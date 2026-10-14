// Горизонт и атмосферная перспектива — общий слой для всех портов.
// Зависит только от PF. Рисуется ПОСЛЕ неба и ДО kit.backdrop (дальние суда) / после воды (блики, тени облаков).
import type { PF } from './portFrame';
import { clamp, hash1, hexA, mix } from './util';

/** Цвет объекта на расстоянии d (0 — рядом, 1 — у самого горизонта): смешивание с цветом неба у горизонта */
export function aerial(f: PF, col: string, d: number) {
  const k = clamp(d, 0, 1);
  const haze = clamp(0.25 + k * 0.6 + f.A.fog * 0.3, 0, 0.92);
  return f.dim(mix(col, f.A.palette.skyHor, haze), 0.6 + k * 0.2);
}

export type FarShip = 'tanker' | 'container' | 'cruise' | 'trawler' | 'sail' | 'ferry' | 'tug';

export interface FarShipSpec {
  kind: FarShip;
  /** глубина 0..1: 0 — дальняя полоса у самого горизонта, 1 — ближе к середине воды */
  depth: number;
  /** секунд на проход */
  period: number;
  dir: 1 | -1;
  offset?: number;
  hull?: string;
}

/** Силуэт судна на горизонте: размер, цвет и качество деталей зависят от глубины */
export function farShip(f: PF, s: FarShipSpec) {
  const { ctx, W, hY, waterY, sc, t, night } = f;
  const tt = t + (s.offset ?? 0);
  const ph = (tt % s.period) / s.period;
  const span = W + 160 * sc;
  const x = s.dir > 0 ? -80 * sc + span * ph : W + 80 * sc - span * ph;
  const y = hY + 1 + s.depth * (waterY - hY) * 0.22;
  const k = sc * (0.35 + s.depth * 0.55);
  const d = 1 - s.depth * 0.6;
  const H = aerial(f, s.hull ?? '#2a3038', d);
  const Wh = aerial(f, '#e8e8e4', d);
  const win = night > 0.3 ? `rgba(255,205,120,${(0.85 * (1 - d * 0.5)).toFixed(3)})` : aerial(f, '#9ab8c8', d);
  ctx.save(); ctx.translate(x, y); ctx.scale(s.dir, 1);
  if (s.kind === 'tanker') {
    ctx.fillStyle = H; ctx.beginPath(); ctx.moveTo(-60 * k, 0); ctx.lineTo(-56 * k, -9 * k); ctx.lineTo(58 * k, -9 * k); ctx.lineTo(64 * k, 0); ctx.fill();
    ctx.fillStyle = aerial(f, '#c8402a', d); ctx.fillRect(-56 * k, -3 * k, 114 * k, 3 * k);
    ctx.fillStyle = Wh; ctx.fillRect(-52 * k, -24 * k, 16 * k, 15 * k); ctx.fillStyle = win; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) ctx.fillRect(-50 * k + c * 3.6 * k, -22 * k + r * 4 * k, 2 * k, 2 * k);
    ctx.fillStyle = aerial(f, '#d8a030', d); ctx.fillRect(-48 * k, -30 * k, 4 * k, 6 * k);
    ctx.strokeStyle = H; ctx.lineWidth = 1.2 * k; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-30 * k + i * 14 * k, -9 * k); ctx.lineTo(-30 * k + i * 14 * k, -16 * k); ctx.stroke(); }
    if (f.random() < 0.03 && !f.reflecting) f.smoke(x + s.dir * -46 * k, y - 32 * k, 2 * k, true);
  } else if (s.kind === 'container') {
    ctx.fillStyle = H; ctx.beginPath(); ctx.moveTo(-56 * k, 0); ctx.lineTo(-52 * k, -8 * k); ctx.lineTo(54 * k, -8 * k); ctx.lineTo(60 * k, 0); ctx.fill();
    const cols = ['#c8402a', '#2a6aa0', '#d8a030', '#3a8a5a', '#e8eef2'];
    for (let c = 0; c < 10; c++) for (let r = 0; r < 3; r++) { if (hash1(c * 7 + r) < 0.2) continue; ctx.fillStyle = aerial(f, cols[(c + r) % 5], d); ctx.fillRect(-46 * k + c * 9 * k, -8 * k - (r + 1) * 5 * k, 8 * k, 4.6 * k); }
    ctx.fillStyle = Wh; ctx.fillRect(-56 * k, -26 * k, 12 * k, 18 * k); ctx.fillStyle = win; for (let r = 0; r < 3; r++) ctx.fillRect(-54 * k, -24 * k + r * 4 * k, 8 * k, 2 * k);
    ctx.strokeStyle = H; ctx.lineWidth = 1 * k; ctx.beginPath(); ctx.moveTo(10 * k, -23 * k); ctx.lineTo(10 * k, -38 * k); ctx.stroke();
  } else if (s.kind === 'cruise') {
    ctx.fillStyle = H; ctx.beginPath(); ctx.moveTo(-60 * k, 0); ctx.lineTo(-58 * k, -10 * k); ctx.lineTo(56 * k, -10 * k); ctx.lineTo(66 * k, 0); ctx.fill();
    ctx.fillStyle = Wh; ctx.fillRect(-56 * k, -32 * k, 108 * k, 22 * k); ctx.fillRect(-40 * k, -40 * k, 70 * k, 8 * k);
    ctx.fillStyle = win; for (let r = 0; r < 4; r++) for (let c = 0; c < 26; c++) ctx.fillRect(-54 * k + c * 4.1 * k, -30 * k + r * 5.2 * k, 2.4 * k, 2.6 * k);
    for (let c = 0; c < 16; c++) ctx.fillRect(-38 * k + c * 4.2 * k, -38 * k, 2.4 * k, 2.6 * k);
    ctx.fillStyle = aerial(f, '#d8a030', d); ctx.fillRect(20 * k, -48 * k, 8 * k, 9 * k); ctx.fillStyle = H; ctx.fillRect(20 * k, -48 * k, 8 * k, 2 * k);
    if (night > 0.3) { ctx.fillStyle = `rgba(255,220,160,${(0.08 * night).toFixed(3)})`; ctx.fillRect(-60 * k, -46 * k, 126 * k, 46 * k); }
  } else if (s.kind === 'ferry') {
    ctx.fillStyle = H; ctx.beginPath(); ctx.moveTo(-40 * k, 0); ctx.lineTo(-38 * k, -8 * k); ctx.lineTo(38 * k, -8 * k); ctx.lineTo(44 * k, 0); ctx.fill();
    ctx.fillStyle = Wh; ctx.fillRect(-34 * k, -22 * k, 66 * k, 14 * k); ctx.fillRect(-20 * k, -28 * k, 36 * k, 6 * k);
    ctx.fillStyle = win; for (let c = 0; c < 14; c++) ctx.fillRect(-32 * k + c * 4.6 * k, -19 * k, 2.6 * k, 3 * k);
    ctx.fillStyle = aerial(f, '#c8402a', d); ctx.fillRect(4 * k, -36 * k, 6 * k, 8 * k);
    if (f.random() < 0.04 && !f.reflecting) f.smoke(x + s.dir * 7 * k, y - 38 * k, 1.6 * k, true);
  } else if (s.kind === 'trawler') {
    ctx.fillStyle = H; ctx.beginPath(); ctx.moveTo(-26 * k, 0); ctx.lineTo(-24 * k, -7 * k); ctx.lineTo(26 * k, -8 * k); ctx.lineTo(30 * k, 0); ctx.fill();
    ctx.fillStyle = Wh; ctx.fillRect(-4 * k, -20 * k, 16 * k, 13 * k); ctx.fillStyle = win; ctx.fillRect(-1 * k, -17 * k, 10 * k, 3 * k);
    ctx.strokeStyle = aerial(f, '#d8a030', d); ctx.lineWidth = 1.6 * k; ctx.beginPath(); ctx.moveTo(-20 * k, -7 * k); ctx.lineTo(-16 * k, -24 * k); ctx.lineTo(-10 * k, -7 * k); ctx.stroke();
    // чайки за кормой
    ctx.strokeStyle = Wh; ctx.lineWidth = 0.8 * k; for (let i = 0; i < 4; i++) { const gx = -34 * k - i * 8 * k, gy = -14 * k - hash1(i) * 10 * k + Math.sin(t * 3 + i) * 2 * k; const fl = Math.sin(t * 6 + i) * 2 * k; ctx.beginPath(); ctx.moveTo(gx - 3 * k, gy - fl); ctx.lineTo(gx, gy); ctx.lineTo(gx + 3 * k, gy - fl); ctx.stroke(); }
  } else if (s.kind === 'sail') {
    ctx.fillStyle = H; ctx.beginPath(); ctx.moveTo(-20 * k, 0); ctx.lineTo(-18 * k, -5 * k); ctx.lineTo(20 * k, -6 * k); ctx.lineTo(24 * k, 0); ctx.fill();
    ctx.fillStyle = Wh; ctx.beginPath(); ctx.moveTo(0, -6 * k); ctx.lineTo(0, -44 * k); ctx.lineTo(16 * k, -7 * k); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-2 * k, -8 * k); ctx.lineTo(-2 * k, -38 * k); ctx.lineTo(-14 * k, -8 * k); ctx.fill();
  } else {
    ctx.fillStyle = H; ctx.beginPath(); ctx.moveTo(-16 * k, 0); ctx.lineTo(-14 * k, -6 * k); ctx.lineTo(14 * k, -6 * k); ctx.lineTo(18 * k, 0); ctx.fill();
    ctx.fillStyle = Wh; ctx.fillRect(-6 * k, -16 * k, 12 * k, 10 * k); ctx.fillStyle = aerial(f, '#1a1a1c', d); ctx.fillRect(2 * k, -22 * k, 3 * k, 6 * k);
    if (f.random() < 0.06 && !f.reflecting) f.smoke(x + s.dir * 3 * k, y - 24 * k, 1.4 * k, true);
  }
  // ходовые огни
  if (night > 0.3 && !f.reflecting) { const L = s.kind === 'tanker' || s.kind === 'cruise' ? 60 : s.kind === 'container' ? 56 : 24; f.glow(L * k, -6 * k, 0.9 * k, '#40ff80', night * 0.8); f.glow(-L * k, -6 * k, 0.9 * k, '#ff4040', night * 0.8); }
  ctx.restore();
  // кильватер и отражение
  ctx.fillStyle = `rgba(255,255,255,${(0.16 * (1 - night * 0.6)).toFixed(3)})`;
  for (let i = 0; i < 6; i++) { const q = i / 6; ctx.beginPath(); ctx.ellipse(x - s.dir * (30 + q * 70) * k, y + 1 + q * 1.5, (6 + q * 16) * k, (0.6 + q) * k, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = hexA(H, 0.28); ctx.fillRect(x - 20 * k, y + 1, 40 * k, 2.5 * k);
}

/**
 * Слой дымки между дальним планом (горы, город) и средним (набережная).
 * Рисуется после kit.backdrop: приглушает контраст далёких объектов и отделяет планы.
 */
export function depthHaze(f: PF) {
  const { ctx, W, H, hY, A } = f;
  const fc = mix(A.palette.skyHor, A.palette.skyMid, 0.3);
  const base = clamp(0.1 + A.fog * 0.3 + A.cover * 0.06 + (A.rain + A.snow) * 0.12, 0, 0.6) * (1 - f.night * 0.4);
  // над горизонтом — плотнее у линии, тает кверху
  const g = ctx.createLinearGradient(0, hY - H * 0.3, 0, hY + 2);
  g.addColorStop(0, hexA(fc, 0)); g.addColorStop(0.7, hexA(fc, base * 0.45)); g.addColorStop(1, hexA(fc, base));
  ctx.fillStyle = g; ctx.fillRect(0, hY - H * 0.3, W, H * 0.3 + 2);
  // по воде — отражённая дымка у горизонта
  const g2 = ctx.createLinearGradient(0, hY, 0, hY + (f.waterY - hY) * 0.5);
  g2.addColorStop(0, hexA(fc, base * 0.8)); g2.addColorStop(1, hexA(fc, 0));
  ctx.fillStyle = g2; ctx.fillRect(0, hY, W, (f.waterY - hY) * 0.5);
}

/** Размытое отражение силуэта берега в дальней воде: берётся срез над горизонтом и зеркалится вниз с затуханием */
export function backdropReflection(f: PF, strength = 0.22) {
  const { ctx, W, H, hY } = f;
  const h = Math.min(H * 0.12, (f.waterY - hY) * 0.5);
  if (h < 4) return;
  // источник — в пикселях канваса (учитываем DPR через текущую матрицу)
  const m = ctx.getTransform();
  const kx = m.a || 1, ky = m.d || 1, ox = m.e || 0, oy = m.f || 0;
  const sx = Math.max(0, ox), sy = Math.max(0, oy + (hY - h) * ky), sw = Math.min(ctx.canvas.width - sx, W * kx), sh = Math.min(ctx.canvas.height - sy, h * ky);
  if (sw <= 0 || sh <= 0) return;
  try {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, hY + 1, W, h); ctx.clip();
    ctx.globalAlpha = strength * (1 - f.night * 0.3);
    ctx.translate(0, hY * 2 + 2); ctx.scale(1, -1);
    ctx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, hY - h, W, h);
    ctx.restore();
    // Soft depth falloff avoids regular scanlines / moiré at fractional mobile scales.
    const fade = ctx.createLinearGradient(0, hY, 0, hY + h);
    fade.addColorStop(0, hexA(f.A.palette.seaNear, 0.08));
    fade.addColorStop(1, hexA(f.A.palette.seaNear, 0.78));
    ctx.fillStyle = fade; ctx.fillRect(0, hY + 1, W, h);
  } catch { ctx.restore(); }
}

