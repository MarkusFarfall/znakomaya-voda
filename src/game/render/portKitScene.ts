import { cloudBank } from './cloudBank';
import type { BoatDef, Building, HotId, Hotspot, PortId, Season } from '../types';
import type { KitAtmo, PF, PortKit, TrafficSpec } from './portFrame';
import { backdropReflection, cloudShadows, depthHaze, distantRain, farShip, farWaterBand, horizonHaze } from './portHorizon';
import { bunting, chalkboard, hull, person, splash } from './portParts';
import { clamp, glow, hash1, hexA, lightPool, mix, rng } from './util';

export interface SceneState {
  pid: PortId;
  A: KitAtmo;
  boat: BoatDef;
  hover: HotId | null;
  fair: boolean;
  /** названия «рыбы дня» для досок на набережной (в игре — hotFish(day) → FISH[].name) */
  hotFish?: string[];
  /** Existing game services stay available; schedules animate street life only. */
  serviceHours?: boolean;
  precipEnabled?: boolean;
  quality?: 0 | 1 | 2;
  reflectionsEnabled?: boolean;
}

export type FxLayer = 'sky' | 'horizon' | 'under' | 'surface' | 'front';

/** Точки стыковки с движком игры (см. INTEGRATION.md) */
export interface SceneHooks {
  /** нарисовать судно игрока (в игре — drawBoat / Boat3D); x уже учитывает анимацию прибытия */
  playerBoat?: (f: PF, x: number, boat: BoatDef, speed: number) => void;
  /** слои для внешних эффектов (в игре — drawEventFx) */
  layer?: (name: FxLayer, f: PF) => void;
  weather?: (f: PF) => void;
  lightning?: (f: PF) => void;
  ice?: (f: PF) => void;
}

/** Открыто ли здание в этот час (часы работы из кита; нет записи — круглосуточно) */
export function isOpen(kit: PortKit, b: Building, hour: number) {
  const hrs = kit.hours?.[b];
  if (!hrs) return true;
  let h = hour;
  if (hrs[1] > 24 && h < hrs[0]) h += 24;
  return h >= hrs[0] && h < hrs[1];
}

/** Прогресс активных событий распорядка: id → 0..1 */
export function eventsAt(kit: PortKit, hour: number, season: Season) {
  const out: Record<string, number> = {};
  for (const e of kit.events ?? []) {
    if (e.seasons && !e.seasons.includes(season)) continue;
    let h = hour;
    if (e.to > 24 && h < e.from) h += 24;
    if (h >= e.from && h < e.to) out[e.id] = (h - e.from) / (e.to - e.from);
  }
  return out;
}

