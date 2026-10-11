/** Промысловые и научные суда: сейнер «Старик», траулер «Полярник», НИС «Глубинник» */
import * as THREE from 'three';
import { clamp } from './util3';
import type { VesselSpec } from './hull3';
import {
  Builder,
  Person,
  V3,
  anchorShape,
  ball,
  box,
  bulwark,
  caps,
  cleat,
  cyl,
  deckPatch,
  fender,
  funnel,
  gunwale,
  lifebuoy,
  loftHull,
  makeFlag,
  mesh,
  placeStrut,
  railing,
  ropeCoil,
  sh,
  slice,
  std,
  strut,
  swing,
  texSteel,
  tireFender,
  torus,
  wet,
  wheelhouse,
  winch,
  type VesselModel,
} from './kit';

const dark = () => std('#1a1b1e', { roughness: 0.7 });

/** Тросовая башня радара с вращающейся антенной; возвращает группу для вращения */
function radarMast(b: Builder, s: number, y: number, h: number, mat: THREE.Material) {
  b.add(cyl(0.06, 0.09, h, mat, s, y + h / 2, 0, 10));
  const g = new THREE.Group();
  g.position.set(s, y + h - 0.3, 0);
  g.add(cyl(0.05, 0.05, 0.2, dark(), 0, 0, 0, 8));
  g.add(box(1.1, 0.07, 0.13, std('#d8dcde', { roughness: 0.5 }), 0, 0.14, 0, 0.02));
  b.add(g);
  b.add(cyl(0.012, 0.012, 1.3, dark(), s + 0.2, y + h + 0.3, 0.15, 5));
  b.add(cyl(0.012, 0.012, 1.0, dark(), s - 0.2, y + h + 0.1, -0.15, 5));
  b.lamp(b.hull, s, y + h + 0.05, 0, 0xffffff, 1.0, 'nav', 0.055);
  b.height(y + h + 1.1);
  return g;
}

/** Фальшборт с шпигатами, привальный брус и кранцы-покрышки */
function steelBulwark(b: Builder, gunPort: V3[], gunStb: V3[], h: number, mat: THREE.Material, belt: THREE.Material, s0: number, s1: number) {
  bulwark(b, gunPort, h, mat, 0.07, s0, s1);
  bulwark(b, gunStb, h, mat, 0.07, s0, s1);
  gunwale(b, gunPort, 0.04, belt, -0.4);
  gunwale(b, gunStb, 0.04, belt, -0.4);
  const port = std('#101114', { roughness: 0.9 });
  for (let s = s0 + 1.2; s < s1 - 1.6; s += 1.7) {
    for (const side of [-1, 1]) b.add(box(0.5, 0.14, 0.02, port, s, b.D(s) + 0.14, side * (b.bd(s) + 0.012)));
  }
  const tires: THREE.Object3D[] = [];
  for (let s = s0 + 2.0; s < s1 - 2.5; s += 2.6) {
    for (const side of [-1, 1]) {
      const t = tireFender();
      t.position.set(s, b.D(s) + h * 0.55, side * (b.bd(s) + 0.05));
      b.add(t);
      tires.push(t);
    }
  }
  return tires;
}

function netDrum(b: Builder, s: number, r: number, w: number, y: number, net = '#2f6a3a') {
  const steel = std('#5a5f66', { roughness: 0.45, metalness: 0.7 });
  const g = new THREE.Group();
  g.position.set(s, y, 0);
  const core = cyl(r * 0.45, r * 0.45, w, steel, 0, 0, 0, 20);
  core.rotation.x = Math.PI / 2;
  g.add(core);
  const roll = cyl(r * 0.92, r * 0.92, w * 0.82, std(net, { roughness: 1 }), 0, 0, 0, 24);
  roll.rotation.x = Math.PI / 2;
  g.add(roll);
  for (const z of [-w / 2, w / 2]) {
    const f = cyl(r, r, 0.06, steel, 0, 0, z, 24);
    f.rotation.x = Math.PI / 2;
    g.add(f);
  }
  b.add(g);
  for (const z of [-w / 2 - 0.08, w / 2 + 0.08]) b.add(box(0.5, y - b.D(s) + 0.1, 0.1, steel, s, (y + b.D(s)) / 2 - 0.05, z, 0.02));
  b.height(y + r);
  return g;
}