/** Атмосферная перспектива над горизонтом: дымка, нагретый воздух, смог порта */
export function horizonHaze(f: PF) {
  const { ctx, W, H, hY, A } = f;
  const fc = mix(A.palette.skyHor, '#ffffff', 0.15 * (1 - f.night));
  const g = ctx.createLinearGradient(0, hY - H * 0.14, 0, hY + 2);
  const a = clamp(0.18 + A.fog * 0.4 + A.cover * 0.1, 0, 0.75) * (1 - f.night * 0.5);
  g.addColorStop(0, hexA(fc, 0)); g.addColorStop(1, hexA(fc, a));
  ctx.fillStyle = g; ctx.fillRect(0, hY - H * 0.14, W, H * 0.14 + 2);
}

/** Тени облаков на воде */
export function cloudShadows(f: PF, clouds: [number, number, number, number][], n: number) {
  const { ctx, W, hY, H, A } = f;
  if (A.sunVis < 0.2 || f.night > 0.5) return;
  const a = 0.14 * A.sunVis * (1 - f.night);
  for (let i = 0; i < n; i++) {
    const [cx, , cw] = clouds[i];
    const sx = cx + (W / 2 - cx) * 0.15, sy = hY + (H - hY) * (0.05 + (i % 4) * 0.08);
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, cw * 1.4);
    g.addColorStop(0, `rgba(0,10,20,${a.toFixed(3)})`); g.addColorStop(1, 'rgba(0,10,20,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sx, sy, cw * 1.4, cw * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  }
}

/** Дальний дождь — тёмные вертикальные полосы под тучей на горизонте (идёт, даже если здесь ещё сухо) */
export function distantRain(f: PF) {
  const { ctx, W, H, hY, A, t } = f;
  const amt = A.weather === 'rain' || A.weather === 'storm' ? 1 : A.weather === 'cloudy' ? clamp(Math.sin(A.day * 2.3 + 1) , 0, 1) : 0;
  if (amt < 0.05) return;
  const cx = W * (0.3 + hash1(A.day) * 0.4) + Math.sin(t * 0.05) * W * 0.05, w = W * 0.22;
  const col = mix(A.palette.skyMid, '#20262e', 0.5);
  const g = ctx.createLinearGradient(0, H * 0.22, 0, hY);
  g.addColorStop(0, hexA(col, 0.55 * amt)); g.addColorStop(1, hexA(col, 0.1 * amt));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - w, H * 0.22); ctx.lineTo(cx + w, H * 0.22); ctx.lineTo(cx + w * 0.7, hY); ctx.lineTo(cx - w * 0.7, hY); ctx.fill();
  ctx.strokeStyle = hexA(col, 0.25 * amt); ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) { const q = i / 18; const x = cx - w * 0.9 + w * 1.8 * q + Math.sin(t * 0.6 + i) * 3; ctx.beginPath(); ctx.moveTo(x, H * 0.26 + hash1(i) * H * 0.04); ctx.lineTo(x - 6 * A.windDir, hY - 2); ctx.stroke(); }
}

