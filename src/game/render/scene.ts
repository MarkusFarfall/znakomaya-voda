import { horizontalView, navigationSpeed, worldNX } from "../navigation";
import { waterWidth, waterSwell } from "../aquatory";
import { sampleWave, waveAmplitudePx } from "../waterPhysics";
import { AquatoryStream } from "./aquatoryStream";
import { LocalWake } from "./localWake";
import { depthToU, JUMP_TIME, TIME_SCALE, type Engine, type SonarBand } from "../engine";
import { FISH } from "../fish";
import { FRIEND_PRESENCE_TTL_MS, type LiveFriendPresence } from "../friends";
import { drawFish, drawFishGlow, fishScreenLen } from "../fishDraw";
import type { ActiveEvent, FishDef } from "../types";
import { PrecipitationField } from "./precipitation";
import { projectFightFish } from "./fishingGeometry";
import { BAIT_BY_ID, BOATS } from "../world";
import { BOAT_SPECS, drawBoat, drawFleetBoat } from "./boat";
import { Boat3D } from "./boats3d/boat3d";
import { hasActiveEvent, horizontalRange, type Frame } from "./frame";
import { drawBobberPointer, drawFightPanel, drawPower, drawRuler, drawSonar } from "./hud";
import { LandRenderer } from "./land";
import { AmbientLife } from "./ambient";
import { SeabedRenderer } from "./seabed";
import { SkyRenderer } from "./sky";
import { drawBolt, drawIce, drawLeaves, makeBolt, type Bolt } from "./weatherFx";
import { drawEventFx, EventFxBuffer, EVENT_FX_MOTION_SCALE, type FxScene } from "./eventFx";
import { clamp, glow, hexA, mix, rng, smooth, af, rgbHex, FONTS, roundRect } from "./util";
import {
  drawDepthOverlay,
  drawSeaBand,
  drawShafts,
  drawSurfaceCaustics,
  drawSurfaceFront,
  drawSurfaceGlow,
  drawSurfaceStreaks,
  drawUnderwaterBody,
  seaSurfaceColor,
  type Ring,
} from "./water";

interface Ambient { f: FishDef; x: number; depth: number; dir: 1 | -1; speed: number; len: number; phase: number; known: boolean }
interface Creature { kind: "jelly" | "turtle" | "crab"; x: number; y: number; vx: number; vy: number; s: number; phase: number; hue: string }
interface Bubble { x: number; y: number; r: number; v: number }
interface Spray { x: number; y: number; vx: number; vy: number; t: number }


interface School { x: number; depth: number; dir: 1 | -1; n: number; speed: number; phase: number; offsets: [number, number][]; col: string; size: number }

export type CamMode = "auto" | "surface" | "hook" | "bottom";
export const CAM_MODES: CamMode[] = ["auto", "surface", "hook", "bottom"];

export class Scene {
  mobileButtons = false;
  private stream = new AquatoryStream();
  private fxBuffer = new EventFxBuffer();
  private readonly activeEventScratch: ActiveEvent[] = [];
  private readonly activeEventIds = new Set<string>();
  get streamedRegions(){return this.stream.residentIds;}
  private bottomAt(f:Frame,x:number){return f.bedDepth?f.sY+f.depthPx(f.bedDepth(x)):this.bed.bedY(x);}
  camY = 0;
  cameraX = 0;
  viewWidth = 0;
  private pixelScale = 1;
  private waterTop = 0;
  private navigationInstance: Engine["navigation"] | null = null;
  private localWake = new LocalWake();
  screenToWorldNX(x: number) { return worldNX(x, this.cameraX, this.pixelScale,this.W); }
  isWaterPoint(y: number) { return y >= this.waterTop && y <= this.H; }
  camMode: CamMode = "auto";
  /** Режим перехода: скорость хода в px/с (null — обычная рыбалка) */
  voyage: number | null = null;
  private flow = 0;
  quality = 2;
  /** зум камеры: 1 — обычный вид, до 2 — приближение к лодке */
  zoom = 1;
  /** 3D-модели судов (переключается в настройках) */
  boat3dOn = false;
  private boat3d: Boat3D | null = null;
  /** детальная графика: отдельные слои можно отключать */
  gfx = { refl: true, shafts: true, caustics: true, foam: true, precip: true };
  private schools: School[] = [];
  private schoolT = 3;
  private sky = new SkyRenderer();
  private land = new LandRenderer();
  private life = new AmbientLife();
  private bed = new SeabedRenderer();
  private ambient: Ambient[] = [];
  private creatures: Creature[] = [];
  private bubbles: Bubble[] = [];
  private sprays: Spray[] = [];
  private rings: Ring[] = [];
  private snow: [number, number, number][] = [];
  private spawnT = 0;
  private creatureT = 0;
  private t = 0;
  private rain = new PrecipitationField("rain");
  private snowfall = new PrecipitationField("snow");
  private W = 0;
  private H = 0;
  private initQuality = -1;
  private spotKey = "";
  private bolt: Bolt = [];
  private lastBoltSeed = -1;
  private sonar: SonarBand[] = [];
  private sonarT = 0;
  private whaleX = -500;
  private friendPresence: { presence: LiveFriendPresence; receivedAt: number; ageAtReceiptMs: number }[] = [];
  private boatSource: Frame | null = null;
  private boatX = 0;
  private boatTurnScale = 1;
  private readonly boatWaveY = (x: number) => {
    const source = this.boatSource;
    return source ? source.waveY(this.boatX + (x - this.boatX) * this.boatTurnScale) : 0;
  };
  private readonly boatFrame = {} as Frame;

  setFriendPresence(snapshot: readonly LiveFriendPresence[], serverNow = new Date().toISOString()) {
    const receivedAt = Date.now();
    const serverTime = Date.parse(serverNow);
    this.friendPresence = snapshot.slice(0, 50).map((presence) => {
      const updatedAt = Date.parse(presence.updatedAt);
      const serverAge = Number.isFinite(serverTime) && Number.isFinite(updatedAt) ? Math.max(0, serverTime - updatedAt) : 0;
      return { presence, receivedAt, ageAtReceiptMs: serverAge };
    });
  }

  /** Ширина экрана в CSS-пикселях. Отдельно от W: W — это ширина мира (7200). */
  private screenW = 0;

  private init(W: number, H: number) {
    if (W === this.W && H === this.H && this.initQuality === this.quality) return;
    this.W = W;
    this.H = H;
    this.initQuality = this.quality;
    const r = rng(9);
    const snowN = this.quality >= 2 ? 130 : this.quality === 1 ? 80 : 45;
    this.snow = Array.from({ length: snowN }, () => [r() * W, r() * 3000, 0.5 + r() * 1.6]);
  }

  private fxScene(f: Frame, boatX: number, rodTip?: readonly [number, number]): FxScene {
    const { ctx, W, H, sc, hY, sY, cam, t, atmo } = f;
    const mast: readonly [number, number] = [boatX - 15 * sc, f.waveY(boatX) - 30 * sc];
    const tip: readonly [number, number] = rodTip ?? [boatX + 70 * sc, f.waveY(boatX) - 50 * sc];
    const rocks = this.voyage===null?this.stream.rocks():this.land.seaRocks.slice(0,8).map(rock=>[rock.x,rock.y-rock.h] as [number,number]);
    // Эффекты событий привязываются к кадру игрока: раньше якоря считались в долях всей
    // акватории (7200 px), поэтому событие могло быть активным, но невидимым.
    const viewX0 = f.viewLeft ?? 0;
    const viewW = f.viewWidth ?? W;
    return {
      // Событийная анимация — только представление: замедляем визуальный дрейф,
      // не трогая возраст/таймеры в EventFxBuffer и EventDirector.
      c: ctx, t: t * EVENT_FX_MOTION_SCALE, W, H, s: sc, q: Math.max(0, Math.min(2, this.quality)) as 0 | 1 | 2,
      horizon: hY, surface: sY, seabed: sY + f.depthPx(f.spot.maxDepth), visW: viewW, worldW: f.W, viewX0, cam,
      windPx: atmo.wind * atmo.windDir * 26 * sc,
      sAt: f.waveY,
      // Реальная кромка грунта: подводные события не должны уходить «внутрь» дна.
      bedAt: f.bedDepth ? (x: number) => sY + f.depthPx(f.bedDepth!(x / W)) : undefined,
      glow: (x, y, r, col, a) => glow(ctx, x, y, r, rgbHex(col), a),
      sun: { x: f.sunX, y: f.sunY }, moon: { x: f.moonX, y: f.moonY },
      rocks, capeX: viewX0 + viewW * (f.loc.land === "cliffs" ? 0.88 : 0.82), capeTop: hY,
      rodTip: tip, mast, lantern: [boatX - 20 * sc, f.waveY(boatX) - 20 * sc], boatX,
      A: atmo, pal: atmo.palette,
    };
  }