/** А-рама на корме: возвращает группу блока (подвешена на маятнике) */
function aFrame(b: Builder, s: number, spread: number, h: number, lean: number, mat: THREE.Material, blockColor = '#303438') {
  const dd = b.D(s);
  for (const z of [-spread, spread]) b.add(strut(new V3(s, dd, z), new V3(s + lean, dd + h, z * 0.55), 0.1, mat, 8));
  b.add(strut(new V3(s + lean, dd + h, -spread * 0.6), new V3(s + lean, dd + h, spread * 0.6), 0.12, mat, 8));
  b.add(strut(new V3(s + lean * 0.35, dd + h * 0.4, -spread * 0.78), new V3(s + lean * 0.35, dd + h * 0.4, spread * 0.78), 0.07, mat, 6));
  const blockG = new THREE.Group();
  blockG.position.set(s + lean, dd + h - 0.1, 0);
  blockG.add(cyl(0.012, 0.012, 1.4, dark(), 0, -0.7, 0, 5));
  blockG.add(box(0.2, 0.34, 0.14, std(blockColor, { roughness: 0.5 }), 0, -1.5, 0, 0.03));
  blockG.add(torus(0.08, 0.018, std('#c8c8c8', { metalness: 0.9, roughness: 0.3 }), 0, -1.75, 0));
  b.add(blockG);
  b.height(dd + h + 0.2);
  return blockG;
}

function pedestalCrane(b: Builder, s: number, z: number, h: number, boomLen: number, mat: THREE.Material) {
  const dd = b.D(s);
  b.add(cyl(0.22, 0.28, h, mat, s, dd + h / 2, z, 12));
  const arm = new THREE.Group();
  arm.position.set(s, dd + h, z);
  arm.add(box(0.5, 0.35, 0.45, mat, 0, 0.05, 0, 0.05));
  const boom = cyl(0.09, 0.07, 1, mat, 0, 0, 0, 8);
  arm.add(boom);
  const hook = new THREE.Group();
  hook.add(cyl(0.01, 0.01, 1, dark(), 0, -0.5, 0, 5));
  hook.add(box(0.12, 0.18, 0.1, std('#d8a020'), 0, -1.05, 0, 0.03));
  arm.add(hook);
  b.add(arm);
  b.height(dd + h + 1.0);
  return { arm, boom, hook, len: boomLen };
}

function poseWorker(p: Person, e: { t: number }, phase: number, lean = 0.3) {
  p.setLean(lean + 0.12 * Math.sin(e.t * 1.6 + phase));
  p.reach(1, new V3(0.42, 0.82 + 0.07 * Math.sin(e.t * 1.6 + phase), 0.06));
  p.reach(0, new V3(0.4, 0.78 + 0.07 * Math.cos(e.t * 1.6 + phase), -0.12));
}

