/** Катер «Норд» и яхта «Альбатрос» */
import * as THREE from 'three';
import { clamp, damp } from './util3';
import type { VesselSpec } from './hull3';
import {
  Builder,
  Person,
  V3,
  anchorShape,
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
  smoothstep,
  std,
  strut,
  swing,
  texPlank,
  texSteel,
  torus,
  wet,
  wheelhouse,
  winch,
  type VesselModel,
} from './kit';
import { line, mast, sailMesh, spreader } from './rig';

/* ════════════════════════ Катер «Норд» ════════════════════════ */
export function buildCutter(spec: VesselSpec, cbx: number): VesselModel {
  const b = new Builder(spec, cbx);
  const { L } = b.g;
  const gloss = { roughness: 0.34, metalness: 0.1 };
  const white = std(spec.trim, { roughness: 0.45 });
  const blue = std(spec.hull, gloss);
  const alu = std('#c4cacf', { roughness: 0.3, metalness: 0.85 });
  const black = std('#18191c', { roughness: 0.7 });
  const { gunPort, gunStb } = loftHull(b, {
    section: 'round',
    pb: 1.7,
    ps: 2.8,
    sternFrac: 0.62,
    bowFlare: 1.35,
    sideFlare: 0.08,
    sheerH: 0.18,
    nSt: 64,
    mats: {
      bottom: wet('#14202a', { roughness: 0.7 }),
      boot: wet('#f0ece0', { roughness: 0.5 }),
      side: wet(spec.hull, gloss),
      sheer: wet(spec.trim, gloss),
    },
  });
  deckPatch(b, -L / 2 + 0.03, L / 2 - 0.03, std('#ffffff', { map: texSteel('#8a949a'), roughness: 0.75 }), 0.05);
  bulwark(b, gunPort, 0.42, white, 0.06, -L / 2 + 0.1, L / 2 - 0.15);
  bulwark(b, gunStb, 0.42, white, 0.06, -L / 2 + 0.1, L / 2 - 0.15);
  gunwale(b, gunPort, 0.03, black, 0.0);

  // рубка
  const cs0 = -1.7;
  const cs1 = 1.25;
  const cy0 = b.D(-0.4) - 0.02;
  const { roofY } = wheelhouse(b, { s0: cs0, s1: cs1, y0: cy0, h: 1.9, w: 2.05, slant: 0.5, color: spec.trim, trim: sh(spec.hull, 1.0), winRows: 3, sideWin: 3, doorAt: 'aft' });
  // мачта с радаром и антеннами
  const ms = -0.35;
  b.add(cyl(0.06, 0.08, 2.4, alu, ms, roofY + 1.2, 0, 10));
  b.height(roofY + 2.8);
  const radar = new THREE.Group();
  radar.position.set(ms, roofY + 1.9, 0);
  radar.add(cyl(0.05, 0.05, 0.18, black, 0, 0.0, 0, 8));
  radar.add(box(0.95, 0.07, 0.12, std('#d8dcde', { roughness: 0.5 }), 0, 0.12, 0, 0.02));
  b.add(radar);
  b.add(cyl(0.012, 0.012, 1.4, black, ms - 0.15, roofY + 3.0, 0.1, 5));
  b.add(mesh(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#e8e8e8'), ms + 0.15, roofY + 2.35, -0.1));
  b.lamp(b.hull, ms, roofY + 2.5, 0, 0xffffff, 0.9, 'nav', 0.05);
  const fl = makeFlag('#e6e6e6', 0.55, 0.33);
  fl.grp.position.set(ms, roofY + 2.38, 0.0);
  b.add(fl.grp);
  // прожекторы, гудок, спасплот на крыше
  for (const z of [-0.5, 0.5]) b.add(cyl(0.08, 0.1, 0.18, alu, cs1 - 0.5, roofY + 0.14, z, 10));
  b.add(cyl(0.1, 0.1, 0.7, std('#d8d0c0', { roughness: 0.6 }), cs0 + 0.55, roofY + 0.18, 0.4, 12)).rotation.z = Math.PI / 2;
  // дымовая труба
  funnel(b, cs0 - 0.4, b.D(cs0 - 0.4), 0.62, 0.55, 3.05, std('#e8e4dc', { roughness: 0.55 }), blue);
  // спасательный круг
  for (const side of [-1, 1]) {
    const lb = lifebuoy();
    lb.position.set(-1.05, cy0 + 1.25, side * (1.025 + 0.07));
    b.add(lb);
  }
  // носовая палуба
  const wl = cyl(0.12, 0.12, 0.7, std('#2c2f33', { roughness: 0.4, metalness: 0.8 }), L / 2 - 1.1, b.D(L / 2 - 1.1) + 0.3, 0, 12);
  wl.rotation.x = Math.PI / 2;
  b.add(wl);
  const anch = anchorShape(alu, 1.0);
  anch.position.set(L / 2 - 0.5, b.D(L / 2 - 0.5) + 0.42, b.bd(L / 2 - 0.5) - 0.15);
  anch.rotation.set(0, 0, -0.6);
  b.add(anch);
  for (const s of [L / 2 - 1.8, -L / 2 + 1.3]) for (const z of [-1, 1]) {
    const cl = cleat(alu);
    cl.position.set(s, b.D(s) + 0.02, z * (b.bd(s) - 0.15));
    b.add(cl);
  }
  // кормовая рама с блоком на маятнике
  const as = -L / 2 + 1.0;
  const ad = b.D(as);
  for (const z of [-0.95, 0.95]) b.add(strut(new V3(as, ad, z), new V3(as, ad + 2.5, z * 0.9), 0.06, alu));
  b.add(strut(new V3(as, ad + 2.5, -0.86), new V3(as, ad + 2.5, 0.86), 0.07, alu));
  const blockG = new THREE.Group();
  blockG.position.set(as, ad + 2.45, 0);
  blockG.add(cyl(0.008, 0.008, 1.0, black, 0, -0.5, 0, 5));
  blockG.add(box(0.1, 0.16, 0.06, std('#d8a020', { roughness: 0.5 }), 0, -1.05, 0, 0.02));
  const net = mesh(new THREE.SphereGeometry(0.28, 10, 8), std('#2f6a3a', { roughness: 1 }), 0, -1.4, 0);
  net.scale.set(1, 1.2, 1);
  blockG.add(net);
  b.add(blockG);
  // ящики и лебёдка на корме
  const crate = std('#2f6aa0', { roughness: 0.6 });
  for (let k = 0; k < 3; k++) b.add(box(0.55, 0.28, 0.4, k % 2 ? std('#e8e8ea') : crate, -1.9 - k * 0.0, b.D(-1.9) + 0.14 + k * 0.29, 0.6, 0.03));
  const wn = winch(alu, black, 0.16, 0.45);
  wn.position.set(-2.5, b.D(-2.5) + 0.4, -0.5);
  b.add(wn);
  const coil = ropeCoil('#d8b868', 0.28, 5);
  coil.position.set(-2.9, b.D(-2.9) + 0.02, 0.5);
  b.add(coil);
  // леера у носа
  railing(b, slice(gunPort, 1.4, L / 2 - 0.15).map((p) => new V3(p.x, p.y + 0.43, p.z * 0.97)), 0.35, alu, { rails: 1, post: 0.9 });
  railing(b, slice(gunStb, 1.4, L / 2 - 0.15).map((p) => new V3(p.x, p.y + 0.43, p.z * 0.97)), 0.35, alu, { rails: 1, post: 0.9 });
  // кранцы на маятниках
  const fenders = [-3.2, -0.4, 2.4].map((s) => {
    const f = fender('#f2f2f2');
    f.position.set(s, b.D(s) + 0.42, b.bd(s) + 0.03);
    b.add(f);
    return f;
  });
  b.nameplate('НОРД', 2.6, 0.55, 1.5, '#f0ece0');
  b.navLights(L / 2 - 1.6, b.D(L / 2 - 1.6) + 0.45, b.bd(L / 2 - 1.6) + 0.02);
  b.lamp(b.hull, cs0 + 0.05, cy0 + 1.4, 1.06, 0xffd890, 0.9, 'night', 0.045);
  const crew = new Person({ coat: '#e8601a', pants: '#2a2c30', hat: 'sou', hatColor: '#e8601a' });
  crew.root.position.set(-3.1, b.D(-3.1), 0.0);
  b.add(crew.root);

  b.upd.push((body, e) => {
    radar.rotation.y = e.t * 2.4;
    fl.update(e.t, e.aw);
    blockG.rotation.z = swing(body, 1) * 0.9;
    fenders.forEach((f, i) => (f.rotation.z = swing(body, 2) * 0.7 * (i % 2 ? -1 : 1)));
    crew.setLean(0.3 + 0.1 * Math.sin(e.t * 1.7));
    crew.reach(1, new V3(0.45, 0.8 + 0.06 * Math.sin(e.t * 1.7), 0.05));
    crew.reach(0, new V3(0.42, 0.78 + 0.06 * Math.cos(e.t * 1.7), -0.15));
  });
  return b.finish();
}

/* ════════════════════════ Яхта «Альбатрос» ════════════════════════ */
export function buildYacht(spec: VesselSpec, cbx: number): VesselModel {
  const b = new Builder(spec, cbx);
  const { L } = b.g;
  const gloss = { roughness: 0.2, metalness: 0.05 };
  const teak = std('#ffffff', { map: texPlank('#b98a50'), roughness: 0.75 });
  const teakSolid = std('#a97a42', { roughness: 0.7 });
  const whiteM = std('#f4f2ee', { roughness: 0.28 });
  const ss = std('#d2d6d8', { roughness: 0.2, metalness: 0.95 });
  const alu = std('#c9cdd0', { roughness: 0.3, metalness: 0.85 });
  const dark = std('#14161a', { roughness: 0.6 });
  const navy = std(spec.trim, { roughness: 0.55 });
  const { gunPort, gunStb } = loftHull(b, {
    section: 'round',
    pb: 1.8,
    ps: 2.6,
    sternFrac: 0.5,
    bowFlare: 1.25,
    sideFlare: 0.02,
    sheerH: 0.12,
    nSt: 64,
    mats: {
      bottom: wet('#1a2a50', { roughness: 0.6 }),
      boot: wet(spec.trim, { roughness: 0.5 }),
      side: wet(spec.hull, gloss),
      sheer: wet(spec.trim, gloss),
    },
  });
  deckPatch(b, -L / 2 + 0.04, L / 2 - 0.04, teak, 0.06);
  // привальный брус и леера
  gunwale(b, gunPort, 0.03, whiteM, 0.01);
  gunwale(b, gunStb, 0.03, whiteM, 0.01);
  for (const g of [gunPort, gunStb]) railing(b, slice(g, -L / 2 + 0.3, L / 2 - 0.35).map((p) => new V3(p.x, p.y + 0.06, p.z * 0.95)), 0.58, ss, { rails: 2, post: 1.05, r: 0.012 });

  // рубка-надстройка
  const cs0 = -1.75;
  const cs1 = 2.1;
  const cy0 = b.D(0.3) + 0.02;
  const { roofY } = wheelhouse(b, { s0: cs0, s1: cs1, y0: cy0, h: 0.55, w: 1.75, slant: 0.7, color: spec.hull, trim: sh('#a97a42', 1.0), winRows: 2, sideWin: 3, roofOver: 0.08, doorAt: 'none' });
  b.add(box(0.7, 0.07, 0.7, dark, 0.4, roofY + 0.04, 0, 0.02));
  b.add(box(0.6, 0.05, 0.6, std('#9fc4d8', { transparent: true, opacity: 0.45, roughness: 0.1 }), 0.4, roofY + 0.09, 0, 0.01));
  for (const z of [-0.45, 0.45]) {
    b.add(cyl(0.09, 0.09, 0.16, ss, 1.35, roofY + 0.12, z, 12));
    b.add(mesh(new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), whiteM, 1.35, roofY + 0.2, z));
  }
  // кокпит: сиденья, комингс, штурвал
  const cockS0 = -4.15;
  const cockS1 = -2.0;
  for (const side of [-1, 1]) {
    const zc = side * (b.bd(-3.1) - 0.38);
    b.add(box(cockS1 - cockS0, 0.07, 0.5, teakSolid, (cockS0 + cockS1) / 2, b.D(-3.1) + 0.32, zc, 0.01));
    b.add(box(cockS1 - cockS0, 0.34, 0.07, whiteM, (cockS0 + cockS1) / 2, b.D(-3.1) + 0.2, side * (b.bd(-3.1) - 0.04), 0.015));
    b.add(box(cockS1 - cockS0, 0.07, 0.1, teakSolid, (cockS0 + cockS1) / 2, b.D(-3.1) + 0.4, side * (b.bd(-3.1) - 0.04), 0.01));
    const wn = winch(ss, dark, 0.09, 0.2);
    wn.position.set(-2.25, b.D(-2.25) + 0.5, side * (b.bd(-2.25) - 0.12));
    b.add(wn);
  }
  b.add(box(0.06, 0.34, 0.5, whiteM, cockS1, b.D(cockS1) + 0.2, 0, 0.01));
  const ped = cyl(0.07, 0.09, 0.85, ss, -3.9, b.D(-3.9) + 0.42, 0, 12);
  b.add(ped);
  b.add(cyl(0.07, 0.07, 0.04, dark, -3.9, b.D(-3.9) + 0.88, 0, 12));
  const wheelTilt = new THREE.Group();
  wheelTilt.position.set(-3.9, b.D(-3.9) + 0.95, 0);
  wheelTilt.rotation.z = 0.2;
  const wheel = new THREE.Group();
  wheel.rotation.y = Math.PI / 2;
  const wr = torus(0.32, 0.022, std('#6a4a2a', { roughness: 0.5 }));
  wheel.add(wr);
  for (let k = 0; k < 4; k++) {
    const sp = cyl(0.01, 0.01, 0.64, ss, 0, 0, 0, 6);
    sp.rotation.z = (k * Math.PI) / 4;
    wheel.add(sp);
  }
  const hl = new THREE.Object3D();
  const hr = new THREE.Object3D();
  hl.position.set(0.32 * Math.cos(2.4), 0.32 * Math.sin(2.4), 0);
  hr.position.set(0.32 * Math.cos(0.6), 0.32 * Math.sin(0.6), 0);
  wheel.add(hl, hr);
  wheelTilt.add(wheel);
  b.add(wheelTilt);
  b.add(cyl(0.07, 0.07, 0.05, ss, -3.75, b.D(-3.75) + 0.2, 0, 14));
  b.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), std('#f0e8d0', { roughness: 0.3 }), -3.75, b.D(-3.75) + 0.26, 0));
  // рулевой
  const helm = new Person({ coat: '#c83a30', pants: '#d8d4c8', hat: 'cap', hatColor: '#f4f4f4', seated: true, legs: [1.35, 1.2] });
  helm.root.position.set(-3.25, b.D(-3.1) + 0.36, 0.5);
  b.add(helm.root);
  // кормовой рельс, трап
  for (const z of [-0.72, 0.72]) b.add(strut(new V3(-L / 2 + 0.2, b.D(-L / 2 + 0.2), z), new V3(-L / 2 + 0.2, b.D(-L / 2 + 0.2) + 0.75, z * 0.93), 0.014, ss));
  b.add(strut(new V3(-L / 2 + 0.2, b.D(-L / 2 + 0.2) + 0.75, -0.67), new V3(-L / 2 + 0.2, b.D(-L / 2 + 0.2) + 0.75, 0.67), 0.014, ss));
  b.lamp(b.hull, -L / 2 + 0.18, b.D(-L / 2) + 0.78, 0, 0xffffff, 0.6, 'nav', 0.04);
  // носовая палуба: люки, якорь, тендер
  for (const s of [1.2, 3.2]) b.add(box(0.6, 0.08, 0.6, std('#e8eef2', { roughness: 0.2 }), s, b.D(s) + 0.08, 0, 0.02));
  const anch = anchorShape(ss, 0.85);
  anch.position.set(L / 2 - 0.2, b.D(L / 2 - 0.2) + 0.14, 0);
  anch.rotation.set(0, 0, -1.2);
  b.add(anch);
  b.add(box(0.22, 0.1, 0.1, ss, L / 2 - 0.1, b.D(L / 2 - 0.1) + 0.06, 0, 0.02));
  const tender = caps(0.2, 1.3, std('#7a8288', { roughness: 0.8 }), 2.2, b.D(2.2) + 0.55, 0.6);
  tender.rotation.z = Math.PI / 2;
  b.add(tender);
  const tender2 = caps(0.2, 1.3, std('#7a8288', { roughness: 0.8 }), 2.2, b.D(2.2) + 0.55, 1.0);
  tender2.rotation.z = Math.PI / 2;
  void tender2;
  const coil = ropeCoil('#e8e0d0', 0.18, 4);
  coil.position.set(-1.0, b.D(-1.0) + 0.02, 0.7);
  b.add(coil);

  // мачта и такелаж
  const mx = 0.9;
  const md = b.D(mx);
  const mastH = 12.4;
  mast(b, mx, md, mastH, 0.075, 0.045, alu);
  b.add(box(0.2, 0.2, 0.2, whiteM, mx, md + 0.1, 0, 0.04));
  const top = new V3(mx, md + mastH - 0.25, 0);
  const sprLo = md + 4.3;
  const sprHi = md + 8.1;
  spreader(b, mx, sprLo, 1.1, alu);
  spreader(b, mx, sprHi, 0.85, alu);
  const wire = std('#9aa0a4', { roughness: 0.3, metalness: 0.9 });
  for (const side of [-1, 1]) {
    const cp = new V3(mx + 0.1, b.D(mx + 0.1) + 0.04, side * (b.bd(mx) - 0.06));
    line(b, cp, new V3(mx, sprLo, side * 0.55), 0.008, wire);
    line(b, new V3(mx, sprLo, side * 0.55), new V3(mx, sprHi, side * 0.42), 0.008, wire);
    line(b, new V3(mx, sprHi, side * 0.42), top, 0.008, wire);
    const cp2 = new V3(mx - 0.4, b.D(mx - 0.4) + 0.04, side * (b.bd(mx) - 0.06));
    line(b, cp2, new V3(mx, sprLo, side * 0.55), 0.007, wire);
    line(b, new V3(mx, sprLo, side * 0.55), new V3(mx, md + mastH * 0.5 + 1.0, 0), 0.007, wire);
  }
  const bow = new V3(L / 2 - 0.12, b.D(L / 2) + 0.35, 0);
  const stern = new V3(-L / 2 + 0.2, b.D(-L / 2 + 0.2) + 0.5, 0);
  line(b, top, bow, 0.01, wire);
  line(b, top, stern, 0.01, wire);
  b.add(cyl(0.012, 0.012, 0.75, ss, mx, md + mastH + 0.35, 0, 6));
  const windex = makeFlag('#d83a30', 0.18, 0.1);
  windex.grp.position.set(mx, md + mastH + 0.72, 0);
  b.add(windex.grp);
  b.lamp(b.hull, mx, md + mastH + 0.1, 0, 0xffffff, 0.95, 'nav', 0.05);
  b.lamp(b.hull, mx + 0.05, md + 6.2, 0, 0xffffff, 0.8, 'nav', 0.04);
  b.navLights(L / 2 - 0.5, b.D(L / 2 - 0.5) + 0.62, b.bd(L / 2 - 0.5) * 0.98);
  b.height(md + mastH + 0.9);

  // гик и паруса
  const by = md + 1.3;
  const boom = cyl(0.045, 0.045, 1, alu, mx, by, 0, 8);
  const vang = cyl(0.014, 0.014, 1, wire, mx, by, 0, 5);
  const lift = cyl(0.008, 0.008, 1, wire, mx, by, 0, 5);
  b.add(boom);
  b.add(vang);
  b.add(lift);
  const main = sailMesh(b, '#f6f4ee');
  const jib = sailMesh(b, '#efeee8');
  const battens: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const bt = cyl(0.012, 0.012, 1, std('#222428', { roughness: 0.5 }), 0, 0, 0, 5);
    battens.push(bt);
    b.add(bt);
  }
  const tmpA = new V3();
  const tmpB = new V3();
  const tmpC = new V3();
  const mainBoomLen = 4.3;
  b.upd.push((body, e, dt) => {
    const kk = Math.max(0.04, body.sailK * (0.4 + 0.6 * body.reef));
    const showing = body.sailK > 0.03;
    const phi = 0.2 + 0.75 * smoothstep(-1, 1, body.windRel);
    const bdv = new V3(-Math.cos(phi), 0, Math.sin(phi));
    const nrm = new V3(Math.sin(phi), 0, Math.cos(phi));
    const tack = new V3(mx - 0.12, by, 0);
    const clew = tack.clone().addScaledVector(bdv, mainBoomLen * (0.55 + 0.45 * kk));
    const headY = by + (md + mastH - 0.7 - by) * kk;
    const head = new V3(mx - 0.1, headY, 0);
    const head2 = head.clone().addScaledVector(bdv, 0.3 * kk);
    const luffing = body.windRel < -0.55;
    const bulge = (luffing ? -0.1 : 0.85) * kk;
    main.set(head, head2, tack, clew, nrm, bulge, luffing ? 0.4 * kk : 0.05 * kk, e.t);
    main.mesh.visible = showing;
    placeStrut(boom, new V3(mx, by, 0), clew);
    placeStrut(vang, new V3(mx, md + 0.15, 0), tmpA.set(mx, by, 0).addScaledVector(bdv, 1.2));
    placeStrut(lift, top.clone().setY(md + mastH - 1.0), clew);
    battens.forEach((bt, i) => {
      const v = (i + 1) / 5;
      const aX = head2.x + (clew.x - head2.x) * v;
      const aY = head2.y + (clew.y - head2.y) * v;
      const aZ = head2.z + (clew.z - head2.z) * v;
      tmpB.set(aX, aY, aZ);
      tmpC.set(tack.x + (head.x - tack.x) * (1 - v), tack.y + (head.y - tack.y) * (1 - v), 0).lerp(tmpB, 0.72);
      placeStrut(bt, tmpC, tmpB);
      bt.visible = showing && kk > 0.4;
    });
    // стаксель
    const jt = new V3(mx + 0.05, md + mastH - 1.2 * (1 - kk) - 1.0, 0);
    const jTack = new V3(L / 2 - 0.25, b.D(L / 2) + 0.4, 0);
    const jc = new V3(mx - 0.3, b.D(mx) + 0.95, Math.sin(phi) * 1.35);
    const jdx = jc.x - jTack.x;
    const jdz = jc.z - jTack.z;
    const jl = Math.hypot(jdx, jdz) || 1;
    const jn = new V3(jdz / jl, 0, -jdx / jl);
    jib.set(jt, jt.clone().add(new V3(0.05, 0, 0)), jTack, jc, jn, (luffing ? -0.05 : 0.7) * kk, luffing ? 0.45 * kk : 0.05 * kk, e.t + 1.3);
    jib.mesh.visible = showing;
    windex.update(e.t, e.aw);
    wheel.rotation.x = damp(wheel.rotation.x, clamp(-body.yawRate * 0.15, -0.58, 0.58), 5.5, dt);
    helm.setLean(clamp(body.lean, -0.3, 0.3) + 0.12);
    b.root.updateMatrixWorld(true);
    hl.getWorldPosition(tmpA);
    helm.root.worldToLocal(tmpA);
    helm.reach(1, tmpA.clone());
    hr.getWorldPosition(tmpA);
    helm.root.worldToLocal(tmpA);
    helm.reach(0, tmpA.clone());
  });
  void fender;
  void navy;
  return b.finish();
}
