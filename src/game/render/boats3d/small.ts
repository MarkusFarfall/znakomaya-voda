/** Малые суда: плоскодонка «Утро», каяк «Тишина», моторка «Чайка», баркас «Помор» */
import * as THREE from 'three';
import { TAU, clamp } from './util3';
import type { VesselSpec } from './hull3';
import {
  Builder,
  Person,
  V3,
  anchorShape,
  ball,
  box,
  bucket,
  bulwark,
  caps,
  cleat,
  cyl,
  deckPatch,
  fender,
  floorPlate,
  gunwale,
  loftHull,
  makeFlag,
  mesh,
  railing,
  ropeCoil,
  rod,
  sh,
  slice,
  smoothstep,
  std,
  strut,
  swing,
  texPlank,
  texStrake,
  torus,
  tubeAlong,
  placeStrut,
  tireFender,
  wet,
  wheelhouse,
  type VesselModel,
} from './kit';
import { line, mast, sailMesh } from './rig';

/* ════════════════════════ Плоскодонка «Утро» ════════════════════════ */
export function buildRow(spec: VesselSpec, cbx: number): VesselModel {
  const b = new Builder(spec, cbx);
  const { L } = b.g;
  const trimM = std(spec.trim, { roughness: 0.6 });
  const { gunPort, gunStb } = loftHull(b, {
    section: 'flat',
    pb: 1.8,
    ps: 2.4,
    sternFrac: 0.55,
    bowFlare: 1.3,
    sideFlare: 0.2,
    sheerH: 0.1,
    nSt: 56,
    mats: {
      bottom: wet('#2a1c12', { roughness: 0.9 }),
      boot: wet('#e6dccb', { roughness: 0.7 }),
      side: wet('#ffffff', { map: texStrake(spec.hull), roughness: 0.78 }),
      sheer: wet(spec.trim, { roughness: 0.6 }),
      inner: std('#ffffff', { map: texPlank('#b58a55'), roughness: 0.85, side: THREE.BackSide }),
    },
  });
  gunwale(b, gunPort, 0.034, trimM);
  gunwale(b, gunStb, 0.034, trimM);
  const plank = std('#ffffff', { map: texPlank('#c19a62'), roughness: 0.8 });
  floorPlate(b, -0.115, -L * 0.42, L * 0.38, (s) => Math.max(0.06, b.bw(s) * 0.5), plank);

  // банки (сиденья) и кницы
  const seatY = 0.26;
  for (const s of [-0.35, 0.95, -1.7]) {
    const half = b.sideZ(s, seatY) - 0.02;
    b.add(box(0.27, 0.035, half * 2, plank, s, seatY, 0, 0.006));
    for (const side of [-1, 1]) b.add(box(0.05, 0.14, 0.05, plank, s, seatY - 0.09, side * (half - 0.05)));
  }
  // форштевень и транцевая доска
  b.add(box(0.06, 0.62, 0.05, trimM, L / 2 - 0.12, 0.3, 0, 0.01));

  // уключины и вёсла
  const lockS = -0.45;
  const lockY = b.D(lockS) + 0.07;
  const lockZ = b.bd(lockS);
  const oarMat = std('#c9a26a', { roughness: 0.6 });
  const leather = std('#4a2f1a', { roughness: 0.9 });
  const darkMat = std('#2b2118', { roughness: 0.7 });
  const iron = std('#3a3d42', { roughness: 0.4, metalness: 0.8 });
  const oars = [1, -1].map((side) => {
    const holder = new THREE.Group();
    holder.position.set(lockS, lockY, side * lockZ);
    if (side < 0) holder.rotation.y = Math.PI;
    const pivot = new THREE.Group();
    pivot.rotation.order = 'YXZ';
    holder.add(pivot);
    const shaft = cyl(0.022, 0.022, 2.4, oarMat, 0, 0, 0.45, 8);
    shaft.rotation.x = Math.PI / 2;
    const blade = new THREE.Group();
    blade.position.set(0, 0, 1.9);
    blade.add(box(0.02, 0.17, 0.55, oarMat, 0, 0, 0, 0.006));
    const grip = cyl(0.03, 0.03, 0.24, darkMat, 0, 0, -0.62, 8);
    grip.rotation.x = Math.PI / 2;
    const collar = cyl(0.036, 0.036, 0.12, leather, 0, 0, 0.12, 8);
    collar.rotation.x = Math.PI / 2;
    const anchor = new THREE.Object3D();
    anchor.position.set(0, 0, -0.55);
    pivot.add(shaft, blade, grip, collar, anchor);
    b.add(holder);
    b.add(cyl(0.018, 0.018, 0.12, iron, lockS, lockY - 0.06, side * lockZ, 6));
    b.add(box(0.07, 0.05, 0.05, iron, lockS, lockY - 0.01, side * (lockZ + 0.03), 0.01));
    return { pivot, blade, anchor, side };
  });

  // гребец
  const rower = new Person({ coat: '#2f5f8a', pants: '#3a3228', hat: 'cap', hatColor: '#3a3a40', seated: true, legs: [1.1, 0.75] });
  rower.root.position.set(-0.35, seatY + 0.02, 0);
  rower.root.rotation.y = Math.PI;
  b.add(rower.root);

  // удочки в держателях на корме
  const rodMat = null;
  void rodMat;
  for (const side of [-1, 1]) {
    const s = -1.95;
    const g = new THREE.Group();
    g.position.set(s, b.D(s) - 0.12, side * (b.bd(s) - 0.05));
    g.rotation.y = Math.PI + side * 0.4;
    g.rotation.z = 0.25;
    g.add(rod(2.5, 0.45));
    g.add(cyl(0.03, 0.03, 0.07, iron, 0.35, 0.1, 0, 10));
    b.add(g);
    b.add(cyl(0.035, 0.035, 0.16, darkMat, s, b.D(s) - 0.05, side * (b.bd(s) - 0.05), 8));
  }

  // фонарь на носовой стойке (качается маятником)
  const ps = L / 2 - 0.42;
  const postTop = b.D(ps) + 0.85;
  b.add(cyl(0.025, 0.03, 0.9, trimM, ps, b.D(ps) + 0.4, 0, 8));
  b.add(strut(new V3(ps, postTop, 0), new V3(ps + 0.18, postTop, 0), 0.015, iron));
  const lantern = new THREE.Group();
  lantern.position.set(ps + 0.18, postTop, 0);
  const lanGlass = std(0xffe0a8, { roughness: 0.2, emissive: 0xffb050, emissiveIntensity: 0.15, transparent: true, opacity: 0.85 });
  lantern.add(cyl(0.008, 0.008, 0.08, iron, 0, -0.04, 0, 5));
  lantern.add(mesh(new THREE.ConeGeometry(0.075, 0.07, 10), iron, 0, -0.1, 0));
  lantern.add(cyl(0.06, 0.06, 0.15, lanGlass, 0, -0.2, 0, 10));
  lantern.add(cyl(0.065, 0.065, 0.02, iron, 0, -0.29, 0, 10));
  b.lamp(lantern, 0, -0.2, 0, 0xffc070, 1.5, 'night', 0.05);
  b.add(lantern);

  // инвентарь
  const bk = bucket();
  bk.position.set(-1.35, -0.09, 0.3);
  b.add(bk);
  b.add(box(0.42, 0.18, 0.24, std('#3b7a4a', { roughness: 0.5 }), -1.25, 0.0, -0.32, 0.02));
  b.add(box(0.2, 0.03, 0.03, iron, -1.25, 0.1, -0.32));
  const anch = anchorShape(iron, 0.8);
  anch.position.set(L / 2 - 0.9, -0.08, 0.15);
  anch.rotation.set(Math.PI / 2, 0.4, 0);
  b.add(anch);
  const coil = ropeCoil('#c8b078', 0.2, 4);
  coil.position.set(L / 2 - 0.55, -0.08, -0.2);
  b.add(coil);
  for (let i = 0; i < 2; i++) {
    const fish = ball(0.1, std('#aeb8c0', { roughness: 0.3, metalness: 0.5 }), 0.7 + i * 0.2, -0.05, 0.3 - i * 0.2, 10);
    fish.scale.set(2.2, 0.55, 0.8);
    fish.rotation.y = 0.5 * i;
    b.add(fish);
  }
  b.navLights(L / 2 - 0.15, b.D(L / 2) + 0.05, 0.08);
  b.height(1.9);

  const tmp = new V3();
  b.upd.push((body, e) => {
    const ph = body.stroke % TAU;
    const al = 0.9 * Math.cos(ph);
    const dn = smoothstep(0, 0.35, Math.sin(ph));
    for (const o of oars) {
      o.pivot.rotation.y = o.side > 0 ? al : -al;
      o.pivot.rotation.x = 0.1 + 0.2 * dn;
      o.blade.rotation.z = (1 - dn) * 1.3;
    }
    rower.setLean(0.07 + 0.43 * (al / 0.9));
    b.root.updateMatrixWorld(true);
    oars.forEach((o, i) => {
      o.anchor.getWorldPosition(tmp);
      rower.root.worldToLocal(tmp);
      rower.reach(o.side > 0 ? 0 : 1, tmp.clone());
      void i;
    });
    lantern.rotation.z = swing(body, 0);
    lanGlass.emissiveIntensity = 0.15 + e.lights * 1.6;
  });
  return b.finish();
}