  render(ctx: CanvasRenderingContext2D, e: Engine, W: number, H: number, dt: number) {
    const screenW = W;
    this.screenW = screenW;
    if (this.voyage === null) W = waterWidth(e.s.location);
    this.init(W, H);
    this.t += dt;
    const t = this.t;
    const loc = e.loc, spot = e.spot;
    const changedPosition = this.navigationInstance !== e.navigation;
    this.navigationInstance = e.navigation;
    if (changedPosition) this.localWake.reset();
    const changedSpot = this.spotKey !== loc.id;
    if (changedSpot) {
      this.localWake.reset();
      this.spotKey = loc.id;
      this.ambient = [];
      this.creatures = [];
      this.schools = [];
      this.sonarT = 0;
    }
    const atmo = e.atmosphere.state;
    const weather = e.weather;
    const cover = atmo.cover;
    const fogK = atmo.fog;
    const day = atmo.daylight;
    const night = atmo.night;
    const golden = atmo.golden;
    const activeEvents = e.activeEventsInto(this.activeEventScratch);
    this.activeEventIds.clear();
    for (const event of activeEvents) this.activeEventIds.add(event.id);

    const sY = H * 0.46;
    const hY = sY - H * 0.095;
    const K = H * 0.42;
    const sc = clamp(Math.min(H / 900, W / 1150), 0.5, 1.25);
    const compact = screenW < 820 || H < 560, land = screenW >= H;
    const calm = this.activeEventIds.has("calm");
    const localSwell = this.voyage === null ? waterSwell(loc.id, e.navigation.x) : (spot.swell ?? 1);
    const amp = waveAmplitudePx(atmo.waves, loc.waveMult, localSwell, atmo.wind, sc, calm);

    const top = rgbHex(atmo.palette.skyTop);
    const mid = rgbHex(atmo.palette.skyMid);
    const hor = rgbHex(atmo.palette.skyHor);
    const sunElev = atmo.sunElev;
    const sunX = W * clamp((atmo.sunAz - 45) / 270, 0, 1);
    const sunY = hY - Math.sin((sunElev * Math.PI) / 180) * H * 0.34;
    const sunVis = atmo.sunVis;
    const moonX = W * clamp((atmo.moonAz - 45) / 270, 0, 1);
    const moonY = hY - Math.sin((atmo.moonElev * Math.PI) / 180) * H * 0.3;
    const moonUp = atmo.moonElev > -1;
    const moonVis = atmo.moonVis;

    if (this.voyage) this.flow += this.voyage * dt;
    const fl = this.flow;
    const waveY = (xx: number) => {
      const x = xx + fl;
      return sY + sampleWave(x, t, amp, atmo.windDir).height + (this.voyage === null ? this.localWake.heightAt(xx) : 0);
    };
    const depthPx = (m: number) => K * depthToU(m);

    // камера
    const inWater = ["sinking", "waiting", "bite", "fight"].includes(e.phase) && !(e.hooked && e.hooked.jump > 0);
    const hookY = sY + depthPx(e.hookDepth);
    const bedMaxPx = sY + depthPx(loc.maxDepth*1.05);
    const bottomCam=Math.max(0,sY+depthPx((this.voyage===null?e.bedAt(e.navigation.nx):spot.maxDepth)*1.05)-H*.73);
    const topRes = compact ? (land ? 64 : 118) : 210;
    const maxCam = Math.max(0, bedMaxPx - H * 0.73);
    let target = 0;
    let speed = 2.2;
    switch (this.voyage !== null || e.navigationMode ? "surface" : this.camMode) {
      case "surface":
        target = 0;
        break;
      case "hook":
        target = inWater ? hookY - H * 0.55 : 0;
        break;
      case "bottom":
        target = bottomCam;
        break;
      default:
        target = inWater ? hookY - H * 0.55 : 0;
        // при поклёвке поплавок обязан быть в кадре
        if (e.phase === "bite" || e.nibbling) {
          target = Math.min(target, sY - topRes - 70);
          speed = 6;
        }
    }
    target = clamp(target, 0, maxCam);
    this.camY += (target - this.camY) * Math.min(1, dt * speed);
    const cam = this.camY;

    const f: Frame = {
      ctx, e, loc, spot, weather, atmo, W, H, t, dt, sY, hY, cam, K, sc, night, day, golden, cover, fogK, top, mid, hor,
      sunX, sunY, sunElev, sunVis, moonX, moonY, moonUp, moonVis, amp,
      wind: this.voyage ? Math.min(3, atmo.wind / 18 + this.voyage / 90) : Math.min(1.5, atmo.wind / 18),
      clarity: loc.clarity ?? 0.6, quality: this.quality, compact, land, bottomFocus: !e.navigationMode && this.camMode === "bottom",
      topRes: compact ? (land ? 64 : 118) : 210, buttonControls:this.mobileButtons, botRes: compact ? (this.mobileButtons?(land?140:195):(land ? 70 : 146)) : this.mobileButtons?195:150, depthPx, waveY,
      light: { dx: clamp((sunX / W) * 2 - 1, -1, 1), k: sunVis * (1 - night * 0.7) },
      activeEvents,
      activeEventIds: this.activeEventIds,
    };
    const fxCalls = this.fxBuffer.build(e.eventDirector, e.s.minutes, TIME_SCALE);
    const fxBoatX = this.voyage !== null ? W * .3 : e.navigation.x;
    f.boatX = fxBoatX;
    if (this.voyage === null) this.localWake.update(f);
    const z = Math.max(screenW / W, clamp(this.zoom, 1, 2));
    this.pixelScale = z;
    this.waterTop = sY + (hY - sY) * z - cam * z;
    const followingTackle = !e.navigationMode && e.phase !== "idle";
    const hullHalf = BOAT_SPECS[e.boat.style].half * 28 * sc;
    const lookAhead = Math.min(100, screenW / z * .16, Math.max(0, screenW / z * .5 - hullHalf - 24));
    const focus = followingTackle ? (fxBoatX + W * e.castNX()) * .5 : fxBoatX + Math.cos(e.navigation.yaw) * lookAhead + e.navigation.velocity / 3.4;
    const view = horizontalView(W, screenW, z, focus);
    this.viewWidth = view.width;
    this.cameraX = this.voyage !== null ? 0 : changedSpot || changedPosition ? view.x : clamp(this.cameraX + (view.x - this.cameraX) * -Math.expm1(-dt * 3.4), 0, W - view.width);
    const screenX = (x: number) => (x - this.cameraX) * z;
    f.viewLeft=this.cameraX;f.viewWidth=view.width;
    if(this.voyage===null){f.bedDepth=x=>e.bedAt(x/W);this.stream.update(f,this.cameraX,view.width,e.navigation.heading);}

    const shake = e.shake * 4;
    ctx.save();
    ctx.clearRect(0, 0, screenW, H);
    ctx.translate(-this.cameraX * z, sY * (1 - z));
    ctx.scale(z, z);
    ctx.translate(shake ? (Math.random() - 0.5) * shake : 0, -cam + (shake ? (Math.random() - 0.5) * shake : 0));

    // ───── НАД ВОДОЙ ─────
    if (cam < sY + 30) {
      this.sky.draw(f);
      if (fxCalls.length) drawEventFx(this.fxScene(f, fxBoatX), "sky", fxCalls);
      this.life.update(f);
      this.life.drawSky(f);
      if(this.voyage===null)this.stream.draw(f,(c,cf)=>c.land.drawAbove(cf));else this.land.drawAbove(f);
      if (fxCalls.length) drawEventFx(this.fxScene(f, fxBoatX), "horizon", fxCalls);
      drawSeaBand(f, () => { if (this.quality > 0 && this.gfx.refl) {if(this.voyage===null)this.stream.draw(f,(c,cf)=>c.land.drawReflection(cf,seaSurfaceColor(f)));else this.land.drawReflection(f,seaSurfaceColor(f));} });
      if (fxCalls.length) drawEventFx(this.fxScene(f, fxBoatX), "surface", fxCalls);
      if(this.voyage===null)this.stream.draw(f,(c,cf)=>c.land.drawSea(cf));else this.land.drawSea(f);
      if (!this.voyage) this.life.drawSea(f);
      if(this.voyage===null)this.stream.draw(f,(c,cf)=>c.land.drawDivers(cf));else this.land.drawDivers(f);
      this.drawSurfaceEvents(f);
    }

    // ───── ПОД ВОДОЙ ─────
    drawUnderwaterBody(f);
    if (fxCalls.length) drawEventFx(this.fxScene(f, fxBoatX), "under", fxCalls);
    if(this.voyage===null)this.stream.draw(f,(c,cf)=>c.bed.draw(cf,this.gfx.caustics));else this.bed.draw(f,this.gfx.caustics);
    this.drawWhale(f);
    this.updateSchools(f);
    this.updateCreatures(f);
    this.updateAmbient(f);
    const bobX = W * e.castNX();
    const fishPos = this.drawHooked(f, bobX, hookY, false);
    drawDepthOverlay(f);
    if (this.quality > 0 && this.gfx.shafts) drawShafts(f);
    if (this.quality > 1 && this.gfx.caustics) drawSurfaceCaustics(f);
    // светящийся проход
    if(this.voyage===null)this.stream.draw(f,(c,cf)=>c.bed.drawGlow(cf));else this.bed.drawGlow(f);
    this.glowPass(f);
    this.drawHooked(f, bobX, hookY, true);
    const deepK = clamp((e.hookDepth - 30) / 250, 0, 1);
    if (inWater && deepK > 0) {
      const g = e.s.currentBait === "glow";
      const lr = (150 + deepK * 110) * sc;
      const lg = ctx.createRadialGradient(fishPos[0], fishPos[1], 0, fishPos[0], fishPos[1], lr);
      lg.addColorStop(0, g ? `rgba(80,255,210,${af(0.34 * deepK)})` : `rgba(255,236,190,${af(0.26 * deepK)})`);
      lg.addColorStop(0.45, g ? `rgba(60,200,180,${af(0.1 * deepK)})` : `rgba(200,190,160,${af(0.08 * deepK)})`);
      lg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = lg;
      ctx.fillRect(fishPos[0] - lr, fishPos[1] - lr, lr * 2, lr * 2);
      ctx.restore();
    }
    this.drawMarineSnow(f);
    this.drawBubbles(f);

    // ───── ПОВЕРХНОСТЬ ─────
    if(this.voyage===null)this.stream.draw(f,(c,cf)=>c.land.drawFront(cf));else this.land.drawFront(f);
    // Свет поверхности — ДО судна: иначе полоса свечения ложится на корпус и режет его.
    if (this.gfx.foam) { drawSurfaceGlow(f); drawSurfaceStreaks(f); }
    const bx = fxBoatX;
    const flowPx = this.voyage ?? Math.abs(e.navigation.velocity);
    const speed01 = Math.min(1, flowPx / (this.voyage !== null ? 230 : navigationSpeed(e.boat)));
    const pose = this.voyage !== null || e.navigationMode ? "helm" : "fish";
    const facing = this.voyage !== null ? 1 : Math.cos(e.navigation.yaw);
    const mirror = facing < 0 ? -1 : 1;
    const turnScale = mirror * Math.max(.22, Math.abs(facing));
    ctx.save(); ctx.translate(bx, 0); ctx.scale(turnScale, 1); ctx.translate(-bx, 0);
    this.boatSource = f;
    this.boatX = bx;
    this.boatTurnScale = turnScale;
    const boatFrame = this.boatFrame;
    Object.assign(boatFrame, f);
    boatFrame.waveY = this.boatWaveY;
    boatFrame.localBoat = this.voyage === null;
    if (!this.boat3d && typeof window !== "undefined") this.boat3d = new Boat3D();
    this.boat3d?.setEnabled(this.boat3dOn);
    const r3 = this.boat3d?.draw(ctx, boatFrame, bx, pose, speed01, Math.abs(ctx.getTransform().a / turnScale) || 1) ?? null;
    let tip: [number, number];
    if (r3) {
      // кроссфейд 2D↔3D: старая модель тонет, новая всплывает
      if (r3.k < 0.99) {
        ctx.save();
        ctx.globalAlpha *= 1 - r3.k;
        ctx.translate(0, r3.k * 10);
        tip = drawBoat(boatFrame, bx, pose, speed01, flowPx);
        ctx.restore();
        if (r3.k > 0.5) tip = r3.tip;
      } else {
        tip = r3.tip;
      }
    } else {
      tip = drawBoat(boatFrame, bx, pose, speed01, flowPx);
    }
    ctx.restore();
    tip = [bx + (tip[0] - bx) * turnScale, tip[1]];
    if (this.voyage === null && this.gfx.foam) this.localWake.draw(f);
    if (this.voyage === null) this.drawFriendFleet(f, screenX, screenW, z);
    if (this.voyage === null && e.navigationMode) this.drawNavigation(f);
    if (this.gfx.foam) drawSurfaceFront(f, this.rings);
    let ringWrite = 0;
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      if (ring.t < 0.7) this.rings[ringWrite++] = ring;
    }
    this.rings.length = ringWrite;
    if (atmo.ice > 0.02) {
      drawIce(ctx, t, W, (x) => waveY(x), atmo.ice, atmo.wind * atmo.windDir * 26 * sc, sc, atmo.palette.seaNear);
    }
    if (!this.voyage) {
      this.drawJump(f, bobX);
      this.drawLine(f, tip, bobX, hookY, fishPos);
    }
    this.drawSprays(f);
    if (fxCalls.length) drawEventFx(this.fxScene(f, bx, tip), "front", fxCalls);