/* ════════════════════════ Сейнер «Старик» ════════════════════════ */
export function buildSeiner(spec: VesselSpec, cbx: number): VesselModel {
  const b = new Builder(spec, cbx);
  const { L } = b.g;
  const gloss = { roughness: 0.5, metalness: 0.2 };
  const hullSteel = std(spec.hull, { roughness: 0.6, metalness: 0.3 });
  const trimM = std(spec.trim, { roughness: 0.55 });
  const alu = std('#c4cacf', { roughness: 0.3, metalness: 0.85 });
  const { gunPort, gunStb } = loftHull(b, {
    section: 'round',
    pb: 1.6,
    ps: 3.0,
    sternFrac: 0.55,
    bowFlare: 1.5,
    sideFlare: 0.06,
    sheerH: 0.22,
    nSt: 64,
    mats: {
      bottom: wet('#6a2018', { roughness: 0.8 }),
      boot: wet('#a8281c', { roughness: 0.7 }),
      side: wet('#ffffff', { map: texSteel(spec.hull), roughness: 0.55, metalness: 0.25 }),
      sheer: wet(spec.trim, gloss),
    },
  });
  deckPatch(b, -L / 2 + 0.03, L / 2 - 0.03, std('#ffffff', { map: texSteel('#6a6e72', '#6a3418'), roughness: 0.8 }), 0.05);
  const tires = steelBulwark(b, gunPort, gunStb, 0.78, hullSteel, std('#16171a', { roughness: 0.9 }), -L / 2 + 0.1, L / 2 - 0.15);

  // рубка в носу + крылья мостика
  const hs0 = 1.2;
  const hs1 = 4.1;
  const hy0 = b.D(2.5) - 0.02;
  const { roofY } = wheelhouse(b, { s0: hs0, s1: hs1, y0: hy0, h: 2.3, w: 2.9, slant: 0.55, color: '#e8e4dc', trim: spec.hull, winRows: 4, sideWin: 4, doorAt: 'aft' });
  for (const side of [-1, 1]) {
    b.add(box(1.3, 0.1, 0.6, std('#d8d4cc', { roughness: 0.7 }), 2.4, hy0 + 1.35, side * (1.45 + 0.3), 0.02));
    railing(b, [new V3(1.75, hy0 + 1.4, side * 1.78), new V3(3.05, hy0 + 1.4, side * 1.78)], 0.5, alu, { rails: 2, post: 0.65, r: 0.016 });
  }
  const radar = radarMast(b, 2.7, roofY, 3.0, alu);
  const fl = makeFlag('#b8322a', 0.6, 0.36);
  fl.grp.position.set(2.7, roofY + 2.85, 0);
  b.add(fl.grp);
  for (const z of [-0.9, 0.9]) b.add(cyl(0.1, 0.12, 0.2, alu, hs1 - 0.7, roofY + 0.18, z, 10));
  // труба
  funnel(b, 0.55, b.D(0.55), 0.85, 0.75, 4.1, std('#303438', { roughness: 0.55 }), trimM);
  // спасательные плотики
  for (const z of [-0.95, 0.95]) b.add(cyl(0.2, 0.2, 1.1, std('#e8e4dc', { roughness: 0.6 }), 1.9, roofY + 0.32, z, 14)).rotation.x = Math.PI / 2;
  // стрела-деррик
  const ps = -1.15;
  const pd = b.D(ps);
  b.add(cyl(0.1, 0.15, 4.4, std('#2e2e30', { roughness: 0.55, metalness: 0.5 }), ps, pd + 2.2, 0, 10));
  b.height(pd + 4.5);
  const topP = new V3(ps, pd + 4.2, 0);
  const derrick = cyl(0.07, 0.07, 1, std('#2e2e30', { roughness: 0.55, metalness: 0.5 }), 0, 0, 0, 8);
  const lift = cyl(0.01, 0.01, 1, dark(), 0, 0, 0, 5);
  b.add(derrick);
  b.add(lift);
  const hook = new THREE.Group();
  hook.add(cyl(0.01, 0.01, 1.2, dark(), 0, -0.6, 0, 5));
  hook.add(box(0.2, 0.2, 0.2, std('#d8a030'), 0, -1.3, 0, 0.04));
  b.add(hook);
  // сеть, ярус на корме
  const drum = netDrum(b, -3.6, 0.75, 2.4, b.D(-3.6) + 0.9);
  const net = mesh(new THREE.SphereGeometry(0.9, 12, 8), std('#2f6a3a', { roughness: 1 }), -1.9, b.D(-1.9) + 0.35, 0.7);
  net.scale.set(1.5, 0.55, 1.1);
  b.add(net);
  // люки трюма, поплавки, лебёдка
  for (const s of [-0.1, -2.2]) {
    b.add(box(1.1, 0.22, 1.1, std('#4a4f55', { roughness: 0.6 }), s, b.D(s) + 0.11, -0.6, 0.02));
    b.add(box(1.0, 0.05, 1.0, std('#8a8f94', { roughness: 0.5 }), s, b.D(s) + 0.24, -0.6, 0.01));
  }
  for (let k = 0; k < 7; k++) b.add(ball(0.16, std('#f07a20', { roughness: 0.45 }), -4.6 + (k % 4) * 0.34, b.D(-4.6) + 0.3 + Math.floor(k / 4) * 0.28, 1.1 - Math.floor(k / 4) * 0.1, 10));
  const wn = winch(alu, dark(), 0.2, 0.7);
  wn.position.set(0.3, b.D(0.3) + 0.5, 0);
  b.add(wn);
  // якорь, брашпиль
  const anch = anchorShape(alu, 1.3);
  anch.position.set(L / 2 - 0.55, b.D(L / 2 - 0.55) + 0.55, b.bd(L / 2 - 0.55) - 0.2);
  anch.rotation.set(0, 0, -0.55);
  b.add(anch);
  const bw = cyl(0.14, 0.14, 0.9, std('#2c2f33', { metalness: 0.8, roughness: 0.4 }), L / 2 - 1.3, b.D(L / 2 - 1.3) + 0.3, 0, 12);
  bw.rotation.x = Math.PI / 2;
  b.add(bw);
  for (const s of [-L / 2 + 1.2, L / 2 - 1.8]) for (const z of [-1, 1]) {
    const c = cleat(alu);
    c.position.set(s, b.D(s) + 0.04, z * (b.bd(s) - 0.15));
    c.scale.setScalar(1.4);
    b.add(c);
  }
  const coil = ropeCoil('#d8b868', 0.34, 6);
  coil.position.set(-0.9, b.D(-0.9) + 0.02, 1.0);
  b.add(coil);
  const lb = lifebuoy();
  lb.position.set(1.4, hy0 + 1.4, 1.48);
  b.add(lb);
  b.nameplate('СТАРИК', 2.9, 0.78, 1.8, '#f0e4c0');
  b.navLights(L / 2 - 1.3, b.D(L / 2 - 1.3) + 0.9, b.bd(L / 2 - 1.3) * 0.97);
  b.lamp(b.hull, hs0 + 0.05, hy0 + 1.6, 1.46, 0xffd890, 1.0, 'night', 0.05);
  b.lamp(b.hull, -L / 2 + 0.3, b.D(-L / 2 + 0.3) + 1.0, 0, 0xffffff, 0.8, 'nav', 0.045);

  const crew = [new Person({ coat: '#e8601a', pants: '#26292e', hat: 'sou', hatColor: '#e8601a' }), new Person({ coat: '#2a5a8a', pants: '#26292e', hat: 'beanie', hatColor: '#c83a2a' })];
  crew[0].root.position.set(-2.7, b.D(-2.7), 0.6);
  crew[1].root.position.set(-1.0, b.D(-1.0), -0.2);
  crew.forEach((c) => b.add(c.root));

  b.upd.push((body, e) => {
    radar.rotation.y = e.t * 2.2;
    fl.update(e.t, e.aw);
    const sw = 0.45 * Math.sin(e.t * 0.25) + 0.15;
    const end = new V3(ps - 3.1 * Math.cos(0.55), pd + 1.7, 3.1 * Math.sin(sw));
    placeStrut(derrick, topP.clone().add(new V3(0, -0.3, 0)), end);
    placeStrut(lift, topP, end);
    hook.position.copy(end);
    hook.rotation.z = swing(body, 1) * 0.9;
    drum.rotation.z = e.t * 0.2 * (body.throttle > 0.1 ? 1 : 0);
    tires.forEach((t, i) => (t.rotation.z = swing(body, 2) * 0.5 * (i % 2 ? -1 : 1)));
    poseWorker(crew[0], e, 0);
    poseWorker(crew[1], e, 2.1, 0.2);
  });
  return b.finish();
}

