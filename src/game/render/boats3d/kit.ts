/**
 * 3D-кит для моделей судов (three.js).
 *
 * Модели строятся в метрах в системе корпуса: s — вдоль судна (нос +), y — вверх от
 * спокойной ватерлинии, z — поперёк (+z к камере). Корпус лофтится по тем же профилям
 * (keelShape / deckHeight), что и физика, поэтому подводная часть совпадает с расчётом.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, mix, rng } from './util3';
import { HULLS, deckHeight, keelShape, type HullGeo, type VesselBody } from './hull3';
import type { VesselSpec } from './hull3';

export const V3 = THREE.Vector3;
export type V3 = THREE.Vector3;

/** Условия кадра для анимации моделей */
export interface Env3 {
  t: number;
  night: number;
  lights: number;
  day: number;
  golden: number;
  /** ветер со знаком, м/с (+ вправо) */
  windS: number;
  /** кажущийся ветер вдоль судна: + дует в нос, − в корму (−1.4…1.4) */
  aw: number;
  temp: number;
  rain: number;
  fog: number;
}
export type Upd = (b: VesselBody, e: Env3, dt: number) => void;

export interface VesselModel {
  root: THREE.Group;
  top: number;
  draft: number;
  halfLen: number;
  smoke: THREE.Object3D[];
  prop: THREE.Object3D | null;
  update: (b: VesselBody, e: Env3, dt: number) => void;
  dispose: () => void;
}

/* ════════════════════ шейдер ватерлинии ════════════════════ */

/** Общие uniform'ы: высота воды вдоль судна (по 32 точкам), пена, ночь */
export const WL = {
  uWave: { value: new Float32Array(32) },
  uX0: { value: -8 },
  uInv: { value: 1 },
  uOn: { value: 1 },
  uNight: { value: 0 },
};

/**
 * Обрезает всё, что ниже воды (только внешние грани — внутренность корпуса остаётся сухой),
 * и красит полосу у ватерлинии пеной.
 */
export function patch<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWave = WL.uWave;
    sh.uniforms.uX0 = WL.uX0;
    sh.uniforms.uInv = WL.uInv;
    sh.uniforms.uOn = WL.uOn;
    sh.uniforms.uNight = WL.uNight;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uWave[32]; uniform float uX0; uniform float uInv; uniform float uOn; uniform float uNight;
varying vec3 vWP;
float waveH(float x){ float f = clamp((x - uX0) * uInv, 0.0, 30.999); int i = int(floor(f)); return mix(uWave[i], uWave[i + 1], f - float(i)); }`
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
float wlD = vWP.y - waveH(vWP.x);
if (uOn > 0.5 && gl_FrontFacing && wlD < 0.0) discard;`
      )
      .replace(
        '#include <dithering_fragment>',
        `if (uOn > 0.5 && gl_FrontFacing) {
  float fm = smoothstep(0.11, 0.0, wlD);
  float nn = fract(sin(dot(floor(vWP.xy * 16.0), vec2(12.9898, 78.233))) * 43758.5453);
  fm *= 0.5 + 0.5 * nn;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.93, 0.97, 0.99) * (1.0 - 0.65 * uNight), fm * 0.8);
}
#include <dithering_fragment>`
      );
  };
  m.customProgramCacheKey = () => 'wlclip';
  return m;
}

/** Обычный (сухой) материал: внутренности, надстройки, люди */
export function std(color: THREE.ColorRepresentation, o: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...o });
}
/** «Мокрый» материал: обрезается по воде и пенится у ватерлинии (обшивка, винт, руль) */
export function wet(color: THREE.ColorRepresentation, o: THREE.MeshStandardMaterialParameters = {}) {
  return patch(std(color, o));
}

/* ════════════════════ процедурные текстуры ════════════════════ */

const cache = new Map<string, THREE.CanvasTexture>();
function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat = true) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}
export const sh = (c: string, k: number) => (k <= 1 ? mix(c, '#000000', 1 - k) : mix(c, '#ffffff', k - 1));

export const texPlank = (base: string) =>
  canvasTex('plank' + base, 256, 256, (g, w, h) => {
    const r = rng(7);
    const rows = 8;
    const rh = h / rows;
    for (let i = 0; i < rows; i++) {
      const y = i * rh;
      g.fillStyle = sh(base, 0.88 + r() * 0.24);
      g.fillRect(0, y, w, rh);
      for (let k = 0; k < 16; k++) {
        g.strokeStyle = `rgba(0,0,0,${0.03 + r() * 0.07})`;
        g.lineWidth = 1;
        const yy = y + r() * rh;
        g.beginPath();
        g.moveTo(0, yy);
        g.bezierCurveTo(w * 0.3, yy + (r() - 0.5) * 3, w * 0.6, yy + (r() - 0.5) * 3, w, yy + (r() - 0.5) * 2);
        g.stroke();
      }
      g.fillStyle = 'rgba(25,14,6,0.6)';
      g.fillRect(0, y + rh - 1.6, w, 1.6);
      g.fillRect(r() * w, y, 1.6, rh);
    }
  });

