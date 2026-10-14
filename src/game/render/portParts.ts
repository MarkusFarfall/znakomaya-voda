// Общие примитивы для портов. Зависят только от PF.
import type { PF } from './portFrame';
import { clamp, hexA, mix, roundRect } from './util';

export interface PersonOpts {
  walk?: number; hat?: string; carry?: 'crate' | 'rod' | 'bucket' | 'net' | 'box' | null; face?: 1 | -1; scale?: number; sit?: boolean;
  /** едет на велосипеде */
  bike?: boolean;
  /** толкает тележку с ящиками */
  cart?: boolean;
  /** воздушный шарик на нитке (цвет) */
  balloon?: string;
}

export function person(f: PF, x: number, y: number, col: string, o: PersonOpts = {}) {
  const { ctx, sc: s0, dim } = f;
  const sc = s0 * (o.scale ?? 1);
  const dir = o.face ?? 1;
  const step = o.walk != null ? Math.sin(o.walk) * 2.2 * sc : 0;
  if (o.bike) {
    const rot = (o.walk ?? 0) * 0.6;
    ctx.strokeStyle = dim('#2a2a2e'); ctx.lineWidth = 1 * sc;
    ctx.beginPath(); ctx.arc(x - 6 * sc * dir, y - 4 * sc, 4 * sc, 0, Math.PI * 2); ctx.arc(x + 6 * sc * dir, y - 4 * sc, 4 * sc, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 0.5;
    for (const cx of [x - 6 * sc * dir, x + 6 * sc * dir]) for (let k = 0; k < 3; k++) { const a = rot + (k * Math.PI) / 3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 4 * sc, y - 4 * sc + Math.sin(a) * 4 * sc); ctx.lineTo(cx - Math.cos(a) * 4 * sc, y - 4 * sc - Math.sin(a) * 4 * sc); ctx.stroke(); }
    ctx.lineWidth = 1 * sc;
    ctx.beginPath(); ctx.moveTo(x - 6 * sc * dir, y - 4 * sc); ctx.lineTo(x - 1 * sc * dir, y - 11 * sc); ctx.lineTo(x + 5 * sc * dir, y - 11 * sc); ctx.lineTo(x + 6 * sc * dir, y - 4 * sc); ctx.lineTo(x + 1 * sc * dir, y - 4 * sc); ctx.lineTo(x - 1 * sc * dir, y - 11 * sc); ctx.stroke();
    ctx.fillStyle = dim(col, 0.8);
    ctx.save(); ctx.translate(x - 1 * sc * dir, y - 11 * sc); ctx.rotate(0.35 * dir); ctx.fillRect(-2.4 * sc, -9 * sc, 4.8 * sc, 9 * sc); ctx.restore();
    ctx.fillStyle = dim('#e8c8a8', 0.8); ctx.beginPath(); ctx.arc(x + 1.5 * sc * dir, y - 21 * sc, 2.6 * sc, 0, Math.PI * 2); ctx.fill();
    if (o.hat) { ctx.fillStyle = dim(o.hat, 0.8); ctx.beginPath(); ctx.arc(x + 1.5 * sc * dir, y - 22 * sc, 3 * sc, Math.PI, 0); ctx.fill(); }
    const px = x + 1 * sc * dir + Math.cos(rot * 2) * 2.5 * sc, py = y - 7 * sc + Math.sin(rot * 2) * 2.5 * sc;
    ctx.strokeStyle = dim(col, 0.8); ctx.lineWidth = 1.6 * sc; ctx.beginPath(); ctx.moveTo(x - 1 * sc * dir, y - 11 * sc); ctx.lineTo(px, py); ctx.stroke();
    return;
  }
  ctx.fillStyle = dim(col, 0.8);
  if (o.sit) {
    ctx.fillRect(x - 3 * sc, y - 12 * sc, 6 * sc, 8 * sc);
    ctx.fillRect(x - 1 * sc, y - 5 * sc, 7 * sc * dir, 2 * sc);
    ctx.fillStyle = dim('#e8c8a8', 0.8);
    ctx.beginPath(); ctx.arc(x, y - 15 * sc, 2.8 * sc, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillRect(x - 2.6 * sc, y - 15 * sc, 5.2 * sc, 9.5 * sc);
    ctx.fillRect(x - 2.2 * sc + step * 0.3, y - 6 * sc, 1.8 * sc, 6 * sc);
    ctx.fillRect(x + 0.4 * sc - step * 0.3, y - 6 * sc, 1.8 * sc, 6 * sc);
    ctx.fillStyle = dim('#e8c8a8', 0.8);
    ctx.beginPath(); ctx.arc(x, y - 18 * sc, 2.8 * sc, 0, Math.PI * 2); ctx.fill();
  }
  if (o.hat) {
    ctx.fillStyle = dim(o.hat, 0.8);
    const hy = o.sit ? y - 18 * sc : y - 21 * sc;
    ctx.fillRect(x - 3.4 * sc, hy, 6.8 * sc, 1.6 * sc);
    ctx.fillRect(x - 2.4 * sc, hy - 2.5 * sc, 4.8 * sc, 3 * sc);
  }
  const hy = y - 15 * sc;
  if (o.carry === 'crate') {
    ctx.fillStyle = dim('#8a6a42', 0.8);
    ctx.fillRect(x - 4 * sc, y - 23 * sc, 8 * sc, 6 * sc);
    ctx.strokeStyle = hexA('#000000', 0.3); ctx.lineWidth = 0.8; ctx.strokeRect(x - 4 * sc, y - 23 * sc, 8 * sc, 6 * sc);
  } else if (o.carry === 'box') {
    ctx.fillStyle = dim('#d8602a', 0.8);
    ctx.fillRect(x - 4 * sc, y - 23 * sc, 8 * sc, 6 * sc);
  } else if (o.carry === 'rod') {
    ctx.strokeStyle = dim('#3a2a1c'); ctx.lineWidth = 1 * sc;
    ctx.beginPath(); ctx.moveTo(x + 2 * sc * dir, hy + 4 * sc); ctx.lineTo(x + 14 * sc * dir, hy - 12 * sc); ctx.stroke();
  } else if (o.carry === 'bucket') {
    ctx.fillStyle = dim('#7a8a98', 0.8);
    ctx.fillRect(x + 3 * sc * dir, hy + 6 * sc, 3.5 * sc, 4 * sc);
  } else if (o.carry === 'net') {
    ctx.strokeStyle = hexA(dim('#b8b090'), 0.7); ctx.lineWidth = 0.6;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + 3 * sc * dir, hy + k * 2 * sc); ctx.lineTo(x + 9 * sc * dir, hy + 8 * sc + k * 1.5 * sc); ctx.stroke(); }
  }
  if (o.cart) {
    const cx = x + 11 * sc * dir;
    ctx.strokeStyle = dim('#2a2a2e'); ctx.lineWidth = 1 * sc;
    ctx.beginPath(); ctx.moveTo(x + 3 * sc * dir, y - 11 * sc); ctx.lineTo(cx - 6 * sc * dir, y - 9 * sc); ctx.stroke();
    ctx.fillStyle = dim('#6a4a2a', 0.8); ctx.fillRect(cx - 7 * sc, y - 9 * sc, 14 * sc, 5 * sc);
    ctx.beginPath(); ctx.arc(cx, y - 3 * sc, 3 * sc, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = dim('#8a6a42', 0.8); ctx.fillRect(cx - 6 * sc, y - 15 * sc, 6 * sc, 6 * sc); ctx.fillStyle = dim('#c8b48a', 0.8); ctx.fillRect(cx, y - 15 * sc, 6 * sc, 6 * sc);
    ctx.fillStyle = dim('#a8b8c0', 0.8); ctx.beginPath(); ctx.ellipse(cx + 3 * sc, y - 15.5 * sc, 2.5 * sc, 1 * sc, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (o.balloon) {
    const sw = Math.sin(f.t * 1.5 + x * 0.05) * 2 * sc;
    ctx.strokeStyle = hexA('#ffffff', 0.5); ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(x + 3 * sc * dir, y - 12 * sc); ctx.lineTo(x + 5 * sc * dir + sw, y - 30 * sc); ctx.stroke();
    ctx.fillStyle = dim(o.balloon, 0.7); ctx.beginPath(); ctx.ellipse(x + 5 * sc * dir + sw, y - 33.5 * sc, 3 * sc, 3.8 * sc, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hexA('#ffffff', 0.35); ctx.beginPath(); ctx.arc(x + 4 * sc * dir + sw, y - 35 * sc, 0.9 * sc, 0, Math.PI * 2); ctx.fill();
  }
}

/** Тёмные силуэты за окном — только когда здание освещено и открыто */
export function silhouettes(f: PF, x: number, y: number, w: number, h: number, n: number, seed: number) {
  if (!f.lit || f.closed) return;
  const { ctx, sc, t } = f;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = 'rgba(40,30,20,0.72)';
  for (let k = 0; k < n; k++) {
    const px = x + w * ((k + 0.5) / n) + Math.sin(t * 0.7 + seed + k * 2) * w * 0.08;
    const sway = Math.sin(t * 1.3 + k + seed) * 0.5 * sc, hh = h * 0.55;
    ctx.beginPath(); ctx.arc(px, y + h - hh - 2.2 * sc + sway, 2 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(px - 2.4 * sc, y + h - hh + sway, 4.8 * sc, hh);
    if (Math.sin(t * 0.9 + k * 3 + seed) > 0.7) ctx.fillRect(px + 3 * sc, y + h - hh - 1 * sc + sway, 1.8 * sc, 2.4 * sc);
  }
  ctx.restore();
}

/** Ноты, уплывающие вверх */
export function notes(f: PF, x: number, y: number, seed: number, col = '#f0ece4') {
  const { ctx, sc, t } = f;
  ctx.fillStyle = hexA(f.dim(col), 0.85); ctx.font = `${6 * sc}px serif`;
  for (let k = 0; k < 3; k++) {
    const ph = (t * 0.5 + k * 0.33 + seed * 0.1) % 1;
    ctx.globalAlpha = 1 - ph;
    ctx.fillText(k % 2 ? '♪' : '♫', x + ph * 14 * sc + Math.sin(ph * 8 + seed) * 3 * sc, y - ph * 26 * sc);
  }
  ctx.globalAlpha = 1;
}

/** Всплеск: кольца и капли, u — прогресс 0..1 */
export function splash(f: PF, x: number, y: number, u: number, s: number) {
  const { ctx } = f;
  const a = 1 - u;
  ctx.strokeStyle = `rgba(255,255,255,${(0.7 * a).toFixed(3)})`; ctx.lineWidth = 1.2 * s;
  ctx.beginPath(); ctx.ellipse(x, y, (4 + u * 16) * s, (1.5 + u * 5) * s, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x, y, (2 + u * 9) * s, (0.8 + u * 3) * s, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${(0.8 * a).toFixed(3)})`;
  for (let k = 0; k < 7; k++) {
    const ang = -Math.PI * 0.9 + k * 0.28, r = (6 + (k % 3) * 3) * s;
    const px = x + Math.cos(ang) * r * u * 2.2, py = y + Math.sin(ang) * r * u * 2.2 + u * u * 14 * s;
    ctx.beginPath(); ctx.arc(px, py, 1.1 * s, 0, Math.PI * 2); ctx.fill();
  }
}

/** Круглый столик */
export function table(f: PF, x: number, y: number, r: number, col: string) {
  const { ctx, sc } = f;
  ctx.fillStyle = f.dim(col); ctx.fillRect(x - 1 * sc, y - 9 * sc, 2 * sc, 9 * sc);
  ctx.beginPath(); ctx.ellipse(x, y - 0.5 * sc, r * 0.6, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, y - 9 * sc, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hexA('#ffffff', 0.15); ctx.beginPath(); ctx.ellipse(x, y - 9.6 * sc, r * 0.8, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
}

/** А-образная доска-штендер с надписями */
export function chalkboard(f: PF, x: number, y: number, lines: string[], st: { bg: string; ink: string; frame: string; accent?: string }) {
  const { ctx, sc } = f;
  const w = 20 * sc, h = 24 * sc;
  ctx.fillStyle = f.dim(st.frame);
  ctx.beginPath(); ctx.moveTo(x - w / 2 + 3 * sc, y - h); ctx.lineTo(x + w / 2 + 6 * sc, y); ctx.lineTo(x + w / 2 + 4 * sc, y); ctx.lineTo(x - w / 2 + 2 * sc, y - h); ctx.fill();
  ctx.fillRect(x - w / 2 - 1.5 * sc, y - h - 1.5 * sc, w + 3 * sc, h + 1.5 * sc);
  ctx.fillStyle = f.dim(st.bg); ctx.fillRect(x - w / 2, y - h, w, h - 2 * sc);
  ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2, y - h, w, h); ctx.clip();
  ctx.textAlign = 'center';
  lines.forEach((ln, i) => {
    ctx.fillStyle = f.dim(i === lines.length - 1 && st.accent ? st.accent : st.ink);
    ctx.font = i === 0 ? `bold ${3.4 * sc}px Inter, sans-serif` : `${3.2 * sc}px 'Segoe Print', 'Comic Sans MS', cursive`;
    ctx.fillText(ln, x, y - h + 5 * sc + i * 5 * sc);
  });
  ctx.restore(); ctx.textAlign = 'left';
  ctx.strokeStyle = hexA('#000000', 0.3); ctx.lineWidth = 0.8; ctx.strokeRect(x - w / 2 - 1.5 * sc, y - h - 1.5 * sc, w + 3 * sc, h + 1.5 * sc);
}

export function gull(ctx: CanvasRenderingContext2D, x: number, y: number, ph: number, s: number, col: string) {
  const fl = Math.sin(ph) * 5 * s;
  ctx.strokeStyle = col; ctx.lineWidth = 1.2 * s; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 10 * s, y - fl); ctx.quadraticCurveTo(x - 4 * s, y - 4 * s, x, y); ctx.quadraticCurveTo(x + 4 * s, y - 4 * s, x + 10 * s, y - fl);
  ctx.stroke();
}

/** Окно с рамой; ночью светится, если здание открыто */
export function windowRect(f: PF, x: number, y: number, w: number, h: number, frame: string, seed = 0, warm?: string) {
  const { ctx } = f;
  ctx.fillStyle = f.win(seed, warm);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = f.dim(frame);
  ctx.fillRect(x + w / 2 - 0.6, y, 1.2, h);
  ctx.fillRect(x, y + h / 2 - 0.5, w, 1);
  if (f.lit && !f.closed && !f.reflecting) f.pool(x + w / 2, y + h / 2, Math.max(w, h) * 1.6, warm ?? '#ffc070', 0.22 * f.night);
}

export function arcWindow(f: PF, x: number, y: number, w: number, h: number, frame: string, seed = 0) {
  const { ctx } = f;
  ctx.fillStyle = f.win(seed);
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = f.dim(frame); ctx.lineWidth = 1; ctx.stroke();
  ctx.fillRect(x + w / 2 - 0.5, y, 1, h);
}

export function door(f: PF, x: number, y: number, w: number, h: number, col: string, arch = false) {
  const { ctx } = f;
  ctx.fillStyle = f.dim(col);
  if (arch) { ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill(); }
  else ctx.fillRect(x, y, w, h);
  ctx.fillStyle = f.dim('#d8b060');
  ctx.fillRect(x + w * 0.72, y + h * 0.55, 1.4, 1.4);
  if (f.closed) { ctx.fillStyle = f.dim('#f0e8d8'); ctx.fillRect(x + w * 0.2, y + h * 0.3, w * 0.6, h * 0.14); ctx.fillStyle = f.dim('#8a2a22'); ctx.fillRect(x + w * 0.28, y + h * 0.35, w * 0.44, h * 0.04); }
}

/** Качающаяся вывеска на кронштейне */
export function sign(f: PF, x: number, y: number, w: number, h: number, bg: string, draw: (ctx: CanvasRenderingContext2D) => void, phase = 0) {
  const { ctx, sc, t } = f;
  ctx.fillStyle = f.dim('#2a2018');
  ctx.fillRect(x - 1 * sc, y - 1 * sc, w + 6 * sc, 1.6 * sc);
  ctx.save();
  ctx.translate(x + w / 2 + 2 * sc, y);
  ctx.rotate(Math.sin(t * (1.3 + f.A.wind * 0.1) + phase) * (0.05 + f.A.wind * 0.006));
  ctx.fillStyle = f.dim('#2a2018');
  ctx.fillRect(-w / 2 + 2 * sc, 0, 1, 2 * sc); ctx.fillRect(w / 2 - 2 * sc, 0, 1, 2 * sc);
  ctx.fillStyle = f.dim(bg);
  roundRect(ctx, -w / 2, 2 * sc, w, h, 1.5 * sc); ctx.fill();
  ctx.strokeStyle = hexA('#000000', 0.35); ctx.lineWidth = 0.8; ctx.stroke();
  ctx.translate(0, 2 * sc + h / 2);
  draw(ctx);
  ctx.restore();
}

export function crate(f: PF, x: number, y: number, w: number, h: number, col: string) {
  const { ctx } = f;
  ctx.fillStyle = f.dim(col);
  ctx.fillRect(x, y - h, w, h);
  ctx.strokeStyle = hexA('#000000', 0.32); ctx.lineWidth = 0.8;
  ctx.strokeRect(x, y - h, w, h);
  ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + w, y); ctx.moveTo(x + w, y - h); ctx.lineTo(x, y); ctx.stroke();
}

export function barrel(f: PF, x: number, y: number, r: number, h: number, col: string, hoop = '#2a2a2a') {
  const { ctx } = f;
  ctx.fillStyle = f.dim(col);
  ctx.beginPath(); ctx.ellipse(x, y - h / 2, r, h / 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = f.dim(hoop);
  ctx.fillRect(x - r, y - h * 0.78, r * 2, 1.2); ctx.fillRect(x - r, y - h * 0.26, r * 2, 1.2);
}

export function fishCrate(f: PF, x: number, y: number, w: number, h: number, col = '#a8b8c0') {
  const { ctx } = f;
  crate(f, x, y, w, h, '#c8b48a');
  ctx.fillStyle = f.dim(col);
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(x + w * (0.2 + k * 0.3), y - h - 1.5, w * 0.17, 2, 0.25 * (k - 1), 0, Math.PI * 2); ctx.fill(); }
}

export function rope(f: PF, x1: number, y1: number, x2: number, y2: number, sag: number, col = '#c8b080', w = 1.2) {
  const { ctx } = f;
  ctx.strokeStyle = f.dim(col); ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2, Math.max(y1, y2) + sag, x2, y2); ctx.stroke();
}

export function bollard(f: PF, x: number, y: number, col = '#2a2a2a') {
  const { ctx, sc } = f;
  ctx.fillStyle = f.dim(col);
  ctx.fillRect(x - 3 * sc, y - 8 * sc, 6 * sc, 8 * sc);
  ctx.beginPath(); ctx.ellipse(x, y - 8 * sc, 3.6 * sc, 1.6 * sc, 0, 0, Math.PI * 2); ctx.fill();
}

/** Флаг: при штиле обвисает, при ветре вытягивается и полощется */
export function flag(f: PF, x: number, y: number, ph: number, cols: string[], fw: number, fh: number, pole = '#d8d8d8', poleH = 70) {
  const { ctx, sc, t } = f;
  const H = poleH * sc;
  const w = clamp(f.A.wind / 14, 0, 1.4);
  const ext = 0.3 + 0.7 * Math.min(1, w * 1.2);
  const amp = (0.6 + w * 2.4) * sc, freq = 3 + w * 4;
  ctx.fillStyle = f.dim(pole);
  ctx.fillRect(x - 1 * sc, y - H, 2 * sc, H);
  ctx.beginPath(); ctx.arc(x, y - H, 2 * sc, 0, Math.PI * 2); ctx.fill();
  const bands = cols.length;
  const pt = (q: number, band: number, edge: number): [number, number] => {
    const wv = Math.sin(t * freq + q * 4 + ph) * amp * q;
    const droop = (1 - ext) * fh * sc * 0.7 * q * q;
    return [x + 1 * sc + q * fw * sc * ext, y - H + 2 * sc + ((band + edge) / bands) * fh * sc + wv + droop];
  };
  for (let band = 0; band < bands; band++) {
    ctx.fillStyle = f.dim(cols[band]);
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) { const p = pt(i / 10, band, 0); if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); }
    for (let i = 10; i >= 0; i--) { const p = pt(i / 10, band, 1); ctx.lineTo(p[0], p[1]); }
    ctx.closePath(); ctx.fill();
  }
}

export function bunting(f: PF, x0: number, y0: number, x1: number, y1: number, sag: number, cols: string[], n = 12, glowAt = false) {
  const { ctx, sc, t } = f;
  ctx.strokeStyle = f.dim('#3a3a3a'); ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1); ctx.stroke();
  const wk = 1 + f.A.wind * 0.1;
  for (let i = 1; i < n; i++) {
    const q = i / n;
    const fx = x0 + (x1 - x0) * q, fy = y0 + (y1 - y0) * q + Math.sin(q * Math.PI) * sag;
    const sw = Math.sin(t * 3 * wk + i) * 1.5 * sc * wk;
    const c = cols[i % cols.length];
    if (glowAt && f.night > 0.3) { f.glow(fx, fy, 1.6 * sc, c, f.night); }
    else {
      ctx.fillStyle = f.dim(c);
      ctx.beginPath(); ctx.moveTo(fx - 3.5 * sc, fy); ctx.lineTo(fx + 3.5 * sc, fy); ctx.lineTo(fx + sw, fy + 8 * sc); ctx.fill();
    }
  }
}

export function cat(f: PF, x: number, y: number, col: string, face: 1 | -1 = 1) {
  const { ctx, sc, t } = f;
  const tail = Math.sin(t * 1.8) * 3 * sc;
  ctx.save(); ctx.translate(x, y); ctx.scale(face, 1);
  ctx.fillStyle = f.dim(col, 0.8);
  ctx.beginPath(); ctx.ellipse(0, -3.5 * sc, 5 * sc, 3.5 * sc, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(4.5 * sc, -7 * sc, 2.6 * sc, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(3 * sc, -9 * sc); ctx.lineTo(3.6 * sc, -11.5 * sc); ctx.lineTo(4.8 * sc, -9.4 * sc); ctx.fill();
  ctx.beginPath(); ctx.moveTo(5 * sc, -9.4 * sc); ctx.lineTo(6.4 * sc, -11.5 * sc); ctx.lineTo(6.8 * sc, -8.8 * sc); ctx.fill();
  ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.4 * sc;
  ctx.beginPath(); ctx.moveTo(-4.5 * sc, -3 * sc); ctx.quadraticCurveTo(-9 * sc, -6 * sc + tail, -7 * sc, -11 * sc + tail); ctx.stroke();
  ctx.restore();
  if (f.night > 0.4) f.glow(x + 5.5 * sc * face, y - 7.3 * sc, 0.7 * sc, '#c8ff80', f.night * 0.8);
}

export function dog(f: PF, x: number, y: number, col: string, face: 1 | -1 = 1) {
  const { ctx, sc, t } = f;
  const wag = Math.sin(t * 9) * 2.5 * sc;
  ctx.save(); ctx.translate(x, y); ctx.scale(face, 1);
  ctx.fillStyle = f.dim(col, 0.8);
  ctx.beginPath(); ctx.ellipse(0, -6 * sc, 7 * sc, 4 * sc, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-5 * sc, -4 * sc, 2 * sc, 4 * sc); ctx.fillRect(3 * sc, -4 * sc, 2 * sc, 4 * sc);
  ctx.beginPath(); ctx.ellipse(7.5 * sc, -9.5 * sc, 3.6 * sc, 2.8 * sc, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6 * sc, -11.5 * sc, 1.6 * sc, 2.6 * sc, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.6 * sc;
  ctx.beginPath(); ctx.moveTo(-6.5 * sc, -7 * sc); ctx.lineTo(-11 * sc, -11 * sc + wag); ctx.stroke();
  ctx.restore();
}

/** Корпус судна на воде (вид сбоку); качка усиливается с волной */
export function hull(f: PF, x: number, y: number, s: number, hullCol: string, trimCol: string, o: { cabin?: boolean; mast?: boolean; sail?: boolean; wheelhouse?: boolean; name?: string; bob?: number; long?: number } = {}) {
  const { ctx, sc } = f;
  const L = o.long ?? 1;
  const bob = (o.bob ?? 0) * (0.5 + f.A.waves * 0.55);
  const tilt = Math.sin(f.t * 0.9 + x * 0.013) * 0.025 * f.A.waves;
  ctx.save();
  ctx.translate(x, y + bob); ctx.rotate(tilt);
  ctx.fillStyle = f.dim(hullCol);
  ctx.beginPath();
  ctx.moveTo(-50 * s * L, -8 * s); ctx.lineTo(52 * s * L, -11 * s); ctx.quadraticCurveTo(44 * s * L, 6 * s, 30 * s * L, 8 * s); ctx.lineTo(-42 * s * L, 8 * s); ctx.quadraticCurveTo(-50 * s * L, 2 * s, -50 * s * L, -8 * s);
  ctx.fill();
  ctx.fillStyle = f.dim(trimCol);
  ctx.fillRect(-50 * s * L, -9 * s, 102 * s * L, 2.5 * s);
  ctx.fillStyle = hexA('#000000', 0.25);
  ctx.fillRect(-46 * s * L, 3 * s, 90 * s * L, 1.5 * s);
  // кранцы
  ctx.fillStyle = f.dim('#1a1a1c'); for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(-30 * s * L + k * 28 * s * L, -2 * s, 1.6 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  if (o.wheelhouse) {
    ctx.fillStyle = f.dim(trimCol);
    ctx.fillRect(-12 * s, -32 * s, 30 * s, 23 * s);
    ctx.fillStyle = f.win(x);
    ctx.fillRect(-8 * s, -27 * s, 22 * s, 7 * s);
    ctx.fillStyle = f.dim('#303030');
    ctx.fillRect(-24 * s, -60 * s, 2.4 * s, 52 * s);
    ctx.fillRect(2 * s, -40 * s, 4 * s, 8 * s);
    if (f.night > 0.3 && !f.reflecting) f.glow(-23 * s, -61 * s, 1.5 * s, '#ffffff', f.night);
  } else if (o.cabin) {
    ctx.fillStyle = f.dim(trimCol);
    ctx.fillRect(-8 * s, -22 * s, 24 * s, 13 * s);
    ctx.fillStyle = f.win(x);
    ctx.fillRect(-4 * s, -19 * s, 16 * s, 5 * s);
  }
  if (o.mast || o.sail) {
    ctx.strokeStyle = f.dim('#c8c8c8'); ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.moveTo(0, -10 * s); ctx.lineTo(0, -82 * s); ctx.stroke();
    if (o.sail) {
      ctx.fillStyle = f.dim('#f4f2ec');
      ctx.beginPath(); ctx.moveTo(-1, -78 * s); ctx.lineTo(-32 * s, -12 * s); ctx.lineTo(-1, -12 * s); ctx.fill();
    } else {
      ctx.strokeStyle = f.dim('#8a8a8a'); ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(0, -80 * s); ctx.lineTo(48 * s * L, -10 * s); ctx.moveTo(0, -80 * s); ctx.lineTo(-46 * s * L, -8 * s); ctx.stroke();
      // вымпел по ветру
      ctx.fillStyle = f.dim('#c84030'); ctx.beginPath(); ctx.moveTo(0, -80 * s); ctx.lineTo(7 * s * f.A.windDir * Math.min(1, 0.3 + f.A.wind * 0.1), -78 * s + Math.sin(f.t * 6) * s); ctx.lineTo(0, -75 * s); ctx.fill();
    }
  }
  ctx.restore();
  ctx.fillStyle = `rgba(255,255,255,${(0.25 * (1 - f.night * 0.6)).toFixed(3)})`;
  ctx.fillRect(x - 50 * s * L, y + 9 * sc + bob, 100 * s * L, 1.2);
}

export function pine(f: PF, x: number, y: number, h: number, col: string, trunk = '#3a2a1c') {
  const { ctx, sc } = f;
  ctx.fillStyle = f.dim(trunk);
  ctx.fillRect(x - 1.2 * sc, y - h * 0.3, 2.4 * sc, h * 0.3);
  ctx.fillStyle = f.dim(col);
  for (let k = 0; k < 3; k++) {
    const w = h * (0.32 - k * 0.08), ty = y - h * (0.25 + k * 0.25);
    ctx.beginPath(); ctx.moveTo(x - w, ty); ctx.lineTo(x, ty - h * 0.33); ctx.lineTo(x + w, ty); ctx.fill();
  }
}

export function palm(f: PF, x: number, y: number, h: number, lean: number, seed: number) {
  const { ctx, sc, t } = f;
  const wk = 1 + f.A.wind * 0.08;
  const tx = x + lean * sc + Math.sin(t * 0.8 + seed) * 3 * wk, ty = y - h;
  ctx.strokeStyle = f.dim('#6a5238'); ctx.lineWidth = 4.5 * sc; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * sc * 0.3, y - h * 0.5, tx, ty); ctx.stroke();
  ctx.strokeStyle = hexA('#000000', 0.2); ctx.lineWidth = 1;
  for (let k = 1; k < 8; k++) { const q = k / 8; const px = x + (tx - x) * q + lean * sc * 0.3 * (1 - q) * q * 2, py = y + (ty - y) * q; ctx.beginPath(); ctx.moveTo(px - 2 * sc, py); ctx.lineTo(px + 2 * sc, py); ctx.stroke(); }
  ctx.fillStyle = f.dim('#6a4a2a');
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(tx + (k - 1) * 2.5 * sc, ty + 3 * sc, 1.8 * sc, 0, Math.PI * 2); ctx.fill(); }
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i - 3.5) * 0.46 + Math.sin(t * 1.2 * wk + i + seed) * 0.06 * wk + f.A.windDir * f.A.wind * 0.01;
    const Lf = h * 0.46;
    ctx.fillStyle = f.dim(i % 2 ? '#2f6a34' : '#3d8a44');
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + Math.cos(a) * Lf * 0.6, ty + Math.sin(a) * Lf * 0.4 - 8 * sc, tx + Math.cos(a) * Lf, ty + Math.sin(a) * Lf * 0.4 + Lf * 0.38);
    ctx.quadraticCurveTo(tx + Math.cos(a) * Lf * 0.5, ty + Math.sin(a) * Lf * 0.2 + 3 * sc, tx, ty);
    ctx.fill();
  }
}

export function cypress(f: PF, x: number, y: number, h: number, lean: number) {
  const { ctx, sc, t } = f;
  const sway = Math.sin(t * 0.7 + x) * 1.5 * sc * (1 + f.A.wind * 0.08);
  ctx.fillStyle = f.dim('#3a2a1c');
  ctx.fillRect(x - 1.5 * sc, y - h * 0.35, 3 * sc, h * 0.35);
  ctx.fillStyle = f.dim('#2c4a34');
  for (let k = 0; k < 5; k++) {
    const q = k / 5;
    const w = h * (0.3 - q * 0.15), cy = y - h * (0.3 + q * 0.14);
    ctx.beginPath(); ctx.ellipse(x + lean * sc * q + sway * q, cy, w, h * 0.09, lean * 0.02, 0, Math.PI * 2); ctx.fill();
  }
}

export function ridgePath(f: PF, baseY: number, hMax: number, seed: number, sharp = 1, x0 = 0, x1 = f.W) {
  const { ctx } = f;
  const point = (x: number) => {
    const q = x / f.W;
    const n = Math.sin(q * 5.1 + seed) * 0.5 + Math.sin(q * 13.7 + seed * 2.3) * 0.3 + Math.sin(q * 31 + seed * 4.1) * 0.2 * sharp;
    ctx.lineTo(x, baseY - hMax * (0.55 + n * 0.45));
  };
  ctx.beginPath(); ctx.moveTo(x0, baseY + 2);
  for (let x = x0; x < x1; x += 6) point(x);
  point(x1); ctx.lineTo(x1, baseY + 2); ctx.closePath();
}

export function mountainRidge(f: PF, baseY: number, hMax: number, seed: number, col: string, sharp = 1, x0 = 0, x1 = f.W) {
  f.ctx.fillStyle = col;
  ridgePath(f, baseY, hMax, seed, sharp, x0, x1);
  f.ctx.fill();
}

/** Snow is clipped inside the same ridge path, never a polygon floating in the sky. */
export function snowCaps(f: PF, baseY: number, hMax: number, seed: number, col: string, sharp: number, level: number) {
  const { ctx, W, H, sc } = f;
  ctx.save(); ridgePath(f, baseY, hMax, seed, sharp); ctx.clip();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0);
  for (let x = W; x >= 0; x -= 6) {
    const q = x / W;
    ctx.lineTo(x, baseY - H * level + (Math.sin(q * 49 + seed) * 3 + Math.sin(q * 93) * 2) * sc);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

export function lantern(f: PF, x: number, y: number, col: string, r: number, seed: number) {
  const { ctx, sc } = f;
  const sw = Math.sin(f.t * 1.4 + seed) * (1.2 + f.A.wind * 0.3) * sc;
  ctx.strokeStyle = f.dim('#3a3a3a'); ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sw, y + 5 * sc); ctx.stroke();
  if (f.night > 0.3) f.glow(x + sw, y + 5 * sc + r, r, col, f.night * 0.9);
  else { ctx.fillStyle = f.dim(col); ctx.beginPath(); ctx.ellipse(x + sw, y + 5 * sc + r, r * 0.8, r, 0, 0, Math.PI * 2); ctx.fill(); }
}

export const shade = (c: string, k: number) => (k < 1 ? mix(c, '#000000', 1 - k) : mix(c, '#ffffff', k - 1));
