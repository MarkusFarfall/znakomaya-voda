import { waterBedAt } from "../src/game/aquatory";
import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, migrateSave, newSave, type Phase } from '../src/game/engine';
import { LocalNavigation, normalizeLocalPosition, NAV_LEFT, NAV_RIGHT, SPOT_WORLD_WIDTH, horizontalView, worldNX } from '../src/game/navigation';
import { BOATS, spotsOf } from '../src/game/world';
import { sanitizeSave } from '../src/lib/sanitize';
import { projectFightFish } from '../src/game/render/fishingGeometry';
import { FISH } from '../src/game/fish';
import { LocalWake } from '../src/game/render/localWake';
const nav = (x = .3, heading: 1 | -1 = 1) => new LocalNavigation({ spot: 'bay_shallows', x, heading });
function tick(n: LocalNavigation, seconds: number, fps = 60, boat = BOATS[0]) { for (let i = 0; i < seconds * fps; i++) n.step(1 / fps, boat); }
function engine() { const e = new Engine(); e.s.atPort = false; e.paused = false; return e; }

test('departure accelerates, arrival brakes without overshoot for every hull', () => {
  for (const boat of BOATS) {
    const n = nav(); n.go(.38); n.step(1 / 60, boat);
    assert.ok(n.velocity > 0 && n.velocity < 1);
    let peak = 0, maxX = 0;
    for (let i = 0; i < 60 * 30; i++) { n.step(1 / 60, boat); peak = Math.max(peak, n.velocity); maxX = Math.max(maxX, n.x); }
    assert.ok(peak > 10, boat.id); assert.ok(maxX <= .38 * SPOT_WORLD_WIDTH + .001, boat.id);
    assert.equal(n.nx, .38); assert.equal(n.velocity, 0); assert.equal(n.moving, false);
  }
});
test('30/60/120 Hz produce matching physical trajectories', () => {
  const states = [30, 60, 120].map(fps => { const n = nav(); n.go(.9); tick(n, 8, fps); return n; });
  for (const n of states) { assert.ok(Math.abs(n.x - states[0].x) < .01); assert.ok(Math.abs(n.velocity - states[0].velocity) < .01); }
});
test('stop preserves momentum then settles, without teleporting', () => {
  const n = nav(); n.go(.9); tick(n, 5); const x = n.x; n.stop();
  assert.equal(n.x, x); assert.equal(n.state, 'braking'); n.step(1 / 60, BOATS[0]);
  assert.ok(n.x > x); assert.ok(n.velocity > 0); tick(n, 5); assert.equal(n.velocity, 0); assert.equal(n.target, null); assert.equal(n.moving, false);
});
test('retargeting behind brakes before turning; turning has finite duration', () => {
  const n = nav(); n.go(.9); tick(n, 5); n.go(.1); n.step(1 / 60, BOATS[0]);
  assert.equal(n.heading, 1); assert.ok(n.velocity > 0);
  while (n.heading === 1) n.step(1 / 60, BOATS[0]);
  assert.ok(Math.abs(n.velocity) < .5); assert.ok(n.turning); assert.ok(n.yaw < Math.PI);
  tick(n, 1); assert.equal(n.heading, -1); assert.equal(n.turning, false); assert.ok(n.velocity < 0);
  tick(n, 100); assert.equal(n.nx, NAV_LEFT); assert.equal(n.moving, false);
});
test('boundaries clamp targets and vessels even on a hard near-edge stop', () => {
  for (const [start, dest] of [[.899, 20], [.101, -5]]) {
    const n = nav(start); n.go(dest); tick(n, 15);
    assert.ok(n.nx >= NAV_LEFT && n.nx <= NAV_RIGHT); assert.equal(n.moving, false);
  }
  const n = nav(.8999); n.velocity = 100; n.stop(); tick(n, 5); assert.equal(n.nx, NAV_RIGHT); assert.equal(n.velocity, 0);
});
test('invalid destination/time and background-frame spikes cannot teleport the boat', () => {
  const n = nav(); for (const x of [NaN, Infinity, -Infinity]) assert.equal(n.go(x), false);
  n.go(.9); const x = n.x; for (const dt of [NaN, Infinity, -1, 0]) n.step(dt, BOATS[0]); assert.equal(n.x, x);
  n.step(120, BOATS[0]); assert.ok(n.x - x < .2);
});
test('waves reduce achievable travel speed, with no idle drift', () => {
  const calm = nav(), rough = nav(); calm.go(.9); rough.go(.9);
  for (let i = 0; i < 600; i++) { calm.step(1 / 60, BOATS[0], .4); rough.step(1 / 60, BOATS[0], 3); }
  assert.ok(calm.x > rough.x); const idle = nav(); tick(idle, 20); assert.equal(idle.nx, .3);
});
test('all deployed-tackle phases reject navigation, never retrieve automatically', () => {
  for (const phase of ['charging','casting','sinking','waiting','bite','fight','caught'] as Phase[]) {
    const e = engine(); e.phase = phase; e.hookDepth = 7;
    assert.equal(e.setNavigationMode(true), false); e.navigationMode = true;
    assert.equal(e.navigateTo(.8), false); assert.equal(e.phase, phase); assert.equal(e.hookDepth, 7);
  }
});
test('navigation and braking both block casting; fishing requires an explicit mode switch', () => {
  const e = engine(); assert.equal(e.navigateTo(.7), false); assert.equal(e.setNavigationMode(true), true);
  e.pointerDown(); assert.equal(e.phase, 'idle'); e.navigateTo(.7); for (let i = 0; i < 180; i++) e.update(1 / 60);
  assert.equal(e.setNavigationMode(false), false); assert.ok(e.tripBlock({kind:'port', port:'home'}, 'sail'));
  assert.equal(e.moveSpot(spotsOf('bay')[1].id), false);
  e.stopNavigation(); e.pointerDown(); assert.equal(e.phase, 'idle');
  for (let i = 0; i < 300; i++) e.update(1 / 60);
  assert.equal(e.setNavigationMode(false), true); e.pointerDown(); assert.equal(e.phase, 'charging');
});
test('pause, port and save replacement never let an old route move the vessel', () => {
  const e = engine(); e.setNavigationMode(true); e.navigateTo(.8); e.update(.1); const x = e.navigation.x;
  e.paused = true; e.update(3); assert.equal(e.navigation.x, x); assert.equal(e.navigateTo(.7), false);
  e.s = { ...newSave(), localPosition: { spot: newSave().spot, x: .65, heading: -1 } };
  assert.equal(e.navigation.nx, .65 / 3); assert.equal(e.navigation.velocity, 0); assert.equal(e.navigation.target, null); assert.equal(e.navigationMode, false);
  e.s.atPort = true; assert.equal(e.setNavigationMode(true), false);
});
test('position checkpoints persist while travelling, but velocity/route do not', () => {
  const e = engine(); e.setNavigationMode(true); e.navigateTo(.8); for (let i = 0; i < 150; i++) e.update(1 / 60);
  assert.equal(e.s.waterPosition!.x, e.navigation.nx); assert.ok(e.dirty);
  const restored = new Engine(migrateSave(JSON.parse(JSON.stringify(e.s)))!);
  assert.equal(restored.navigation.nx, e.navigation.nx); assert.equal(restored.navigation.moving, false); assert.equal(restored.navigationMode, false);
});
test('client/server position migration rejects foreign spots and non-finite values', () => {
  const s = newSave();
  for (const v of [null, {}, {spot:s.spot,x:NaN}, {spot:'foreign',x:.8}, {spot:s.spot,x:'0.8'}]) {
    assert.equal(normalizeLocalPosition(v, s.spot).x, .3);
    assert.equal(migrateSave({...s,localPosition:v})!.localPosition!.x, .3);
    assert.equal((sanitizeSave({...s,localPosition:v}).data as unknown as typeof s).localPosition!.x, .3);
  }
  assert.equal(normalizeLocalPosition({spot:s.spot,x:4,heading:-1},s.spot).x,NAV_RIGHT);
  assert.equal(normalizeLocalPosition({spot:s.spot,x:-4,heading:8},s.spot).heading,1);
});
test('legacy moveSpot queues a physical route without resetting position', () => {
  const e = engine(), x=e.navigation.x, spot=e.s.spot;
  assert.equal(e.moveSpot(spotsOf('bay')[1].id), true); assert.equal(e.navigation.x,x); assert.equal(e.s.spot,spot); assert.ok(e.navigation.target!>2400);
});
test('screen-to-world mapping is invertible at every viewport and zoom, without shrinking terrain', () => {
  for (const width of [320,390,844,1440,3400]) for (const zoom of [1,1.5,2]) for (const nx of [.1,.5,.9]) {
    const z = Math.max(width / SPOT_WORLD_WIDTH,zoom), view = horizontalView(SPOT_WORLD_WIDTH,width,z,nx*SPOT_WORLD_WIDTH);
    assert.ok(view.x >= 0 && view.x + view.width <= SPOT_WORLD_WIDTH + .0001);
    const sx = (nx * SPOT_WORLD_WIDTH - view.x) * z;
    assert.ok(Math.abs(worldNX(sx,view.x,z)-nx)<1e-8);
  }
  assert.equal(horizontalView(SPOT_WORLD_WIDTH,320,1,1200).width,320);
});
test('casts and canonical bed depth follow position and facing, not viewport size', () => {
  const e = engine(); const right = e.castNX(1); e.navigation.heading=-1; const left=e.castNX(1);
  assert.ok(left<e.navigation.nx && right>e.navigation.nx); assert.ok(Math.abs(right+left-e.navigation.nx*2)<1e-9);
  e.navigation.x = 1800; assert.equal(e.bedAt(e.castNX()), waterBedAt(e.s.location,e.castNX()*e.navigation.worldWidth));
});
test('left-facing fight projection reels to the left rod anchor; mouth remains attached', () => {
  const e=engine(); e.phase='bite'; e.pendingFish={fish:FISH[0],weight:1,variant:null}; e.pointerDown(); const h=e.hooked!;
  h.line=0; h.sway=0;
  const pose=projectFightFish(h,{boatX:1000,castX:700,scale:1,waveY:()=>200,depthPx:d=>d*10});
  assert.equal(pose.x,940); assert.ok(Number.isFinite(pose.mouth[0])); assert.ok(Number.isFinite(pose.mouth[1]));
});
test('wake impulses remain in world coordinates after turning and fully decay', () => {
  const e=engine(),wake=new LocalWake(); e.navigation.velocity=34;
  const f={e,dt:.1,sc:1}; for(let i=0;i<8;i++)wake.update(f);
  const sample=Array.from({length:500},(_,i)=>wake.heightAt(450+i)); assert.ok(sample.some(x=>Math.abs(x)>.001));
  e.navigation.heading=-1; e.navigation.velocity=0;
  const unchanged=Array.from({length:500},(_,i)=>wake.heightAt(450+i)); assert.deepEqual(unchanged,sample);
  for(let i=0;i<60;i++)wake.update(f);
  assert.ok(Array.from({length:500},(_,i)=>wake.heightAt(450+i)).every(x=>x===0));
});