/** Дальняя полоса воды у горизонта: более тёмная и гладкая, с «зубчиками» мелкой зыби и бликами */
export function farWaterBand(f: PF) {
  const { ctx, W, hY, waterY, A, t } = f;
  const band = (waterY - hY) * 0.18;
  const g = ctx.createLinearGradient(0, hY, 0, hY + band);
  g.addColorStop(0, hexA(mix(A.palette.skyHor, A.palette.deep, 0.55), 0.55)); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, hY, W, band);
  if (A.sunVis > 0.1 && f.night < 0.6) {
    ctx.fillStyle = `rgba(255,255,255,${(0.35 * A.sunVis * (1 - f.night)).toFixed(3)})`;
    for (let i = 0; i < 60; i++) { const x = ((hash1(i) * W + t * (6 + hash1(i + 3) * 10)) % W); const on = Math.sin(t * (3 + hash1(i + 9) * 4) + i) > 0.6; if (on) ctx.fillRect(x, hY + 2 + hash1(i + 5) * band * 0.7, 1.5 + hash1(i + 7) * 2, 1); }
  }
  // линия горизонта — чуть светлее при ясной погоде
  ctx.fillStyle = hexA(mix(A.palette.skyHor, '#ffffff', 0.3), 0.3 * (1 - A.fog) * (1 - f.night * 0.7)); ctx.fillRect(0, hY, W, 1);
}