export const texStrake = (base: string) =>
  canvasTex('strake' + base, 256, 256, (g, w, h) => {
    const n = 7;
    const s = h / n;
    const r = rng(5);
    for (let i = 0; i < n; i++) {
      const y = i * s;
      const gr = g.createLinearGradient(0, y, 0, y + s);
      gr.addColorStop(0, sh(base, 1.18));
      gr.addColorStop(0.7, base);
      gr.addColorStop(1, sh(base, 0.6));
      g.fillStyle = gr;
      g.fillRect(0, y, w, s);
      for (let k = 0; k < 10; k++) {
        g.strokeStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`;
        const yy = y + r() * s;
        g.beginPath();
        g.moveTo(0, yy);
        g.lineTo(w, yy + (r() - 0.5) * 2);
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(0, y + s - 2, w, 2);
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.fillRect(0, y + 1, w, 1.5);
      g.fillStyle = 'rgba(30,20,12,0.7)';
      for (let x = 6; x < w; x += 18) g.fillRect(x, y + s * 0.55, 2, 2);
    }
  });

export const texSteel = (base: string, rust = '#7a3b1e') =>
  canvasTex('steel' + base + rust, 256, 256, (g, w, h) => {
    const r = rng(11);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${0.015 + r() * 0.035})` : `rgba(0,0,0,${0.02 + r() * 0.05})`;
      g.fillRect(r() * w, r() * h, 4 + r() * 28, 3 + r() * 16);
    }
    for (let y = 0; y < h; y += 64) {
      g.fillStyle = 'rgba(0,0,0,0.38)';
      g.fillRect(0, y, w, 2);
      g.fillStyle = 'rgba(255,255,255,0.1)';
      g.fillRect(0, y + 2, w, 1.5);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      for (let x = 4; x < w; x += 12) g.fillRect(x, y + 6, 2.2, 2.2);
    }
    for (let x = 0; x < w; x += 128) {
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(x, 0, 2, h);
    }
    for (let i = 0; i < 8; i++) {
      const x = r() * w;
      const len = 40 + r() * 140;
      const gr = g.createLinearGradient(0, 0, 0, len);
      gr.addColorStop(0, rust + 'aa');
      gr.addColorStop(1, rust + '00');
      g.fillStyle = gr;
      g.fillRect(x, r() * 40, 2 + r() * 6, len);
    }
  });

export const texSail = (base: string, cross = true) =>
  canvasTex('sail' + base + cross, 256, 256, (g, w, h) => {
    const r = rng(3);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(0,0,0,${0.01 + r() * 0.02})`;
      g.fillRect(r() * w, r() * h, 10 + r() * 40, 2 + r() * 8);
    }
    g.fillStyle = 'rgba(70,60,40,0.22)';
    for (let k = 1; k < 8; k++) {
      if (cross) g.fillRect(0, (k * h) / 8, w, 1.4);
      else g.fillRect((k * w) / 8, 0, 1.4, h);
    }
    const eg = g.createLinearGradient(0, 0, w, 0);
    eg.addColorStop(0, 'rgba(0,0,0,0.12)');
    eg.addColorStop(0.12, 'rgba(0,0,0,0)');
    g.fillStyle = eg;
    g.fillRect(0, 0, w, h);
  }, false);

export const texName = (text: string, fg: string) =>
  canvasTex('name' + text + fg, 512, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = '700 84px Georgia, "Times New Roman", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  }, false);

export const texGlow = (() => {
  let t: THREE.CanvasTexture | null = null;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.18, 'rgba(255,255,255,0.65)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.14)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
})();

/* ════════════════════ простые формы ════════════════════ */

export function mesh<G extends THREE.BufferGeometry>(geo: G, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
export const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, r = 0) =>
  mesh(r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)) : new THREE.BoxGeometry(w, h, d), mat, x, y, z);
export const cyl = (rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 16) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);
export const ball = (r: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 14) => mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)), mat, x, y, z);
export const caps = (r: number, len: number, mat: THREE.Material, x = 0, y = 0, z = 0) => mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat, x, y, z);
export const torus = (R: number, r: number, mat: THREE.Material, x = 0, y = 0, z = 0, arc = Math.PI * 2) => mesh(new THREE.TorusGeometry(R, r, 8, 28, arc), mat, x, y, z);

/** Поставить цилиндр-стержень между двумя точками */
export function placeStrut(m: THREE.Object3D, a: V3, b: V3) {
  const d = new V3().subVectors(b, a);
  const len = d.length() || 0.0001;
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.multiplyScalar(1 / len));
  m.scale.set(1, len, 1);
}
/** Стержень единичной высоты (масштабируется placeStrut) */
export function strut(a: V3, b: V3, r: number, mat: THREE.Material, seg = 6) {
  const m = mesh(new THREE.CylinderGeometry(r, r, 1, seg), mat);
  m.castShadow = r > 0.03;
  placeStrut(m, a, b);
  return m;
}
export function tubeAlong(pts: V3[], r: number, mat: THREE.Material, seg = 48, closed = false) {
  const curve = new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', 0.2);
  return mesh(new THREE.TubeGeometry(curve, seg, r, 6, closed), mat);
}
export function lathe(profile: [number, number][], mat: THREE.Material, x = 0, y = 0, z = 0, seg = 20) {
  return mesh(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), seg), mat, x, y, z);
}
/** Многоугольник XY, выдавленный по z (центрируется по z) */
export function extrude(pts: [number, number][], depth: number, mat: THREE.Material, bevel = 0.03) {
  const sp = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sp, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return mesh(g, mat);
}

/* ════════════════════ освещение: огни ════════════════════ */

interface Lamp {
  m: THREE.Mesh;
  spr: THREE.Sprite;
  on: THREE.Color;
  off: THREE.Color;
  size: number;
  mode: 'night' | 'nav' | 'always';
}

/* ════════════════════ сборщик ════════════════════ */

export class Builder {
  readonly root = new THREE.Group();
  /** начало — середина корпуса; сдвинут так, чтобы центр тяжести лёг в ноль */
  readonly hull = new THREE.Group();
  readonly g: HullGeo;
  readonly upd: Upd[] = [];
  readonly lamps: Lamp[] = [];
  readonly smoke: THREE.Object3D[] = [];
  readonly glass: THREE.MeshStandardMaterial;
  readonly snow: THREE.Object3D[] = [];
  prop: THREE.Object3D | null = null;
  top = 2;
  /** полуширина корпуса на ватерлинии и на палубе, м */
  bw: (s: number) => number = () => 0.5;
  bd: (s: number) => number = () => 0.5;
  /** z борта на высоте y в сечении s */
  sideZ: (s: number, y: number) => number = () => 0.5;

  constructor(readonly spec: VesselSpec, cbx: number) {
    this.g = HULLS[spec.style];
    this.hull.position.x = -cbx;
    this.root.rotation.order = 'YZX';
    this.root.add(this.hull);
    this.glass = std(0x1b2a38, { roughness: 0.07, metalness: 0.8, emissive: 0xffb35c, emissiveIntensity: 0, envMapIntensity: 1.5 });
  }
  D = (s: number) => deckHeight(this.g, (2 * s) / this.g.L);
  add<T extends THREE.Object3D>(o: T, parent: THREE.Object3D = this.hull): T {
    parent.add(o);
    return o;
  }
  height(y: number) {
    this.top = Math.max(this.top, y);
  }

  lamp(parent: THREE.Object3D, x: number, y: number, z: number, color: number, size = 0.9, mode: Lamp['mode'] = 'night', r = 0.06) {
    const on = new THREE.Color(color);
    const off = on.clone().multiplyScalar(0.4);
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color: off }));
    m.position.set(x, y, z);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    spr.position.copy(m.position);
    spr.visible = false;
    parent.add(m, spr);
    this.lamps.push({ m, spr, on, off, size, mode });
    return m;
  }

  /** Ходовые огни: красный — левый борт (−z при курсе вправо), зелёный — правый */
  navLights(sBow: number, yBow: number, zBow: number) {
    this.lamp(this.hull, sBow, yBow, -zBow, 0xff2a2a, 0.55, 'nav', 0.05);
    this.lamp(this.hull, sBow, yBow, zBow, 0x30ff60, 0.55, 'nav', 0.05);
  }

  /** Фирменная табличка с названием на обоих бортах */
  nameplate(text: string, s: number, y: number, w: number, color: string) {
    const t = texName(text, color);
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false });
    const mk = (side: 1 | -1) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), mat);
      p.position.set(s, y, side * (this.sideZ(s, y) + 0.012));
      if (side < 0) p.rotation.y = Math.PI;
      this.hull.add(p);
    };
    mk(1);
    mk(-1);
  }

  tick(b: VesselBody, e: Env3, dt: number) {
    this.glass.emissiveIntensity = e.lights * 1.7;
    for (const l of this.lamps) {
      const on = l.mode === 'always' ? 1 : l.mode === 'nav' ? clamp(e.lights * 1.7 + e.fog * 0.9, 0, 1) : clamp(e.lights * 1.4, 0, 1);
      (l.m.material as THREE.MeshBasicMaterial).color.copy(l.off).lerp(l.on, on);
      l.spr.visible = on > 0.04;
      (l.spr.material as THREE.SpriteMaterial).opacity = on * 0.95;
      l.spr.scale.setScalar(l.size * (0.55 + 0.9 * on));
    }
    const snowOn = e.temp < 0.5;
    for (const o of this.snow) o.visible = snowOn;
    for (const u of this.upd) u(b, e, dt);
  }

  finish(): VesselModel {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.userData.noShadow) {
        m.castShadow = false;
      }
    });
    return {
      root: this.root,
      top: this.top,
      draft: this.g.T + 0.3,
      halfLen: this.g.L / 2 + 1,
      smoke: this.smoke,
      prop: this.prop,
      update: (b, e, dt) => this.tick(b, e, dt),
      dispose: () => {
        this.root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          const mat = m.material as THREE.Material | THREE.Material[] | undefined;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else if (mat && !(mat as THREE.SpriteMaterial).map) mat.dispose();
        });
      },
    };
  }
}

/* ════════════════════ лофтинг корпуса ════════════════════ */

export interface HullOpts {
  section: 'round' | 'flat' | 'vee';
  /** острота носа (больше — полнее) и кормы */
  pb: number;
  ps: number;
  /** доля ширины на транце (0 — острая корма) */
  sternFrac: number;
  bowFlare: number;
  sideFlare: number;
  mats: { bottom: THREE.Material; boot: THREE.Material; side: THREE.Material; sheer: THREE.Material; inner?: THREE.Material; transom?: THREE.Material };
  sheerH?: number;
  nSt?: number;
  uvScale?: number;
}

export function loftHull(b: Builder, o: HullOpts) {
  const { L, B, T } = b.g;
  const n = o.nSt ?? 64;
  const nL = 9;
  const P = nL + 6;
  const R = 2 * P - 1;
  const beam = (u: number) =>
    u >= 0 ? Math.pow(Math.max(0, 1 - Math.pow(u, o.pb)), 0.6) : o.sternFrac + (1 - o.sternFrac) * Math.pow(Math.max(0, 1 - Math.pow(-u, o.ps)), 0.6);
  const bwAt = (s: number) => Math.max(0.012, (B / 2) * beam((2 * s) / L));
  const flareAt = (s: number) => {
    const u = (2 * s) / L;
    return (1 + o.sideFlare) * (1 + (o.bowFlare - 1) * Math.pow(Math.max(0, u), 1.4));
  };
  const bdAt = (s: number) => bwAt(s) * flareAt(s);
  const sideZ = (s: number, y: number) => {
    const D = b.D(s);
    const bw = bwAt(s);
    return bw + (bdAt(s) - bw) * Math.pow(clamp(y / D, 0, 1), 1.15);
  };
  b.bw = bwAt;
  b.bd = bdAt;
  b.sideZ = sideZ;

  const pos = new Float32Array((n + 1) * R * 3);
  const uv = new Float32Array((n + 1) * R * 2);
  const ringPts: V3[][] = [];
  const us = o.uvScale ?? 0.4;
  for (let i = 0; i <= n; i++) {
    const s = -L / 2 + L * (0.5 - 0.5 * Math.cos((Math.PI * i) / n));
    const u = (2 * s) / L;
    const bw = bwAt(s);
    const bd = bdAt(s);
    const yk = -T * keelShape(u);
    const D = b.D(s);
    const half: [number, number][] = [];
    for (let k = 0; k < nL; k++) {
      const a = k / (nL - 1);
      let z: number;
      let y: number;
      if (o.section === 'round') {
        z = bw * Math.sin((a * Math.PI) / 2);
        y = yk * Math.cos((a * Math.PI) / 2);
      } else if (o.section === 'flat') {
        if (a < 0.4) {
          z = bw * 0.55 * (a / 0.4);
          y = yk;
        } else {
          const t = (a - 0.4) / 0.6;
          z = bw * (0.55 + 0.45 * t);
          y = yk * (1 - Math.pow(t, 0.9));
        }
      } else if (a < 0.7) {
        const t = a / 0.7;
        z = bw * 0.93 * t;
        y = yk * (1 - 0.84 * t);
      } else {
        const t = (a - 0.7) / 0.3;
        z = bw * (0.93 + 0.07 * t);
        y = yk * 0.16 * (1 - t);
      }
      half.push([z, y]);
    }
    const yb = Math.min(0.12, D * 0.22);
    const yS = D - Math.min(o.sheerH ?? 0.14, D * 0.25);
    const levels = [yb, yb + (yS - yb) * 0.25, yb + (yS - yb) * 0.5, yb + (yS - yb) * 0.75, yS, D];
    for (const y of levels) half.push([bw + (bd - bw) * Math.pow(y / D, 1.15), y]);
    const ring: V3[] = [];
    for (let j = 0; j < R; j++) {
      const k = j < P ? P - 1 - j : j - P + 1;
      const sign = j < P ? -1 : 1;
      const [z, y] = half[k];
      const idx = i * R + j;
      pos[idx * 3] = s;
      pos[idx * 3 + 1] = y;
      pos[idx * 3 + 2] = sign * z;
      uv[idx * 2] = s * us;
      uv[idx * 2 + 1] = y;
      ring.push(new V3(s, y, sign * z));
    }
    ringPts.push(ring);
  }

  const bands = [
    { k0: 0, k1: nL - 1, m: 0 },
    { k0: nL - 1, k1: nL, m: 1 },
    { k0: nL, k1: nL + 4, m: 2 },
    { k0: nL + 4, k1: nL + 5, m: 3 },
  ];
  const idxs: number[] = [];
  const groups: [number, number, number][] = [];
  for (const bd of bands) {
    const start = idxs.length;
    const ranges: [number, number][] = [
      [P - 1 + bd.k0, P - 1 + bd.k1],
      [P - 1 - bd.k1, P - 1 - bd.k0],
    ];
    for (const [j0, j1] of ranges) {
      for (let i = 0; i < n; i++) {
        for (let j = j0; j < j1; j++) {
          const a = i * R + j;
          const bb = (i + 1) * R + j;
          const c = i * R + j + 1;
          const d = (i + 1) * R + j + 1;
          idxs.push(a, bb, c, bb, d, c);
        }
      }
    }
    groups.push([start, idxs.length - start, bd.m]);
  }
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idxs);
  for (const [s0, c0, m0] of groups) geo.addGroup(s0, c0, m0);
  geo = toCreasedNormals(geo, 0.75);

  const m = o.mats;
  b.add(mesh(geo, [m.bottom, m.boot, m.side, m.sheer]));
  if (m.inner) {
    const inner = new THREE.Mesh(geo, m.inner);
    inner.receiveShadow = true;
    b.add(inner);
  }

  // транец
  if (o.sternFrac > 0.05) {
    const ring = ringPts[0];
    const cy = ring.reduce((a, p) => a + p.y, 0) / ring.length;
    const tp: number[] = [];
    const c = new V3(ring[0].x, cy, 0);
    for (let j = 0; j < R; j++) {
      const a = ring[j];
      const bn = ring[(j + 1) % R];
      tp.push(c.x, c.y, c.z, a.x, a.y, a.z, bn.x, bn.y, bn.z);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
    tg.computeVertexNormals();
    b.add(mesh(tg, m.transom ?? m.side));
  }
  const gunPort = ringPts.map((r) => r[0].clone());
  const gunStb = ringPts.map((r) => r[R - 1].clone());
  return { gunPort, gunStb };
}

/** Палуба на участке корпуса [s0, s1] с развалом и небольшой погибью */
export function deckPatch(b: Builder, s0: number, s1: number, mat: THREE.Material, crown = 0.05, inset = 0.985, nAcross = 7) {
  const n = Math.max(6, Math.round(((s1 - s0) / b.g.L) * 60));
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n;
    const bd = b.bd(s) * inset;
    const D = b.D(s);
    for (let k = 0; k < nAcross; k++) {
      const q = (k / (nAcross - 1)) * 2 - 1;
      pos.push(s, D + crown * (1 - q * q), q * bd);
      uv.push(s * 0.5, q * bd * 0.5);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < nAcross - 1; k++) {
      const a = i * nAcross + k;
      const c = a + 1;
      const d = (i + 1) * nAcross + k;
      const e = d + 1;
      idx.push(a, c, d, c, e, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = mesh(g, mat);
  return b.add(m);
}

/** Горизонтальная пластина (пайол, настил) внутри открытой лодки */
export function floorPlate(b: Builder, y: number, s0: number, s1: number, half: (s: number) => number, mat: THREE.Material, thick = 0.03) {
  const pts: THREE.Vector2[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n;
    pts.push(new THREE.Vector2(s, half(s)));
  }
  for (let i = n; i >= 0; i--) {
    const s = s0 + ((s1 - s0) * i) / n;
    pts.push(new THREE.Vector2(s, -half(s)));
  }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: thick, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return b.add(mesh(g, mat));
}

/** Планширь (трубка вдоль борта) */
export function gunwale(b: Builder, pts: V3[], r: number, mat: THREE.Material, lift = 0.01) {
  const step = Math.max(1, Math.floor(pts.length / 40));
  const ps = pts.filter((_, i) => i % step === 0 || i === pts.length - 1).map((p) => new V3(p.x, p.y + lift, p.z));
  return b.add(tubeAlong(ps, r, mat, ps.length * 3));
}

/** Фальшборт: тонкая стенка над палубой вдоль борта */
export function bulwark(b: Builder, pts: V3[], h: number, mat: THREE.Material, thick = 0.05, s0 = -1e9, s1 = 1e9) {
  const use = pts.filter((p) => p.x >= s0 && p.x <= s1);
  if (use.length < 2) return;
  const pos: number[] = [];
  const idx: number[] = [];
  const side = use[0].z >= 0 ? 1 : -1;
  use.forEach((p, i) => {
    const zo = p.z + side * 0.003;
    const zi = p.z - side * thick;
    pos.push(p.x, p.y, zo, p.x, p.y + h, zo, p.x, p.y + h, zi, p.x, p.y, zi);
    if (i > 0) {
      const a = (i - 1) * 4;
      const c = i * 4;
      // наружная, верхняя и внутренняя грани
      for (let q = 0; q < 3; q++) {
        const q0 = a + q;
        const q1 = a + q + 1;
        const r0 = c + q;
        const r1 = c + q + 1;
        idx.push(q0, r0, q1, r0, r1, q1);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (mat instanceof THREE.MeshStandardMaterial) mat.side = THREE.DoubleSide;
  b.add(m);
  // верхняя «планка»
  const rail = use.map((p) => new V3(p.x, p.y + h + 0.01, p.z - side * thick * 0.5));
  gunwale(b, rail, thick * 0.65, mat, 0);
}

/** Леер: стойки и поручни по пути (точки на уровне палубы) */
export function railing(b: Builder, path: V3[], h: number, mat: THREE.Material, o: { post?: number; rails?: number; r?: number } = {}) {
  const r = o.r ?? 0.022;
  const rails = o.rails ?? 2;
  const curve = new THREE.CatmullRomCurve3(path, false, 'catmullrom', 0.1);
  const count = Math.max(2, Math.round(curve.getLength() / (o.post ?? 0.9)));
  const posts: THREE.BufferGeometry[] = [];
  for (const p of curve.getSpacedPoints(count)) {
    const g = new THREE.CylinderGeometry(r, r, h, 6);
    g.translate(p.x, p.y + h / 2, p.z);
    posts.push(g);
  }
  b.add(mesh(mergeGeometries(posts)!, mat));
  for (let k = 1; k <= rails; k++) {
    const lift = (h * k) / rails;
    const pts = path.map((p) => new V3(p.x, p.y + lift, p.z));
    b.add(tubeAlong(pts, r * 0.8, mat, 40));
  }
}

/** Пояс из точек борта в диапазоне [s0, s1] (для лееров и фальшборта) */
export const slice = (pts: V3[], s0: number, s1: number) => pts.filter((p) => p.x >= s0 && p.x <= s1);

/* ════════════════════ человек ════════════════════ */

export interface PersonOpts {
  coat: string;
  pants?: string;
  hat?: 'cap' | 'sou' | 'beanie' | 'hood' | 'helmet' | 'none';
  hatColor?: string;
  seated?: boolean;
  boots?: string;
  vest?: string;
  legs?: [number, number];
  scale?: number;
}

const UP = new V3(0, 1, 0);
function placeLimb(m: THREE.Object3D, a: V3, c: V3) {
  const d = new V3().subVectors(c, a);
  const len = d.length() || 1e-4;
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.multiplyScalar(1 / len));
}

/** Низкополигональный человек с двухзвенными руками (IK) */
export class Person {
  readonly root = new THREE.Group();
  private readonly hipY: number;
  private readonly torso = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly arms: { up: THREE.Mesh; fo: THREE.Mesh; hand: THREE.Mesh }[] = [];
  private readonly L1 = 0.27;
  private readonly L2 = 0.26;
  lean = 0;
  constructor(o: PersonOpts) {
    const skin = std('#d9a57f', { roughness: 0.75 });
    const coat = std(o.coat, { roughness: 0.85 });
    const pants = std(o.pants ?? '#2c3440', { roughness: 0.9 });
    const boot = std(o.boots ?? '#1b1b1d', { roughness: 0.6 });
    const seated = !!o.seated;
    this.hipY = seated ? 0.14 : 0.92;
    this.root.scale.setScalar(o.scale ?? 1);
    const [ta, tk] = o.legs ?? (seated ? [1.5, 1.5] : [0.03, 0.06]);
    for (const z of [-0.09, 0.09]) {
      const hip = new V3(0, this.hipY, z);
      const knee = hip.clone().add(new V3(Math.sin(ta), -Math.cos(ta), 0).multiplyScalar(0.44));
      const tb = ta - tk;
      const ank = knee.clone().add(new V3(Math.sin(tb), -Math.cos(tb), 0).multiplyScalar(0.44));
      const th = caps(0.075, 0.28, pants);
      placeLimb(th, hip, knee);
      const sn = caps(0.06, 0.28, pants);
      placeLimb(sn, knee, ank);
      const bt = box(0.27, 0.1, 0.11, boot, ank.x + 0.07, ank.y - 0.03, z, 0.03);
      this.root.add(th, sn, bt);
    }
    // торс (вращается вокруг таза)
    this.torso.position.set(0, this.hipY, 0);
    const tor = caps(0.15, 0.33, coat, 0, 0.3, 0);
    tor.scale.z = 1.3;
    this.torso.add(tor);
    if (o.vest) {
      const v = caps(0.158, 0.3, std(o.vest, { roughness: 0.7 }), 0.005, 0.32, 0);
      v.scale.z = 1.34;
      this.torso.add(v);
    }
    this.head.position.set(0.02, 0.76, 0);
    this.head.add(ball(0.115, skin, 0, 0, 0, 12));
    const hc = std(o.hatColor ?? '#2a2f3a', { roughness: 0.8 });
    switch (o.hat ?? 'cap') {
      case 'cap': {
        this.head.add(mesh(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hc, 0, 0.02, 0));
        this.head.add(box(0.14, 0.015, 0.16, hc, 0.12, 0.03, 0));
        break;
      }
      case 'sou': {
        this.head.add(mesh(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hc, 0, 0.025, 0));
        this.head.add(cyl(0.2, 0.2, 0.012, hc, 0.01, 0.03, 0, 18));
        break;
      }
      case 'beanie':
        this.head.add(mesh(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.7), hc, 0, 0.02, 0));
        break;
      case 'hood':
        this.head.add(mesh(new THREE.SphereGeometry(0.14, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.5), coat, -0.015, 0.0, 0));
        break;
      case 'helmet':
        this.head.add(mesh(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#f0b020', { roughness: 0.4 }), 0, 0.02, 0));
        break;
      default:
        break;
    }
    this.torso.add(this.head);
    this.root.add(this.torso);
    for (let i = 0; i < 2; i++) {
      const up = caps(0.05, this.L1 - 0.1, coat);
      const fo = caps(0.043, this.L2 - 0.086, coat);
      const hand = ball(0.05, skin, 0, 0, 0, 8);
      this.root.add(up, fo, hand);
      this.arms.push({ up, fo, hand });
    }
  }

  /** target — в системе корпуса модели; передаётся уже переведённым в локаль человека */
  reach(side: 0 | 1, t: V3 | null) {
    const sz = side === 0 ? -0.2 : 0.2;
    const S = new V3(this.hipY * 0 + Math.sin(this.lean) * 0.54, this.hipY + Math.cos(this.lean) * 0.54, sz);
    const T = t ? t.clone() : new V3(S.x + 0.08, S.y - 0.47, sz * 1.1);
    const d = new V3().subVectors(T, S);
    let dd = d.length();
    const max = this.L1 + this.L2 - 0.004;
    const min = Math.abs(this.L1 - this.L2) + 0.02;
    dd = clamp(dd, min, max);
    const dir = d.normalize();
    const a = (this.L1 * this.L1 - this.L2 * this.L2 + dd * dd) / (2 * dd);
    const h = Math.sqrt(Math.max(0, this.L1 * this.L1 - a * a));
    const pole = new V3(-0.25, -1, sz * 1.5);
    pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    const E = S.clone().addScaledVector(dir, a).addScaledVector(pole, h);
    const Tc = S.clone().addScaledVector(dir, dd);
    const arm = this.arms[side];
    placeLimb(arm.up, S, E);
    placeLimb(arm.fo, E, Tc);
    arm.hand.position.copy(Tc);
  }
  /** повернуть голову (в радианах, +вверх) */
  look(pitch: number) {
    this.head.rotation.z = pitch;
  }
  setLean(l: number) {
    this.lean = l;
    this.torso.rotation.z = -l;
  }
}

/* ════════════════════ ткань: паруса и флаги ════════════════════ */

export class Cloth {
  readonly mesh: THREE.Mesh;
  private readonly nu: number;
  private readonly nv: number;
  constructor(nu: number, nv: number, mat: THREE.Material) {
    this.nu = nu;
    this.nv = nv;
    const g = new THREE.PlaneGeometry(1, 1, nu, nv);
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }
  /** fn(u, v) -> точка; u слева направо, v сверху вниз (0..1) */
  set(fn: (u: number, v: number, out: V3) => void) {
    const pos = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    const o = new V3();
    for (let iy = 0; iy <= this.nv; iy++) {
      for (let ix = 0; ix <= this.nu; ix++) {
        fn(ix / this.nu, iy / this.nv, o);
        pos.setXYZ(iy * (this.nu + 1) + ix, o.x, o.y, o.z);
      }
    }
    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
}

/** Четырёхугольный парус по углам (tl, tr, bl, br) с выпуклостью вдоль нормали */
export function quadPoint(tl: V3, tr: V3, bl: V3, br: V3, u: number, v: number, out: V3) {
  const ax = tl.x + (tr.x - tl.x) * u;
  const ay = tl.y + (tr.y - tl.y) * u;
  const az = tl.z + (tr.z - tl.z) * u;
  const bx = bl.x + (br.x - bl.x) * u;
  const by = bl.y + (br.y - bl.y) * u;
  const bz = bl.z + (br.z - bl.z) * u;
  out.set(ax + (bx - ax) * v, ay + (by - ay) * v, az + (bz - az) * v);
}

/** Флаг: полотнище, развевающееся по кажущемуся ветру */
export function makeFlag(color: string, w = 0.6, h = 0.36) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide });
  const cloth = new Cloth(8, 3, mat);
  const grp = new THREE.Group();
  grp.add(cloth.mesh);
  const update = (t: number, aw: number) => {
    const dir = aw >= 0 ? 1 : -1;
    const k = clamp(Math.abs(aw), 0.12, 1.3);
    const len = w * (0.35 + 0.65 * Math.min(1, k));
    cloth.set((u, v, o) => {
      const wave = Math.sin(u * 7 - t * (6 + k * 5)) * 0.07 * u * (0.3 + k);
      o.set(dir * u * len, -v * h + wave * 0.3 - u * (1 - Math.min(1, k)) * 0.22, wave);
    });
  };
  update(0, 0.5);
  return { grp, update };
}

/* ════════════════════ мелкие детали ════════════════════ */

export function lifebuoy(): THREE.Group {
  const g = new THREE.Group();
  g.add(torus(0.27, 0.075, std('#e8e4dc', { roughness: 0.6 })));
  const red = std('#d8342a', { roughness: 0.6 });
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    const seg = torus(0.27, 0.078, red, 0, 0, 0, Math.PI / 4);
    seg.rotation.z = a - Math.PI / 8;
    g.add(seg);
  }
  return g;
}
export function fender(color = '#e8e4dc'): THREE.Group {
  const g = new THREE.Group();
  g.add(caps(0.085, 0.3, std(color, { roughness: 0.5 }), 0, -0.3, 0));
  g.add(cyl(0.012, 0.012, 0.25, std('#c8b890'), 0, -0.05, 0, 5));
  return g;
}
export function tireFender(): THREE.Group {
  const g = new THREE.Group();
  const t = torus(0.17, 0.07, std('#161618', { roughness: 0.95 }));
  t.rotation.y = Math.PI / 2;
  g.add(t);
  return g;
}
export function ropeCoil(color = '#c8b078', r = 0.22, turns = 4): THREE.Group {
  const g = new THREE.Group();
  const m = std(color, { roughness: 0.95 });
  for (let i = 0; i < turns; i++) {
    const t = torus(r - i * 0.012, 0.028, m, 0, i * 0.045 + 0.03, 0);
    t.rotation.x = Math.PI / 2;
    g.add(t);
  }
  return g;
}
export function cleat(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.22, 0.03, 0.06, mat, 0, 0.03, 0, 0.01));
  g.add(box(0.04, 0.05, 0.05, mat, -0.07, 0.015, 0), box(0.04, 0.05, 0.05, mat, 0.07, 0.015, 0));
  return g;
}
export function anchorShape(mat: THREE.Material, scale = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.025, 0.03, 0.8, mat, 0, 0.4, 0, 8));
  g.add(cyl(0.02, 0.02, 0.4, mat, 0, 0.72, 0, 8)).rotation.z = 0;
  const stock = cyl(0.018, 0.018, 0.42, mat, 0, 0.75, 0, 8);
  stock.rotation.x = Math.PI / 2;
  g.add(stock);
  const arms = torus(0.3, 0.032, mat, 0, 0.12, 0, Math.PI);
  arms.rotation.z = Math.PI;
  g.add(arms);
  for (const sgn of [-1, 1]) {
    const f = mesh(new THREE.ConeGeometry(0.06, 0.16, 4), mat, sgn * 0.3, 0.14, 0);
    f.rotation.z = sgn * -0.5;
    g.add(f);
  }
  g.scale.setScalar(scale);
  return g;
}
export function winch(mat: THREE.Material, dark: THREE.Material, r = 0.2, w = 0.5): THREE.Group {
  const g = new THREE.Group();
  const drum = cyl(r, r, w, mat, 0, 0, 0, 20);
  drum.rotation.x = Math.PI / 2;
  g.add(drum);
  for (const z of [-w / 2, w / 2]) {
    const fl = cyl(r * 1.35, r * 1.35, 0.03, dark, 0, 0, z, 20);
    fl.rotation.x = Math.PI / 2;
    g.add(fl);
  }
  g.add(box(r * 3, 0.1, w + 0.2, dark, 0, -r * 1.4, 0, 0.02));
  return g;
}
export function rod(len = 2.4, bend = 0.4): THREE.Mesh {
  const pts = [new V3(0, 0, 0), new V3(len * 0.3, len * 0.22, 0), new V3(len * 0.65, len * 0.36 - bend * 0.2, 0), new V3(len, len * 0.34 - bend, 0)];
  const m = tubeAlong(pts, 0.014, std('#1a1a1c', { roughness: 0.4 }), 18);
  m.userData.noShadow = true;
  m.castShadow = false;
  return m;
}
export function bucket(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.17, 0.13, 0.28, std('#2a6a9a', { roughness: 0.5 }), 0, 0.14, 0, 16));
  const h = torus(0.16, 0.008, std('#aaa', { metalness: 0.8, roughness: 0.4 }), 0, 0.28, 0, Math.PI);
  g.add(h);
  return g;
}

/** Синхронизация подвеса с физикой: маятник качается вдоль судна */
export function swing(b: VesselBody, i: number) {
  const sgn = Math.cos(b.psi) >= 0 ? 1 : -1;
  return b.pend[i].phi * sgn - b.theta * 0.85;
}

/** Усечённый конус-труба (дымовая) со сдвигом */
export function funnel(b: Builder, s: number, y0: number, w: number, d: number, h: number, mat: THREE.Material, band?: THREE.Material) {
  const f = box(w, h, d, mat, s, y0 + h / 2, 0, 0.06);
  b.add(f);
  if (band) b.add(box(w + 0.02, h * 0.22, d + 0.02, band, s, y0 + h * 0.62, 0, 0.05));
  b.add(box(w * 1.08, 0.05, d * 1.08, std('#1a1a1c', { roughness: 0.7 }), s, y0 + h + 0.02, 0, 0.02));
  const em = new THREE.Object3D();
  em.position.set(s, y0 + h + 0.1, 0);
  b.add(em);
  b.smoke.push(em);
  b.height(y0 + h + 0.3);
}

export interface HouseOpts {
  s0: number;
  s1: number;
  y0: number;
  h: number;
  w: number;
  slant: number;
  color: string;
  trim: string;
  winRows?: number;
  sideWin?: number;
  roofOver?: number;
  doorAt?: 'aft' | 'fwd' | 'none';
}

/** Рубка: корпус со скошенным носом, окна, козырёк крыши и дверь */
export function wheelhouse(b: Builder, o: HouseOpts) {
  const body = std(o.color, { roughness: 0.5, metalness: 0.1 });
  const trim = std(o.trim, { roughness: 0.55 });
  const frame = std('#202428', { roughness: 0.6 });
  const { s0, s1, y0, h, w, slant } = o;
  const prof: [number, number][] = [
    [s0, y0],
    [s1, y0],
    [s1 - slant, y0 + h],
    [s0, y0 + h],
  ];
  const hull = extrude(prof, w, body, 0.035);
  b.add(hull);
  const roofOver = o.roofOver ?? 0.14;
  b.add(box(s1 - s0 + roofOver * 1.6 - slant * 0.5, 0.06, w + roofOver * 1.6, trim, (s0 + s1 - slant * 0.5) / 2 + roofOver * 0.2, y0 + h + 0.03, 0, 0.02));
  b.add(box(s1 - s0 - slant * 0.4, 0.045, w - 0.02, std('#d4d4d0', { roughness: 0.8 }), (s0 + s1 - slant * 0.5) / 2, y0 + h + 0.085, 0, 0.01));
  const ang = Math.atan2(slant, h);
  // лобовые окна по скосу
  const nf = o.winRows ?? 3;
  const fw = (w - 0.2) / nf - 0.06;
  for (let i = 0; i < nf; i++) {
    const z = -w / 2 + 0.1 + ((i + 0.5) * (w - 0.2)) / nf;
    const g = box(0.04, h * 0.42, fw, b.glass, 0, 0, 0, 0.008);
    const fr = box(0.035, h * 0.42 + 0.05, fw + 0.05, frame, -0.012, 0, 0, 0.01);
    const pv = new THREE.Group();
    pv.add(fr, g);
    const t = 0.64;
    pv.position.set(s1 - slant * t + 0.02, y0 + h * t, z);
    pv.rotation.z = ang;
    b.add(pv);
  }
  // боковые окна
  const ns = o.sideWin ?? 3;
  for (const side of [-1, 1]) {
    for (let i = 0; i < ns; i++) {
      const sw = (s1 - slant - s0 - 0.5) / ns - 0.08;
      const sx = s0 + 0.28 + (i + 0.5) * ((s1 - slant - s0 - 0.5) / ns);
      b.add(box(sw + 0.05, h * 0.4 + 0.05, 0.02, frame, sx, y0 + h * 0.62, side * (w / 2 + 0.004), 0.01));
      b.add(box(sw, h * 0.4, 0.02, b.glass, sx, y0 + h * 0.62, side * (w / 2 + 0.012), 0.008));
    }
    if (o.doorAt !== 'none') {
      const dx = o.doorAt === 'fwd' ? s1 - slant - 0.35 : s0 + 0.2;
      b.add(box(0.5, h * 0.82, 0.022, std(sh(o.color, 0.82), { roughness: 0.55 }), dx + (o.doorAt === 'fwd' ? 0 : 0.0), y0 + h * 0.42, side * (w / 2 + 0.004), 0.01));
    }
  }
  b.height(y0 + h + 0.2);
  return { roofY: y0 + h + 0.11 };
}

/** Чугунная шкала времени: используется в моделях для плавных анимаций */
export const smoothstep = (a: number, c: number, x: number) => {
  const t = clamp((x - a) / (c - a), 0, 1);
  return t * t * (3 - 2 * t);
};
