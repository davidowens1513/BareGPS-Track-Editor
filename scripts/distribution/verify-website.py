#!/usr/bin/env python3
"""Verify the published tool's downloads against their packaged checksums."""
from pathlib import Path
from html.parser import HTMLParser
import argparse
import hashlib
import json
import urllib.request
import zipfile

parser=argparse.ArgumentParser()
parser.add_argument('site',type=Path)
parser.add_argument('--base-url')
parser.add_argument('--previous',type=Path)
args=parser.parse_args()
site=args.site.resolve()
html=(site/'index.html').read_text()
class Links(HTMLParser):
    def __init__(self):super().__init__();self.hrefs=[]
    def handle_starttag(self,tag,attrs):
        if tag=='a':self.hrefs += [value for key,value in attrs if key=='href']
links=Links();links.feed(html)
if args.previous:
    prior=Links();prior.feed(args.previous.read_text())
    assert set(prior.hrefs)<=set(links.hrefs),'An existing website link was removed or changed.'
assert html.index('id="tools"')>html.index('id="openbaremap"')
assert html.count('Will be available through App Store')==1
assert 'https://github.com/davidowens1513/BareGPS-Track-Editor' in links.hrefs
prefix='tools/baregps-track-editor/0.1.1/'
manifest=json.loads((site/prefix/'manifest.json').read_text())
checks=[]
for name,info in manifest['files'].items():
    path=prefix+name
    url=args.base_url.rstrip('/')+'/'+path if args.base_url else None
    data=urllib.request.urlopen(url,timeout=40).read() if url else (site/path).read_bytes()
    assert hashlib.sha256(data).hexdigest()==info['sha256'],name
    checks.append({'path':path,'bytes':len(data),'sha256':info['sha256']})
for platform in ['ios','android']:
    bundle=next((site/prefix/platform).glob('*.zip'))
    with zipfile.ZipFile(bundle) as archive:
        names=archive.namelist()
        assert archive.testzip() is None
        assert not any(name.endswith(('.mobileprovision','.p12','.p8','.jks','.keystore')) for name in names)
        assert 'instructions.txt' in names
        if platform=='ios':
            assert 'ios/App/App.xcodeproj/project.pbxproj' in names
            assert 'ios/App/App/public/index.html' in names
        else:assert 'BareGPS-Track-Editor-0.1.1.apk' in names
print(json.dumps({'base_url':args.base_url,'existing_links_preserved':bool(args.previous),'tools_after_openbaremap':True,'platform_bundles_valid':True,'downloads':checks},indent=2))