/* ════════════════════════ Каяк «Тишина» ════════════════════════ */
export function buildKayak(spec: VesselSpec, cbx: number): VesselModel {
  const b = new Builder(spec, cbx);
  const { L } = b.g;
  const plastic = { roughness: 0.28, metalness: 0.0 };
  const deckM = std(sh(spec.hull, 1.06), plastic);
  const { gunPort, gunStb } = loftHull(b, {
    section: 'round',
    pb: 1.5,
    ps: 1.5,
    sternFrac: 0,
    bowFlare: 1.05,
    sideFlare: 0,
    sheerH: 0.06,
    nSt: 60,
    mats: {
      bottom: wet(sh(spec.hull, 0.55), plastic),
      boot: wet('#1c1c1c', plastic),
      side: wet(spec.hull, plastic),
      sheer: wet(sh(spec.hull, 0.9), plastic),
    },
  });
  deckPatch(b, -L / 2 + 0.03, L / 2 - 0.03, deckM, 0.075, 0.99, 9);
  const rope = std('#d8c040', { roughness: 0.9 });
  const black = std('#16161a', { roughness: 0.8 });
  const grey = std('#4a4d52', { roughness: 0.5, metalness: 0.6 });
  b.add(tubeAlong(slice(gunPort, -L * 0.42, L * 0.42).map((p) => new V3(p.x, p.y + 0.06, p.z * 0.92)), 0.009, rope, 30));
  b.add(tubeAlong(slice(gunStb, -L * 0.42, L * 0.42).map((p) => new V3(p.x, p.y + 0.06, p.z * 0.92)), 0.009, rope, 30));

  // кокпит
  const cs = 0.2;
  const cy = b.D(cs) + 0.07;
  const coam = mesh(new THREE.TorusGeometry(0.32, 0.024, 8, 32), black, cs, cy, 0);
  coam.rotation.x = Math.PI / 2;
  coam.scale.set(1.55, 0.85, 1);
  b.add(coam);
  const hole = mesh(new THREE.CircleGeometry(0.31, 28), std('#08090b', { roughness: 1 }), cs, cy - 0.012, 0);
  hole.rotation.x = -Math.PI / 2;
  hole.scale.set(1.55, 0.85, 1);
  b.add(hole);
  b.add(cyl(0.15, 0.25, 0.16, std('#101216', { roughness: 0.9 }), cs, cy + 0.07, 0, 14));

  // грузовые шнуры, люки, сумка
  for (const s of [-0.95, 1.05]) {
    const hatch = cyl(0.19, 0.2, 0.025, black, s, b.D(s) + 0.07, 0, 20);
    b.add(hatch);
    b.add(torus(0.19, 0.012, grey, s, b.D(s) + 0.085, 0).rotateX(Math.PI / 2));
  }
  for (const [s0, s1] of [
    [1.25, 1.65],
    [0.6, 0.95],
  ]) {
    for (const k of [-1, 1]) {
      b.add(tubeAlong([new V3(s0, b.D(s0) + 0.075, -0.18 * k), new V3((s0 + s1) / 2, b.D(s0) + 0.1, 0), new V3(s1, b.D(s1) + 0.075, 0.18 * k)], 0.008, black, 12));
    }
  }
  const bag = caps(0.1, 0.3, std('#e8c020', { roughness: 0.5 }), -0.55, b.D(-0.55) + 0.17, 0);
  bag.rotation.x = Math.PI / 2;
  b.add(bag);
  // удочка в держателе
  const rg = new THREE.Group();
  rg.position.set(-0.8, b.D(-0.8) + 0.09, 0.1);
  rg.rotation.y = Math.PI + 0.25;
  rg.rotation.z = 0.35;
  rg.add(rod(2.2, 0.35));
  b.add(rg);
  b.add(cyl(0.03, 0.035, 0.12, grey, -0.8, b.D(-0.8) + 0.09, 0.1, 8));
  // компас на носу
  b.add(cyl(0.05, 0.055, 0.03, std('#d8d8d0'), L * 0.3, b.D(L * 0.3) + 0.09, 0, 14));
  // руль и скег
  b.add(box(0.28, 0.32, 0.015, wet('#2a2a2a', { roughness: 0.5 }), -L / 2 + 0.28, -0.2, 0, 0.004));
  // флажок на стойке
  const wp = new V3(-L / 2 + 0.45, b.D(-L / 2 + 0.45) + 0.05, 0);
  b.add(strut(wp, new V3(wp.x, wp.y + 1.05, 0), 0.006, black));
  const flag = makeFlag('#ff5a1a', 0.3, 0.2);
  flag.grp.position.set(wp.x, wp.y + 1.05, 0);
  b.add(flag.grp);

  // гребец
  const paddler = new Person({ coat: '#e8c020', pants: '#202428', hat: 'helmet', seated: true, vest: '#d83a2a', legs: [1.45, 0.25] });
  paddler.root.position.set(cs, b.D(cs) - 0.07, 0);
  b.add(paddler.root);
  // двухлопастное весло
  const pg = new THREE.Group();
  pg.position.set(cs + 0.12, b.D(cs) + 0.5, 0);
  pg.rotation.order = 'YXZ';
  const shaft = cyl(0.016, 0.016, 2.1, black, 0, 0, 0, 8);
  shaft.rotation.x = Math.PI / 2;
  pg.add(shaft);
  const bl = std('#f0c020', { roughness: 0.45 });
  for (const sd of [-1, 1]) {
    pg.add(box(0.02, 0.2, 0.52, bl, 0, 0, sd * 1.3, 0.008));
    const a = new THREE.Object3D();
    a.position.set(0, 0, sd * 0.38);
    a.name = sd > 0 ? 'hand+' : 'hand-';
    pg.add(a);
  }
  b.add(pg);
  b.navLights(L / 2 - 0.1, b.D(L / 2) + 0.06, 0.05);
  b.height(1.6);

  const tmp = new V3();
  const hp = pg.getObjectByName('hand+')!;
  const hm = pg.getObjectByName('hand-')!;
  b.upd.push((body, e) => {
    const ph = body.stroke % TAU;
    const active = Math.abs(body.throttle) > 0.05 || ph > 0.001;
    const al = active ? 0.5 * Math.cos(ph) : 0.0;
    pg.rotation.y = al;
    pg.rotation.x = active ? 0.5 * Math.sin(ph) : 0.08;
    paddler.setLean(0.12 + 0.18 * Math.cos(ph) * (active ? 1 : 0));
    b.root.updateMatrixWorld(true);
    hp.getWorldPosition(tmp);
    paddler.root.worldToLocal(tmp);
    paddler.reach(1, tmp.clone());
    hm.getWorldPosition(tmp);
    paddler.root.worldToLocal(tmp);
    paddler.reach(0, tmp.clone());
    flag.update(e.t, e.aw);
  });
  return b.finish();
}

