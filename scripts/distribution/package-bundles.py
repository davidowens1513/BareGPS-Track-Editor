#!/usr/bin/env python3
"""Build public platform downloads without signing identities or local settings."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parents[2]
version = json.loads((root / 'package.json').read_text())['version']
parser=argparse.ArgumentParser()
parser.add_argument('output',nargs='?',type=Path,default=root/'releases'/'bundles'/version)
parser.add_argument('--apk',type=Path,default=root/'android/app/build/outputs/apk/release/app-release.apk')
parser.add_argument('--platform',choices=['both','android','ios'],default='both')
args=parser.parse_args()
output=args.output.resolve()
filename_prefix='BareGPS-Track-Editor'
output.mkdir(parents=True,exist_ok=True)
commit = subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
apk=args.apk.resolve()
assert apk.is_file(), 'Build and validate the signed Android release APK first.'
sdk = Path(os.environ.get('ANDROID_HOME', Path.home() / 'Library/Android/sdk'))
build_tools = sorted((sdk / 'build-tools').glob('*'), key=lambda path: tuple(int(part) for part in path.name.split('.') if part.isdigit()))
assert build_tools, 'Android build tools are required to verify the public APK.'
tools = build_tools[-1]
certificate = subprocess.check_output([str(tools / 'apksigner'), 'verify', '--verbose', '--print-certs', str(apk)], text=True)
assert 'CN=Android Debug' not in certificate, 'Refusing to package a debug-signed APK.'
expected_certificate = (root/'docs/distribution/android-release-certificate.sha256').read_text().strip()
assert re.search(r'certificate SHA-256 digest: ([0-9a-f]+)',certificate)[1] == expected_certificate, 'APK is not signed by the permanent Track Editor release identity.'
badging = subprocess.check_output([str(tools / 'aapt'), 'dump', 'badging', str(apk)], text=True)
assert 'application-debuggable' not in badging, 'Refusing to package a debuggable APK.'
assert "package: name='com.baregps.trackeditor'" in badging, 'Unexpected Android application identity.'
metadata=apk.parent/'output-metadata.json'
if metadata.is_file():
    assert all(item['versionName']==version for item in json.loads(metadata.read_text())['elements']), 'APK version does not match package.json.'
assert (root/'dist/index.html').is_file(), 'Run npm run native:sync first.'
excluded = {'node_modules','build','Pods','DerivedData','xcuserdata','.git','.idea','outputs'}
secret_suffixes={'.p12','.p8','.mobileprovision','.jks','.keystore','.xcuserstate'}

def allowed(path):
    return not any(part in excluded for part in path.parts) and path.suffix not in secret_suffixes and path.name!='local.properties' and not path.name.startswith('.env') and path.name != 'config 2.xml'

def add_tree(archive,directory):
    for path in sorted(directory.rglob('*')):
        if path.is_file() and allowed(path.relative_to(root)):
            archive.write(path,path.relative_to(root).as_posix())

for platform in (['ios','android'] if args.platform=='both' else [args.platform]):
    directory=output/platform
    directory.mkdir(parents=True,exist_ok=True)
    guide=root/'docs'/'distribution'/f'{platform}-instructions.txt'
    shutil.copy(guide,directory/'instructions.txt')
    bundle=directory/f'{filename_prefix}-{platform}-Bundle-{version}.zip'
    with zipfile.ZipFile(bundle,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        archive.write(guide,'instructions.txt')
        archive.writestr('BUILD-INFO.json',json.dumps({'app':'BareGPS Track Editor','version':version,'platform':platform,'app_source_commit':commit},indent=2)+'\n')
        if platform=='android':
            filename=f'{filename_prefix}-{version}.apk'
            shutil.copy(apk,directory/filename)
            archive.write(apk,filename)
            archive.writestr('SHA256SUMS.txt',hashlib.sha256(apk.read_bytes()).hexdigest()+'  '+filename+'\n')
        else:
            for name in ['src','public','dist','ios']:
                add_tree(archive,root/name)
            for name in ['package.json','package-lock.json','tsconfig.json','vite.config.ts','capacitor.config.ts','index.html','.gitignore','.gitattributes','scripts/distribution/normalize-ios-package.mjs']:
                archive.write(root/name,name)
    with zipfile.ZipFile(bundle) as archive:
        assert archive.testzip() is None
        assert not any(Path(name).suffix in secret_suffixes for name in archive.namelist())
    assert bundle.stat().st_size<25*1024*1024, 'File exceeds Cloudflare Pages asset limit.'
    print(f'{platform}: {bundle.name} ({bundle.stat().st_size:,} bytes)')

manifest={}
for path in sorted(output.rglob('*')):
    if path.is_file() and path.name not in {'manifest.json','SHA256SUMS.txt'}:
        manifest[path.relative_to(output).as_posix()]={'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
(output/'manifest.json').write_text(json.dumps({'version':version,'app_source_commit':commit,'android':{'build':int(re.search(r"versionCode='(\d+)'",badging)[1]),'release_signed':True,'debuggable':False,'signing_certificate_sha256':re.search(r'certificate SHA-256 digest: ([0-9a-f]+)',certificate)[1]},'files':manifest},indent=2)+'\n')
(output/'SHA256SUMS.txt').write_text(''.join(info['sha256']+'  '+name+'\n' for name,info in manifest.items()))
