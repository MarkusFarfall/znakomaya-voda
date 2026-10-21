import { bedFrac } from "../world";
import { hasActiveEvent, horizontalGridRange, horizontalRange, type Frame } from "./frame";
import { clamp, ctx2d, hash1, hexA, makeCanvas, mix, rng, af, rgbHex } from "./util";

let causticTile: HTMLCanvasElement | null = null;

/** Тайлящаяся текстура каустики (края ячеек Вороного) */
export function getCaustics(): HTMLCanvasElement {
  if (causticTile) return causticTile;
  const S = 128;
  const c = makeCanvas(S, S);
  const g = ctx2d(c);
  const img = g.createImageData(S, S);
  const r = rng(42);
  const pts: [number, number][] = Array.from({ length: 22 }, () => [r(), r()]);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      let f1 = 9, f2 = 9;
      for (const [px, py] of pts) {
        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            const dx = px + ox - u, dy = py + oy - v;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
          }
        }
      }
      const e = f2 - f1;
      const val = Math.pow(clamp(1 - e / 0.07, 0, 1), 2.2);
      const i = (y * S + x) * 4;
      img.data[i] = 235;
      img.data[i + 1] = 255;
      img.data[i + 2] = 250;
      img.data[i + 3] = Math.round(val * 255);
    }
  }
  g.putImageData(img, 0, 0);
  causticTile = c;
  return c;
}

export function tileCaustics(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, t: number, scale: number, alpha = 1) {
  const tile = getCaustics();
  const S = 128 * scale;
  // Сетка тайлов выровнена по мировым координатам: тот же каустический узор можно
  // залить одним повтором вместо сотни drawImage. Раскладка и фазы — те же.
  const usePattern = typeof DOMMatrix !== "undefined" && typeof ctx.createPattern === "function";
  for (let layer = 0; layer < 2; layer++) {
    const ox = ((layer ? -t * 9 : t * 7) % S + S) % S;
    const oy = ((layer ? t * 4 : -t * 3) % S + S) % S;
    ctx.globalAlpha = (layer ? 0.55 : 0.7) * alpha;
    const shiftX = ox + (layer ? S * 0.5 : 0);
    const shiftY = oy + (layer ? S * 0.37 : 0);
    const pattern = usePattern ? ctx.createPattern(tile, "repeat") : null;
    if (pattern) {
      pattern.setTransform(new DOMMatrix().translate(-shiftX, -shiftY).scale(S / tile.width, S / tile.height));
      ctx.fillStyle = pattern;
      ctx.fillRect(x0, y0, w, h);
    } else {
      for (let y = y0 - oy - (layer ? S * 0.37 : 0); y < y0 + h; y += S) {
        for (let x = Math.floor(x0/S)*S - ox - (layer ? S * 0.5 : 0); x < x0 + w; x += S) {
          ctx.drawImage(tile, x, y, S, S);
        }
      }
    }
  }
  ctx.globalAlpha = 1;
}

export function seaSurfaceColor(f: Frame) {
  const near = mix(f.loc.water.surface, rgbHex(f.atmo.palette.seaNear), 0.32);
  return mix(mix(near, f.top, 0.25), "#02050c", f.night * 0.72);
}