/** Купол далёкого города: зарево ночью */
export function cityGlow(f: PF, x: number, w: number, col: string) {
  if (f.night < 0.15) return;
  const { ctx, hY } = f;
  const g = ctx.createRadialGradient(x, hY + 4, 0, x, hY + 4, w);
  g.addColorStop(0, hexA(col, 0.22 * f.night)); g.addColorStop(1, hexA(col, 0));
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - w, hY - w * 0.5, w * 2, w * 0.5 + 4); ctx.restore();
}

/** Самолёт/вертолёт с мигающими огнями высоко в небе */
export function airplane(f: PF, period: number, altitude: number, offset = 0) {
  const { ctx, W, H, sc, t } = f;
  const ph = ((t + offset) % period) / period;
  const x = -40 * sc + (W + 80 * sc) * ph, y = H * altitude + Math.sin(ph * 6) * 4;
  const d = 0.9;
  ctx.fillStyle = aerial(f, '#e8e8ea', d);
  ctx.fillRect(x - 6 * sc, y - 0.8 * sc, 12 * sc, 1.6 * sc);
  ctx.beginPath(); ctx.moveTo(x - 1 * sc, y); ctx.lineTo(x - 5 * sc, y + 3 * sc); ctx.lineTo(x - 3 * sc, y); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 1 * sc, y); ctx.lineTo(x - 4 * sc, y - 2.5 * sc); ctx.lineTo(x - 2.5 * sc, y); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 6 * sc, y); ctx.lineTo(x - 7 * sc, y - 2.5 * sc); ctx.lineTo(x - 5 * sc, y); ctx.fill();
  // инверсионный след
  if (f.A.cover < 0.6) { const g = ctx.createLinearGradient(x - 6 * sc, 0, x - 120 * sc, 0); g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - 120 * sc, y - 0.6 * sc, 114 * sc, 1.2 * sc); }
  if (f.night > 0.2) { if (Math.floor(t * 2) % 2 === 0) f.glow(x + 5 * sc, y, 0.9 * sc, '#ffffff', f.night); f.glow(x - 4 * sc, y + 3 * sc, 0.7 * sc, '#ff4040', f.night * 0.8); f.glow(x - 4 * sc, y - 2.5 * sc, 0.7 * sc, '#40ff80', f.night * 0.8); }
}