    if (this.voyage === null && !e.navigationMode && (e.phase === "idle" || e.phase === "charging")) {
      const dy = sY + depthPx(Math.min(e.s.targetDepth, e.maxDepth));
      ctx.save();
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = "rgba(255,230,150,0.5)";
      ctx.beginPath();
      ctx.moveTo(bx + e.navigation.heading * 60, dy);
      ctx.lineTo(W * e.castNX(), dy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,230,150,0.9)";
      ctx.font = "600 12px ui-sans-serif, system-ui";
      ctx.fillText(`${Math.min(e.s.targetDepth, e.maxDepth)} м`, W * e.castNX() - 16, dy - 6);
      ctx.restore();
    }
    this.drawPrecipitation(f);
    ctx.restore();

    // HUD/weather are screen-space, never stretched to the canonical world width.
    const screen: Frame = { ...f, W: screenW, worldWidth: W, worldToScreenX: screenX,
      sY, hY: sY + (hY - sY) * z, cam: cam * z,
      depthPx: m => depthPx(m) * z, waveY: x => sY + (waveY(this.cameraX + x / z) - sY) * z,
      sunX: screenX(sunX), moonX: screenX(moonX) };
    this.drawWeather(screen);
    this.drawLightning(screen);
    this.grade(screen);
    if (!this.voyage) {
      drawRuler(screen);
      drawBobberPointer(screen);
    }
    this.sonarT -= dt;
    if (this.sonarT <= 0) {
      this.sonarT = 0.6;
      this.sonar = e.s.sonar > 0 ? e.sonarScan() : [];
    }
    drawSonar(screen, this.sonar);
    drawPower(screen);
    drawFightPanel(screen);
    if (e.fade > 0) {
      ctx.fillStyle = `rgba(2,4,10,${smooth(clamp(e.fade, 0, 1))})`;
      ctx.fillRect(0, 0, screenW, H);
    }
  }

  private drawFriendFleet(f: Frame, screenX: (x: number) => number, screenW: number, z: number) {
    if (!this.friendPresence.length) return;
    const now = Date.now();
    const visible = this.friendPresence.flatMap((entry) => {
      const { presence } = entry;
      if (presence.location !== f.loc.id) return [];
      const ageMs = entry.ageAtReceiptMs + Math.max(0, now - entry.receivedAt);
      if (ageMs >= FRIEND_PRESENCE_TTL_MS) return [];
      const age = Math.max(0, Math.min(2.5, ageMs / 1000));
      const x = clamp(presence.x + presence.velocity * age, 0, 1) * f.W;
      const sx = screenX(x);
      if (sx < -90 || sx > screenW + 90) return [];
      const boat = BOATS[presence.boat] ?? BOATS[0];
      return [{ presence, x, sx, boat, speed: Math.abs(presence.velocity * f.W) / navigationSpeed(boat) }];
    }).sort((a, b) => a.x - b.x);

    for (const { presence, x, sx, boat, speed } of visible) {
      drawFleetBoat(f, x, boat, presence.heading, speed, presence.activity);
      const { ctx } = f;
      const label = presence.username.slice(0, 24);
      const fontSize = 12 / z;
      ctx.save();
      ctx.font = `650 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
      const pad = 7 / z;
      const width = Math.min(190 / z, ctx.measureText(label).width + pad * 2);
      const height = 19 / z;
      const labelY = f.waveY(x) - (76 + boat.tier * 9) * f.sc - 12 / z;
      const labelX = clamp(x, this.cameraX + width / 2, this.cameraX + screenW / z - width / 2);
      if (Math.abs(labelX - x) > 1 / z) {
        ctx.beginPath();
        ctx.moveTo(x, labelY + height * 0.56);
        ctx.lineTo(labelX, labelY + height * 0.56);
        ctx.lineWidth = 1 / z;
        ctx.strokeStyle = "rgba(174, 223, 209, .58)";
        ctx.stroke();
      }
      roundRect(ctx, labelX - width / 2, labelY - height / 2, width, height, 7 / z);
      ctx.fillStyle = "rgba(4, 20, 25, .88)";
      ctx.fill();
      ctx.lineWidth = 1 / z;
      ctx.strokeStyle = "rgba(174, 223, 209, .58)";
      ctx.stroke();
      ctx.fillStyle = "#f1f6e9";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, labelX, labelY, width - pad * 2);
      ctx.beginPath();
      ctx.arc(labelX, labelY + height * 0.56, 2.1 / z, 0, Math.PI * 2);
      ctx.fillStyle = "#79d5b3";
      ctx.fill();
      ctx.restore();
    }
  }

  private drawNavigation(f: Frame) {
    const { ctx, W, e, sc, t } = f;
    ctx.save();
    for (const nx of [e.navigation.left,e.navigation.right]) {
      const x = nx * W, y = f.waveY(x);
      ctx.strokeStyle = "rgba(223,211,166,.35)"; ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.moveTo(x, y - 35 * sc); ctx.lineTo(x, y + 22 * sc); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = "#ddc48d";
      ctx.beginPath(); ctx.ellipse(x, y, 4 * sc, 2 * sc, 0, 0, Math.PI * 2); ctx.fill();
    }
    const dest = e.navigation.target;
    if (dest !== null) {
      const y = f.waveY(dest), pulse = 1 + Math.sin(t * 3) * .12;
      ctx.strokeStyle = "rgba(247,220,151,.85)"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(dest, y, 16 * sc * pulse, 4 * sc * pulse, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(dest, y - 26 * sc); ctx.lineTo(dest, y - 9 * sc); ctx.stroke();
      ctx.fillStyle = "#f3dca1"; ctx.beginPath(); ctx.arc(dest, y - 29 * sc, 2.5 * sc, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  private drawSurfaceEvents(f: Frame) {
    const { ctx, e, W, hY, t, night } = f;
    if (hasActiveEvent(f, "ghost_ship")) {
      const gx = W * 0.72 + Math.sin(t * 0.05) * 60;
      ctx.save();
      ctx.globalAlpha = 0.28 + Math.sin(t) * 0.08;
      ctx.fillStyle = "#c8e4ec";
      ctx.beginPath();
      ctx.moveTo(gx - 55, hY);
      ctx.lineTo(gx + 55, hY);
      ctx.lineTo(gx + 44, hY + 9);
      ctx.lineTo(gx - 48, hY + 9);
      ctx.fill();
      for (let m = -1; m <= 1; m++) {
        ctx.fillRect(gx + m * 26, hY - 62, 2, 62);
        ctx.beginPath();
        ctx.moveTo(gx + m * 26 + 2, hY - 56);
        ctx.quadraticCurveTo(gx + m * 26 + 20 + Math.sin(t + m) * 3, hY - 38, gx + m * 26 + 2, hY - 12);
        ctx.fill();
      }
      glow(ctx, gx - 40, hY - 4, 2, "#80ffd0", 0.7);
      ctx.restore();
    }
    if (hasActiveEvent(f, "whale")) {
      const wx = W * 0.82;
      const p = (t % 7) / 7;
      if (p < 0.3) {
        ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - p / 0.3)})`;
        for (let i = 0; i < 14; i++) {
          ctx.beginPath();
          ctx.arc(wx + Math.sin(i) * 8 * p * 5, hY + 5 - p * 130 * (i / 14), 3 + p * 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = mix("#1a2430", f.hor, 0.3);
      ctx.beginPath();
      ctx.ellipse(wx, hY + 7, 32, 5, 0, Math.PI, 0);
      ctx.fill();
    }
    if (hasActiveEvent(f, "dolphins")) {
      for (let i = 0; i < 3; i++) {
        const p = ((t * 0.35 + i * 0.3) % 1.6);
        if (p > 1) continue;
        const dx = W * (0.45 + i * 0.1) + p * 60;
        const dy = hY + (f.sY - hY) * 0.6 - Math.sin(p * Math.PI) * 22;
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(-Math.cos(p * Math.PI) * 0.8);
        ctx.fillStyle = mix("#3a4a5a", "#05080f", night * 0.7);
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-2, -3);
        ctx.lineTo(-6, -9);
        ctx.lineTo(3, -3);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  /** Кильватер и бурун при переходе */
  private drawWhale(f: Frame) {
    const { ctx, e, W, sY, t, sc } = f;
    if (!hasActiveEvent(f, "whale")) return;
    // Кит проходит через кадр игрока, а не ползёт 205 секунд через всю акваторию.
    const viewX0 = f.viewLeft ?? 0, viewW = f.viewWidth ?? W;
    const left = viewX0 - 420, right = viewX0 + viewW + 520;
    if (this.whaleX < left || this.whaleX > right) this.whaleX = left;
    // 110 px/s: проход кадра занимает ~19 с, а не три с половиной минуты.
    this.whaleX += f.dt * 110;
    if (this.whaleX > right) this.whaleX = left;
    const wy = sY + f.depthPx(Math.min(f.spot.maxDepth * 0.5, 40));
    ctx.save();
    ctx.translate(this.whaleX, wy);
    ctx.scale(sc, sc);
    ctx.fillStyle = mix(f.loc.water.mid, "#000000", 0.45);
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(240, 0);
    ctx.bezierCurveTo(200, -55, -100, -50, -220, -6);
    ctx.lineTo(-220, 6);
    ctx.bezierCurveTo(-100, 45, 200, 55, 240, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-210, 0);
    ctx.lineTo(-300, -40 + Math.sin(t) * 14);
    ctx.lineTo(-280, 0);
    ctx.lineTo(-300, 40 + Math.sin(t) * 14);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(60, 40, 70, 12, 0.5 + Math.sin(t * 0.8) * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private updateSchools(f: Frame) {
    const left=f.viewLeft??0,right=left+(f.viewWidth??f.W);
    const { ctx, e, W, sY, t, sc, loc } = f;
    this.schoolT -= f.dt;
    const maxD = Math.min(f.spot.maxDepth * 0.8, loc.id === "abyss" ? 300 : 60);
    const shoal = hasActiveEvent(f, "shoal");
    if (this.schoolT <= 0 && this.schools.length < (shoal ? 3 : 1) && maxD > 2) {
      this.schoolT = shoal ? 4 : 18 + Math.random() * 22;
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      const cols: Record<string, string> = { reef: Math.random() < 0.5 ? "#f0c040" : "#60a0ff", fjord: "#a8b8c8", abyss: "#8090a0" };
      const depth = 1.5 + Math.random() * (maxD - 1.5);
      const n = 22 + Math.floor(Math.random() * 26);
      const speed = (35 + Math.random() * 30) * sc;
      const phase = Math.random() * 10;
      const seed = Math.random() * 100;
      const col = cols[loc.id] ?? "#c8d4dc";
      const size = (0.7 + Math.random() * 0.5) * sc;
      const offsets = Array.from({ length: n }, (_, i) => {
        const hx = Math.sin(i * 12.9898 + seed) * 43758.5453;
        const hy = Math.sin(i * 78.233 + seed) * 12345.6789;
        return [((hx - Math.floor(hx)) - 0.5) * 180 * size, ((hy - Math.floor(hy)) - 0.5) * 50 * size] as [number, number];
      });
      this.schools.push({ x: dir > 0 ? left - 260 : right + 260, depth, dir, n, speed, phase, offsets, col, size });
    }
    // Стая: раньше каждая рыба давала два fill и свою строку цвета (до сотни
    // вызовов на стаю). Теперь тела и хвосты собираются в пути по группам
    // блика — та же картинка, но единицы вызовов на кадр.
    const buckets = new Map<string, Path2D | null>();
    const bucketOrder: string[] = [];
    const bucketFor = (key: string) => {
      let path = buckets.get(key);
      if (path === undefined) {
        path = typeof Path2D === "undefined" ? null : new Path2D();
        buckets.set(key, path);
        bucketOrder.push(key);
      }
      return path;
    };
    for (const sch of this.schools) {
      sch.x += sch.dir * sch.speed * f.dt;
      sch.phase += f.dt;
      const cy = sY + f.depthPx(sch.depth);
      for (let i = 0; i < sch.n; i++) {
        const [ox, oy] = sch.offsets[i];
        const wave = Math.sin(sch.phase * 1.4 + ox * 0.02) * 12 * sch.size;
        const x = sch.x + ox + Math.sin(sch.phase * 0.7 + i) * 6;
        const y = cy + oy + wave;
        const glint = Math.max(0, Math.sin(sch.phase * 3 + i * 0.9 + ox * 0.05));
        const L = 8 * sch.size;
        if(y-L*.4<sY || y+L*.4>Math.min(this.bottomAt(f,x-L),this.bottomAt(f,x+L)))continue;
        // Пять ступеней блика вместо непрерывного смешивания: разницы не видно,
        // зато цвет — константа и путь можно объединить.
        const step = glint > 0.85 ? 4 : Math.min(3, Math.floor(glint * 4));
        const key = `${sch.col}|${step}`;
        const path = bucketFor(key);
        const rot = Math.cos(sch.phase * 1.4 + ox * 0.02) * 0.25;
        if (path) {
          path.moveTo(x + L * Math.cos(rot), y + L * Math.sin(rot));
          path.ellipse(x, y, L, L * 0.32, rot, 0, Math.PI * 2);
          path.moveTo(x - sch.dir * L * 0.9, y);
          path.lineTo(x - sch.dir * L * 1.5, y - L * 0.35);
          path.lineTo(x - sch.dir * L * 1.5, y + L * 0.35);
          path.closePath();
        } else {
          ctx.fillStyle = glint > 0.85 ? "#ffffff" : mix(sch.col, "#203040", 0.25 - glint * 0.25);
          ctx.beginPath();
          ctx.ellipse(x, y, L, L * 0.32, rot, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x - sch.dir * L * 0.9, y);
          ctx.lineTo(x - sch.dir * L * 1.5, y - L * 0.35);
          ctx.lineTo(x - sch.dir * L * 1.5, y + L * 0.35);
          ctx.fill();
        }
      }
    }
    for (const key of bucketOrder) {
      const path = buckets.get(key);
      if (!path) continue;
      const [col, stepS] = key.split("|");
      const step = Number(stepS);
      // Блик в середине ступени — так оттенок совпадает с прежним сглаженным.
      const glintRep = (step + 0.5) / 4;
      ctx.fillStyle = step === 4 ? "#ffffff" : mix(col, "#203040", 0.25 - glintRep * 0.25);
      ctx.fill(path);
    }
    let keepSchool = 0;
    for (let i = 0; i < this.schools.length; i++) {
      const school = this.schools[i];
      if (school.x > left - 400 && school.x < right + 400) this.schools[keepSchool++] = school;
    }
    this.schools.length = keepSchool;
    void t;
  }

  private updateCreatures(f: Frame) {
    const left=f.viewLeft??0,right=left+(f.viewWidth??f.W);
    const { ctx, e, W, sY, t, sc, loc } = f;
    this.creatureT -= f.dt;
    if (this.creatureT <= 0 && this.creatures.length < 3) {
      this.creatureT = 5 + Math.random() * 8;
      const r = Math.random();
      const maxD = f.spot.maxDepth;
      if (r < 0.45 && !["fjord", "estuary", "skerries", "mangrove"].includes(loc.id)) {
        const deep = loc.id === "abyss" || e.isNight;
        const d = Math.min(maxD * 0.8, 3 + Math.random() * Math.min(maxD, loc.id === "abyss" ? 900 : 60));
        this.creatures.push({ kind: "jelly", x: left+Math.random()*(right-left), y: sY + f.depthPx(d), vx: (Math.random() - 0.5) * 6, vy: -3 - Math.random() * 3, s: (0.6 + Math.random() * 0.8) * sc, phase: Math.random() * 6, hue: deep ? (Math.random() < 0.5 ? "#60e0ff" : "#c080ff") : "#e8d0f0" });
      } else if (r < 0.65 && ["reef", "ocean", "mangrove", "volcano"].includes(loc.id)) {
        const d = Math.min(maxD * 0.7, 4 + Math.random() * 25);
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.creatures.push({ kind: "turtle", x: dir > 0 ? left-80 : right+80, y: sY + f.depthPx(d), vx: dir * (18 + Math.random() * 10) * sc, vy: 0, s: (0.8 + Math.random() * 0.5) * sc, phase: 0, hue: "#6a7a40" });
      } else if (maxD < 70 && loc.id !== "abyss") {
        const x = left+Math.random()*(right-left);
        this.creatures.push({ kind: "crab", x, y: 0, vx: (Math.random() < 0.5 ? -1 : 1) * 12 * sc, vy: 0, s: (0.7 + Math.random() * 0.5) * sc, phase: Math.random() * 6, hue: loc.id === "reef" ? "#e05030" : "#c86040" });
      }
    }
    for (const c of this.creatures) {
      c.phase += f.dt;
      if (c.kind === "jelly") {
        const pulse = Math.max(0, Math.sin(c.phase * 2));
        c.y += (c.vy * pulse * 3 + 2) * f.dt;
        c.x += c.vx * f.dt;
        if (c.y < sY + 10) c.vy = Math.abs(c.vy);
        const floor=Math.min(this.bottomAt(f,c.x-16*c.s),this.bottomAt(f,c.x+16*c.s))-40*c.s;
        if(floor<sY+12*c.s)continue;
        if(c.y>floor){c.y=floor;c.vy=-Math.abs(c.vy);}
        c.y=Math.max(sY+12*c.s,c.y);
        ctx.save();
        ctx.translate(c.x, c.y);
        const bw = 12 * c.s * (1 - pulse * 0.15), bh = 9 * c.s * (1 + pulse * 0.1);
        ctx.strokeStyle = hexA(c.hue, 0.45);
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.moveTo((i - 2.5) * bw * 0.3, 0);
          for (let k = 1; k <= 6; k++) ctx.lineTo((i - 2.5) * bw * 0.3 + Math.sin(c.phase * 2 + k * 0.8 + i) * 3, k * 6 * c.s);
          ctx.stroke();
        }
        const g = ctx.createRadialGradient(0, -bh * 0.3, 0, 0, 0, bw);
        g.addColorStop(0, hexA(c.hue, 0.55));
        g.addColorStop(1, hexA(c.hue, 0.12));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, bw, bh, 0, Math.PI, 0);
        ctx.fill();
        ctx.restore();
      } else if (c.kind === "turtle") {
        c.x += c.vx * f.dt;
        const floor=Math.min(this.bottomAt(f,c.x-35*c.s),this.bottomAt(f,c.x+35*c.s))-26*c.s;
        if(floor<sY+16*c.s)continue;
        c.y=Math.max(sY+16*c.s,Math.min(c.y,floor));
        const dir = c.vx > 0 ? 1 : -1;
        const fl = Math.sin(c.phase * 2.5) * 0.5;
        ctx.save();
        ctx.translate(c.x, c.y + Math.sin(c.phase * 0.6) * 5);
        ctx.scale(dir * c.s, c.s);
        ctx.fillStyle = "#8a9a5a";
        ctx.beginPath();
        ctx.ellipse(24, -2, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.rotate(fl);
        ctx.beginPath();
        ctx.ellipse(8, 10, 16, 5, 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.ellipse(-16, 8, 8, 3, -0.4 - fl * 0.5, 0, Math.PI * 2);
        ctx.fill();
        const sg = ctx.createLinearGradient(0, -14, 0, 10);
        sg.addColorStop(0, "#7a6a38");
        sg.addColorStop(1, "#3a3a20");
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(20,20,10,0.4)";
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 9, -11);
          ctx.lineTo(i * 9 + 2, 10);
          ctx.stroke();
        }
        ctx.fillStyle = "#101010";
        ctx.beginPath();
        ctx.arc(28, -4, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        c.x += c.vx * f.dt * (Math.sin(c.phase * 1.5) > 0 ? 1 : 0.1);
        c.y = this.bottomAt(f,c.x) - 3 * c.s;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(c.s, c.s);
        ctx.strokeStyle = c.hue;
        ctx.lineWidth = 1.2;
        for (let i = -1; i <= 1; i += 2) {
          for (let k = 0; k < 3; k++) {
            const lp = Math.sin(c.phase * 10 + k * 2) * 1.5;
            ctx.beginPath();
            ctx.moveTo(i * 3, 0);
            ctx.lineTo(i * (7 + k * 1.5), 2 + lp);
            ctx.lineTo(i * (8 + k * 1.5), 4);
            ctx.stroke();
          }
        }
        ctx.fillStyle = c.hue;
        ctx.beginPath();
        ctx.ellipse(0, -1, 7, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-8, -4, 2.5, 0, Math.PI * 2);
        ctx.arc(8, -4, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#101010";
        ctx.fillRect(-2.5, -6, 1.2, 2);
        ctx.fillRect(1.3, -6, 1.2, 2);
        ctx.restore();
      }
    }
    let keepCreature = 0;
    for (let i = 0; i < this.creatures.length; i++) {
      const creature = this.creatures[i];
      if (creature.x > left - 120 && creature.x < right + 120 && creature.y < f.cam + f.H * 3 && creature.phase < 90) this.creatures[keepCreature++] = creature;
    }
    this.creatures.length = keepCreature;
  }

  private updateAmbient(f: Frame) {
    const left=f.viewLeft??0,right=left+(f.viewWidth??f.W);
    const { ctx, e, W, sY, cam, H, loc } = f;
    this.spawnT -= f.dt;
    const shoal = hasActiveEvent(f, "shoal");
    const maxN = shoal ? 24 : 10;
    if (this.spawnT <= 0 && this.ambient.length < maxN) {
      this.spawnT = shoal ? 0.15 : this.ambient.length < 4 ? 0.25 : 0.7 + Math.random() * 1.2;
      const inv = (px: number) => (Math.exp(px / f.K) - 1) * 8;
      const dTop = inv(Math.max(0, cam - sY)), dBot = Math.min(f.spot.maxDepth, inv(Math.max(0, cam + H - sY)));
      const tod = e.timeOfDay;
      const pool = FISH.filter(
        (fi) =>
          fi.loc.includes(loc.id) &&
          fi.rarity !== "legendary" &&
          fi.depth[1] >= dTop &&
          fi.depth[0] <= dBot &&
          (fi.time === "any" || fi.time === tod) &&
          (!fi.weather || fi.weather.includes(e.weather)) &&
          (!fi.season || fi.season.includes(e.season)),
      );
      if (pool.length) {
        const biased = pool.filter((p) => f.spot.bias.includes(p.id));
        const src = biased.length && Math.random() < 0.5 ? biased : pool;
        const fi = shoal ? src.reduce((a, b) => (a.weight[1] < b.weight[1] ? a : b)) : src[Math.floor(Math.random() * src.length)];
        const lo = Math.max(fi.depth[0], dTop, 0.8), hi = Math.min(fi.depth[1], dBot, f.spot.maxDepth * 0.9);
        if (hi > lo) {
          const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
          const w = fi.weight[0] + (fi.weight[1] - fi.weight[0]) * Math.random() * 0.6;
          this.ambient.push({ f: fi, dir, x: dir === 1 ? left-150 : right+150, depth: lo + Math.random() * (hi - lo), speed: (20 + Math.random() * 40 + fi.strength * 4) * f.sc, len: fishScreenLen(fi, w, 0.75 * f.sc), phase: Math.random() * 10, known: !!e.s.codex[fi.id] });
        }
      }
    }
    for (const a of this.ambient) {
      a.x += a.dir * a.speed * f.dt;
      a.phase += f.dt * (3 + a.speed * 0.05);
      let y = sY + f.depthPx(a.depth) + Math.sin(a.phase * 0.3) * 6;
      const by = this.bottomAt(f,a.x) - a.len * 0.3;
      if (y > by) y = by;
      if (y < cam - 100 || y > cam + H + 100) continue;
      drawFish(ctx, a.f, a.x, y, a.len, a.dir, { wag: a.phase, alpha: 0.92, silhouette: a.known ? null : "rgba(4,10,18,0.72)" });
    }
    let keepFish = 0;
    for (let i = 0; i < this.ambient.length; i++) {
      const fish = this.ambient[i];
      if (fish.x > left - 220 && fish.x < right + 220) this.ambient[keepFish++] = fish;
    }
    this.ambient.length = keepFish;
  }

  private glowPass(f: Frame) {
    const { ctx, sY, cam, H, e, t, W } = f;
    for (const a of this.ambient) {
      if (!a.f.glow || !a.known) continue;
      const y = Math.min(sY + f.depthPx(a.depth) + Math.sin(a.phase * 0.3) * 6, this.bottomAt(f,a.x) - a.len * 0.3);
      if (y < cam - 50 || y > cam + H + 50) continue;
      drawFishGlow(ctx, a.f, a.x, y, a.len, a.dir, a.phase, 1);
    }
    for (const c of this.creatures) {
      if (c.kind === "jelly" && (f.loc.id === "abyss" || e.isNight)) glow(ctx, c.x, c.y - 3, 5 * c.s, c.hue, 0.5 + Math.sin(c.phase * 2) * 0.3);
    }
    if (hasActiveEvent(f, "plankton")) {
      for (let i = 0; i < 70; i++) {
        const x = (i * 97.3 + Math.sin(t * 0.3 + i) * 30) % W;
        const y = sY + 6 + ((i * 53.7) % 1) * 0 + ((i * 37) % 160) * f.sc + Math.sin(t + i) * 8;
        const a = 0.4 + Math.sin(t * 3 + i * 1.3) * 0.4;
        if (a > 0.1) glow(ctx, x, y, 1.3, "#60ffd8", a);
      }
    }
  }

  private drawHooked(f: Frame, bobX: number, hookY: number, glowOnly: boolean): [number, number] {
    const { ctx, e, W, t, sY } = f;
    if (e.hooked) {
      const h = e.hooked;
      const pose = projectFightFish(h, { boatX: f.boatX ?? W * .3, castX: bobX, scale: f.sc, waveY: f.waveY, depthPx: f.depthPx });
      const { x: fishX, y: fishY, len, dir } = pose;
      if (h.jump > 0) return pose.mouth;
      ctx.save(); ctx.translate(fishX, fishY); ctx.rotate(pose.angle); ctx.scale(pose.turn, 1);
      if (glowOnly) {
        drawFishGlow(ctx, h.fish, 0, 0, len, dir, h.motion.swimPhase, 1.3);
        if (e.hookDepth > 30) {
          ctx.save();
          ctx.globalAlpha = clamp((e.hookDepth - 30) / 200, 0, 0.75);
          drawFish(ctx, h.fish, 0, 0, len, dir, { wag: h.motion.swimPhase, variant: h.variant });
          ctx.restore();
        }
      } else {
        if (h.surgeWarning > 0) {
          ctx.save();
          ctx.strokeStyle = `rgba(227,201,150,${0.35 + Math.sin(t * 16) * 0.15})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(0, 0, len * 0.6 + 8, len * 0.23 + 6, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        drawFish(ctx, h.fish, 0, 0, len, dir, { wag: h.motion.swimPhase, variant: h.variant });
        if (Math.random() < f.dt * 8 * h.intensity) this.bubbles.push({ x: fishX, y: fishY, r: 1 + Math.random() * 3, v: 40 + Math.random() * 40 });
      }
      ctx.restore();
      return pose.mouth;
    }
    if (e.phase === "bite" && e.pendingFish && !glowOnly) {
      const fi = e.pendingFish.fish;
      const len = fishScreenLen(fi, e.pendingFish.weight, f.sc);
      drawFish(ctx, fi, bobX - len * 0.45, hookY + 4, len, 1, { wag: t * 12, silhouette: "rgba(5,12,20,0.78)" });
    }
    if (e.phase === "sinking" && !glowOnly && Math.random() < f.dt * 20) this.bubbles.push({ x: bobX + (Math.random() - 0.5) * 6, y: hookY, r: 1 + Math.random() * 2, v: 50 + Math.random() * 40 });
    return [bobX, hookY];
  }

  private drawJump(f: Frame, bobX: number) {
    const { ctx, e, W } = f;
    const h = e.hooked;
    if (!h || h.jump <= 0) return;
    const p = 1 - h.jump / JUMP_TIME;
    const pose = projectFightFish(h, { boatX: f.boatX ?? W * .3, castX: bobX, scale: f.sc, waveY: f.waveY, depthPx: f.depthPx });
    ctx.save(); ctx.translate(pose.x, pose.y); ctx.rotate(pose.angle); ctx.scale(pose.turn, 1);
    drawFish(ctx, h.fish, 0, 0, pose.len, pose.dir, { wag: h.motion.swimPhase, variant: h.variant });
    ctx.restore();
    if (Math.random() < f.dt * 22) this.sprays.push({ x: pose.x, y: pose.y, vx: h.motion.velocity * 8, vy: -30 - Math.random() * 35, t: 0 });
    // Rate, not a fixed number per rendered frame (same spray budget at 30/120 fps).
    if ((p < 0.1 || p > 0.9) && Math.random() < f.dt * 45) {
      this.sprays.push({ x: pose.x, y: f.waveY(pose.x), vx: (Math.random() - 0.5) * 140, vy: -80 - Math.random() * 140, t: 0 });
    }
  }

  private drawSprays(f: Frame) {
    const { ctx } = f;
    if (!this.gfx.foam) { this.sprays.length = 0; return; }
    ctx.fillStyle = "rgba(235,245,255,0.8)";
    for (const s of this.sprays) {
      s.t += f.dt;
      s.vy += 400 * f.dt;
      s.x += s.vx * f.dt;
      s.y += s.vy * f.dt;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    let keepSpray = 0;
    for (let i = 0; i < this.sprays.length; i++) {
      const spray = this.sprays[i];
      if (spray.t < 1.2 && spray.y < f.sY + 10) this.sprays[keepSpray++] = spray;
    }
    this.sprays.length = keepSpray;
  }

  private drawLine(f: Frame, tip: [number, number], bobX: number, hookY: number, fishPos: [number, number]) {
    const { ctx, e, t, H, night } = f;
    const bobWaveY = f.waveY(bobX);
    ctx.lineWidth = 1;
    ctx.strokeStyle = night > 0.5 ? "rgba(220,230,240,0.55)" : "rgba(250,250,250,0.75)";
    if (e.phase === "casting") {
      const k = e.castT;
      const x = tip[0] + (bobX - tip[0]) * k;
      const y = tip[1] + (bobWaveY - tip[1]) * k - Math.sin(k * Math.PI) * H * 0.18;
      ctx.beginPath();
      ctx.moveTo(tip[0], tip[1]);
      ctx.quadraticCurveTo((tip[0] + x) / 2, Math.min(tip[1], y) - 10, x, y);
      ctx.stroke();
      this.drawBobber(ctx, x, y, false, t);
    } else if (["sinking", "waiting", "bite"].includes(e.phase)) {
      const bite = e.phase === "bite";
      const nibble = e.nibbling;
      const tap = nibble ? Math.pow(Math.max(0, Math.sin(e.nibbleProgress * Math.PI * 5)), 4) : 0;
      const bobY = bobWaveY + (bite ? 4 + Math.abs(Math.sin(t * 14)) * 4 : nibble ? tap * 2.8 : Math.sin(t * 2) * 1.2);
      ctx.beginPath();
      ctx.moveTo(tip[0], tip[1]);
      ctx.quadraticCurveTo((tip[0] + bobX) / 2, Math.max(tip[1], bobY) + 20, bobX, bobY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bobX, bobY);
      ctx.lineTo(bobX + Math.sin(t) * 3, hookY);
      ctx.strokeStyle = "rgba(230,240,250,0.4)";
      ctx.stroke();
      this.drawHook(ctx, e, bobX + Math.sin(t) * 3, hookY);
      this.drawBobber(ctx, bobX, bobY, bite, t, nibble ? tap * 0.3 : bite ? Math.sin(t * 9) * 0.18 : 0);
      if (nibble || bite) {
        ctx.save();
        const cue = bite ? "Подсекайте!" : e.pendingFind ? "Снасть дрогнула…" : "Пробует — ждите";
        const cueY = bobY - (bite ? 59 : 34);
        ctx.font = `500 11px ${FONTS.sans}`;
        const cueW = ctx.measureText(cue).width + 24;
        roundRect(ctx, bobX - cueW / 2, cueY - 14, cueW, 23, 3);
        ctx.fillStyle = "rgba(7,13,21,0.86)";
        ctx.fill();
        ctx.strokeStyle = bite ? "rgba(227,201,150,0.75)" : "rgba(227,201,150,0.25)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = bite ? "#f3dcac" : "#e6e1d6";
        ctx.textAlign = "center";
        ctx.fillText(cue, bobX, cueY + 1);
        if (nibble) for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = 0.3 + 0.6 * Math.max(0, Math.sin(e.nibbleProgress * Math.PI * 5 - i));
          ctx.beginPath();
          ctx.arc(bobX - 8 + i * 8, bobY - 16, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (bite) {
        const p = e.biteProgress;
        const perfect = e.inPerfectHookWindow;
        ctx.save();
        ctx.lineWidth = perfect ? 2 : 1.2;
        ctx.strokeStyle = perfect ? "rgba(227,201,150,0.95)" : "rgba(230,225,214,0.35)";
        ctx.beginPath();
        ctx.arc(bobX, bobY - 2, 30 * (1 - p) + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p));
        ctx.stroke();
        ctx.restore();
      }
      if (bite) {
        ctx.save();
        ctx.fillStyle = "#e3c996";
        ctx.translate(bobX, bobY - 26 + Math.sin(t * 8) * 1.5);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-3, -3, 6, 6);
        ctx.restore();
        for (let i = 0; i < 2; i++) {
          const rp = (t * 1.4 + i / 2) % 1;
          ctx.strokeStyle = `rgba(240,230,210,${0.35 * (1 - rp)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(bobX, bobWaveY + 1.5, 3 + rp * 15, 1 + rp * 2.6, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else if (e.phase === "fight" && e.hooked) {
      const h = e.hooked;
      const tension = h.tension;
      ctx.strokeStyle = tension > 0.9 ? "rgba(255,120,100,0.95)" : "rgba(250,250,250,0.85)";
      ctx.lineWidth = 0.8 + Math.min(1.2, tension) * 0.35;
      if (h.jump > 0) {
        // The same mouth point as the airborne body — no second jump formula.
        ctx.beginPath(); ctx.moveTo(...tip);
        const slack = Math.max(0, h.motion.lineOut - h.line);
        ctx.quadraticCurveTo((tip[0] + fishPos[0]) / 2, (tip[1] + fishPos[1]) / 2 + (1 - Math.min(1, tension)) * 18 + Math.min(35, slack * 8), ...fishPos);
        ctx.stroke();
      } else {
        // Intersect the tip→mouth ray with the actual water surface.
        let entryX = (tip[0] + fishPos[0]) / 2;
        for (let i = 0; i < 3; i++) {
          const u = clamp((f.waveY(entryX) - tip[1]) / Math.max(1, fishPos[1] - tip[1]), 0, 1);
          entryX = tip[0] + (fishPos[0] - tip[0]) * u;
        }
        const entryY = f.waveY(entryX);
        ctx.beginPath();
        ctx.moveTo(tip[0], tip[1]);
        const sag = (1 - clamp(tension, 0, 1)) * 12 + Math.min(40, Math.max(0, h.motion.lineOut - h.line) * 10);
        ctx.quadraticCurveTo((tip[0] + entryX) / 2, (tip[1] + entryY) / 2 + sag, entryX, entryY);
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(entryX, entryY);
        ctx.strokeStyle = tension > 1 ? "rgba(240,136,110,0.72)" : "rgba(207,234,239,0.58)";
        ctx.quadraticCurveTo((entryX + fishPos[0]) / 2, (entryY + fishPos[1]) / 2 + sag * 0.7, fishPos[0], fishPos[1]);
        ctx.stroke();
        // поплавок остаётся на леске: наклоняется к рыбе и притапливается по натяжению
        const dive = clamp(tension, 0, 1.1) * 4.5 + h.intensity * 1.5 + Math.sin(h.motion.swimPhase) * h.intensity * 1.2;
        const lean = clamp(Math.atan2(fishPos[1] - entryY, fishPos[0] - entryX) - Math.PI / 2, -1.1, 1.1) * clamp(tension, 0.2, 1);
        this.drawBobber(ctx, entryX, entryY + dive, h.overload > 0.05, t, lean);
        if (h.running && Math.random() < f.dt * 3) this.rings.push({ x: entryX, t: 0, s: 1.4 });
        if (h.intensity > 0.6 && Math.random() < f.dt * 12) this.sprays.push({ x: entryX, y: entryY, vx: (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 40, t: 0 });
      }
    }
    if (e.splash > 0) {
      const sx = e.phase === "fight" ? fishPos[0] : bobX;
      ctx.strokeStyle = `rgba(255,255,255,${e.splash * 0.8})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.33;
        const r = (1 - e.splash) * 36 + 6;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * r * 0.4, bobWaveY + Math.sin(a) * r * 0.4);
        ctx.lineTo(sx + Math.cos(a) * r, bobWaveY + Math.sin(a) * r);
        ctx.stroke();
      }
    }
  }

  private drawBobber(ctx: CanvasRenderingContext2D, x: number, y: number, bite: boolean, t: number, tilt = 0) {
    ctx.save();
    ctx.translate(x, y);
    if (tilt) ctx.rotate(tilt);
    // Увеличение поплавка на узком экране: раньше здесь сравнивалась ширина мира (7200),
    // поэтому ветка не срабатывала никогда.
    if (this.screenW < 820) ctx.scale(1.2, 1.2);
    // тело ~4.5px в ширину: поплавок заметно меньше борта судна
    ctx.fillStyle = "#f4f4f0";
    ctx.beginPath();
    ctx.ellipse(0, 1.2, 2.2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bite ? "#ff3020" : "#e83a2a";
    ctx.beginPath();
    ctx.ellipse(0, -1.4, 2.2, 2.5, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-0.5, -7, 1, 4);
    if (bite) glow(ctx, 0, -7, 1.4 + Math.sin(t * 20) * 0.6, "#ff6040", 1);
    ctx.restore();
  }

  private drawHook(ctx: CanvasRenderingContext2D, e: Engine, x: number, y: number) {
    const bait = BAIT_BY_ID[e.s.currentBait];
    ctx.strokeStyle = "#c0c4c8";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y + 3, 3, 0, Math.PI);
    ctx.stroke();
    if (bait.id === "glow") glow(ctx, x, y + 4, 3, bait.color, 1);
    else {
      ctx.fillStyle = bait.color;
      ctx.beginPath();
      ctx.ellipse(x - 1, y + 5, 3, 2, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawMarineSnow(f: Frame) {
    const { ctx, sY, cam, H, W, t, e } = f;
    const plankton = hasActiveEvent(f, "plankton");
    // «Морской снег»: раньше каждая частица ставила globalAlpha и делала свой
    // fillRect. Теперь частицы раскладываются по пяти ступеням прозрачности и
    // рисуются одним путём на ступень — тех же ~130 точек за пять вызовов.
    const base = plankton ? "120,255,230" : "220,235,255";
    const buckets: number[][] = [[], [], [], [], []];
    for (const p of this.snow) {
      p[1] -= f.dt * 6 * p[2];
      p[0] += Math.sin(t * 0.5 + p[1] * 0.01) * f.dt * 4;
      let yy = (((p[1] % (H * 1.2)) + H * 1.2) % (H * 1.2)) + cam - H * 0.1;
      if (yy < sY + 4) continue;
      if (yy > cam + H) yy -= H;
      const width=f.viewWidth??W,left=f.viewLeft??0;
      const xx = left+(((p[0]-left)%width)+width)%width;
      if (yy > this.bottomAt(f,xx) - 2) continue;
      const a = clamp((yy - sY) / (H * 0.5), 0.15, 1) * 0.6;
      const gi = Math.min(4, Math.max(0, Math.round(((a / 0.6) - 0.15) / 0.85 * 4)));
      buckets[gi].push(xx, yy, p[2]);
    }
    for (let gi = 0; gi < 5; gi++) {
      const list = buckets[gi];
      if (!list.length) continue;
      const a = (0.15 + (gi / 4) * 0.85) * 0.6;
      ctx.fillStyle = `rgba(${base},${a.toFixed(3)})`;
      ctx.beginPath();
      for (let i = 0; i < list.length; i += 3) ctx.rect(list[i], list[i + 1], list[i + 2], list[i + 2]);
      ctx.fill();
    }
  }

  private drawBubbles(f: Frame) {
    const { ctx, sY, cam } = f;
    ctx.strokeStyle = "rgba(220,245,255,0.65)";
    ctx.lineWidth = 1;
    for (const b of this.bubbles) {
      b.y -= b.v * f.dt;
      b.x += Math.sin(b.y * 0.05) * 0.3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(b.x - b.r * 0.4, b.y - b.r * 0.5, 1, 1);
    }
    let keepBubble = 0;
    for (let i = 0; i < this.bubbles.length; i++) {
      const bubble = this.bubbles[i];
      if (bubble.y > sY && bubble.y > cam - 50) this.bubbles[keepBubble++] = bubble;
    }
    this.bubbles.length = keepBubble;
    if (this.bubbles.length > 220) this.bubbles.splice(0, this.bubbles.length - 220);
  }

  private drawPrecipitation(f: Frame) {
    // Дождь и снег живут в окне игрока, а не по всей ширине акватории.
    const view = horizontalRange(f, 60);
    const o = {
      x0: view.left, x1: view.right, top: -60, bottom: f.sY + f.amp + 6,
      floor: f.waveY, horizon: f.hY,
      wind: f.atmo.wind * f.atmo.windDir * 26 * f.sc, s: f.sc,
      q: clamp(Math.round(f.quality), 0, 2) as 0 | 1 | 2,
      color: f.atmo.palette.cloud,
    };
    // Дождь и снег — частицы над водой; в кадре их держит только видимое окно.
    // Снежинки не должны тянуться до дна: их пол это поверхность, а не дно.
    const rain = { ...o, active: this.gfx.precip && f.atmo.rain > 0.001, intensity: this.gfx.precip ? f.atmo.rain : 0 };
    const snowFloor = (x: number) => Math.min(f.waveY(x), o.bottom);
    const snow = { ...o, floor: snowFloor, active: this.gfx.precip && f.atmo.snow > 0.001, intensity: this.gfx.precip ? f.atmo.snow : 0 };
    this.rain.step(rain, f.dt); this.snowfall.step(snow, f.dt);
    if (this.gfx.precip) {
      this.rain.draw(f.ctx, rain); this.snowfall.draw(f.ctx, snow);
    }
  }

  private drawWeather(f: Frame) {
    const { ctx, W, H, sY, cam, t, atmo, sc } = f;
    const surf = sY - cam;
    const windPx = atmo.wind * atmo.windDir * 26 * sc;
    if (surf > 0) {
      if (atmo.leaves > 0.02 && surf > 8) drawLeaves(ctx, t, 0, W, 0, Math.min(H, surf), windPx, atmo.leaves, "leaf", sc);
      if (atmo.petals > 0.02 && surf > 8) drawLeaves(ctx, t, 0, W, 0, Math.min(H, surf), windPx * 0.6, atmo.petals, "petal", sc);
    }
    if (f.fogK > 0.04) {
      const fy = surf;
      const fc = rgbHex(atmo.palette.fog);
      const fg = ctx.createLinearGradient(0, fy - H * 0.4, 0, fy + H * 0.08);
      fg.addColorStop(0, hexA(fc, 0));
      fg.addColorStop(0.65, hexA(fc, 0.24 + f.fogK * 0.5));
      fg.addColorStop(1, hexA(fc, 0));
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) {
        const x = ((t * (8 + i * 3) + i * 300) % (W + 700)) - 350;
        ctx.save(); ctx.translate(x, fy - 30 - i * 26); ctx.scale(320, 35);
        const veil = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        veil.addColorStop(0, hexA(fc, 0.05 + f.fogK * 0.12)); veil.addColorStop(1, hexA(fc, 0));
        ctx.fillStyle = veil; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
      }
    }
  }

  private drawLightning(f: Frame) {
    const { ctx, e, W, H, sY, cam, sc } = f;
    const strike = e.lastLightningStrike;
    if (strike && strike.seed !== this.lastBoltSeed) {
      this.lastBoltSeed = strike.seed;
      const r = rng(strike.seed);
      const x0 = W * strike.x;
      const surface = Math.max(0, sY - cam);
      this.bolt = makeBolt(x0, 0, x0 + (r() - 0.5) * W * 0.12, surface, r);
    }
    if (e.lightning <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(230,235,255,${e.lightning * 0.28})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    if (this.bolt.length && sY - cam > 0) drawBolt(ctx, this.bolt, e.lightning, sc);
  }

  private grade(f: Frame) {
    const { ctx, W, H, golden, night, cam, sY } = f;
    ctx.save();
    if (golden > 0.05) {
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = `rgba(255,150,70,${0.35 * golden})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (night > 0.3) {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(8,16,48,${0.14 * night})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    // блики объектива
    const sx = f.sunX, sy = f.sunY - cam;
    if (this.quality > 1 && f.sunVis > 0.55 && sy > 0 && sy < sY - cam && f.sunElev > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const cx = W / 2, cy = H / 2;
      const flares: [number, number, string][] = [[0.3, 18, "255,220,160"], [0.6, 10, "180,220,255"], [1.1, 34, "255,180,120"], [1.5, 14, "200,255,220"]];
      for (const [k, r, c] of flares) {
        const x = sx + (cx - sx) * k * 2, y = sy + (cy - sy) * k * 2;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * f.sc * 1.5);
        g.addColorStop(0, `rgba(${c},${af(0.1 * f.sunVis)})`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * f.sc * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(0,0,10,${af(0.42 + night * 0.2)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
}