/** Дальняя полоса моря между горизонтом и разрезом */
export function drawSeaBand(f: Frame, reflect: () => void) {
  const { ctx, W, hY, sY, t, night } = f;
  const water = seaSurfaceColor(f);
  const far = mix(f.loc.water.surface, rgbHex(f.atmo.palette.seaFar), 0.32);
  const near = mix(f.loc.water.shallow, rgbHex(f.atmo.palette.seaNear), 0.24);
  const g = ctx.createLinearGradient(0, hY, 0, sY + f.amp + 4);
  g.addColorStop(0, mix(mix(f.hor, far, 0.35), water, 0.15));
  g.addColorStop(0.35, mix(water, f.hor, 0.2));
  g.addColorStop(1, mix(water, mix(near, "#02050c", night * 0.8), 0.4));
  ctx.fillStyle = g;
  ctx.fillRect(0, hY, W, sY - hY + f.amp * 2 + 6);
  reflect();

  // перспективная рябь: позиции остаются в мировых координатах (мир не меняется),
  // но штрихи вне кадра не рисуются — на широкой карте их большинство.
  const band = sY - hY;
  const lightC = mix(mix(f.mid, rgbHex(f.atmo.palette.glow), 0.18), "#1a2438", night * 0.8);
  const darkC = mix(water, "#000000", 0.35);
  const rows = f.quality > 0 ? 34 : 14;
  const rippleView = horizontalRange(f, 40);
  // Блики ряби — сотни мелких прямоугольников в двух оттенках. Копим их в пути
  // по оттенку и квантованной прозрачности (шаг 0.02) и заливаем пачкой:
  // позиции и порядок штрихов те же, вызовов заливки в разы меньше.
  const buckets = new Map<number, number[]>();
  for (let i = 0; i < rows; i++) {
    const p = i / rows;
    const y = hY + band * p * p;
    const th = 0.5 + p * 1.8;
    const dashes = 10 + Math.floor(p * 8);
    const spd = (8 + p * 30) * (0.5 + f.wind);
    for (let k = 0; k < dashes; k++) {
      const seed = i * 31.7 + k * 7.3;
      const len = (6 + (seed % 5) * 4) * (0.4 + p * 2);
      const x = (((seed * 97) % W) + t * spd + Math.sin(t * 0.8 + seed) * 6) % (W + 60) - 30;
      if (x + len < rippleView.left || x > rippleView.right) continue;
      const dark = k % 3 === 0;
      const alpha = (dark ? 0.25 : 0.18) * (0.5 + p);
      const key = (dark ? 0 : 1) * 1000 + Math.round(alpha * 50);
      const list = buckets.get(key);
      if (list) list.push(x, y, len, th);
      else buckets.set(key, [x, y, len, th]);
    }
  }
  for (const [key, list] of buckets) {
    const dark = key < 1000,
      alpha = (key % 1000) / 50;
    ctx.beginPath();
    for (let j = 0; j < list.length; j += 4) ctx.rect(list[j], list[j + 1], list[j + 2], list[j + 3]);
    ctx.fillStyle = hexA(dark ? darkC : lightC, alpha);
    ctx.fill();
  }
  if (f.fogK > 0.3) {
    const fg = ctx.createLinearGradient(0, hY - 20, 0, hY + band * 0.8);
    const fc = mix(rgbHex(f.atmo.palette.fog), "#101820", night * 0.85);
    fg.addColorStop(0, hexA(fc, 0.8 * f.fogK));
    fg.addColorStop(1, hexA(fc, 0));
    ctx.fillStyle = fg;
    ctx.fillRect(0, hY - 20, W, band + 20);
  }

  // дорожка солнца / луны
  const sun = f.sunElev > 0;
  const gx = sun ? f.sunX : f.moonX;
  const ga = sun ? 0.95 * f.sunVis : f.moonUp ? 0.5 * f.moonVis * f.atmo.moonIllum : 0;
  if (ga > 0.03) {
    const col = sun ? mix("#fff4d8", "#ffa860", f.golden) : "#dce6ff";
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const cg = ctx.createRadialGradient(gx, hY, 0, gx, hY, band * 3);
    cg.addColorStop(0, hexA(col, 0.25 * ga));
    cg.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = cg;
    ctx.fillRect(gx - band * 3, hY, band * 6, band + 4);
    // Дорожка света — те же 90 бликов, но сгруппированы по квантованной яркости:
    // у каждого блика своя пульсация, поэтому заливок столько же, сколько ступеней.
    const sparks = new Map<number, number[]>();
    for (let i = 0; i < 90; i++) {
      const p = ((i * 0.618) % 1);
      const y = hY + band * p * p;
      const spread = 8 + p * 150 * (sun ? 1 - clamp(f.sunElev / 60, 0, 1) * 0.5 : 0.7);
      const x = gx + Math.sin(i * 12.9898 + Math.floor(t * 4 + i * 0.37) * 3.1) * spread;
      const a = ga * 0.55 * (0.25 + 0.75 * Math.abs(Math.sin(t * 5 + i * 1.7)));
      const key = Math.round(a * 100);
      const list = sparks.get(key);
      if (list) list.push(x, y, 2 + p * 9, 0.6 + p * 1.1);
      else sparks.set(key, [x, y, 2 + p * 9, 0.6 + p * 1.1]);
    }
    for (const [key, list] of sparks) {
      ctx.beginPath();
      for (let j = 0; j < list.length; j += 4) ctx.rect(list[j], list[j + 1], list[j + 2], list[j + 3]);
      ctx.fillStyle = hexA(col, key / 100);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Толща воды: градиент и подповерхностный отсвет */
export function drawUnderwaterBody(f: Frame) {
  const { ctx, W, H, sY, cam } = f;
  const wc = f.loc.water;
  const surface = mix(wc.surface, rgbHex(f.atmo.palette.seaNear), 0.34);
  const shallow = mix(wc.shallow, rgbHex(f.atmo.palette.seaNear), 0.28);
  const mid = mix(wc.mid, rgbHex(f.atmo.palette.deep), 0.24);
  const deep = mix(wc.deep, rgbHex(f.atmo.palette.abyss), 0.2);
  const bottom = cam + H + 10;
  const top = Math.max(sY - f.amp * 2 - 4, cam - 10);
  if (bottom <= top) return;
  const span = f.depthPx(Math.max(f.loc.maxDepth * 1.3, 60));
  const ug = ctx.createLinearGradient(0, sY, 0, sY + span);
  const nk = f.night * 0.78 + (1 - f.day) * 0.08;
  const dk = "#01040a";
  ug.addColorStop(0, mix(mix(surface, f.top, 0.12), dk, nk * 0.85));
  ug.addColorStop(0.18, mix(shallow, dk, nk * 0.9));
  ug.addColorStop(0.55, mix(mid, dk, nk * 0.92));
  ug.addColorStop(1, mix(deep, dk, nk * 0.6));
  ctx.fillStyle = ug;
  ctx.fillRect(0, top, W, bottom - top);
}

let shaftTexture: HTMLCanvasElement | null = null;
function softShaft() {
  if (shaftTexture) return shaftTexture;
  const c = makeCanvas(64, 256), ctx = ctx2d(c);
  const cross = ctx.createLinearGradient(0, 0, 64, 0);
  cross.addColorStop(0, "rgba(220,255,250,0)"); cross.addColorStop(.45, "rgba(220,255,250,.8)");
  cross.addColorStop(.6, "rgba(220,255,250,1)"); cross.addColorStop(1, "rgba(220,255,250,0)");
  ctx.fillStyle = cross; ctx.fillRect(0, 0, 64, 256);
  ctx.globalCompositeOperation = "destination-in";
  const fade = ctx.createLinearGradient(0, 0, 0, 256);
  fade.addColorStop(0, "rgba(0,0,0,.7)"); fade.addColorStop(.18, "rgba(0,0,0,1)"); fade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fade; ctx.fillRect(0, 0, 64, 256); ctx.globalCompositeOperation = "source-over";
  shaftTexture = c; return c;
}

/** Feathered sunlight, attenuated by real sun visibility, clipped to the water volume. */
export function drawShafts(f: Frame) {
  const { ctx, W, H, sY, t, cam } = f;
  const strength = f.sunVis * (1 - f.cover * .65) * (.4 + f.clarity * .6);
  if (strength < .045 || cam > sY + H) return;
  ctx.save(); clipWaterToBed(f); ctx.globalCompositeOperation = "lighter";
  const texture = softShaft(), tilt = (f.sunX - W / 2) / W;
  for (let i = 0; i < (f.quality > 1 ? 8 : 5); i++) {
    const x = ((i * .143 + .03) * W * 1.2 + Math.sin(t * .15 + i * 2.1) * 30) % (W * 1.1) - W * .05;
    const width = (35 + i % 4 * 24) * f.sc;
    const length = H * (.45 + i % 3 * .22) * (.6 + f.clarity * .6);
    ctx.save(); ctx.globalAlpha = .16 * strength * (.6 + .4 * Math.sin(t * .4 + i * 1.3));
    ctx.transform(1, 0, -tilt * .6 + .06, 1, x, sY);
    ctx.drawImage(texture, -width / 2, 0, width, length); ctx.restore();
  }
  ctx.restore();
}

let bandCanvas: HTMLCanvasElement | null = null;
/** Каустика у поверхности */
export function drawSurfaceCaustics(f: Frame) {
  const { ctx, W, sY, t, cam, H } = f;
  const a = f.sunVis * (1 - f.cover * 0.65) * f.clarity;
  if (a < 0.05 || cam > sY + 120) return;
  const bh = Math.round(110 * f.sc);
  const left=Math.floor((f.viewLeft??0)/128)*128, width=Math.ceil((f.viewWidth??W)+256);
  if (!bandCanvas || bandCanvas.width !== width || bandCanvas.height !== bh) bandCanvas = makeCanvas(width, bh);
  const b = ctx2d(bandCanvas);
  b.globalCompositeOperation = "source-over";
  b.clearRect(0, 0, bandCanvas.width, bh);
  b.save();b.translate(-left,0);tileCaustics(b,left,0,width,bh,t,1.6*f.sc);b.restore();
  b.globalCompositeOperation = "destination-in";
  const g = b.createLinearGradient(0, 0, 0, bh);
  g.addColorStop(0, "rgba(0,0,0,0.9)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  b.fillStyle = g;
  b.fillRect(0,0,width,bh);
  ctx.save();
  clipWaterToBed(f);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.28 * a;
  ctx.drawImage(bandCanvas,left,sY+2);
  ctx.restore();
  void H;
}

/** Water lighting stops at the actual seabed: no light shafts through solid ground. */
export function clipWaterToBed(f: Frame) {
  if (!f.waterClipPath) {
    const { W, sY, ctx } = f;
    const view = horizontalRange(f, 8);
    const left = clamp(view.left, 0, W);
    const right = clamp(view.right, left, W);
    // Preserve the original W-anchored 8-unit profile grid (including non-multiple widths).
    const first = W - Math.floor((W - right) / 8) * 8;
    const firstWorldSample = W - Math.floor(W / 8) * 8;
    const last = Math.max(firstWorldSample, W - Math.ceil((W - left) / 8) * 8);
    const bedY = (x: number) => sY + f.depthPx(f.bedDepth ? f.bedDepth(x) : f.spot.maxDepth * bedFrac(f.spot, x / W));
    const path = typeof Path2D !== "undefined" ? new Path2D() : null;
    const builder = path ?? ctx;
    if (!path) ctx.beginPath();
    builder.moveTo(left, sY);
    builder.lineTo(first, sY);
    for (let x = first; x >= last; x -= 8) builder.lineTo(x, bedY(x));
    builder.lineTo(left, bedY(left));
    builder.closePath();
    if (path) f.waterClipPath = path;
  }
  if (f.waterClipPath) f.ctx.clip(f.waterClipPath);
  else f.ctx.clip();
}

/** Затемнение по глубине (поверх всех подводных объектов) */
export function drawDepthOverlay(f: Frame) {
  const { ctx, W, H, sY, cam, night } = f;
  const top = Math.max(sY, cam - 5);
  const bottom = cam + H + 5;
  if (bottom <= top) return;
  const L = 22 + f.clarity * 45;
  const storm = clamp(f.atmo.dark * 0.14 + f.atmo.precip * 0.06 + f.fogK * 0.06, 0, 0.24);
  const dark = mix(f.loc.water.deep, "#000308", 0.65);
  // Bottom inspection exposes nearby relief, not the entire deep ocean. Surface/auto retain darkness.
  const attenuation = f.bottomFocus ? .60 : .955;
  const maxD = Math.max(f.loc.maxDepth * 1.3, 40);
  const span = f.depthPx(maxD);
  const g = ctx.createLinearGradient(0, sY, 0, sY + span);
  const stops = [0, 2, 6, 15, 35, 80, 180, 400, 900, 2000];
  for (const d of stops) {
    if (d > maxD) break;
    const base = 1 - Math.exp(-d / L);
    const a = 1 - (1 - base * 0.97) * (1 - night * 0.62) * (1 - storm);
    g.addColorStop(clamp(f.depthPx(d) / span, 0, 1), hexA(dark, clamp(a, 0, attenuation)));
  }
  g.addColorStop(1, hexA(dark, attenuation));
  ctx.fillStyle = g;
  ctx.fillRect(0, top, W, bottom - top);
}

export interface Ring { x: number; t: number; s: number }

/**
 * Гребень поверхности — ОДИН путь на кадр.
 * Свечение (до судна) и обводка (после судна) обязаны сэмплировать одну и ту же
 * волну, иначе на стыке появляется смещённая линия; кроме того, строить путь
 * дважды — это лишние сотни `lineTo` на кадр.
 */
let crestKey = "";
let crestPath: Path2D | null = null;
let crestDepth = 0;
function surfaceCrest(f: Frame, depth: number): Path2D | null {
  if (typeof Path2D === "undefined") return null;
  const key = `${f.W}:${f.t}:${f.amp}:${f.sc}:${f.spot.seed}:${depth}`;
  if (crestPath && crestKey === key) return crestPath;
  const r = horizontalGridRange(f, 5, 5);
  const p = new Path2D();
  // Один непрерывный подпуть: гребень слева направо, затем стенки вниз.
  p.moveTo(r.first, f.sY + depth);
  for (let x = r.first; x <= r.last; x += 5) p.lineTo(x, f.waveY(x));
  p.lineTo(r.last, f.sY + depth);
  p.closePath();
  crestKey = key;
  crestPath = p;
  crestDepth = depth;
  return p;
}

/**
 * Подводное свечение у поверхности (светлая полоса под гребнем волны).
 * Рисуется ДО судна: раньше эта заливка ложилась поверх корпуса и разрезала
 * его прямой светлой полосой — подводная часть выглядела отдельным клином.
 */
export function drawSurfaceGlow(f: Frame) {
  const { ctx, sY, night } = f;
  const wc = f.loc.water;
  const slc = mix(mix(wc.surface, "#ffffff", 0.08 * (1 - night)), "#02050c", night * 0.86);
  const depth = 80 * f.sc;
  const sl = ctx.createLinearGradient(0, sY - f.amp, 0, sY + depth);
  sl.addColorStop(0, hexA(slc, 0.75 - night * 0.35));
  sl.addColorStop(1, hexA(slc, 0));
  const shape = surfaceCrest(f, depth);
  ctx.fillStyle = sl;
  if (shape) {
    ctx.fill(shape);
    return;
  }
  // Без Path2D (старые движки) — тот же силуэт напрямую в контексте.
  const r = horizontalGridRange(f, 5, 5);
  ctx.beginPath();
  ctx.moveTo(r.first, sY + depth);
  for (let x = r.first; x <= r.last; x += 5) ctx.lineTo(x, f.waveY(x));
  ctx.lineTo(r.last, sY + depth);
  ctx.closePath();
  ctx.fill();
}

/** Блики на поверхности: мировые штрихи по ветру (тоже свет, а не объём — до судна). */
export function drawSurfaceStreaks(f: Frame) {
  const { ctx, W, night, t } = f;

  const streaks = Math.min(120, Math.max(22, Math.round(W / 110)));
  const drift = t * (4 + f.atmo.wind * 1.5) * (f.atmo.windDir < 0 ? -1 : 1);
  const streakRange = horizontalRange(f, 50 * f.sc);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 0.8 * f.sc;
  for (let i = 0; i < streaks; i++) {
    const seed = i + f.spot.seed * 13;
    const x0 = (((i * 137 + drift) % W) + W) % W;
    const offset = (3 + hash1(seed) * 34) * f.sc;
    const len = (12 + hash1(seed + 87) * 38 + f.atmo.wind * 0.8) * f.sc;
    if (x0 + len < streakRange.left || x0 > streakRange.right) continue;
    const alpha = (0.035 + hash1(seed + 171) * 0.09) * (0.4 + f.sunVis * (1 - f.cover * 0.6)) * (1 - night * 0.55);
    ctx.strokeStyle = `rgba(235,248,244,${alpha})`;
    ctx.beginPath();
    for (let j = 0; j <= 3; j++) {
      const x = x0 + len * j / 3;
      const y = f.waveY(x) + offset + Math.sin(t * 1.7 + seed + j) * f.sc;
      if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Передний слой воды: гребень, барашки и круги от дождя (поверх судна) */
export function drawSurfaceFront(f: Frame, rings: Ring[]) {
  const { ctx, sY, night, t } = f;
  const plankton = hasActiveEvent(f, "plankton");
  ctx.strokeStyle = plankton ? "rgba(110,255,225,0.85)" : `rgba(${night > 0.5 ? "170,190,210" : "255,255,255"},${af(0.12 + 0.43 * (1 - night))})`;
  ctx.lineWidth = 1.6;
  // Тот же путь, что заливал свечение, — обводим только гребень.
  const shape = surfaceCrest(f, 80 * f.sc);
  if (shape) {
    const r = horizontalGridRange(f, 5, 5);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.first - 4, sY - f.amp - 6, r.last - r.first + 8, f.amp * 2 + 12);
    ctx.clip();
    ctx.stroke(shape);
    ctx.restore();
  } else {
    const outlineRange = horizontalGridRange(f, 5, 5);
    for (let x = outlineRange.first; x <= outlineRange.last; x += 5) {
      const y = f.waveY(x);
      if (x === outlineRange.first) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // гребни
  if (f.amp > 5) {
    ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.2 * (1 - night)})`;
    const crestRange = horizontalRange(f, Math.max(40, 8 + f.amp * 0.6));
    let x = (t * 30) % 40;
    if (x < crestRange.left) x += Math.ceil((crestRange.left - x) / 40) * 40;
    for (; x < f.W && x <= crestRange.right; x += 40) {
      const y = f.waveY(x);
      if (f.waveY(x - 6) > y + 0.5 && f.waveY(x + 6) > y + 0.5) {
        ctx.beginPath();
        ctx.ellipse(x, y, 7 + f.amp * 0.6, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // круги
  ctx.lineWidth = 1;
  for (const r of rings) {
    r.t += f.dt;
    const k = r.t / 0.7;
    if (k >= 1) continue;
    ctx.strokeStyle = `rgba(230,240,255,${0.5 * (1 - k)})`;
    ctx.beginPath();
    ctx.ellipse(r.x, f.waveY(r.x) + 1, 2 + k * 9 * r.s, 0.8 + k * 2 * r.s, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}
