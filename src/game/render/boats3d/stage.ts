/**
 * VesselStage — 3D-сцена судна (three.js), которая рисуется в отдельный WebGL-canvas
 * с прозрачным фоном и затем композитится в 2D-сцену моря.
 *
 * Камера ортографическая, чуть сверху (≈11°): видны палуба и внутренность открытых лодок.
 * Освещение берётся из погоды (солнце/луна/небо), тени и отражения — настоящие.
 * Воду режет шейдер: всё ниже реальной волны под судном скрывается, у борта — пена.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clamp } from './util3';
import type { VesselBody } from './hull3';
import type { SeaSim } from './hull3';
import type { F } from './frame3';
import { WL, type Env3, type VesselModel } from './kit';
import { buildVessel } from './index';

const EL = 0.2;
const COS = Math.cos(EL);
const TAN = Math.tan(EL);

export interface StageHooks {
  smoke: (sx: number, sy: number, size: number) => void;
  bubble: (sx: number, sy: number) => void;
}

const rgb = (c: [number, number, number]) => new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255);

export class VesselStage {
  readonly canvas = document.createElement('canvas');
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  private sun = new THREE.DirectionalLight(0xffffff, 2);
  private fill = new THREE.DirectionalLight(0x9cc4d0, 0.45);
  private hemi = new THREE.HemisphereLight(0xaac8ff, 0x203040, 0.6);
  private model: VesselModel | null = null;
  private key = '';
  private v = new THREE.Vector3();

  private pr = 1;
  private quality = -1;
  private lost = false;
  private readonly mobile = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  private readonly width = this.mobile ? 960 : 1280;
  private readonly height = this.mobile ? 768 : 1024;

  get contextLost() {
    return this.lost || this.renderer.getContext().isContextLost();
  }

  /** плотность рендера под dpr основной сцены — без «пикселей» при приближении */
  setPixelRatio(dpr: number) {
    const pr = Math.min(this.mobile ? 1 : 1.5, Math.max(1, Number.isFinite(dpr) ? dpr : 1));
    if (pr === this.pr) return;
    this.pr = pr;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(this.width, this.height, false);
  }

  setQuality(level: number) {
    const quality = clamp(Number.isFinite(level) ? Math.round(level) : 1, 0, 2);
    if (quality === this.quality) return;
    this.quality = quality;
    const shadows = quality > 0;
    this.renderer.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows;
    const size = shadows ? (this.mobile ? (quality > 1 ? 768 : 512) : (quality > 1 ? 1536 : 1024)) : 1;
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.needsUpdate = true;
  }

  constructor() {
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: !this.mobile, premultipliedAlpha: true, powerPreference: 'default' });
    r.setPixelRatio(1);
    r.setSize(this.width, this.height, false);
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.12;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = r;
    this.canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); this.lost = true; });
    this.canvas.addEventListener("webglcontextrestored", () => { this.lost = false; this.key = ""; });
    const pm = new THREE.PMREMGenerator(r);
    const room = new RoomEnvironment();
    this.scene.environment = pm.fromScene(room, 0.04).texture;
    room.dispose();
    pm.dispose();
    this.sun.castShadow = true;
    const shadowSize = this.mobile ? 512 : 1024;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.035;
    this.fill.position.set(-24, 12, 30);
    this.fill.target.position.set(0, 1, 0);
    this.scene.add(this.sun, this.sun.target, this.fill, this.fill.target, this.hemi);
    this.cam.position.set(0, Math.sin(EL) * 80, Math.cos(EL) * 80);
    this.cam.lookAt(0, 0, 0);
    this.cam.updateMatrixWorld(true);
  }

  private setVessel(b: VesselBody) {
    if (this.key === b.spec.id && this.model) return;
    if (this.model) {
      this.scene.remove(this.model.root);
      this.model.dispose();
      this.model = null;
    }
    this.model = buildVessel(b.spec, b.cbx);
    this.scene.add(this.model.root);
    this.key = b.spec.id;
    const m = this.model;
    const c = this.sun.shadow.camera;
    c.left = -(m.halfLen + 2);
    c.right = m.halfLen + 2;
    c.top = m.top + 3;
    c.bottom = -(m.top + 3);
    c.near = 1;
    c.far = 200;
    c.updateProjectionMatrix();
  }

  /** Рисует судно в 2D-контекст. Возвращает false, если нужно использовать запасную отрисовку */
  draw(ctx: CanvasRenderingContext2D, f: F, sim: SeaSim, hooks: StageHooks): boolean {
    if (this.contextLost) return false;
    const b = sim.body;
    this.setVessel(b);
    const m = this.model;
    if (!m) return false;
    const w = f.w;
    const dt = f.dt;

    /* ───── поза ───── */
    m.root.position.set(0, b.y, 0);
    m.root.rotation.set(b.roll, b.psi, b.theta);

    /* ───── вода под судном ───── */
    const span = m.halfLen * 1.35 + 2;
    for (let i = 0; i < 32; i++) WL.uWave.value[i] = f.ocean.height(b.x - span + (2 * span * i) / 31);
    WL.uX0.value = -span;
    WL.uInv.value = 31 / (2 * span);
    WL.uNight.value = f.night;

    /* ───── анимация модели ───── */
    const sgn = Math.cos(b.psi) >= 0 ? 1 : -1;
    const vg = b.vw + f.lane.current(b.x);
    const env: Env3 = {
      t: f.t,
      night: f.night,
      lights: w.lights,
      day: f.day,
      golden: f.golden,
      windS: f.windS,
      aw: clamp(((f.windS - vg) * sgn) / 7, -1.4, 1.4),
      temp: w.temp,
      rain: w.rain,
      fog: f.fog,
    };
    m.update(b, env, dt);

    /* ───── свет ───── */
    let el: number;
    let az: number;
    let inten: number;
    const col = new THREE.Color(0xffffff);
    if (w.sunElev > 2) {
      el = w.sunElev;
      az = w.sunAz;
      inten = 3.3 * clamp(w.sunVis * 1.15 + 0.1 * (1 - w.cover), 0, 1) + 0.15;
      col.set(0xfff6e8).lerp(new THREE.Color(0xffa860), clamp(f.golden * 1.1, 0, 1));
    } else if (w.moonElev > 0) {
      el = w.moonElev;
      az = w.moonAz;
      inten = 1.1 * w.moonVis * w.moonIllum + 0.14;
      col.set(0xb8c8ff);
    } else {
      el = 25;
      az = 180;
      inten = 0.16;
      col.set(0x8090c0);
    }
    const elc = (clamp(el, 14, 80) * Math.PI) / 180;
    const azr = ((az - 180) * Math.PI) / 180;
    this.sun.position.set(Math.sin(azr) * Math.cos(elc), Math.sin(elc), Math.cos(azr) * Math.cos(elc)).multiplyScalar(60);
    this.sun.target.position.set(0, m.top * 0.4, 0);
    this.sun.target.updateMatrixWorld();
    this.sun.color.copy(col);
    this.sun.intensity = inten;
    this.fill.color.copy(rgb(w.palette.seaNear).lerp(new THREE.Color(0xc8e5e3), 0.3));
    this.fill.intensity = 0.18 + 0.34 * (1 - w.daylight) + 0.12 * w.cover;
    this.hemi.color.copy(rgb(w.palette.skyMid).lerp(new THREE.Color(0xffffff), 0.25));
    this.hemi.groundColor.copy(rgb(w.palette.seaNear).multiplyScalar(0.75));
    this.hemi.intensity = 0.42 + 0.55 * w.daylight + 0.14 * (1 - w.night);
    this.scene.environmentIntensity = 0.26 + 0.75 * w.daylight * (0.7 + 0.3 * (1 - w.cover)) + 0.08 * f.golden;

    /* ───── камера: 1 м = ppm пикселей по обеим осям ───── */
    const want = f.PXM * f.dpr * 1.2;
    const maxW = this.width / (2 * (m.halfLen + 2.5));
    const maxH = (this.height * 0.97) / (m.top + 1.6 + m.draft + 1.3);
    const ppm = Math.min(want, maxW, maxH);
    const ox = this.width / 2;
    const oy = (m.top + 1.3) * ppm;
    const ppmY = ppm / COS;
    this.cam.left = -ox / ppm;
    this.cam.right = (this.width - ox) / ppm;
    this.cam.top = oy / ppmY;
    this.cam.bottom = (oy - this.height) / ppmY;
    this.cam.updateProjectionMatrix();

    this.renderer.render(this.scene, this.cam);

    /* ───── композитинг ───── */
    const sx0 = f.X2S(b.x);
    const k = f.PXM / ppm;
    ctx.drawImage(this.canvas, sx0 - ox * k, f.sY - oy * k, this.width * k, this.height * k);

    /* ───── эмиттеры: дым и пузыри винта ───── */
    const toMain = (v: THREE.Vector3): [number, number] => [sx0 + v.x * f.PXM, f.sY - (v.y - v.z * TAN) * f.PXM];
    m.root.updateMatrixWorld(true);
    const motor = b.geo.motor !== 'none';
    const smokeRate = motor ? 2.5 + 12 * b.rpm : 0.8;
    for (const o of m.smoke) {
      if (Math.random() < smokeRate * dt) {
        o.getWorldPosition(this.v);
        const [mx, my] = toMain(this.v);
        hooks.smoke(mx, my, 0.5);
      }
    }
    if (m.prop && b.rpm > 0.2 && Math.random() < (6 + 30 * b.rpm) * dt) {
      m.prop.getWorldPosition(this.v);
      const [mx, my] = toMain(this.v);
      hooks.bubble(mx, my);
    }
    return true;
  }

  dispose() {
    if (this.model) this.model.dispose();
    this.renderer.dispose();
  }
}