export const fmtHour = (h: number) => `${String(Math.floor(h % 24)).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;

type WalkerKind = 'walk' | 'bike' | 'cart' | 'pair';
interface Walker { x: number; v: number; seed: number; c: string; c2: string; carry: 'crate' | 'rod' | 'bucket' | 'net' | 'box' | null; hat?: string; umb: string; kind: WalkerKind }
interface Puff { x: number; y: number; t: number; r: number; dark: boolean }
interface Spark { x: number; y: number; vx: number; vy: number; t: number }

const BUILDINGS: Building[] = ['market', 'shop', 'shipyard', 'tavern'];

export class PortKitScene {
  hot: Hotspot[] = [];
  private t = 0;
  private windTravel = 0;
  private key = '';
  private walkers: Walker[] = [];
  private birds: [number, number, number][] = [];
  private clouds: [number, number, number, number][] = [];
  private smoke: Puff[] = [];
  private sparks: Spark[] = [];
  private random = rng(0x706f7274);
  private wet = 0;
  private jumpT = 4;
  private jump: { x: number; y: number; t: number } | null = null;

  constructor(private kits: Record<PortId, PortKit>, private hooks: SceneHooks = {}) {}

  render(ctx: CanvasRenderingContext2D, st: SceneState, W: number, H: number, dt: number) {
    dt = clamp(dt, 0, 0.1);
    this.t += dt;
    const t = this.t;
    const kit = this.kits[st.pid];
    const A = st.A;
    this.windTravel += A.windDir * dt;
    const night = A.night, golden = A.golden;
    const sc = clamp(Math.min(H / 820, W / 760), 0.5, 1.3);
    const hY = H * 0.5, quayY = H * 0.66, waterY = H * 0.715;
    const gY = quayY - 6 * sc;
    const waveAmp = (1.4 + A.waves * 0.45) * sc;
    const waveY = (x: number) => waterY + 4 * sc + Math.sin(x * 0.02 + t * 1.1) * waveAmp + Math.sin(t * 0.7) * 1.2 * sc;
    const L = kit.layout;
    const dockX = W * L.dock;
    const lit = night > 0.3;
    const hour = A.hour ?? 12;
    const dim = (c: string, k = 0.75) => mix(c, '#060a12', night * k);
    const win = (seed = 0, warm = '#ffc870') => {
      if (frame.closed) return dim('#1e262e', 0.5);
      if (!lit) return dim(mix('#3a4654', '#8fb0c8', A.sunVis * 0.4));
      const flick = 0.86 + Math.sin(t * 2.3 + seed * 0.37) * 0.07 + (Math.sin(t * 17 + seed) > 0.985 ? -0.35 : 0);
      return hexA(warm, clamp((0.55 + night * 0.45) * flick, 0, 1));
    };
    // распорядок дня и часы работы
    const ev = eventsAt(kit, hour, A.season);
    let actMul = 1;
    for (const e of kit.events ?? []) if (ev[e.id] != null && e.activity != null) actMul *= e.activity;
    const openMap: Record<Building, boolean> = { market: !st.serviceHours || isOpen(kit, 'market', hour), shop: !st.serviceHours || isOpen(kit, 'shop', hour), shipyard: !st.serviceHours || isOpen(kit, 'shipyard', hour), tavern: !st.serviceHours || isOpen(kit, 'tavern', hour) };
    // мокрая набережная: накапливается в дождь, сохнет после
    this.wet = clamp(this.wet + (A.rain > 0.05 ? dt * 0.25 : -dt * 0.04), 0, 1);
    const activity = clamp(clamp(1 - night * 0.85, 0.15, 1) * (A.rain > 0.5 ? 0.55 : 1) * (A.weather === 'storm' ? 0.35 : 1) * actMul, 0.05, 1.3);
    const sunX = W * clamp((A.sunAz - 45) / 270, 0.02, 0.98);
    const sunY = hY - Math.sin(A.sunElev * Math.PI / 180) * H * 0.42;
    const shadowDir: 1 | -1 = sunX > W / 2 ? -1 : 1;
    const shadowLen = A.sunElev > 1 ? clamp(16 / Math.tan(A.sunElev * Math.PI / 180), 0, 90) * sc : 0;
    const shadowA = 0.3 * A.sunVis * (1 - night) * clamp(A.sunElev / 8, 0, 1);
    const frame: PF = {
      ctx, W, H, t, windTravel: this.windTravel, dt, sc, hY, quayY, waterY, waveY, gY, A, night, golden, lit, reflecting: false, fair: st.fair, activity, wet: this.wet,
      shadow: { dir: shadowDir, len: shadowLen, a: shadowA }, ev, hotFish: st.hotFish ?? [], closed: false,
      open: (b) => openMap[b],
      bob: (seed, amp = 1.5) => Math.sin(t * 1.1 + seed) * amp * sc * (0.5 + A.waves * 0.55),
      dim, win,
      glow: (x, y, r, c, a = 1) => glow(ctx, x, y, r, c, a),
      pool: (x, y, r, c, a) => lightPool(ctx, x, y, r, c, a),
      smoke: (x, y, r = 4 * sc, dark = false) => { if (!frame.reflecting && this.smoke.length < 160) this.smoke.push({ x, y, t: 0, r, dark }); },
      spark: (x, y) => { if (!frame.reflecting && this.sparks.length < 90) this.sparks.push({ x, y, vx: (this.random() - 0.5) * 60 * sc, vy: -this.random() * 40 * sc, t: 0 }); },
      h: hash1, random: this.random, quality: st.quality ?? 1, precipEnabled: st.precipEnabled ?? true,
      hover: st.hover,
    };
    const layer = (name: FxLayer) => this.hooks.layer?.(name, frame);

    // инициализация при смене порта / размера
    const key = `${st.pid}|${W}|${H}`;
    if (key !== this.key) {
      this.key = key;
      const r = rng(st.pid.length * 13 + 3);
      const carries: Walker['carry'][] = ['crate', 'rod', 'bucket', 'net', null, null, 'box'];
      const umbs = ['#c84030', '#2a5a8a', '#1a1a1c', '#f0c040', '#3a9a5a'];
      this.walkers = Array.from({ length: kit.walkers.n + 3 }, (_, i) => {
        const kind: WalkerKind = i === 0 ? 'bike' : i === 1 ? 'cart' : i === 2 ? 'pair' : 'walk';
        const sp = kind === 'bike' ? 2.4 : kind === 'cart' ? 0.7 : 1;
        return {
          x: r() * W, v: (r() < 0.5 ? -1 : 1) * (10 + r() * 14) * sc * kit.walkers.speed * sp, seed: r() * 100,
          c: kit.walkers.cols[Math.floor(r() * kit.walkers.cols.length)], c2: kit.walkers.cols[Math.floor(r() * kit.walkers.cols.length)],
          carry: carries[Math.floor(r() * carries.length)],
          hat: kit.walkers.hats && r() < 0.5 ? ['#3a3a44', '#d8a030', '#8a3a2a'][Math.floor(r() * 3)] : undefined,
          umb: umbs[Math.floor(r() * umbs.length)], kind,
        };
      });
      const bn = kit.birds?.n ?? 6;
      this.birds = Array.from({ length: bn }, () => [r() * W, H * (0.06 + r() * 0.22), r() * 6]);
      this.clouds = Array.from({ length: 8 }, () => [r() * W * 1.3 - W * 0.15, H * (0.04 + r() * 0.26), (70 + r() * 120) * sc, 3 + r() * 6]);
      this.smoke = []; this.sparks = []; this.jump = null;
    }

    // ───── небо ─────
    const P = A.palette;
    const g = ctx.createLinearGradient(0, 0, 0, hY);
    g.addColorStop(0, P.skyTop); g.addColorStop(0.6, P.skyMid); g.addColorStop(1, P.skyHor);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hY + 2);
    const moonX = W * clamp((A.moonAz - 45) / 270, 0.02, 0.98);
    const moonY = hY - Math.sin(A.moonElev * Math.PI / 180) * H * 0.32;
    if (A.starVis > 0.01) {
      const r = rng(9);
      for (let i = 0; i < 200; i++) {
        const x = r() * W, y = Math.pow(r(), 1.3) * hY * 0.92, s = r() * 1.3 + 0.3;
        ctx.globalAlpha = A.starVis * (0.4 + 0.6 * Math.sin(t * 2 + i));
        ctx.fillStyle = i % 9 === 0 ? '#ffe0c0' : '#ffffff';
        ctx.fillRect(x, y, s, s);
      }
      ctx.globalAlpha = 1;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const mw = ctx.createLinearGradient(W * 0.2, 0, W * 0.9, hY);
      mw.addColorStop(0, 'rgba(180,200,255,0)'); mw.addColorStop(0.5, `rgba(180,200,255,${(0.07 * A.starVis).toFixed(3)})`); mw.addColorStop(1, 'rgba(180,200,255,0)');
      ctx.fillStyle = mw; ctx.fillRect(0, 0, W, hY); ctx.restore();
      const sp = (t % 23) / 23;
      if (sp < 0.04) { const u = sp / 0.04; const sx0 = W * hash1(Math.floor(t / 23)), sy0 = hY * 0.1 + hash1(Math.floor(t / 23) + 1) * hY * 0.3; ctx.strokeStyle = `rgba(255,255,255,${(A.starVis * (1 - u)).toFixed(3)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx0 + u * 120 * sc, sy0 + u * 50 * sc); ctx.lineTo(sx0 + u * 120 * sc - 24 * sc, sy0 + u * 50 * sc - 10 * sc); ctx.stroke(); }
    }
    if (A.aurora > 0.01) this.aurora(ctx, W, H, t, A.aurora);
    if (A.sunElev > -4) {
      const gl = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, H * 0.38);
      gl.addColorStop(0, hexA(P.glow, 0.55 * A.sunVis + 0.25 * golden)); gl.addColorStop(1, 'rgba(255,200,140,0)');
      ctx.fillStyle = gl; ctx.fillRect(0, 0, W, hY);
      // у горизонта диск сплющен рефракцией, краснее и крупнее; выше — обычный
      const low = clamp(1 - A.sunElev / 10, 0, 1);
      const r = H * 0.026 * (1 + low * 0.35);
      const sunCol = mix(P.sun, '#ff7a3a', low * 0.7);
      ctx.fillStyle = hexA(sunCol, A.sunVis);
      ctx.beginPath(); ctx.ellipse(sunX, sunY, r, r * (1 - low * 0.22), 0, 0, Math.PI * 2); ctx.fill();
      // дымка «съедает» низ диска
      if (low > 0.2) { const hg = ctx.createLinearGradient(0, sunY - r * 0.2, 0, sunY + r); hg.addColorStop(0, hexA(P.skyHor, 0)); hg.addColorStop(1, hexA(P.skyHor, 0.7 * low)); ctx.fillStyle = hg; ctx.fillRect(sunX - r - 2, sunY - r * 0.2, r * 2 + 4, r * 1.2); }
      // сумеречные лучи сквозь облака
      if (A.cover > 0.3 && A.cover < 0.95 && A.sunElev > 0 && A.sunElev < 35 && A.sunVis > 0.15) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const n = 9;
        for (let i = 0; i < n; i++) {
          const a0 = Math.PI * (0.55 + (i / n) * 0.9) + Math.sin(t * 0.07 + i) * 0.02;
          const len = H * (0.5 + hash1(i) * 0.4);
          const wdt = 0.03 + hash1(i + 4) * 0.03;
          const g = ctx.createLinearGradient(sunX, sunY, sunX + Math.cos(a0) * len, sunY + Math.sin(a0) * len);
          const aa = 0.07 * A.sunVis * (1 - low * 0.4) * clamp(A.cover, 0, 1) * (0.6 + 0.4 * Math.sin(t * 0.3 + i * 2));
          g.addColorStop(0, hexA(P.glow, aa)); g.addColorStop(1, hexA(P.glow, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sunX, sunY); ctx.lineTo(sunX + Math.cos(a0 - wdt) * len, sunY + Math.sin(a0 - wdt) * len); ctx.lineTo(sunX + Math.cos(a0 + wdt) * len, sunY + Math.sin(a0 + wdt) * len); ctx.fill();
        }
        ctx.restore();
      }
    }
    if (A.moonElev > -1 && A.moonVis > 0.02) {
      const r = H * 0.02;
      ctx.save(); ctx.globalAlpha = A.moonVis;
      ctx.fillStyle = '#e7e9e4'; ctx.beginPath(); ctx.arc(moonX, moonY, r, 0, Math.PI * 2); ctx.fill();
      const k = Math.cos(A.moonPhase * Math.PI * 2);
      ctx.fillStyle = mix(P.skyMid, '#000000', 0.3); ctx.globalAlpha = A.moonVis * 0.9;
      ctx.beginPath(); ctx.ellipse(moonX + (A.moonPhase < 0.5 ? 1 : -1) * k * r, moonY, Math.abs(k) * r, r, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      glow(ctx, moonX, moonY, r * 5, '#c8d8ff', 0.18 * A.moonVis * A.moonIllum);
    }
    layer('sky');
    {
      let litC = mix(P.cloud, '#ffc488', golden * 0.35);
      litC = mix(litC, '#1a2030', night * 0.88);
      const shadeC = mix(litC, P.skyTop, 0.45);
      // перистые облака высоко — тонкие растянутые полосы, подсвечиваются на закате раньше всех
      if (A.cover > 0.05 && A.cover < 0.9 && A.fog < 0.6) {
        ctx.save(); ctx.globalAlpha = 0.5 * (1 - night * 0.6) * clamp(A.cover * 2, 0, 1);
        const cir = mix(mix(P.cloud, '#ffd0a0', golden * 0.6), '#2a3040', night * 0.8);
        for (let i = 0; i < 5; i++) {
          const cx = ((hash1(i + 20) * W + t * 2 * A.windDir) % (W + 300)) - 150, cy = H * (0.03 + hash1(i + 21) * 0.1), cw = (120 + hash1(i + 22) * 160) * sc;
          const g = ctx.createLinearGradient(cx - cw, 0, cx + cw, 0); g.addColorStop(0, hexA(cir, 0)); g.addColorStop(0.3, hexA(cir, 0.5)); g.addColorStop(0.7, hexA(cir, 0.5)); g.addColorStop(1, hexA(cir, 0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(cx - cw, cy + 3 * sc);
          ctx.bezierCurveTo(cx - cw * .3, cy - 7 * sc, cx + cw * .35, cy - 3 * sc, cx + cw, cy);
          ctx.bezierCurveTo(cx + cw * .2, cy + 2 * sc, cx - cw * .45, cy + 6 * sc, cx - cw, cy + 3 * sc); ctx.fill();
        }
        ctx.restore();
      }
      // низкая гряда мелких облаков у горизонта — в перспективе: ближе к горизонту меньше и плотнее
      if (A.cover > 0.15 && A.fog < 0.7) {
        const n2 = Math.round(14 * A.cover);
        for (let i = 0; i < n2; i++) {
          const q = hash1(i + 40);
          const cx = ((hash1(i + 41) * W * 1.4 + t * (1 + q) * A.windDir) % (W * 1.4)) - W * 0.2;
          const depth = hash1(i + 42);
          const cy = hY - H * (0.03 + depth * 0.09), cw = (16 + depth * 40) * sc * (0.6 + q * 0.6);
          const lc = mix(mix(litC, P.skyHor, 0.55 - depth * 0.3), '#ffb070', golden * 0.25 * depth);
          const scC = mix(shadeC, P.skyHor, 0.5 - depth * 0.3);
          cloudBank(ctx, cx, cy, cw, lc, scC, .42, i);
        }
      }
      const n = Math.round(this.clouds.length * A.cover);
      for (let i = 0; i < n; i++) {
        const c = this.clouds[i];
        c[0] += (c[3] + A.wind * 1.2) * A.windDir * dt;
        if (c[0] - c[2] * 1.5 > W) c[0] = -c[2] * 1.6;
        if (c[0] + c[2] * 1.5 < 0) c[0] = W + c[2] * 1.6;
        const [cx, cy, cw] = c;
        cloudBank(ctx, cx, cy, cw * 1.1, litC, shadeC, .60, i);
      }
    }
    this.drawBirds(frame, kit);
    if (frame.precipEnabled) distantRain(frame);
    horizonHaze(frame);

    // ───── горизонт: вода рисуется первой, чтобы дальние суда и берега легли на неё ─────
    const wg = ctx.createLinearGradient(0, hY, 0, H);
    const portNear = mix(kit.pal.water[0], P.seaNear, 0.34);
    const portDeep = mix(kit.pal.water[1], P.deep, 0.28);
    wg.addColorStop(0, dim(mix(portNear, P.skyHor, 0.4), 0.7)); wg.addColorStop(0.35, dim(portNear, 0.8)); wg.addColorStop(1, dim(portDeep, 0.6));
    ctx.fillStyle = wg; ctx.fillRect(0, hY, W, H - hY);
    farWaterBand(frame);
    kit.horizon?.(frame);
    for (const s of kit.farShips ?? []) farShip(frame, s);

    // ───── задник (берега, горы — перекрывают дальние суда) ─────
    kit.backdrop(frame);
    layer('horizon');
    if (frame.quality > 0 && st.reflectionsEnabled !== false) backdropReflection(frame, 0.2);
    depthHaze(frame);
    cloudShadows(frame, this.clouds, Math.round(this.clouds.length * A.cover));
    layer('under');
    if (A.sunVis > 0.05 && A.sunElev > -1) this.lightPath(ctx, sunX, hY, H, W, P.glow, A.sunVis * (0.35 + golden * 0.5), t);
    if (A.moonVis > 0.1) this.lightPath(ctx, moonX, hY, H, W, '#c8d8ff', A.moonVis * 0.35, t);
    for (let i = 0; i < 44; i++) {
      const p = (i * 0.618) % 1;
      const y = hY + (H - hY) * p;
      const x = ((i * 173 + t * (10 + p * 30)) % (W + 80)) - 40;
      ctx.fillStyle = `rgba(255,255,255,${((0.05 + p * 0.12) * (1 - night * 0.6)).toFixed(3)})`;
      ctx.fillRect(x, y, 10 + p * 40, 1 + p);
    }
    kit.farWater(frame);
    for (const spec of kit.traffic ?? []) this.traffic(frame, spec);

    // ───── набережная ─────
    this.quay(frame, kit);
    kit.ground?.(frame);
    this.wetQuay(frame);

    // ───── город (отражение, затем настоящий) ─────
    this.hot = [];
    const bw = Math.min(150 * sc, W * 0.19);
    const drawTown = () => {
      kit.backRow?.(frame);
      for (const b of BUILDINGS) {
        const x = W * L[b];
        if (!frame.reflecting) this.groundShadow(frame, x, bw);
        frame.closed = !openMap[b];
        const top = kit.building(frame, b, x, bw);
        frame.closed = false;
        if (!frame.reflecting) this.hot.push({ id: b, x, y: top });
      }
      kit.extras(frame);
      kit.props(frame);
      kit.signage?.(frame);
    };
    if (frame.quality > 0 && st.reflectionsEnabled !== false) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, waterY, W, H - waterY); ctx.clip();
    ctx.translate(0, waterY * 2 + 2 * sc); ctx.scale(1, -1);
    ctx.globalAlpha = 0.26 * (1 - night * 0.2);
    frame.reflecting = true; drawTown(); frame.reflecting = false;
    ctx.restore();
    }
    const reflectionFade = ctx.createLinearGradient(0, waterY, 0, H);
    reflectionFade.addColorStop(0, hexA(dim(kit.pal.water[0], 0.7), 0.12));
    reflectionFade.addColorStop(1, hexA(dim(kit.pal.water[1], 0.7), 0.72));
    ctx.fillStyle = reflectionFade; ctx.fillRect(0, waterY, W, H - waterY);
    const sh = ctx.createLinearGradient(0, waterY, 0, waterY + 26 * sc);
    sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh; ctx.fillRect(0, waterY, W, 26 * sc);
    for (let x = 0; x < W; x += 7 * sc) {
      const a = Math.max(0, Math.sin(x * 0.045 + t * 2.1) * 0.5 + Math.sin(x * 0.013 - t * 1.3) * 0.5) * (0.35 + A.waves * 0.2) * (1 - night * 0.5);
      if (a < 0.05) continue;
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.fillRect(x, waterY + 1 + Math.sin(x * 0.2 + t * 3) * 1.2 * sc, 6 * sc, 1.4 * sc);
    }
    drawTown();
    this.waterLife(frame, kit);

    // ───── фонари, доска «рыба дня», ярмарка ─────
    const lampXs = kit.lampXs ?? [0.06, 0.28, 0.5, 0.72, 0.94];
    const lampTop = (kit.lampTop ?? 46) * sc;
    for (const q of lampXs) kit.lamp(frame, W * q);
    if (frame.hotFish.length) {
      const bx = W * (kit.hotBoard ?? L.market - 0.105);
      const style = kit.quay === 'sand' ? { bg: '#c8a060', ink: '#2a2a2a', frame: '#8a6a4a', accent: '#8a2a22' }
        : kit.quay === 'ice' ? { bg: '#f4f6f8', ink: '#1a3a9a', frame: '#4a5058', accent: '#d8402a' }
        : kit.quay === 'concrete' ? { bg: '#1a2230', ink: '#9ad8ff', frame: '#3a3e44', accent: '#ffd060' }
        : { bg: '#2a2a2a', ink: '#f0e8d8', frame: '#6a4a2a', accent: '#f0c040' };
      chalkboard(frame, bx, gY, ['РЫБА ДНЯ', ...frame.hotFish.slice(0, 2), 'спрос ×1,8'], style);
      if (lit && kit.quay === 'concrete') glow(ctx, bx, gY - 14 * sc, 3 * sc, '#9ad8ff', night * 0.4);
    }
    if (st.fair) {
      const cols = ['#d8402a', '#f0c040', '#2a70b0', '#3a9a5a', '#f0f0e8'];
      for (let i = 0; i + 1 < lampXs.length; i++) bunting(frame, W * lampXs[i], gY - lampTop + 2 * sc, W * lampXs[i + 1], gY - lampTop + 2 * sc, 14 * sc, cols, 10, lit);
      const bxq = W * L.market + bw * 0.55;
      for (let k = 0; k < 5; k++) {
        const sw = Math.sin(t * 1.4 + k) * 3 * sc, by = gY - 34 * sc - k * 5 * sc + Math.cos(t * 1.1 + k) * 2 * sc;
        ctx.strokeStyle = hexA('#ffffff', 0.4); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(bxq, gY - 6 * sc); ctx.lineTo(bxq + (k - 2) * 5 * sc + sw, by); ctx.stroke();
        ctx.fillStyle = dim(cols[k], 0.7); ctx.beginPath(); ctx.ellipse(bxq + (k - 2) * 5 * sc + sw, by - 4 * sc, 3.2 * sc, 4 * sc, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    // мотыльки у фонарей
    if (lit && kit.quay !== 'ice') {
      ctx.fillStyle = `rgba(255,240,200,${(0.6 * night).toFixed(3)})`;
      for (const q of lampXs) for (let k = 0; k < 3; k++) { const a = t * (3 + k) + k * 2; const r = (4 + 2 * Math.sin(t * 2 + k)) * sc; ctx.fillRect(W * q + Math.cos(a) * r, gY - lampTop - 3 * sc + Math.sin(a * 1.3) * r * 0.6, 1.2 * sc, 1.2 * sc); }
    }

    // ───── прохожие ─────
    const cold = kit.cold?.(frame) ?? false;
    const nWalk = Math.round(this.walkers.length * (0.3 + 0.7 * Math.min(1, activity)));
    for (let i = 0; i < this.walkers.length; i++) {
      const w = this.walkers[i];
      w.x += w.v * dt;
      if (w.x < -20) w.x = W + 20; if (w.x > W + 20) w.x = -20;
      if (i >= nWalk) continue;
      const face: 1 | -1 = w.v > 0 ? 1 : -1;
      if (w.kind === 'pair') { person(frame, w.x - 7 * sc * face, gY, w.c2, { walk: t * 7 + w.seed + 1, face, hat: w.hat ? undefined : '#d8a030' }); person(frame, w.x, gY, w.c, { walk: t * 7 + w.seed, face, hat: w.hat }); }
      else person(frame, w.x, gY, w.c, { walk: t * 7 + w.seed, carry: w.kind === 'walk' ? w.carry : null, face, hat: w.hat, bike: w.kind === 'bike', cart: w.kind === 'cart' });
      if (A.rain > 0.3 && A.weather !== 'storm' && w.kind !== 'bike') {
        ctx.fillStyle = dim(w.umb, 0.8);
        ctx.beginPath(); ctx.arc(w.x + 2 * sc * face, gY - 22 * sc, 7 * sc, Math.PI, 0); ctx.fill();
        ctx.fillStyle = dim('#2a2a2a'); ctx.fillRect(w.x + 2 * sc * face - 0.5, gY - 22 * sc, 1, 8 * sc);
      }
      if (cold && this.random() < 0.015) frame.smoke(w.x + 3 * sc * face, gY - 19 * sc, 1.1 * sc);
    }
    kit.locals(frame);
    for (const e of kit.events ?? []) { const u = ev[e.id]; if (u != null) e.draw?.(frame, u); }

    // ───── причал и судно игрока ─────
    this.hooks.ice?.(frame);
    this.dock(frame, kit, dockX, st.boat);
    kit.moored(frame);
    layer('surface');

    // ───── дым, искры ─────
    for (const p of this.smoke) {
      p.t += dt; p.y -= 14 * sc * dt; p.x += (4 + A.wind) * A.windDir * dt; p.r += 4 * sc * dt;
      const base = p.dark ? (night > 0.5 ? '40,42,48' : '90,88,84') : (night > 0.5 ? '80,86,96' : '222,222,226');
      ctx.fillStyle = `rgba(${base},${(0.35 * (1 - p.t / 5)).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    this.smoke = this.smoke.filter((p) => p.t < 5);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const s of this.sparks) {
      s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 160 * sc * dt;
      ctx.fillStyle = `rgba(255,${200 - s.t * 150 | 0},80,${(1 - s.t / 0.7).toFixed(3)})`;
      ctx.fillRect(s.x, s.y, 1.6 * sc, 1.6 * sc);
    }
    ctx.restore();
    this.sparks = this.sparks.filter((s) => s.t < 0.7);
    layer('front');

    // Weather comes from the real engine, including its precipitation settings.
    this.hooks.weather?.(frame);
    // шторм: брызги через стенку набережной
    if (A.waves > 1.5) {
      for (let k = 0; k < 5; k++) {
        const ph = (t * 0.9 + k * 0.37) % 1;
        const x = W * hash1(k * 3 + Math.floor(t * 0.9 + k * 0.37));
        ctx.fillStyle = `rgba(240,248,255,${(0.6 * (1 - ph) * (1 - night * 0.4)).toFixed(3)})`;
        for (let i = 0; i < 8; i++) { const a = -Math.PI * 0.95 + i * 0.13 + (hash1(i + k) - 0.5) * 0.2; const r = (10 + i * 5) * sc * ph; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 2.2, waterY - 4 * sc + Math.sin(a) * r * 2.6 + ph * ph * 40 * sc, (1.4 + hash1(i * 5 + k) * 1.6) * sc, 0, Math.PI * 2); ctx.fill(); }
      }
    }
    kit.foreground(frame);
    const fogAmt = clamp(A.fog + (kit.fogBase ?? 0), 0, 1);
    if (fogAmt > 0.04) {
      const fc = mix(P.fog, '#101820', night * 0.85);
      for (let k = 0; k < 4; k++) {
        const y0 = hY - H * 0.08 + k * H * 0.11, hh = H * 0.16;
        const fg = ctx.createLinearGradient(0, y0, 0, y0 + hh);
        const a = fogAmt * (0.14 + k * 0.05) * (0.7 + 0.3 * Math.sin(t * 0.3 + k));
        fg.addColorStop(0, hexA(fc, 0)); fg.addColorStop(0.5, hexA(fc, a)); fg.addColorStop(1, hexA(fc, 0));
        ctx.fillStyle = fg;
        const off = Math.sin(t * 0.15 + k * 2) * W * 0.05;
        ctx.fillRect(-W * 0.1 + off, y0, W * 1.2, hh);
      }
      const fg2 = ctx.createLinearGradient(0, hY * 0.6, 0, hY * 1.1);
      fg2.addColorStop(0, hexA(fc, 0)); fg2.addColorStop(1, hexA(fc, fogAmt * 0.45));
      ctx.fillStyle = fg2; ctx.fillRect(0, 0, W, hY * 1.1);
    }
    this.hooks.lightning?.(frame);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,10,${(0.42 + night * 0.2).toFixed(3)})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (st.hover) {
      const hs = this.hot.find((h) => h.id === st.hover);
      if (hs) {
        const y = hs.y - 14 * sc + Math.sin(t * 4) * 3 * sc;
        ctx.fillStyle = '#f1ebdd'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(hs.x, y); ctx.lineTo(hs.x - 7 * sc, y - 11 * sc); ctx.lineTo(hs.x + 7 * sc, y - 11 * sc); ctx.closePath(); ctx.fill(); ctx.stroke();
        lightPool(ctx, hs.x, gY, (hs.id === 'dock' ? 70 : 90) * sc, '#f1ebdd', 0.1 + 0.04 * Math.sin(t * 4));
      }
    }
  }

  /** Чайки на воде, прыгающая рыба, плавучий мусор */
  private waterLife(f: PF, kit: PortKit) {
    const { ctx, W, H, waterY, sc, t, dt, dim } = f;
    if (kit.quay !== 'ice') {
      for (let k = 0; k < 3; k++) {
        const x = W * (0.12 + k * 0.31) + Math.sin(t * 0.1 + k) * 20 * sc, y = waterY + 18 * sc + k * 9 * sc + Math.sin(t * 1.1 + x * 0.02) * 1.5 * sc * (0.5 + f.A.waves * 0.5);
        ctx.fillStyle = dim('#f4f4f4', 0.8); ctx.beginPath(); ctx.ellipse(x, y - 1.5 * sc, 3.4 * sc, 2 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x + 2.8 * sc, y - 4 * sc, 1.5 * sc, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = dim('#8a8a8a', 0.8); ctx.beginPath(); ctx.ellipse(x - 0.5 * sc, y - 2 * sc, 2.2 * sc, 1 * sc, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = dim('#f0a030'); ctx.fillRect(x + 4 * sc, y - 4.2 * sc, 1.8 * sc, 0.8 * sc);
        ctx.fillStyle = `rgba(255,255,255,${(0.2 * (1 - f.night * 0.5)).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(x, y + 0.5 * sc, 5 * sc, 1.2 * sc, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    this.jumpT -= dt;
    if (this.jumpT <= 0) { this.jump = { x: W * (0.05 + this.random() * 0.9), y: waterY + 10 * sc + this.random() * (H - waterY) * 0.5, t: 0 }; this.jumpT = 6 + this.random() * 9; }
    if (this.jump) {
      const j = this.jump; j.t += dt; const u = j.t / 1.1;
      if (u >= 1) this.jump = null;
      else {
        const px = j.x + u * 18 * sc, py = j.y - Math.sin(u * Math.PI) * 16 * sc;
        ctx.save(); ctx.translate(px, py); ctx.rotate((0.5 - u) * 1.6);
        ctx.fillStyle = dim(kit.quay === 'sand' ? '#60c0d0' : '#b8c8d0'); ctx.beginPath(); ctx.ellipse(0, 0, 4 * sc, 1.6 * sc, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-3.5 * sc, 0); ctx.lineTo(-6 * sc, -2 * sc); ctx.lineTo(-6 * sc, 2 * sc); ctx.fill(); ctx.restore();
        if (u < 0.2) splash(f, j.x, j.y, u / 0.2, sc * 0.8);
        if (u > 0.75) splash(f, j.x + 18 * sc, j.y, (u - 0.75) / 0.25, sc);
      }
    }
    for (let k = 0; k < 4; k++) {
      const x = ((f.h(k + 77) * W + t * (3 + k) * sc * f.A.windDir) % (W + 40) + W + 40) % (W + 40) - 20;
      const y = waterY + 14 * sc + f.h(k + 88) * (H - waterY) * 0.6 + Math.sin(t * 1.3 + k) * 1 * sc;
      if (kit.quay === 'ice') { ctx.fillStyle = dim('#eef4f8', 0.4); ctx.beginPath(); ctx.ellipse(x, y, 5 * sc, 1.6 * sc, 0, 0, Math.PI * 2); ctx.fill(); }
      else if (k % 2) { ctx.fillStyle = dim('#8a6a4a'); ctx.fillRect(x - 6 * sc, y, 12 * sc, 1.6 * sc); }
      else { ctx.strokeStyle = dim(k ? '#e8e4dc' : '#d8402a'); ctx.lineWidth = 1.4 * sc; ctx.beginPath(); ctx.ellipse(x, y, 3 * sc, 1.4 * sc, 0, 0, Math.PI * 2); ctx.stroke(); }
    }
  }

  private drawBirds(f: PF, kit: PortKit) {
    const { ctx, W, sc, t, dt, dim } = f;
    const kind = kit.birds?.kind ?? 'gull';
    const col = kind === 'skua' || kind === 'frigate' ? dim('#2a2a2e', 0.6) : dim('#f4f4f4', 0.9);
    const size = kind === 'pelican' ? 1.3 : kind === 'frigate' ? 1.5 : 0.8;
    const flap = kind === 'pelican' ? 2.5 : kind === 'frigate' ? 1.2 : 6;
    for (const b of this.birds) {
      b[0] += (14 + b[2] * 3) * sc * dt * (b[2] > 3 ? 1 : -1);
      if (b[0] > W + 30) b[0] = -30; if (b[0] < -30) b[0] = W + 30;
      const x = b[0], y = b[1] + Math.sin(t * 0.5 + b[2]) * 10, s = sc * size;
      const fl = Math.sin(t * flap + b[2] * 5) * 5 * s;
      ctx.strokeStyle = col; ctx.lineWidth = 1.2 * s; ctx.lineCap = 'round';
      ctx.beginPath();
      if (kind === 'frigate') { ctx.moveTo(x - 14 * s, y - fl); ctx.quadraticCurveTo(x - 5 * s, y - 5 * s, x, y); ctx.quadraticCurveTo(x + 5 * s, y - 5 * s, x + 14 * s, y - fl); ctx.moveTo(x, y); ctx.lineTo(x - 2 * s, y + 6 * s); ctx.moveTo(x, y); ctx.lineTo(x + 2 * s, y + 6 * s); }
      else { ctx.moveTo(x - 10 * s, y - fl); ctx.quadraticCurveTo(x - 4 * s, y - 4 * s, x, y); ctx.quadraticCurveTo(x + 4 * s, y - 4 * s, x + 10 * s, y - fl); }
      ctx.stroke();
      if (kind === 'pelican') { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y + 1 * s, 4 * s, 1.6 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dim('#e0a050', 0.8); ctx.fillRect(x + 3 * s, y + 0.5 * s, 5 * s, 1.2 * s); }
    }
  }

  private aurora(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, a: number) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) {
      for (let x = 0; x <= W; x += 7) {
        const y = H * (0.05 + k * 0.03) + Math.sin(x * 0.006 + t * 0.25 + k) * 30 + Math.sin(x * 0.02 - t * 0.4) * 10;
        const hh = 70 + Math.sin(x * 0.02 + t + k) * 28;
        const gg = ctx.createLinearGradient(0, y, 0, y + hh);
        const c = k === 1 ? '150,90,255' : k === 3 ? '90,200,255' : '70,255,160';
        const amp = 0.13 * a * (0.6 + 0.4 * Math.sin(x * 0.01 + t * 0.7 + k * 2));
        gg.addColorStop(0, `rgba(${c},0)`); gg.addColorStop(0.65, `rgba(${c},${amp.toFixed(3)})`); gg.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = gg; ctx.fillRect(x, y, 7, hh);
      }
    }
    ctx.restore();
  }

  private lightPath(ctx: CanvasRenderingContext2D, x: number, hY: number, H: number, W: number, col: string, a: number, t: number) {
    if (a <= 0.01) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const q = i / 26;
      const y = hY + 4 + q * (H - hY) * 0.75;
      const w = (10 + q * 120) * (W / 900);
      const off = Math.sin(t * 1.6 + i * 1.3) * (4 + q * 18);
      ctx.fillStyle = hexA(col, a * (1 - q) * 0.35 * (0.6 + 0.4 * Math.sin(t * 2 + i)));
      ctx.fillRect(x - w / 2 + off, y, w, 1.5 + q * 2);
    }
    ctx.restore();
  }

  private groundShadow(f: PF, x: number, bw: number) {
    const { ctx, gY, quayY, sc, shadow } = f;
    const bandH = quayY + 4 * sc - gY;
    const base = ctx.createLinearGradient(0, gY, 0, gY + bandH);
    base.addColorStop(0, 'rgba(0,0,0,0.22)'); base.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = base; ctx.fillRect(x - bw / 2, gY, bw, bandH);
    if (shadow.len < 2 || shadow.a < 0.01) return;
    const x0 = shadow.dir > 0 ? x + bw / 2 : x - bw / 2 - shadow.len;
    const gsh = ctx.createLinearGradient(shadow.dir > 0 ? x0 : x0 + shadow.len, 0, shadow.dir > 0 ? x0 + shadow.len : x0, 0);
    gsh.addColorStop(0, `rgba(0,0,0,${shadow.a.toFixed(3)})`); gsh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gsh; ctx.fillRect(x0, gY, shadow.len, bandH);
  }

  private wetQuay(f: PF) {
    const { ctx, W, sc, gY, quayY, wet, A, dim } = f;
    if (wet < 0.02) return;
    const bandH = quayY + 4 * sc - gY;
    ctx.fillStyle = `rgba(10,16,24,${(0.22 * wet).toFixed(3)})`; ctx.fillRect(0, gY, W, bandH);
    const sky = dim(A.palette.skyHor, 0.5);
    for (let i = 0; i < 9; i++) {
      const px = f.h(i + 300) * W, pw = (14 + f.h(i + 310) * 30) * sc * wet, py = gY + 2 * sc + f.h(i + 320) * (bandH - 4 * sc);
      ctx.fillStyle = hexA(sky, 0.45 * wet); ctx.beginPath(); ctx.ellipse(px, py, pw, 1.6 * sc, 0, 0, Math.PI * 2); ctx.fill();
      if (f.lit) { ctx.fillStyle = `rgba(255,210,140,${(0.18 * wet * f.night).toFixed(3)})`; ctx.fillRect(px - 1, py - 1.2 * sc, 2, 2.4 * sc); }
    }
  }

  private traffic(f: PF, s: TrafficSpec) {
    const { ctx, W, hY, waterY, sc, t, night, dim } = f;
    const tt = t + (s.offset ?? 0);
    const ph = (tt % s.period) / s.period;
    const dir = Math.floor(tt / s.period) % 2 ? 1 : -1;
    const span = W + 200 * sc;
    const x = dir > 0 ? -100 * sc + span * ph : W + 100 * sc - span * ph;
    const y = hY + (waterY - hY) * (0.12 + s.lane * 0.85);
    const k = s.scale * sc * (0.45 + s.lane * 0.55);
    const bob = Math.sin(t * 1.4 + s.lane * 9) * 1.2 * sc * (0.5 + f.A.waves * 0.6);
    ctx.save(); ctx.translate(x, y + bob); ctx.rotate(Math.sin(t * 1.1 + s.lane * 5) * 0.02 * f.A.waves * dir); ctx.scale(dir, 1);
    const H2 = dim(s.hull), T2 = dim(s.trim);
    const winCol = night > 0.3 ? 'rgba(255,200,110,0.9)' : dim('#8ab0c8');
    if (s.kind === 'zodiac') {
      ctx.fillStyle = T2; ctx.beginPath(); ctx.ellipse(0, -3 * k, 16 * k, 3.5 * k, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = H2; ctx.fillRect(-12 * k, -3 * k, 24 * k, 3 * k); ctx.fillRect(-16 * k, -10 * k, 4 * k, 8 * k);
      ctx.fillStyle = dim('#d8402a'); ctx.fillRect(-2 * k, -11 * k, 5 * k, 8 * k);
    } else if (s.kind === 'pirogue') {
      ctx.fillStyle = H2; ctx.beginPath(); ctx.moveTo(-20 * k, -4 * k); ctx.quadraticCurveTo(0, -9 * k, 20 * k, -4 * k); ctx.quadraticCurveTo(0, 1 * k, -20 * k, -4 * k); ctx.fill();
      ctx.strokeStyle = T2; ctx.lineWidth = 1.2 * k; ctx.beginPath(); ctx.moveTo(-8 * k, -6 * k); ctx.lineTo(-8 * k, -13 * k); ctx.lineTo(8 * k, -13 * k); ctx.lineTo(8 * k, -6 * k); ctx.stroke();
      ctx.fillStyle = T2; ctx.fillRect(-14 * k, -14.5 * k, 28 * k, 2 * k);
      ctx.fillStyle = dim('#3a2a1c'); ctx.fillRect(-2 * k, -14 * k, 3 * k, 9 * k);
      ctx.strokeStyle = dim('#8a6a4a'); ctx.lineWidth = 1 * k; const pd = Math.sin(t * 3) * 4 * k; ctx.beginPath(); ctx.moveTo(1 * k, -9 * k); ctx.lineTo(8 * k + pd, 2 * k); ctx.stroke();
    } else if (s.kind === 'sail') {
      ctx.fillStyle = H2; ctx.beginPath(); ctx.moveTo(-26 * k, -5 * k); ctx.lineTo(28 * k, -7 * k); ctx.lineTo(22 * k, 4 * k); ctx.lineTo(-22 * k, 4 * k); ctx.fill();
      ctx.strokeStyle = dim('#c8c8c8'); ctx.lineWidth = 1.2 * k; ctx.beginPath(); ctx.moveTo(0, -6 * k); ctx.lineTo(0, -52 * k); ctx.stroke();
      ctx.fillStyle = T2; ctx.beginPath(); ctx.moveTo(-1, -50 * k); ctx.lineTo(-22 * k, -8 * k); ctx.lineTo(-1, -8 * k); ctx.fill();
      ctx.fillStyle = dim('#f4f2ec'); ctx.beginPath(); ctx.moveTo(2 * k, -46 * k); ctx.lineTo(18 * k, -9 * k); ctx.lineTo(2 * k, -9 * k); ctx.fill();
    } else {
      const L = s.kind === 'ferry' ? 1.5 : s.kind === 'trawler' ? 1.15 : s.kind === 'tug' ? 0.8 : 1;
      ctx.fillStyle = H2; ctx.beginPath(); ctx.moveTo(-30 * k * L, -6 * k); ctx.lineTo(32 * k * L, -8 * k); ctx.quadraticCurveTo(28 * k * L, 4 * k, 20 * k * L, 5 * k); ctx.lineTo(-26 * k * L, 5 * k); ctx.quadraticCurveTo(-30 * k * L, 0, -30 * k * L, -6 * k); ctx.fill();
      ctx.fillStyle = T2; ctx.fillRect(-30 * k * L, -7 * k, 62 * k * L, 1.6 * k);
      if (s.kind === 'ferry') {
        ctx.fillStyle = T2; ctx.fillRect(-26 * k * L, -22 * k, 50 * k * L, 15 * k); ctx.fillRect(-16 * k * L, -30 * k, 30 * k * L, 8 * k);
        ctx.fillStyle = winCol; for (let i = 0; i < 9; i++) ctx.fillRect(-24 * k * L + i * 5.4 * k * L, -18 * k, 3 * k * L, 3 * k); for (let i = 0; i < 5; i++) ctx.fillRect(-13 * k * L + i * 5.6 * k * L, -27 * k, 3 * k * L, 3 * k);
        ctx.fillStyle = dim('#c8402a'); ctx.fillRect(4 * k * L, -38 * k, 6 * k, 8 * k); ctx.fillStyle = dim('#1a1a1c'); ctx.fillRect(4 * k * L, -38 * k, 6 * k, 1.5 * k);
        if (!f.reflecting && this.random() < 0.06) f.smoke(x + dir * 7 * k * L, y - 40 * k, 2 * k, true);
      } else if (s.kind === 'trawler') {
        ctx.fillStyle = T2; ctx.fillRect(-4 * k, -22 * k, 20 * k, 15 * k); ctx.fillStyle = winCol; ctx.fillRect(-1 * k, -19 * k, 14 * k, 4 * k);
        ctx.strokeStyle = dim('#d8a030'); ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.moveTo(-22 * k, -6 * k); ctx.lineTo(-18 * k, -26 * k); ctx.lineTo(-12 * k, -6 * k); ctx.stroke();
        ctx.strokeStyle = dim('#303030'); ctx.lineWidth = 1.5 * k; ctx.beginPath(); ctx.moveTo(10 * k, -22 * k); ctx.lineTo(10 * k, -36 * k); ctx.stroke();
        if (!f.reflecting && this.random() < 0.04) f.smoke(x + dir * 12 * k, y - 25 * k, 1.5 * k, true);
      } else if (s.kind === 'tug') {
        ctx.fillStyle = T2; ctx.fillRect(-8 * k, -20 * k, 16 * k, 13 * k); ctx.fillStyle = winCol; ctx.fillRect(-5 * k, -17 * k, 10 * k, 4 * k);
        ctx.fillStyle = dim('#1a1a1c'); ctx.fillRect(2 * k, -28 * k, 4 * k, 8 * k);
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-24 * k + i * 16 * k, -4 * k, 2.5 * k, 0, Math.PI * 2); ctx.fill(); }
        if (!f.reflecting && this.random() < 0.08) f.smoke(x + dir * 4 * k, y - 30 * k, 2 * k, true);
      } else if (s.kind === 'fireboat') {
        ctx.fillStyle = T2; ctx.fillRect(-10 * k, -20 * k, 24 * k, 13 * k); ctx.fillStyle = winCol; ctx.fillRect(-7 * k, -17 * k, 18 * k, 4 * k);
        ctx.fillStyle = dim('#8a8a8a'); ctx.fillRect(-2 * k, -28 * k, 3 * k, 8 * k); ctx.fillRect(16 * k, -14 * k, 3 * k, 7 * k);
        ctx.strokeStyle = `rgba(230,240,255,${(0.55 * (1 - night * 0.4)).toFixed(3)})`; ctx.lineWidth = 2 * k;
        for (const [sx0, sy0, a0] of [[-1 * k, -28 * k, -1.1], [17 * k, -14 * k, -0.7], [-20 * k, -8 * k, -1.8]]) {
          ctx.beginPath(); ctx.moveTo(sx0, sy0);
          for (let i = 1; i <= 12; i++) { const u = i / 12; ctx.lineTo(sx0 + Math.cos(a0) * u * 70 * k, sy0 + Math.sin(a0) * u * 70 * k + u * u * 60 * k); }
          ctx.stroke();
        }
        if (night > 0.3) f.glow(x, y - 29 * k, 1.5 * k, '#ff4040', night * (Math.floor(t * 4) % 2));
      } else {
        ctx.fillStyle = T2; ctx.fillRect(-6 * k, -16 * k, 14 * k, 10 * k); ctx.fillStyle = winCol; ctx.fillRect(-3 * k, -13 * k, 9 * k, 3.5 * k);
        ctx.strokeStyle = dim('#303030'); ctx.lineWidth = 1.5 * k; ctx.beginPath(); ctx.moveTo(-16 * k, -6 * k); ctx.lineTo(-16 * k, -34 * k); ctx.stroke();
        ctx.fillStyle = dim('#3a3a44'); ctx.fillRect(14 * k, -12 * k, 3 * k, 7 * k); ctx.beginPath(); ctx.arc(15.5 * k, -14 * k, 2 * k, 0, Math.PI * 2); ctx.fill();
      }
      if (night > 0.3 && !f.reflecting) { f.glow(28 * k * L, -10 * k, 1.2 * k, '#40ff80', night); f.glow(-30 * k * L, -8 * k, 1.2 * k, '#ff4040', night); }
    }
    ctx.restore();
    for (let i = 0; i < 10; i++) {
      const q = i / 10;
      ctx.fillStyle = `rgba(255,255,255,${(0.3 * (1 - q) * (1 - night * 0.5)).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(x - dir * (24 + q * 90) * k, y + 4 * k + q * 2, (4 + q * 14) * k, (1 + q * 1.5) * k, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  private quay(f: PF, kit: PortKit) {
    const { ctx, W, sc, quayY, waterY, dim } = f;
    const top = quayY - 6 * sc;
    ctx.fillStyle = dim(kit.pal.quay); ctx.fillRect(0, top, W, waterY - top);
    ctx.fillStyle = dim(kit.pal.quayFace); ctx.fillRect(0, quayY + 4 * sc, W, waterY - quayY - 4 * sc);
    if (kit.quay === 'wood') {
      ctx.fillStyle = hexA('#000000', 0.22);
      for (let x = 0; x < W; x += 9 * sc) ctx.fillRect(x, top, 1, quayY + 4 * sc - top);
      ctx.fillStyle = hexA('#000000', 0.35);
      for (let x = 6 * sc; x < W; x += 34 * sc) ctx.fillRect(x, quayY + 2 * sc, 4 * sc, waterY - quayY + 24 * sc);
      ctx.fillStyle = hexA('#3a5a3a', 0.5);
      for (let x = 6 * sc; x < W; x += 34 * sc) ctx.fillRect(x, waterY - 5 * sc, 4 * sc, 5 * sc);
    } else if (kit.quay === 'stone') {
      ctx.fillStyle = hexA('#000000', 0.2);
      for (let row = 0; row < 3; row++) {
        const y = quayY + 4 * sc + row * ((waterY - quayY - 4 * sc) / 3);
        ctx.fillRect(0, y, W, 1);
        for (let x = (row % 2) * 14 * sc; x < W; x += 28 * sc) ctx.fillRect(x, y, 1, (waterY - quayY - 4 * sc) / 3);
      }
      ctx.fillStyle = hexA('#ffffff', 0.08); ctx.fillRect(0, top, W, 1.5 * sc);
    } else if (kit.quay === 'concrete') {
      ctx.fillStyle = hexA('#000000', 0.25);
      for (let x = 0; x < W; x += 60 * sc) ctx.fillRect(x, quayY + 4 * sc, 1.5, waterY - quayY);
      ctx.fillStyle = hexA('#ffe040', 0.5); ctx.fillRect(0, top + 1, W, 1.2 * sc);
      ctx.fillStyle = hexA('#000000', 0.3);
      for (let x = 20 * sc; x < W; x += 80 * sc) { ctx.beginPath(); ctx.arc(x, quayY + 14 * sc, 5 * sc, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = hexA('#000000', 0.55); ctx.lineWidth = 2.5 * sc;
      for (let x = 50 * sc; x < W; x += 80 * sc) { ctx.beginPath(); ctx.arc(x, quayY + 16 * sc, 5 * sc, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = hexA('#3a5a3a', 0.35); ctx.fillRect(0, waterY - 4 * sc, W, 4 * sc);
    } else if (kit.quay === 'sand') {
      ctx.fillStyle = hexA('#ffffff', 0.12);
      for (let i = 0; i < 60; i++) ctx.fillRect(f.h(i) * W, top + f.h(i + 99) * (quayY - top + 4 * sc), 1.5, 1);
      const foam = ctx.createLinearGradient(0, quayY + 2 * sc, 0, waterY);
      foam.addColorStop(0, hexA('#f8f4ea', 0.6)); foam.addColorStop(1, hexA('#f8f4ea', 0));
      ctx.fillStyle = foam; ctx.fillRect(0, quayY + 2 * sc, W, waterY - quayY);
    } else if (kit.quay === 'ice') {
      ctx.fillStyle = hexA('#ffffff', 0.5); ctx.fillRect(0, top, W, 2 * sc);
      ctx.strokeStyle = hexA('#7a9ab8', 0.35); ctx.lineWidth = 0.8;
      for (let i = 0; i < 10; i++) { const x = f.h(i + 7) * W; ctx.beginPath(); ctx.moveTo(x, quayY + 4 * sc); ctx.lineTo(x + (f.h(i) - 0.5) * 30 * sc, waterY); ctx.stroke(); }
      ctx.fillStyle = hexA('#8ab8d8', 0.3); ctx.fillRect(0, waterY - 3 * sc, W, 3 * sc);
    }
  }

  private dock(f: PF, kit: PortKit, dockX: number, boat: BoatDef) {
    const { ctx, sc, quayY, waterY, dim, t } = f;
    ctx.fillStyle = dim(kit.pal.quay); ctx.fillRect(dockX - 70 * sc, quayY - 2 * sc, 140 * sc, 5 * sc);
    for (const dx of [-60, -20, 20, 60]) { ctx.fillStyle = dim(kit.pal.quayFace); ctx.fillRect(dockX + dx * sc, quayY, 5 * sc, waterY - quayY + 30 * sc); }
    // TravelOverlay already performed the journey. Never replay an approach through the moored fleet.
    const bx = dockX + 40 * sc;
    this.hot.push({ id: 'dock', x: bx, y: waterY - 60 * sc });
    if (this.hooks.playerBoat) {
      this.hooks.playerBoat(f, bx, boat, 0);
      ctx.strokeStyle = dim('#c8b080'); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(dockX - 20 * sc, quayY);
      ctx.quadraticCurveTo(dockX, waterY + 6 * sc, bx - 30 * sc, f.waveY(bx - 30 * sc) - 4 * sc); ctx.stroke();
      return;
    }
    const bob = Math.sin(t * 1.1) * 1.5 * sc;
    const s = sc * 0.9;
    const st = boat.style;
    if (st === 'row' || st === 'kayak' || st === 'dinghy') {
      const k = st === 'kayak' ? 0.5 : 0.62;
      hull(f, bx, waterY + 2 * sc, s * k, boat.hull, boat.trim, { bob, long: st === 'kayak' ? 1.3 : 1 });
      if (st !== 'kayak') { ctx.strokeStyle = dim('#5a3a1c'); ctx.lineWidth = 1.4 * sc; ctx.beginPath(); ctx.moveTo(bx - 10 * s, waterY - 4 * s + bob); ctx.lineTo(bx - 30 * s, waterY + 12 * s + bob); ctx.stroke(); }
      if (st === 'dinghy') { ctx.fillStyle = dim('#2a2a2a'); ctx.fillRect(bx - 38 * s, waterY - 12 * s + bob, 7 * s, 14 * s); }
    } else if (st === 'barkas' || st === 'cutter') {
      hull(f, bx, waterY + 2 * sc, s * 0.85, boat.hull, boat.trim, { bob, cabin: true, mast: st === 'barkas' });
    } else if (st === 'yacht') {
      hull(f, bx, waterY + 2 * sc, s * 0.9, boat.hull, boat.trim, { bob, sail: false, mast: true, long: 1.1 });
    } else {
      hull(f, bx, waterY + 2 * sc, s * 1.25, boat.hull, boat.trim, { bob, wheelhouse: true, long: st === 'research' ? 1.25 : 1.1 });
      if (st === 'trawler' || st === 'research') {
        ctx.strokeStyle = dim(st === 'research' ? '#f4f4f4' : '#d8a030'); ctx.lineWidth = 2.5 * s;
        ctx.beginPath(); ctx.moveTo(bx - 60 * s, waterY - 8 * s + bob); ctx.lineTo(bx - 50 * s, waterY - 50 * s + bob); ctx.lineTo(bx - 40 * s, waterY - 8 * s + bob); ctx.stroke();
      }
    }
    ctx.strokeStyle = dim('#c8b080'); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(dockX - 20 * sc, quayY); ctx.quadraticCurveTo(dockX, waterY + 6 * sc, bx - 44 * s, waterY - 4 * s + bob); ctx.stroke();
    ctx.strokeStyle = dim('#3a2a1c'); ctx.lineWidth = 1 * sc;
    ctx.beginPath(); ctx.moveTo(bx + 20 * s, waterY - 6 * s + bob); ctx.lineTo(bx + 60 * s, waterY - 62 * s + bob); ctx.stroke();
    ctx.strokeStyle = hexA('#ffffff', 0.35); ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(bx + 60 * s, waterY - 62 * s + bob); ctx.quadraticCurveTo(bx + 64 * s, waterY - 20 * s, bx + 62 * s + Math.sin(t) * 3, f.waveY(bx + 62 * s)); ctx.stroke();
  }
}
