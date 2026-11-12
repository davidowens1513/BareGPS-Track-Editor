from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parents[2]
site=root.parent/'WebsiteRelease'
base='https://appsbyonzy.dev/'
def get(path):
 return subprocess.check_output(['curl','--fail','--silent','--show-error','--location','--max-time','60',base+path])
home=get('').decode(); assert 'Version 0.3.2 · build 74' in home and 'Track Editor support and privacy' in home and '4160e3f94c358006859fdefe0d71a662' in home, 'Home page is stale'
checks=[]
for f in sorted((site/'tools/baregps-track-editor/0.3.2').rglob('*')):
 if f.is_file():
  rel=f.relative_to(site).as_posix();data=get(rel);assert data==f.read_bytes(),rel
  checks.append({'path':rel,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
for f in (root/'web-dist').rglob('*'):
 if f.is_file():
  rel='tools/baregps-track-editor/'+f.relative_to(root/'web-dist').as_posix();assert get(rel)==f.read_bytes(),rel
out={'version':'0.3.2','build':74,'website':base,'home_version_and_policy_links_verified':True,'preview_assets_match':True,'downloads':checks,'unit_tests_passed':116,'cloudflare_result':'Success observed; 209 files uploaded','source_commit':'a588b77','packages_commit':'7e891c0'}
(root/'docs/testing/website-0.3.2-build74-live.json').write_text(json.dumps(out,indent=2)+'\n')
print('Build 74 live homepage, preview and all downloads match packaged bytes')