/* ════════════════════════ Траулер «Полярник» ════════════════════════ */
export function buildTrawler(spec: VesselSpec, cbx: number): VesselModel {
  const b = new Builder(spec, cbx);
  const { L } = b.g;
  const white = std(spec.trim, { roughness: 0.5 });
  const redM = std(spec.hull, { roughness: 0.55, metalness: 0.2 });
  const alu = std('#c4cacf', { roughness: 0.3, metalness: 0.85 });
  const { gunPort, gunStb } = loftHull(b, {
    section: 'round',
    pb: 1.7,
    ps: 3.0,
    sternFrac: 0.5,
    bowFlare: 1.5,
    sideFlare: 0.05,
    sheerH: 0.22,
    nSt: 64,
    mats: {
      bottom: wet('#2a1210', { roughness: 0.8 }),
      boot: wet('#141416', { roughness: 0.7 }),
      side: wet('#ffffff', { map: texSteel(spec.hull, '#4a1a10'), roughness: 0.55, metalness: 0.25 }),
      sheer: wet(spec.trim, { roughness: 0.5 }),
    },
  });
  const deckM = std('#ffffff', { map: texSteel('#5e6266', '#5a3018'), roughness: 0.8 });
  deckPatch(b, -L / 2 + 0.03, L / 2 - 0.03, deckM, 0.05);
  const tires = steelBulwark(b, gunPort, gunStb, 0.85, redM, std('#141416', { roughness: 0.9 }), -L / 2 + 0.1, L / 2 - 0.15);

  // двухъярусная рубка
  const hy0 = b.D(2.6) - 0.02;
  const low = wheelhouse(b, { s0: 0.7, s1: 4.7, y0: hy0, h: 2.1, w: 3.5, slant: 0.5, color: spec.trim, trim: spec.hull, winRows: 4, sideWin: 4, doorAt: 'aft' });
  const up = wheelhouse(b, { s0: 2.5, s1: 4.4, y0: low.roofY, h: 1.4, w: 3.1, slant: 0.5, color: spec.trim, trim: spec.hull, winRows: 4, sideWin: 3, doorAt: 'none' });
  const roofY = up.roofY;
  const radar = radarMast(b, 3.2, roofY, 3.2, alu);
  b.add(mesh(new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), std('#f4f4f4', { roughness: 0.35 }), 2.4, roofY + 0.1, 0.9));
  const fl = makeFlag('#e8e8e8', 0.6, 0.36);
  fl.grp.position.set(3.2, roofY + 3.0, 0);
  b.add(fl.grp);
  // труба
  funnel(b, 0.05, b.D(0.05), 1.0, 0.9, 5.0, redM, white);
  // А-рама, траловые лебёдки, сетевой барабан
  const blockG = aFrame(b, -L / 2 + 0.5, 1.5, 5.3, 1.0, std('#d8d4cc', { roughness: 0.5, metalness: 0.3 }));
  const drum = netDrum(b, -3.9, 0.95, 3.0, b.D(-3.9) + 1.05, '#c8a030');
  for (const z of [-1.5, 1.5]) {
    const wn = winch(alu, dark(), 0.34, 0.7);
    wn.position.set(-1.7, b.D(-1.7) + 0.9, z * 0.9);
    b.add(wn);
  }
  for (const z of [-0.9, 0.9]) {
    const door = box(1.6, 1.1, 0.12, std('#4a4f55', { roughness: 0.5, metalness: 0.6 }), -L / 2 + 1.6, b.D(-L / 2 + 1.6) + 0.7, z * 1.0, 0.02);
    door.rotation.z = 0.2;
    b.add(door);
  }
  // кран у борта
  const crane = pedestalCrane(b, -0.6, 1.5, 1.5, 3.4, std(spec.trim, { roughness: 0.5 }));
  // якорь, брашпиль, леера
  const anch = anchorShape(alu, 1.4);
  anch.position.set(L / 2 - 0.6, b.D(L / 2 - 0.6) + 0.6, b.bd(L / 2 - 0.6) - 0.2);
  anch.rotation.set(0, 0, -0.55);
  b.add(anch);
  const bw = cyl(0.16, 0.16, 1.0, std('#2c2f33', { metalness: 0.8, roughness: 0.4 }), L / 2 - 1.4, b.D(L / 2 - 1.4) + 0.35, 0, 12);
  bw.rotation.x = Math.PI / 2;
  b.add(bw);
  const lb = lifebuoy();
  lb.position.set(1.5, hy0 + 1.35, 1.78);
  b.add(lb);
  for (const z of [-1.2, 1.2]) b.add(cyl(0.2, 0.2, 1.2, std('#e8e4dc', { roughness: 0.6 }), 2.6, low.roofY + 0.32, z, 14)).rotation.x = Math.PI / 2;
  // снежный покров при морозе
  const snow = std('#f4f8fb', { roughness: 0.95 });
  const sn1 = box(3.6, 0.1, 3.3, snow, 2.7, low.roofY + 0.14, 0, 0.04);
  const sn2 = box(1.7, 0.08, 2.9, snow, 3.4, roofY + 0.12, 0, 0.04);
  const sn3 = box(L * 0.55, 0.07, 3.0, snow, L * 0.1, b.D(L * 0.1) + 0.1, 0, 0.03);
  const sn4 = box(3.4, 0.08, 2.4, snow, L / 2 - 2.5, b.D(L / 2 - 2.5) + 0.1, 0, 0.03);
  for (const s of [sn1, sn2, sn3, sn4]) {
    b.add(s);
    b.snow.push(s);
  }
  b.nameplate('ПОЛЯРНИК', 3.3, 0.85, 2.2, '#f4f0e8');
  b.navLights(L / 2 - 1.4, b.D(L / 2 - 1.4) + 0.95, b.bd(L / 2 - 1.4) * 0.97);
  b.lamp(b.hull, 0.8, hy0 + 1.5, 1.77, 0xffd890, 1.0, 'night', 0.05);
  b.lamp(b.hull, -L / 2 + 0.3, b.D(-L / 2 + 0.3) + 1.1, 0, 0xffffff, 0.8, 'nav', 0.045);
  const crew = [new Person({ coat: '#e86a20', pants: '#26292e', hat: 'helmet' }), new Person({ coat: '#e8c020', pants: '#26292e', hat: 'helmet' })];
  crew[0].root.position.set(-3.2, b.D(-3.2), 1.0);
  crew[1].root.position.set(-2.4, b.D(-2.4), -0.9);
  crew.forEach((c) => b.add(c.root));

  b.upd.push((body, e) => {
    radar.rotation.y = e.t * 2.0;
    fl.update(e.t, e.aw);
    blockG.rotation.z = swing(body, 1) * 0.8;
    drum.rotation.z = e.t * 0.15;
    const sw = 0.6 * Math.sin(e.t * 0.22);
    crane.arm.rotation.y = sw;
    const ang = 0.9;
    const bl = crane.len;
    const a0 = new V3(0, 0.1, 0);
    const a1 = new V3(-Math.cos(ang) * bl * 0.0 + 0.0, 0, 0).set(Math.cos(ang) * bl, Math.sin(ang) * bl, 0).multiplyScalar(0.98);
    a1.set(-Math.cos(ang) * bl, Math.sin(ang) * bl + 0.1, 0);
    placeStrut(crane.boom, a0, a1);
    crane.hook.position.copy(a1);
    crane.hook.rotation.z = swing(body, 1) * 0.7;
    tires.forEach((t, i) => (t.rotation.z = swing(body, 2) * 0.5 * (i % 2 ? -1 : 1)));
    poseWorker(crew[0], e, 0.4);
    poseWorker(crew[1], e, 2.5, 0.2);
  });
  return b.finish();
}