/** Стая птиц клином вдали */
export function birdFlock(f: PF, period: number, altitude: number, n = 9, offset = 0) {
  const { ctx, W, H, sc, t } = f;
  const ph = ((t + offset) % period) / period;
  const x0 = -40 * sc + (W + 80 * sc) * ph, y0 = H * altitude + Math.sin(ph * 4) * 10;
  ctx.strokeStyle = aerial(f, '#1a1a1c', 0.8); ctx.lineWidth = 0.8 * sc;
  for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1, k = Math.ceil(i / 2); const x = x0 - k * 6 * sc, y = y0 + side * k * 3.5 * sc; const fl = Math.sin(t * 7 + i) * 1.6 * sc; ctx.beginPath(); ctx.moveTo(x - 2.5 * sc, y - fl); ctx.lineTo(x, y); ctx.lineTo(x + 2.5 * sc, y - fl); ctx.stroke(); }
}

/** Мерцающие огни на дальнем берегу ночью (посёлок, бакены, маяки) */
export function shoreLights(f: PF, xs: [number, number, string][], baseY: number) {
  if (f.night < 0.2) return;
  const { ctx, t, sc } = f;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [x, dy, col] of xs) { const tw = 0.6 + 0.4 * Math.sin(t * (2 + hash1(x) * 3) + x); ctx.fillStyle = hexA(col, f.night * tw * 0.9); ctx.fillRect(x, baseY - dy * sc, 1.4 * sc, 1.4 * sc); ctx.fillStyle = hexA(col, f.night * tw * 0.25); ctx.fillRect(x - 1, baseY + 2, 3.5 * sc, 4 * sc); }
  ctx.restore();
}