/* ════════════════════════ Моторка «Чайка» ════════════════════════ */
export function buildDinghy(spec: VesselSpec, cbx: number): VesselModel {
  const b = new Builder(spec, cbx);
  const { L } = b.g;
  const gloss = { roughness: 0.32, metalness: 0.1 };
  const steel = std('#c9ced2', { roughness: 0.25, metalness: 0.9 });
  const black = std('#16171a', { roughness: 0.6 });
  const { gunPort, gunStb } = loftHull(b, {
    section: 'vee',
    pb: 1.5,
    ps: 3.2,
    sternFrac: 0.78,
    bowFlare: 1.55,
    sideFlare: 0.08,
    sheerH: 0.16,
    nSt: 60,
    mats: {
      bottom: wet('#1c1f24', { roughness: 0.6 }),
      boot: wet('#2a2a30', { roughness: 0.5 }),
      side: wet(spec.hull, gloss),
      sheer: wet(spec.trim, gloss),
      inner: std('#cfd2d4', { roughness: 0.6, side: THREE.BackSide }),
    },
  });
  const rub = std('#26282c', { roughness: 0.8 });
  gunwale(b, gunPort, 0.03, rub);
  gunwale(b, gunStb, 0.03, rub);
  const sole = std('#9aa1a6', { roughness: 0.75 });
  floorPlate(b, 0.0, -L * 0.45, L * 0.2, (s) => Math.max(0.06, b.bw(s) * 0.8), sole, 0.04);
  deckPatch(b, L * 0.14, L / 2 - 0.02, std(spec.hull, gloss), 0.05);
  // носовой рельс
  railing(b, slice(gunPort, L * 0.2, L / 2 - 0.15).map((p) => new V3(p.x, p.y + 0.05, p.z * 0.96)), 0.32, steel, { rails: 1, post: 0.7 });
  railing(b, slice(gunStb, L * 0.2, L / 2 - 0.15).map((p) => new V3(p.x, p.y + 0.05, p.z * 0.96)), 0.32, steel, { rails: 1, post: 0.7 });

  // консоль, ветровое стекло, штурвал
  const cs = 0.3;
  b.add(box(0.7, 0.82, 0.66, std(spec.hull, gloss), cs, 0.41, 0, 0.05));
  b.add(box(0.5, 0.05, 0.62, black, cs - 0.05, 0.84, 0, 0.02));
  const ws = new THREE.Group();
  ws.position.set(cs + 0.16, 0.86, 0);
  ws.rotation.z = -0.28;
  ws.add(box(0.025, 0.42, 0.66, std('#9fc4d8', { transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.2 }), 0, 0.21, 0, 0.005));
  ws.add(box(0.035, 0.03, 0.68, steel, 0, 0.43, 0));
  for (const z of [-0.33, 0.33]) ws.add(box(0.035, 0.44, 0.03, steel, 0, 0.21, z));
  b.add(ws);
  const wheel = new THREE.Group();
  wheel.position.set(cs - 0.31, 0.72, 0);
  wheel.rotation.y = Math.PI / 2;
  const wm = std('#202226', { roughness: 0.5 });
  const wt = torus(0.15, 0.016, wm);
  wheel.add(wt);
  for (let k = 0; k < 3; k++) {
    const sp = cyl(0.008, 0.008, 0.3, wm, 0, 0, 0, 6);
    sp.rotation.z = (k * Math.PI) / 3;
    wheel.add(sp);
  }
  const handL = new THREE.Object3D();
  const handR = new THREE.Object3D();
  handL.position.set(0.15 * Math.cos(2.6), 0.15 * Math.sin(2.6), 0);
  handR.position.set(0.15 * Math.cos(0.5), 0.15 * Math.sin(0.5), 0);
  wheel.add(handL, handR);
  const wheelTilt = new THREE.Group();
  wheelTilt.position.copy(wheel.position);
  wheelTilt.rotation.z = 0.45;
  wheel.position.set(0, 0, 0);
  wheelTilt.add(wheel);
  b.add(wheelTilt);
  b.add(cyl(0.012, 0.012, 0.1, black, cs - 0.31, 0.7, 0.0, 6));
  for (let k = 0; k < 2; k++) b.add(cyl(0.04, 0.04, 0.02, std('#d8d8d0'), cs + 0.05 + k * 0.1, 0.875, -0.15 + k * 0.3, 12));

  // сиденья, ящик, бак
  const seatM = std('#2c3036', { roughness: 0.8 });
  b.add(box(0.46, 0.34, 1.6, std('#dfe3e6', { roughness: 0.5 }), -1.55, 0.17, 0, 0.04));
  b.add(box(0.5, 0.07, 1.64, seatM, -1.55, 0.37, 0, 0.03));
  b.add(box(0.1, 0.4, 1.4, seatM, -1.78, 0.58, 0, 0.04));
  b.add(box(0.52, 0.34, 0.7, std('#e8e8ea', { roughness: 0.45 }), L * 0.12, 0.17, 0, 0.04));
  b.add(box(0.54, 0.05, 0.72, std('#2f6aa0', { roughness: 0.6 }), L * 0.12, 0.36, 0, 0.03));
  b.add(cyl(0.14, 0.14, 0.34, std('#c8302a', { roughness: 0.5 }), -L / 2 + 0.3, 0.17, 0.45, 14));
  // держатели удилищ
  for (const [s, z] of [
    [-1.1, 1],
    [-0.5, 1],
    [-0.8, -1],
  ] as [number, number][]) {
    const zz = z * (b.bd(s) - 0.02);
    const hh = cyl(0.03, 0.03, 0.2, steel, s, b.D(s) + 0.02, zz, 8);
    hh.rotation.x = z * 0.35;
    b.add(hh);
  }
  for (const s of [-1.2, 0.9]) for (const z of [-1, 1]) {
    const cl = cleat(steel);
    cl.position.set(s, b.D(s) + 0.01, z * (b.bd(s) - 0.12));
    b.add(cl);
  }
  const anch = anchorShape(steel, 0.7);
  anch.position.set(L / 2 - 0.45, b.D(L / 2 - 0.45) + 0.06, 0.15);
  anch.rotation.set(Math.PI / 2, 0.3, 0);
  b.add(anch);
  const f1 = fender('#f0f0f0');
  f1.position.set(0.1, b.D(0.1) + 0.02, b.bd(0.1) + 0.02);
  b.add(f1);
  const f2 = fender('#f0f0f0');
  f2.position.set(-0.45, b.D(-0.45) + 0.02, b.bd(-0.45) + 0.02);
  b.add(f2);
  b.navLights(L / 2 - 0.35, b.D(L / 2 - 0.35) + 0.1, 0.12);
  b.lamp(b.hull, cs - 0.1, 1.55, 0, 0xffffff, 0.7, 'nav', 0.045);
  b.add(strut(new V3(cs - 0.1, 0.86, 0), new V3(cs - 0.1, 1.55, 0), 0.015, steel));

  // подвесной мотор
  const motor = new THREE.Group();
  motor.position.set(-L / 2 + 0.04, b.D(-L / 2) + 0.02, 0);
  const cowl = std(spec.hull, { roughness: 0.3, metalness: 0.2 });
  const stripe = std('#c83a2a', { roughness: 0.35 });
  motor.add(box(0.1, 0.36, 0.3, black, 0.02, -0.12, 0, 0.02));
  motor.add(box(0.52, 0.5, 0.36, cowl, -0.26, 0.16, 0, 0.1));
  motor.add(box(0.53, 0.06, 0.37, stripe, -0.26, 0.1, 0, 0.02));
  motor.add(box(0.2, 0.8, 0.15, wet('#8a8f94', { roughness: 0.4, metalness: 0.5 }), -0.27, -0.55, 0, 0.03));
  const gear = caps(0.085, 0.3, wet('#7d8288', { roughness: 0.35, metalness: 0.6 }), -0.27, -0.98, 0);
  gear.rotation.z = Math.PI / 2;
  motor.add(gear);
  const propG = new THREE.Group();
  propG.position.set(-0.5, -0.98, 0);
  const blm = wet('#b8bcc0', { roughness: 0.3, metalness: 0.85 });
  for (let k = 0; k < 3; k++) {
    const arm = new THREE.Group();
    arm.rotation.x = (k * TAU) / 3;
    const bladeM = box(0.04, 0.28, 0.09, blm, 0, 0.17, 0, 0.01);
    bladeM.rotation.y = 0.6;
    arm.add(bladeM);
    propG.add(arm);
  }
  const blur = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 24),
    new THREE.MeshBasicMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  );
  blur.rotation.y = Math.PI / 2;
  propG.add(blur);
  motor.add(propG);
  b.add(motor);
  b.prop = propG;
  b.height(1.7);

  // рулевой
  const skipper = new Person({ coat: '#1f3a52', pants: '#2a2c30', hat: 'cap', hatColor: '#c83a2a', vest: '#f08a20' });
  skipper.root.position.set(-0.4, 0.0, 0);
  b.add(skipper.root);
  const tmp = new V3();
  b.upd.push((body) => {
    propG.rotation.x += (0.2 + body.rpm * 55) * 0.016;
    (blur.material as THREE.MeshBasicMaterial).opacity = clamp((body.rpm - 0.35) * 0.55, 0, 0.3);
    motor.rotation.z = 0.05 + body.theta * 0.4 + clamp(body.rpm - 0.4, 0, 1) * 0.06;
    wheel.rotation.x = -body.yawRate * 3.5;
    skipper.setLean(clamp(body.lean, -0.3, 0.3) + 0.08);
    b.root.updateMatrixWorld(true);
    handL.getWorldPosition(tmp);
    skipper.root.worldToLocal(tmp);
    skipper.reach(0, tmp.clone());
    handR.getWorldPosition(tmp);
    skipper.root.worldToLocal(tmp);
    skipper.reach(1, tmp.clone());
  });
  return b.finish();
}