/* ════════════════════════ НИС «Глубинник» ════════════════════════ */
export function buildResearch(spec: VesselSpec, cbx: number): VesselModel {
  const b = new Builder(spec, cbx);
  const { L } = b.g;
  const white = std('#f4f4f2', { roughness: 0.4 });
  const orange = std(spec.hull, { roughness: 0.45, metalness: 0.15 });
  const alu = std('#c4cacf', { roughness: 0.3, metalness: 0.85 });
  const { gunPort, gunStb } = loftHull(b, {
    section: 'round',
    pb: 1.7,
    ps: 2.8,
    sternFrac: 0.5,
    bowFlare: 1.4,
    sideFlare: 0.05,
    sheerH: 0.2,
    nSt: 64,
    mats: {
      bottom: wet('#2a2220', { roughness: 0.8 }),
      boot: wet('#141416', { roughness: 0.7 }),
      side: wet(spec.hull, { roughness: 0.4, metalness: 0.2 }),
      sheer: wet('#f4f4f2', { roughness: 0.45 }),
    },
  });
  deckPatch(b, -L / 2 + 0.03, L / 2 - 0.03, std('#ffffff', { map: texSteel('#9aa0a4', '#7a4a28'), roughness: 0.8 }), 0.05);
  const tires = steelBulwark(b, gunPort, gunStb, 0.8, orange, std('#141416', { roughness: 0.9 }), -L / 2 + 0.1, L / 2 - 0.15);
  // надстройка: три яруса
  const hy0 = b.D(2.0) - 0.02;
  const l1 = wheelhouse(b, { s0: -0.6, s1: 4.6, y0: hy0, h: 1.9, w: 3.2, slant: 0.7, color: '#f4f4f2', trim: spec.hull, winRows: 4, sideWin: 6, doorAt: 'aft' });
  const l2 = wheelhouse(b, { s0: 1.4, s1: 4.2, y0: l1.roofY, h: 1.5, w: 3.0, slant: 0.55, color: '#f4f4f2', trim: spec.hull, winRows: 4, sideWin: 4, doorAt: 'none' });
  const roofY = l2.roofY;
  const radar = radarMast(b, 3.0, roofY, 3.0, alu);
  b.add(mesh(new THREE.SphereGeometry(0.75, 18, 12), std('#fafafa', { roughness: 0.3 }), 0.6, l1.roofY + 0.7, 0));
  for (const z of [-0.5, 0.5]) b.add(cyl(0.012, 0.012, 1.6, dark(), 1.2, roofY + 0.8, z, 5));
  const fl = makeFlag('#2a60c0', 0.65, 0.4);
  fl.grp.position.set(3.0, roofY + 2.9, 0);
  b.add(fl.grp);
  funnel(b, -1.15, b.D(-1.15), 0.9, 0.8, 4.3, orange, white);
  // лаборатория-контейнер
  const labS = -2.9;
  b.add(box(2.5, 2.3, 2.4, std('#e4e6e6', { roughness: 0.5, metalness: 0.2 }), labS, b.D(labS) + 1.15, 0, 0.05));
  for (let k = 0; k < 3; k++) for (const z of [-1.206, 1.206]) b.add(box(0.5, 0.45, 0.02, b.glass, labS - 0.7 + k * 0.7, b.D(labS) + 1.5, z));
  b.add(box(0.6, 0.06, 2.5, std('#c8cccc', { roughness: 0.6 }), labS, b.D(labS) + 2.33, 0, 0.02));
  b.height(b.D(labS) + 2.5);
  // А-рама и лебёдка CTD
  const blockG = aFrame(b, -L / 2 + 0.55, 1.4, 4.9, 0.9, std(spec.hull, { roughness: 0.5, metalness: 0.2 }), '#f08020');
  const ctd = new THREE.Group();
  ctd.add(cyl(0.01, 0.01, 1.6, dark(), 0, -0.8, 0, 5));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    ctd.add(cyl(0.05, 0.05, 0.5, std('#2a3038', { roughness: 0.4 }), Math.cos(a) * 0.16, -1.9, Math.sin(a) * 0.16, 8));
  }
  ctd.add(torus(0.22, 0.02, std('#2a3038'), 0, -1.65, 0).rotateX(Math.PI / 2));
  blockG.add(ctd);
  const drum = netDrum(b, -4.7, 0.65, 1.6, b.D(-4.7) + 0.8, '#6a7078');
  // кран и РИБ на шлюпбалках
  const crane = pedestalCrane(b, -1.5, -1.6, 1.4, 3.2, std(spec.hull, { roughness: 0.5 }));
  const rib = new THREE.Group();
  rib.position.set(1.5, l1.roofY + 0.45, 1.25);
  const tube = std('#3a3f46', { roughness: 0.85 });
  for (const z of [-0.42, 0.42]) {
    const t = caps(0.2, 3.4, tube, 0, 0, z);
    t.rotation.z = Math.PI / 2;
    rib.add(t);
  }
  rib.add(box(3.4, 0.08, 0.7, std('#c8cccc', { roughness: 0.6 }), 0, -0.1, 0, 0.02));
  rib.add(box(0.5, 0.35, 0.5, std('#e8e8e6'), -0.7, 0.2, 0, 0.04));
  rib.add(box(0.3, 0.45, 0.4, std('#2a2a2e', { roughness: 0.5 }), -1.7, 0.1, 0, 0.04));
  b.add(rib);
  for (const s of [0.4, 2.6]) b.add(strut(new V3(s, l1.roofY + 0.1, 1.25), new V3(s, l1.roofY + 1.5, 1.25), 0.05, alu));
  const anch = anchorShape(alu, 1.3);
  anch.position.set(L / 2 - 0.6, b.D(L / 2 - 0.6) + 0.55, b.bd(L / 2 - 0.6) - 0.2);
  anch.rotation.set(0, 0, -0.55);
  b.add(anch);
  const lb = lifebuoy();
  lb.position.set(1.0, hy0 + 1.25, 1.68);
  b.add(lb);
  b.nameplate('ГЛУБИННИК', 3.5, 0.8, 2.3, '#f4f4f2');
  b.navLights(L / 2 - 1.4, b.D(L / 2 - 1.4) + 0.9, b.bd(L / 2 - 1.4) * 0.97);
  b.lamp(b.hull, -0.5, hy0 + 1.4, 1.62, 0xffd890, 1.0, 'night', 0.05);
  b.lamp(b.hull, -L / 2 + 0.3, b.D(-L / 2 + 0.3) + 1.0, 0, 0xffffff, 0.8, 'nav', 0.045);
  const crew = [new Person({ coat: '#f0a020', pants: '#26292e', hat: 'helmet', vest: '#f08a20' }), new Person({ coat: '#f4f4f2', pants: '#2a2e34', hat: 'cap', hatColor: '#2a60c0' })];
  crew[0].root.position.set(-4.0, b.D(-4.0), 0.7);
  crew[1].root.position.set(-1.7, b.D(-1.7), 0.9);
  crew.forEach((c) => b.add(c.root));

  b.upd.push((body, e) => {
    radar.rotation.y = e.t * 2.6;
    fl.update(e.t, e.aw);
    blockG.rotation.z = swing(body, 1) * 0.7;
    drum.rotation.z = e.t * 0.1;
    crane.arm.rotation.y = 0.5 * Math.sin(e.t * 0.2) + 0.2;
    const ang = 0.95;
    const a1 = new V3(Math.cos(ang) * crane.len, Math.sin(ang) * crane.len + 0.1, 0);
    placeStrut(crane.boom, new V3(0, 0.1, 0), a1);
    crane.hook.position.copy(a1);
    crane.hook.rotation.z = swing(body, 1) * 0.6;
    rib.rotation.z = swing(body, 2) * 0.1;
    tires.forEach((t, i) => (t.rotation.z = swing(body, 2) * 0.5 * (i % 2 ? -1 : 1)));
    poseWorker(crew[0], e, 0.8);
    poseWorker(crew[1], e, 1.9, 0.15);
    void clamp;
  });
  void fender;
  void sh;
  void slice;
  void ball;
  return b.finish();
}
