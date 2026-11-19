'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let checks = 0;
function test(name, cb){ Promise.resolve().then(cb).then(()=>{ checks++;console.log('PASS',name); }).catch(error=>{ console.error('FAIL',name,error);process.exitCode=1; }); }
function segment(start,end){const a=html.indexOf(start), b=html.indexOf(end,a);assert(a>=0&&b>a,`Missing ${start}`);return html.slice(a,b);}
const settingDefinitions=segment('const settings = {','// ============================================================\nconst statusEl');
const wiring=segment('// ---------- UI Wiring ----------',"document.getElementById('calibBtn').addEventListener");
const sliderKeys=['gainX','gainY','gainZ','gainYaw','gainPitch','gainRoll','headSmooth','gainGazeX','gainGazeY','gazeSmooth','gazeDeadzone','smooth','roomDepth','depthTravel'];
const booleanKeys=['useHeadPos','useHeadRot','useEyeGaze','useBodyFallback','showBodyOverlay','showBox','showLandmarks','showGazeArrow','showHeadAxis','freezeObjects','useHeadRoll','flipX','flipYaw','flipPitch','invertZ','showTestArrow','showScreenPlane'];
const modeKeys=['room','window','hybrid','look'];
const inputs={};
for(const id of sliderKeys){
  const m=html.match(new RegExp(`<input type="range" id="${id}" min="([^"]+)" max="([^"]+)" step="([^"]+)" value="([^"]+)"`));
  assert(m,`Slider ${id} not found`);
  inputs[id]={min:+m[1],max:+m[2],step:+m[3],value:+m[4]};
}
class FakeElement {
  constructor(attrs={}){Object.assign(this, attrs);this.listeners={};this.classList={toggle:()=>{}};this.children=[];this.textContent='';this.checked=false;}
  addEventListener(type, cb){(this.listeners[type]??=[]).push(cb);}
  async trigger(type){ for(const cb of this.listeners[type]??[]) await cb({target:this}); }
  click(){return this.trigger('click');}
}
function makeApp(store, options={}){
  const els=new Map();
  const add=(id, attrs={})=>{const e=new FakeElement(attrs);els.set(id,e);return e;};
  for(const id of sliderKeys){add(id,{...inputs[id],type:'range'});add(id+'v');}
  for(const id of booleanKeys)add(id,{type:'checkbox'});
  for(const id of ['panel','panelHeader','configStatus','saveConfigBtn','exportConfigBtn','importConfigBtn','restoreConfigBtn','configImportFile','roomDepthv']){
    if(!els.has(id))add(id);
  }
  const radios=modeKeys.map(value=>new FakeElement({value}));
  const storage={
    getItem(key){if(options.failStorage)throw new Error('storage blocked');return store.get(key)??null;},
    setItem(key,value){if(options.failStorage)throw new Error('storage blocked');store.set(key,value);}
  };
  const window={localStorage:storage,listeners:{},addEventListener(type,cb){(this.listeners[type]??=[]).push(cb);}};
  const ctx={
    console:{log(){},warn(){}},window,
    document:{getElementById(id){return els.get(id)||null;},querySelectorAll(selector){return selector==='input[name="mode"]'?radios:[];}},
    setTimeout,clearTimeout,URL:{createObjectURL:()=> 'blob:demo',revokeObjectURL(){}},Blob,
    headYawHistory:[],headPitchHistory:[],headRollHistory:[],
    visibleFace:false,bodyFallbackActive:false,bodyFallbackBasis:null,faceReturnBlend:null,
    trackingSource:'RETURN_TO_NEUTRAL',referenceReady:false,
    faceSizeForDepth:0.3,calibBaseFaceSize:0.3,rawZ:2.5,targetVirtualTravel:0,
    applyRoomDepth(){},neutralizeViewTargets(){},updateBodyStatus(){},computeRoomTravel(){return 0;}
  };
  vm.createContext(ctx);
  vm.runInContext(settingDefinitions,ctx);
  vm.runInContext(wiring,ctx);
  return {ctx,els,radios,eval:(expr)=>vm.runInContext(expr,ctx)};
}
(async()=>{
function check(name,fn){return Promise.resolve().then(fn).then(()=>{checks++;console.log('PASS',name);});}
const store=new Map();
await check('Defaults loaded and input values match',()=>{
  const app=makeApp(store);
  assert.equal(app.eval('settings.mode'),'room');
  assert.equal(app.eval('settings.roomDepth'),6);
  assert.equal(app.els.get('roomDepthv').textContent,'6.00');
  assert(app.radios[0].checked);
});
await check('Controls autosave checkbox, slider and camera mode',async()=>{
  const app=makeApp(store);
  const flip=app.els.get('flipX'); flip.checked=false; await flip.trigger('change');
  const slider=app.els.get('gainX'); slider.value='3.2';await slider.trigger('input');await slider.trigger('change');
  const radio=app.radios[2];radio.checked=true;await radio.trigger('change');
  assert.equal(app.eval('settings.mode'),'hybrid');
  assert.equal(app.eval('settings.gainX'),3.2);
  const raw=JSON.parse(store.get('headtracking3d.room11.settings.v1'));
  assert.equal(raw.version,1);
  assert.equal(raw.settings.flipX,false);
  assert.equal(raw.settings.gainX,3.2);
  assert.equal(raw.settings.mode,'hybrid');
  assert(!('calibBaseFaceSize' in raw.settings));
});
await check('Browser reload restores mode, checkbox, slider and number readout',()=>{
  const app=makeApp(store);
  assert.equal(app.eval('settings.mode'),'hybrid');
  assert.equal(app.eval('settings.gainX'),3.2);
  assert.equal(app.els.get('gainXv').textContent,'3.20');
  assert.equal(app.els.get('flipX').checked,false);
  assert(app.radios[2].checked && !app.radios[0].checked);
});
await check('Restore defaults immediately resets the UI and persisted values',async()=>{
  const app=makeApp(store);
  await app.els.get('restoreConfigBtn').trigger('click');
  assert.equal(app.eval('settings.mode'),'room');
  assert.equal(app.eval('settings.gainX'),1);
  assert.equal(app.els.get('gainXv').textContent,'1.00');
  assert.equal(app.els.get('flipX').checked,true);
  assert.equal(JSON.parse(store.get('headtracking3d.room11.settings.v1')).settings.mode,'room');
});
await check('Import profile applies controls and saves after import',async()=>{
  const app=makeApp(store);
  const file=app.els.get('configImportFile');
  file.files=[{size:120,text:async()=>JSON.stringify({version:1,settings:{mode:'look',gainPitch:2.05,showBox:false}})}];
  await file.trigger('change');
  assert.equal(app.eval('settings.mode'),'look');
  assert.equal(app.eval('settings.gainPitch'),2.05);
  assert.equal(app.els.get('gainPitchv').textContent,'2.05');
  assert.equal(app.els.get('showBox').checked,false);
  assert.equal(JSON.parse(store.get('headtracking3d.room11.settings.v1')).settings.mode,'look');
});
await check('Invalid JSON and wrong schema are rejected without changing config',async()=>{
  const app=makeApp(store);
  const picker=app.els.get('configImportFile');
  const before=app.eval('settings.mode');
  picker.files=[{size:10,text:async()=>'{no json'}];await picker.trigger('change');
  assert.equal(app.eval('settings.mode'),before);
  picker.files=[{size:100,text:async()=>JSON.stringify({version:999,settings:{mode:'room'}})}];await picker.trigger('change');
  assert.equal(app.eval('settings.mode'),before);
});
await check('Out-of-range numbers and wrong types are sanitized',()=>{
  store.set('headtracking3d.room11.settings.v1',JSON.stringify({version:1,settings:{roomDepth:999,gainX:-123,gainY:'2.0',flipX:1,mode:'bad',__proto__:null}}));
  const app=makeApp(store);
  assert.equal(app.eval('settings.roomDepth'),6);
  assert.equal(app.eval('settings.gainX'),0);
  assert.equal(app.eval('settings.gainY'),1);
  assert.equal(app.eval('settings.flipX'),true);
  assert.equal(app.eval('settings.mode'),'room');
});
await check('Broken browser storage falls back to defaults and does not crash',()=>{
  const app=makeApp(store,{failStorage:true});
  assert.equal(app.eval('settings.mode'),'room');
  assert.equal(app.eval('saveConfiguration()'),false);
  assert(app.els.get('configStatus').textContent.includes('unavailable'));
});
await check('No request or telemetry sends settings off device',()=>{
  assert(!/fetch\(|sendBeacon\(|XMLHttpRequest\(/.test(settingDefinitions));
  assert(html.includes('Restore defaults') && html.includes('Export JSON') && html.includes('Import JSON'));
});
console.log(`\n${checks} configuration persistence tests passed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