/* ════════════════════════ Баркас «Помор» ════════════════════════ */
export function buildBarkas(spec: VesselSpec, cbx: number): VesselModel {
  const b = new Builder(spec, cbx);
  const { L } = b.g;
  const woodTrim = std(spec.trim, { roughness: 0.6 });
  const hullWood = std(spec.hull, { roughness: 0.8 });
  const iron = std('#2e3135', { roughness: 0.5, metalness: 0.8 });
  const rope = std('#b8a070', { roughness: 0.95 });
  const { gunPort, gunStb } = loftHull(b, {
    section: 'round',
    pb: 1.7,
    ps: 1.7,
    sternFrac: 0,
    bowFlare: 1.25,
    sideFlare: 0.12,
    sheerH: 0.16,
    nSt: 64,
    mats: {
      bottom: wet('#1b1410', { roughness: 0.95 }),
      boot: wet('#2a1c10', { roughness: 0.9 }),
      side: wet('#ffffff', { map: texStrake(spec.hull), roughness: 0.82 }),
      sheer: wet(spec.trim, { roughness: 0.65 }),
    },
  });
  deckPatch(b, -L / 2 + 0.05, L / 2 - 0.05, std('#ffffff', { map: texPlank('#9c7a4c'), roughness: 0.82 }), 0.06);
  bulwark(b, gunPort, 0.36, hullWood, 0.06, -L / 2 + 0.2, L / 2 - 0.1);
  bulwark(b, gunStb, 0.36, hullWood, 0.06, -L / 2 + 0.2, L / 2 - 0.1);
  gunwale(b, gunPort, 0.04, woodTrim, 0.38);
  gunwale(b, gunStb, 0.04, woodTrim, 0.38);

  // кубрик
  const cabY = b.D(-1.7) - 0.02;
  wheelhouse(b, { s0: -2.8, s1: -0.75, y0: cabY, h: 1.05, w: 1.55, slant: 0.15, color: spec.trim, trim: sh(spec.hull, 0.9), winRows: 2, sideWin: 2, doorAt: 'fwd' });
  // печная труба
  b.add(cyl(0.07, 0.08, 0.5, iron, -2.35, cabY + 1.35, 0.4, 10));
  b.add(cyl(0.1, 0.07, 0.07, iron, -2.35, cabY + 1.62, 0.4, 10));
  const chim = new THREE.Object3D();
  chim.position.set(-2.35, cabY + 1.7, 0.4);
  b.add(chim);
  b.smoke.push(chim);
  const cabWinds = new THREE.Object3D();
  void cabWinds;

  // мачта
  const mx = 0.9;
  const md = b.D(mx);
  const mastM = std('#6a4a2c', { roughness: 0.8 });
  mast(b, mx, md, 6.4, 0.11, 0.065, mastM);
  b.add(cyl(0.16, 0.16, 0.18, std('#4a3220'), mx, md + 0.09, 0, 12));
  const by = md + 1.55;
  const ty = md + 4.6;
  const boom = cyl(0.045, 0.045, 1, mastM, mx, by, 0, 8);
  const gaff = cyl(0.04, 0.04, 1, mastM, mx, ty, 0, 8);
  b.add(boom);
  b.add(gaff);
  const sail = sailMesh(b, '#cdbd94');
  // ванты и штаги
  const shroud = std('#1c1c1e', { roughness: 0.7 });
  const top = new V3(mx, md + 5.9, 0);
  for (const side of [-1, 1]) {
    for (const ds of [-0.25, 0.35]) {
      const cp = new V3(mx + ds, b.D(mx + ds) + 0.36, side * b.bd(mx + ds));
      line(b, cp, new V3(mx, md + 5.7, side * 0.04), 0.012, shroud);
    }
  }
  line(b, top, new V3(L / 2 - 0.25, b.D(L / 2 - 0.25) + 0.45, 0), 0.014, shroud);
  line(b, top, new V3(-L / 2 + 0.3, b.D(-L / 2 + 0.3) + 0.4, 0), 0.014, shroud);
  b.lamp(b.hull, mx, md + 6.5, 0, 0xffffff, 0.8, 'nav', 0.05);

  // люк, бочки, брашпиль, якорь
  b.add(box(1.0, 0.2, 0.95, std('#5a3f26', { roughness: 0.85 }), 0.1, b.D(0.1) + 0.1, 0, 0.02));
  b.add(box(0.95, 0.04, 0.9, std('#8a6a40', { roughness: 0.8 }), 0.1, b.D(0.1) + 0.22, 0, 0.01));
  for (const [s, z] of [
    [-0.15, 0.55],
    [-0.25, -0.5],
  ] as [number, number][]) {
    b.add(cyl(0.26, 0.27, 0.62, std('#6a4a2c', { roughness: 0.85 }), s, b.D(s) + 0.31, z, 14));
    for (const hy of [0.1, 0.31, 0.52]) b.add(cyl(0.275, 0.275, 0.025, iron, s, b.D(s) + hy, z, 14));
  }
  const wl = cyl(0.1, 0.1, 0.8, iron, L / 2 - 1.0, b.D(L / 2 - 1.0) + 0.32, 0, 12);
  wl.rotation.x = Math.PI / 2;
  b.add(wl);
  b.add(box(0.2, 0.3, 0.9, iron, L / 2 - 1.0, b.D(L / 2 - 1.0) + 0.12, 0, 0.02));
  const anch = anchorShape(iron, 0.9);
  anch.position.set(L / 2 - 0.5, b.D(L / 2 - 0.5) + 0.44, b.bd(L / 2 - 0.5) - 0.12);
  anch.rotation.set(0, 0, -0.5);
  b.add(anch);
  const coil = ropeCoil('#b8a070', 0.3, 5);
  coil.position.set(1.7, b.D(1.7) + 0.02, -0.35);
  b.add(coil);
  // кранцы-покрышки
  const tires = [-0.6, 0.5, 1.6].map((s, i) => {
    const t = tireFender();
    t.position.set(s, b.D(s) + 0.3, (i % 2 ? -1 : 1) * (b.bd(s) + 0.02));
    b.add(t);
    return t;
  });
  b.nameplate('ПОМОР', 1.9, 0.52, 1.4, '#e8dcc0');
  b.navLights(L / 2 - 0.9, b.D(L / 2 - 0.9) + 0.4, b.bd(L / 2 - 0.9) - 0.05);
  b.lamp(b.hull, -1.8, cabY + 1.2, 0, 0xffc880, 1.2, 'night', 0.05);

  // тросы
  const tillerPivot = new V3(-L / 2 + 0.55, b.D(-L / 2 + 0.55) + 0.55, 0);
  b.add(strut(tillerPivot, new V3(tillerPivot.x + 1.0, tillerPivot.y + 0.1, 0.0), 0.03, woodTrim));

  // экипаж
  const helm = new Person({ coat: '#4a5a40', pants: '#3a342c', hat: 'sou', hatColor: '#d8b020', vest: undefined });
  helm.root.position.set(-3.1, b.D(-3.1), 0.05);
  b.add(helm.root);
  const deckhand = new Person({ coat: '#8a3a2a', pants: '#2e3238', hat: 'beanie', hatColor: '#2a2a30' });
  deckhand.root.position.set(2.3, b.D(2.3), 0.15);
  deckhand.root.rotation.y = 0.3;
  b.add(deckhand.root);
  const hand = new V3();
  const k = new V3();

  const mastTop = new V3(mx, 0, 0);
  void mastTop;
  b.upd.push((body, e) => {
    const sg = 1;
    const kk = Math.max(0.05, body.sailK * (0.45 + 0.55 * body.reef));
    const ph = 0.2 + 0.75 * smoothstep(-1, 1, body.windRel);
    const bdv = new V3(-Math.cos(ph), 0, sg * Math.sin(ph));
    const nrm = new V3(sg * Math.sin(ph), 0, Math.cos(ph));
    const bl = 2.9 * (0.7 + 0.3 * kk);
    const tack = new V3(mx, by, 0);
    const clew = tack.clone().addScaledVector(bdv, bl);
    const tl = new V3(mx, by + (ty - by) * kk + 0.02, 0);
    const peak = new V3(mx, by + (ty - by) * kk + 0.85 * kk, 0).addScaledVector(bdv, bl * 0.72);
    placeStrut(boom, tack, clew);
    boom.scale.x = 1;
    placeStrut(gaff, tl, peak);
    const luff = body.windRel < -0.55 ? 0.28 : 0.04;
    sail.set(tl, peak, tack, clew, nrm, (body.windRel > -0.2 ? 0.55 : -0.2) * kk, luff * kk, e.t);
    sail.mesh.visible = body.sailK > 0.03;
    tires.forEach((t, i) => (t.rotation.z = swing(body, 2) * 0.5 * (i % 2 ? -1 : 1)));
    // рулевой и палубный матрос
    helm.setLean(clamp(body.lean, -0.3, 0.3) + 0.05);
    helm.reach(1, new V3(0.55, 0.95, 0.2));
    helm.reach(0, null);
    deckhand.setLean(0.45 + 0.08 * Math.sin(e.t * 2.4));
    hand.set(0.42, 0.52 + 0.05 * Math.sin(e.t * 2.4), 0.05 + 0.08 * Math.cos(e.t * 2.4));
    k.set(0.45, 0.55 + 0.05 * Math.cos(e.t * 2.4), -0.1 + 0.06 * Math.sin(e.t * 2.4));
    deckhand.reach(1, hand);
    deckhand.reach(0, k);
  });
  void rope;
  return b.finish();
}
