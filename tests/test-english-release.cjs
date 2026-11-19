'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');
const readme = read('README.md');
const notes = read('docs/TRACKING-NOTES.md');
const license = read('LICENSE');
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS', name); }

test('The document identifies English and retains the original scene', () => {
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>HeadTracking3D — Your Screen Becomes a Window<\/title>/);
  for (const token of ['const ROOM_W = 7.0;', 'const ROOM_DEPTH = 12.0;', 'new THREE.BoxGeometry(ROOM_W, ROOM_H, ROOM_DEPTH)', 'new THREE.PointLight(', 'new THREE.Fog(']) {
    assert(html.includes(token), `Missing preserved scene element: ${token}`);
  }
  for (const name of ['cube','torus','octa','sphere','cone','icos','protrusionArrow']) {
    assert(new RegExp(`\\bconst\\s+${name}\\s*=`).test(html), `Missing primitive: ${name}`);
  }
});

test('All four modes and original tracking settings remain present', () => {
  for (const mode of ['room','window','hybrid','look']) assert(html.includes(`name="mode" value="${mode}"`));
  for (const id of ['useHeadPos','useHeadRot','useEyeGaze','useBodyFallback','showBodyOverlay','showBox','showLandmarks','showGazeArrow','showHeadAxis','freezeObjects','useHeadRoll','flipX','flipYaw','flipPitch','invertZ','showTestArrow','showScreenPlane','roomDepth','depthTravel','gainX','gainY','gainZ','gainYaw','gainPitch','gainRoll','headSmooth','gainGazeX','gainGazeY','gazeSmooth','gazeDeadzone','smooth']) {
    assert(html.includes(`id="${id}"`), `Missing control: ${id}`);
  }
  for (const state of ['WAITING','RETURN_TO_NEUTRAL','BODY (X/Y)','FACE']) assert(html.includes(state), `Missing English state: ${state}`);
  assert(html.includes('MediaPipe') || html.includes('FaceLandmarker'));
});

test('English UI and live status messages are complete', () => {
  const expected = [
    '⚙ Settings','Tracking sources','Virtual room / monitor','Room depth','Immersion',
    'Show monitor-plane markers','Body fallback when face is lost','Pause object animations',
    'Head smoothing','Gaze dead zone','Body smoothing','Calibrate','● Face detected',
    '○ Tracking lost · returning to neutral','Loading face model (~3 MB)…',
    'Body tracking ready','Pose GPU delegate unavailable; trying CPU:',
    'Error: '
  ];
  for (const label of expected) assert(html.includes(label), `Missing English text: ${label}`);
  assert(!/lang="de"/.test(html));
  assert(!/[\u00e4\u00f6\u00fc\u00c4\u00d6\u00dc\u00df]/.test(html));
});

test('Upstream attribution is visible and license is preserved verbatim', () => {
  for (const doc of [readme, notes]) assert(doc.includes('https://github.com/AralimNGA/head-tracking-3d'));
  assert(license.startsWith('MIT License\n\nCopyright (c) 2026 Aralim (AralimNGA)'));
  assert(license.includes('The above copyright notice and this permission notice shall be included'));
  assert(readme.includes('not an official upstream release'));
});

test('Removed unnecessary historical files and screenshot; retained required files', () => {
  for (const filename of ['index.html','README.md','LICENSE','.gitignore','start.command','start-windows.cmd','docs/TRACKING-NOTES.md','tests/test-body-fallback-11.cjs']) {
    assert(fs.statSync(path.join(root, filename)).isFile(), `Missing release file: ${filename}`);
  }
  assert(!fs.existsSync(path.join(root,'screenshots')));
  assert(!fs.readdirSync(root).some(name => /-DE\.(?:md|txt)$/.test(name)));
  assert(!fs.existsSync(path.join(root,'tests/test-body-fallback.cjs')));
});

test('Launchers use local loopback only and English instructions', () => {
  for (const filename of ['start.command','start-windows.cmd']) {
    const script = read(filename);
    assert(script.includes('127.0.0.1'));
    assert(script.includes('8765'));
    assert(!/Python ist|Beenden mit|nicht installiert/.test(script));
    assert(script.includes('--bind 127.0.0.1'));
  }
});

console.log(`\n${count} release checks passed`);
