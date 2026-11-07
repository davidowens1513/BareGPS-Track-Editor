#!/usr/bin/env python3
"""Build public platform downloads without signing identities or local settings."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parents[2]
version = json.loads((root / 'package.json').read_text())['version']
parser=argparse.ArgumentParser()
parser.add_argument('output',nargs='?',type=Path,default=root/'releases'/'bundles'/version)
parser.add_argument('--apk',type=Path,default=root/'android/app/build/outputs/apk/debug/app-debug.apk')
args=parser.parse_args()
output=args.output.resolve()
filename_prefix='BareGPS-Track-Creator-and-Editor'
output.mkdir(parents=True,exist_ok=True)
commit = subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
apk=args.apk.resolve()
assert apk.is_file(), 'Build and validate the Android APK first.'
metadata=apk.parent/'output-metadata.json'
if metadata.is_file():
    assert all(item['versionName']==version for item in json.loads(metadata.read_text())['elements']), 'APK version does not match package.json.'
assert (root/'dist/index.html').is_file(), 'Run npm run native:sync first.'
excluded = {'node_modules','build','Pods','DerivedData','xcuserdata','.git','outputs'}
secret_suffixes={'.p12','.p8','.mobileprovision','.jks','.keystore','.xcuserstate'}

def allowed(path):
    return not any(part in excluded for part in path.parts) and path.suffix not in secret_suffixes and path.name!='local.properties' and not path.name.startswith('.env')

def add_tree(archive,directory):
    for path in sorted(directory.rglob('*')):
        if path.is_file() and allowed(path.relative_to(root)):
            archive.write(path,path.relative_to(root).as_posix())

for platform in ['ios','android']:
    directory=output/platform
    directory.mkdir(parents=True,exist_ok=True)
    guide=root/'docs'/'distribution'/f'{platform}-instructions.txt'
    shutil.copy(guide,directory/'instructions.txt')
    bundle=directory/f'{filename_prefix}-{platform}-Bundle-{version}.zip'
    with zipfile.ZipFile(bundle,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        archive.write(guide,'instructions.txt')
        archive.writestr('BUILD-INFO.json',json.dumps({'app':'BareGPS Track Creator and Editor','version':version,'platform':platform,'app_source_commit':commit},indent=2)+'\n')
        if platform=='android':
            filename=f'{filename_prefix}-{version}.apk'
            shutil.copy(apk,directory/filename)
            archive.write(apk,filename)
            archive.writestr('SHA256SUMS.txt',hashlib.sha256(apk.read_bytes()).hexdigest()+'  '+filename+'\n')
        else:
            for name in ['src','public','dist','ios']:
                add_tree(archive,root/name)
            for name in ['package.json','package-lock.json','tsconfig.json','vite.config.ts','capacitor.config.ts','index.html','.gitignore','.gitattributes']:
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
(output/'manifest.json').write_text(json.dumps({'version':version,'app_source_commit':commit,'files':manifest},indent=2)+'\n')
(output/'SHA256SUMS.txt').write_text(''.join(info['sha256']+'  '+name+'\n' for name,info in manifest.items()))
