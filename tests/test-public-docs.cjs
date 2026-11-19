'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const readme=read('README.md');
const notes=read('docs/TRACKING-NOTES.md');
const html=read('index.html');
const license=read('LICENSE');
const win=read('start-windows.cmd');
const mac=read('start.command');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS',name)}
test('Public branding omits internal prototype version',()=>{
  for(const text of [readme,notes,html.slice(0,200),win,mac]) {
    const withoutLegacyStorageKey=text.replaceAll('headtracking3d.room11.settings.v1','(compatibility key)');
    assert(!/room\s*11|english edition/i.test(withoutLegacyStorageKey));
  }
  assert(readme.startsWith('# HeadTracking3D — Your Screen Becomes a Window'));
});
test('The source project is linked and attribution is retained',()=>{
  const repo='https://github.com/AralimNGA/head-tracking-3d';
  assert(readme.includes(repo) && notes.includes(repo));
  assert(readme.includes('not an official upstream release'));
  assert.match(license,/Copyright \(c\) 2026 Aralim \(AralimNGA\)/);
});
test('Lee demonstration and screen/window effect are explained accurately',()=>{
  assert(readme.includes('https://www.youtube.com/watch?v=Jd3-eiid-Uw'));
  for(const term of ['head-coupled perspective','motion parallax','physical display boundary','Window','Room']) assert(readme.includes(term),term);
  assert(readme.includes('not as the source code of this project'));
});
test('Enhancements are separated from upstream and stored settings described correctly',()=>{
  for(const term of ['What the upstream project provides','What this extended edition adds or refines','Iris-based gaze','Pose Landmarker Lite','JSON export/import','headtracking3d.room11.settings.v1']) assert((readme+'\n'+notes).includes(term),term);
  assert(!notes.includes('not persisted'));
});
test('Existing users retain saved settings despite new public branding',()=>{
  assert(html.includes("const CONFIG_STORAGE_KEY = 'headtracking3d.room11.settings.v1';"));
  assert(html.includes("link.download = 'headtracking3d-settings.json';"));
});
test('Documentation links resolve locally',()=>{
  for(const doc of ['README.md','docs/TRACKING-NOTES.md']){
    const text=read(doc);
    for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
      const url=match[1];
      if(url.startsWith('https://')||url.startsWith('http://')) continue;
      assert(fs.existsSync(path.resolve(path.dirname(path.join(root,doc)),url)),`${doc}: broken link ${url}`);
    }
  }
});
console.log(`\n${passed} public-doc checks passed`);
