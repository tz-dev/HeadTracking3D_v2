'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const coreStart=html.indexOf('// ===== BODY_FALLBACK_CORE_START =====');
const coreEnd=html.indexOf('// ===== BODY_FALLBACK_CORE_END =====');
const motionStart=html.indexOf('// ---------- Source-aware, speed-limited camera travel ----------');
const motionEnd=html.indexOf('// ---------- Main loop ----------',motionStart);
assert(coreStart>=0&&coreEnd>coreStart&&motionStart>=0&&motionEnd>motionStart);
const bodyCode=html.slice(coreStart,coreEnd);
const motionCode=html.slice(motionStart,motionEnd);
const inferenceCode=html.slice(html.indexOf('async function initBodyLandmarker()'),html.indexOf('// ---------- Stabilized eye direction ----------'));
const ctx={
 console,
 Math,Number,Array,
 document:{getElementById(){return {textContent:''};}},
 settings:{mode:'room',useBodyFallback:true,useHeadPos:true,showBodyOverlay:true,flipX:true,
           invertZ:true,gainX:1,gainY:1,gainZ:.75,depthTravel:.15,smooth:.2},
 THREE:{MathUtils:{clamp:(v,min,max)=>Math.min(max,Math.max(min,v))}},
 video:{readyState:2}, performance:{now:()=>0},
 referenceReady:true,calibBaseFaceSize:.24,BASE_DISTANCE:2.5,
 rawX:.2,rawY:-.1,rawZ:2.6,rawYaw:.45,rawPitch:.4,rawRoll:-.2,
 rawGazeX:.32,rawGazeY:-.13,
 headYaw:0.45,headPitch:.4,headRoll:-.2,gazeX:.32,gazeY:-.13,
 headX:.2,headY:-.1,headZ:2.6,virtualTravel:.8,
 headYawHistory:[.4],headPitchHistory:[.2],headRollHistory:[-.2],
 eyeHistoryX:[.4],eyeHistoryY:[.2],
 targetVirtualTravel:.8,lastFaceSize:.24,faceSizeForDepth:.24,
 lastLandmarks:[1],lastBox:{w:.2},visibleFace:true,faceReturnBlend:null,
 statusEl:{innerHTML:''},overlay:{width:640,height:480},
 octx:{save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){}},
 computeRoomTravel:(_,__,___,z)=>(2.5-z)*.2,
};
vm.createContext(ctx);
vm.runInContext(bodyCode+'\n'+inferenceCode+'\n'+motionCode,ctx);
const get=(code)=>vm.runInContext(code,ctx);
const set=(code)=>vm.runInContext(code,ctx);
let passed=0;
function test(title,fn){fn();passed++;console.log(`PASS ${title}`);}
const p=(x,y,visibility=1)=>({x,y,z:0,visibility});
function sample(cx=.6,cy=.5,width=.28,height=.2,ts=1000){
 const pts=Array.from({length:33},()=>p(.5,.5,0));
 pts[11]=p(cx-width/2,cy);pts[12]=p(cx+width/2,cy);
 pts[23]=p(cx-width/2,cy+height);pts[24]=p(cx+width/2,cy+height);
 return get('bodyAnchorFromPose')(pts,ts);
}
function nearly(a,b,epsilon=1e-7){assert(Math.abs(a-b)<epsilon,`${a} != ${b}`)}
test('Same-body shoulder / torso landmarks are measured',()=>{
 const v=sample();nearly(v.x,.6);nearly(v.width,.28);nearly(v.height,.2);
});
test('Invalid shoulders cannot create body anchor',()=>{
 const pts=Array.from({length:33},()=>p(.5,.5,0));pts[11]=p(.4,.5);pts[12]=p(.6,.5,.1);
 assert.equal(get('bodyAnchorFromPose')(pts,1000),null);
});
test('Body-to-face matching bridges a single observer',()=>{
 get('captureBodyBridge')(sample(),{x:.55,y:.18,w:.2,h:.24});
 nearly(get('bodyBridge.face.x'),.65);
});
test('First body handover retains face XYZ despite 3.5 gain',()=>{
 set('trackingSource="FACE";');
 const first=sample(.6,.5,.28,.2,1000);
 assert(get('applyFallbackPose')(first,1000));
 nearly(ctx.rawX,.2);nearly(ctx.rawY,-.1);nearly(ctx.rawZ,2.6);
 assert.equal(get('BODY_XYZ_GAIN'),3.5);
});
test('Body movement delta is 3.5 times normal XYZ sensitivity',()=>{
 const changed=sample(.7,.55,.25,.18,1100);
 assert(get('applyFallbackPose')(changed,1100));
 assert(Math.abs(ctx.rawX-.2)>.3,`x movement ${ctx.rawX}`);
 assert(Math.abs(ctx.rawY+.1)>.1,`y movement ${ctx.rawY}`);
 assert(Math.abs(ctx.rawZ-2.6)>.01,`z movement ${ctx.rawZ}`);
});
test('Body mode neutralizes head rotation and eye gaze without snapping current angles',()=>{
 assert.equal(ctx.rawYaw,0);assert.equal(ctx.rawPitch,0);assert.equal(ctx.rawRoll,0);
 assert.equal(ctx.rawGazeX,0);assert.equal(ctx.rawGazeY,0);
 assert.equal(ctx.headYaw,.45);assert.equal(ctx.gazeX,.32);
});
test('Camera speed is limited even for 2m+ teleport tracking updates',()=>{
 const step=get('approachCameraPosition')({x:-3,y:-2,z:6},{x:4,y:5,z:.6},1/60,'BODY',.2);
 const distance=Math.hypot(step.x+3,step.y+2,step.z-6);
 assert(distance>0&&distance<=2.8/60+1e-9,`teleport step=${distance}`);
});
test('Camera transition is monotonic and converges over many frames',()=>{
 let v={x:-3,y:-2,z:6};const goal={x:3,y:2,z:2};let prev=Infinity;
 for(let i=0;i<600;i++){
  v=get('approachCameraPosition')(v,goal,1/60,'BODY',.2);
  const dist=Math.hypot(v.x-goal.x,v.y-goal.y,v.z-goal.z);
  assert(dist<=prev+1e-9);prev=dist;
 }
 assert(prev<1e-4,`distance=${prev}`);
});
test('World immersion offset follows a rate-limited trajectory',()=>{
 const f=get('approachScalar');
 const step=f(-1,1.55,1/60,.32,1.7);
 assert(step>-1 && step+1<=1.7/60+1e-9);
});
test('No face and no body targets neutral XYZ, angles, gaze and immersion',()=>{
 set('bodySample=null;bodyEvidenceAt=-Infinity;');
 get('handleMissingFace')(3000);
 for(const key of ['rawX','rawY','rawYaw','rawPitch','rawRoll','rawGazeX','rawGazeY','targetVirtualTravel']) assert.equal(ctx[key],0,key);
 assert.equal(ctx.rawZ,2.5);
 assert.equal(get('trackingSource'),'RETURN_TO_NEUTRAL');
 assert.equal(ctx.headX,.2);assert.equal(ctx.headZ,2.6);assert.equal(ctx.virtualTravel,.8);
});
test('Neutral flight does not teleport the camera home in one frame',()=>{
 const next=get('approachCameraPosition')({x:2,y:1,z:6},{x:0,y:0,z:2.5},1/60,'RETURN_TO_NEUTRAL',.2);
 const length=Math.hypot(next.x-2,next.y-1,next.z-6);
 assert(length>0&&length<=2/60+1e-9);
});
test('A pose-only startup uses camera-relative absolute body location',()=>{
 set('bodyFallbackBasis=null;bodyBridge=null;trackingSource="RETURN_TO_NEUTRAL";');
 const b=sample(.7,.5,.25,.2,4000);
 assert(get('applyFallbackPose')(b,4000));
 assert(ctx.rawX < -1.2,`rawX=${ctx.rawX}`);
 assert.equal(get('trackingSource'),'BODY (X/Y)');
});
test('Uncalibrated body depth is not fabricated',()=>{
 assert.equal(get('bodyEstimatedZ')(null),null);
});
test('Fallback disabled / stale sample does not overwrite camera target',()=>{
 const old=ctx.rawX;
 ctx.settings.useBodyFallback=false;
 assert.equal(get('applyFallbackPose')(sample(.5,.5,.2,.2,5000),5000),false);
 ctx.settings.useBodyFallback=true;
 assert.equal(get('applyFallbackPose')(sample(.5,.5,.2,.2,1000),4000),false);
 assert.equal(ctx.rawX,old);
});
test('Fast relocation is accepted only after a second consistent pose',()=>{
 set('previousAcceptedBody=bodyAnchorFromPose(Array.from({length:33},(_,i)=>({x:i===11?.2:i===12?.4:.3,y:.5,z:0,visibility:i===11||i===12?1:0})),7000);');
 // Setup directly; the inference function uses a mocked pose model.
 set('previousAcceptedBody={x:.30,y:.5,width:.2,height:.2,timestamp:7000};pendingBodyRelocation=null;bodySample=null;lastPoseAttempt=-Infinity;bodyInferenceMs=0;visibleFace=false;');
 const s=sample(.88,.5,.2,.2,7100);
 const pts=s.points;
 ctx.fakePoseLandmarker={detectForVideo:()=>({landmarks:[pts]})};
 set('poseLandmarker=fakePoseLandmarker;');
 get('updateBodyInference')(7100);
 assert.equal(get('bodySample'),null);
 get('updateBodyInference')(7200);
 assert(get('bodySample') && Math.abs(get('bodySample.x')-.88)<1e-7);
});
test('Partial lost frame during relocation preserves the prior body anchor',()=>{
 set('bodyFallbackBasis={pos:{x:0,y:0},estimatedZ:2.5,x:0,y:0,z:2.5};bodyEvidenceAt=7100;bodySample=null;');
 get('handleMissingFace')(7250);
 assert(get('bodyFallbackBasis')!==null);
 get('handleMissingFace')(8500);
 assert.equal(get('bodyFallbackBasis'),null);
});
test('Previous approved default values remain unchanged',()=>{
 const expected={roomDepth:6,depthTravel:.15,gainX:1,gainY:1,gainZ:.75,gainYaw:1,gainPitch:1.15,headSmooth:.8,gainRoll:1,gainGazeX:.4,gainGazeY:.4,gazeSmooth:.68,gazeDeadzone:.25,smooth:.2};
 for(const [id,v] of Object.entries(expected)){
  const m=html.match(new RegExp(`<input type="range" id="${id}"[^>]*value="([^"]+)"`));
  assert(m,id);nearly(Number(m[1]),v);
 }
 for(const id of ['flipX','flipYaw','flipPitch','invertZ','useHeadRoll'])assert(html.includes(`id="${id}" checked`),id);
});
test('Other camera modes remain available',()=>{
 for(const value of ['window','hybrid','look'])assert(html.includes(`name="mode" value="${value}"`));
});
console.log(`\n${passed} tests passed`);
