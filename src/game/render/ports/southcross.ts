import type { PF, PortKit } from '../portFrame';
import { aerial } from '../portHorizon';
import { door, flag, notes, person } from '../portParts';
import { hexA, mix } from '../util';

function dome(f: PF, x: number, y: number, r: number, col: string, seed: number, o: { door?: boolean; lab?: boolean } = {}) {
  const { ctx } = f;
  ctx.fillStyle = f.dim(col);
  ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.fill();
  // триангуляция геокупола
  ctx.strokeStyle = hexA('#000000', 0.14); ctx.lineWidth = 1;
  for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.arc(x, y, r * (k / 4), Math.PI, 0); ctx.stroke(); }
  for (let k = 1; k < 8; k++) { const a = Math.PI + (k / 8) * Math.PI; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke(); }
  for (let k = 0; k < 3; k++) { const a = Math.PI + ((k + 1) / 4) * Math.PI; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); ctx.lineTo(x + Math.cos(a - 0.4) * r * 0.75, y + Math.sin(a - 0.4) * r * 0.75); ctx.lineTo(x + Math.cos(a + 0.4) * r * 0.75, y + Math.sin(a + 0.4) * r * 0.75); ctx.closePath(); ctx.stroke(); }
  // круглые окна
  for (let k = 0; k < 3; k++) { const a = Math.PI + ((k + 1) / 4) * Math.PI; const wx = x + Math.cos(a) * r * 0.62, wy = y + Math.sin(a) * r * 0.62; ctx.fillStyle = f.win(seed + k, o.lab ? '#9ad8ff' : '#ffc870'); ctx.beginPath(); ctx.arc(wx, wy, r * 0.09, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = f.dim('#3a4650'); ctx.lineWidth = 1; ctx.stroke(); }
  if (o.door) { ctx.fillStyle = f.dim('#2a3038'); ctx.fillRect(x - r * 0.12, y - r * 0.28, r * 0.24, r * 0.28); ctx.fillStyle = f.win(seed + 7, o.lab ? '#9ad8ff' : '#ffc870'); ctx.fillRect(x - r * 0.08, y - r * 0.26, r * 0.16, r * 0.12); if (f.lit) f.pool(x, y, r * 0.9, o.lab ? '#80c8ff' : '#ffc070', 0.22 * f.night); }
  // снег на куполе
  ctx.fillStyle = hexA('#ffffff', 0.35); ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 1.15, Math.PI * 1.85); ctx.lineTo(x + Math.cos(Math.PI * 1.85) * r * 0.9, y + Math.sin(Math.PI * 1.85) * r * 0.9); ctx.arc(x, y, r * 0.9, Math.PI * 1.85, Math.PI * 1.15, true); ctx.fill();
}

function penguin(f: PF, x: number, y: number, s: number, o: { walk?: number; slide?: boolean; face?: 1 | -1; chick?: boolean } = {}) {
  const { ctx } = f;
  const dir = o.face ?? 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  if (o.slide) {
    ctx.fillStyle = '#15171c'; ctx.beginPath(); ctx.ellipse(0, -3 * s, 8 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2f2ee'; ctx.beginPath(); ctx.ellipse(0, -2.4 * s, 6.5 * s, 1.8 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#15171c'; ctx.beginPath(); ctx.arc(8 * s, -4 * s, 2.4 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0a030'; ctx.fillRect(10 * s, -4.5 * s, 2.5 * s, 1 * s);
  } else {
    const wob = o.walk != null ? Math.sin(o.walk) * 0.12 : 0;
    ctx.rotate(wob);
    const h = o.chick ? 6 * s : 12 * s, w = o.chick ? 3 * s : 4 * s;
    ctx.fillStyle = o.chick ? '#8a8a90' : '#15171c'; ctx.beginPath(); ctx.ellipse(0, -h / 2, w, h / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2f2ee'; ctx.beginPath(); ctx.ellipse(0.8 * s, -h / 2 + 0.5 * s, w * 0.6, h / 2 * 0.72, 0, 0, Math.PI * 2); ctx.fill();
    if (!o.chick) { ctx.fillStyle = '#f0c040'; ctx.beginPath(); ctx.ellipse(1.6 * s, -h + 2.2 * s, 1.4 * s, 1.8 * s, 0.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#f0a030'; ctx.fillRect(w * 0.6, -h + 1.4 * s, 2.5 * s, 1 * s);
    ctx.fillStyle = '#15171c'; const fl = o.walk != null ? Math.sin(o.walk * 2) * 0.3 : 0; ctx.save(); ctx.translate(-w * 0.8, -h * 0.6); ctx.rotate(0.3 + fl); ctx.fillRect(-1 * s, 0, 2 * s, h * 0.5); ctx.restore();
    ctx.fillStyle = '#f0a030'; ctx.fillRect(-2.5 * s, -1 * s, 2.4 * s, 1 * s); ctx.fillRect(0.5 * s, -1 * s, 2.4 * s, 1 * s);
  }
  ctx.restore();
}

function turbine(f: PF, x: number, y: number, h: number, seed: number) {
  const { ctx, sc, t } = f;
  ctx.fillStyle = f.dim('#e8eef2'); ctx.beginPath(); ctx.moveTo(x - 2.5 * sc, y); ctx.lineTo(x - 1.2 * sc, y - h); ctx.lineTo(x + 1.2 * sc, y - h); ctx.lineTo(x + 2.5 * sc, y); ctx.fill();
  ctx.fillRect(x - 3 * sc, y - h - 2 * sc, 7 * sc, 4 * sc);
  const spin = t * (1.2 + f.A.wind * 0.12) + seed;
  ctx.strokeStyle = f.dim('#f4f6f8'); ctx.lineWidth = 2 * sc; ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) { const a = spin + (k / 3) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + Math.cos(a) * h * 0.45, y - h + Math.sin(a) * h * 0.45); ctx.stroke(); }
  if (f.night > 0.3 && Math.floor(t * 1.5 + seed) % 2 === 0) f.glow(x, y - h, 1.5 * sc, '#ff4040', f.night);
}

function moduleBox(f: PF, x: number, y: number, w: number, h: number, col: string, seed: number, label?: string) {
  const { ctx, sc } = f;
  const x0 = x - w / 2;
  ctx.fillStyle = f.dim('#4a5058'); for (let k = 0; k < 4; k++) ctx.fillRect(x0 + 4 * sc + (k / 3) * (w - 11 * sc), y - 12 * sc, 3 * sc, 12 * sc);
  ctx.fillRect(x0 - 2 * sc, y - 13 * sc, w + 4 * sc, 2 * sc);
  const by = y - 13 * sc;
  ctx.fillStyle = f.dim(col); ctx.fillRect(x0, by - h, w, h);
  ctx.fillStyle = hexA('#000000', 0.14); for (let k = 0; k < w; k += 7 * sc) ctx.fillRect(x0 + k, by - h, 1.5, h);
  ctx.fillStyle = f.dim('#e8eef2'); ctx.fillRect(x0 - 2 * sc, by - h - 3 * sc, w + 4 * sc, 3 * sc);
  for (let k = 0; k < 3; k++) { ctx.fillStyle = f.win(seed + k); ctx.fillRect(x0 + w * (0.12 + k * 0.3), by - h * 0.72, w * 0.18, h * 0.3); ctx.strokeStyle = f.dim('#2a3038'); ctx.lineWidth = 1.2; ctx.strokeRect(x0 + w * (0.12 + k * 0.3), by - h * 0.72, w * 0.18, h * 0.3); }
  if (label) { ctx.fillStyle = f.dim('#f4f6f8'); ctx.font = `bold ${5 * sc}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(label, x, by - h * 0.12); ctx.textAlign = 'left'; }
  // лестница
  ctx.fillStyle = f.dim('#8a9098'); for (let k = 0; k < 4; k++) ctx.fillRect(x0 - 14 * sc + k * 3.5 * sc, y - k * 3.3 * sc - 2 * sc, 6 * sc, 1.6 * sc);
  return by - h - 3 * sc;
}

export const southcrossKit: PortKit = {
  layout: { tavern: 0.14, shop: 0.34, market: 0.53, dock: 0.7, shipyard: 0.88 },
  quay: 'ice',
  pal: { quay: '#d8e2ea', quayFace: '#9ab0c0', water: ['#3a7a96', '#062030'], lamp: '#4a5058', lampLight: '#dfe8ff' },
  walkers: { n: 4, cols: ['#d8402a', '#e8701a', '#d8402a', '#2a3a5a'], speed: 0.7 },
  lampXs: [0.265, 0.625, 0.765, 0.98],
  birds: { kind: 'skua', n: 2 },
  traffic: [
    { kind: 'zodiac', hull: '#2a2a2e', trim: '#d8402a', scale: 1.0, period: 32, lane: 0.6 },
    { kind: 'tug', hull: '#e8701a', trim: '#f4f4f4', scale: 1.0, period: 110, lane: 0.3, offset: 50 },
  ],
  hotBoard: 0.5,
  lampTop: 60,
  hours: { shop: [8, 20] },
  cold: () => true,
  farShips: [
    { kind: 'tanker', depth: 0.1, period: 600, dir: 1, offset: 200, hull: '#b8322a' },
    { kind: 'trawler', depth: 0.4, period: 260, dir: -1, offset: 30, hull: '#e87a20' },
  ],

  horizon(f) {
    const { ctx, W, H, hY, sc, t, A } = f;
    // кромка пакового льда на горизонте: белая зубчатая полоса с голубыми тенями
    ctx.fillStyle = aerial(f, '#eef4f8', 0.9);
    ctx.beginPath(); ctx.moveTo(0, hY + 1);
    for (let x = 0; x <= W; x += 4) { const q = x / W; const inPack = q < 0.36 || q > 0.6; const h = inPack ? (1.5 + Math.abs(Math.sin(q * 60 + 1)) * 3 + f.h(Math.floor(x / 9)) * 2) * sc : 0; ctx.lineTo(x, hY + 1 - h); }
    ctx.lineTo(W, hY + 1); ctx.fill();
    ctx.fillStyle = hexA('#7ab0d8', 0.4); for (let x = 0; x < W; x += 9 * sc) { const q = x / W; if (q >= 0.36 && q <= 0.6) continue; ctx.fillRect(x, hY, 9 * sc, 1.2 * sc); }
    // столовые айсберги на горизонте — огромные, плоские
    for (const [qx, qw, qh] of [[0.08, 0.1, 10], [0.7, 0.14, 13], [0.92, 0.08, 8]]) {
      const x = W * qx, w = W * qw, h = qh * sc;
      ctx.fillStyle = aerial(f, '#f4f8fb', 0.9); ctx.beginPath(); ctx.moveTo(x - w / 2, hY + 1); ctx.lineTo(x - w / 2 + 3 * sc, hY - h); ctx.lineTo(x + w / 2 - 4 * sc, hY - h + 1 * sc); ctx.lineTo(x + w / 2, hY + 1); ctx.fill();
      ctx.fillStyle = hexA('#6aa0d0', 0.35); ctx.beginPath(); ctx.moveTo(x + w / 2 - 4 * sc, hY - h + 1 * sc); ctx.lineTo(x + w / 2, hY + 1); ctx.lineTo(x + w * 0.2, hY + 1); ctx.fill();
      ctx.strokeStyle = hexA('#4a88b8', 0.3); ctx.lineWidth = 0.8; for (let k = 0; k < 4; k++) { const sx = x - w / 2 + 6 * sc + k * (w / 4); ctx.beginPath(); ctx.moveTo(sx, hY - h * 0.9); ctx.lineTo(sx + (f.h(k + qx * 100) - 0.5) * 6 * sc, hY); ctx.stroke(); }
    }
    // открытая вода (полынья) между льдами — тёмная, с паром морозным утром
    if (f.night < 0.6 && A.weather !== 'storm') { ctx.save(); for (let k = 0; k < 5; k++) { const px = W * (0.38 + k * 0.05) + Math.sin(t * 0.4 + k) * 8 * sc, py = hY + 2 + Math.sin(t * 0.6 + k * 2) * 1.5; const g = ctx.createRadialGradient(px, py, 0, px, py, 18 * sc); g.addColorStop(0, 'rgba(235,242,250,0.28)'); g.addColorStop(1, 'rgba(235,242,250,0)'); ctx.fillStyle = g; ctx.fillRect(px - 18 * sc, py - 10 * sc, 36 * sc, 20 * sc); } ctx.restore(); }
    // научное судно стоит на якоре у кромки льда с оранжевым корпусом
    { const x = W * 0.5 + Math.sin(t * 0.02) * 6, y = hY + 1, k = sc * 0.55; ctx.fillStyle = aerial(f, '#e87a20', 0.85); ctx.beginPath(); ctx.moveTo(-30 * k + x, y); ctx.lineTo(-28 * k + x, y - 7 * k); ctx.lineTo(30 * k + x, y - 8 * k); ctx.lineTo(36 * k + x, y); ctx.fill(); ctx.fillStyle = aerial(f, '#f4f4f4', 0.85); ctx.fillRect(x - 10 * k, y - 20 * k, 26 * k, 13 * k); ctx.fillRect(x - 4 * k, y - 26 * k, 14 * k, 6 * k); ctx.fillStyle = f.night > 0.3 ? 'rgba(255,205,120,0.85)' : aerial(f, '#9ab8c8', 0.85); for (let c = 0; c < 6; c++) ctx.fillRect(x - 8 * k + c * 4 * k, y - 17 * k, 2.4 * k, 2.4 * k); ctx.strokeStyle = aerial(f, '#f4f4f4', 0.85); ctx.lineWidth = 1.4 * k; ctx.beginPath(); ctx.moveTo(x - 24 * k, y - 7 * k); ctx.lineTo(x - 20 * k, y - 30 * k); ctx.lineTo(x - 14 * k, y - 7 * k); ctx.stroke(); ctx.lineWidth = 1 * k; ctx.beginPath(); ctx.moveTo(x + 4 * k, y - 26 * k); ctx.lineTo(x + 4 * k, y - 40 * k); ctx.stroke(); ctx.save(); ctx.translate(x + 4 * k, y - 36 * k); ctx.rotate(t * 2); ctx.fillStyle = aerial(f, '#f4f4f4', 0.85); ctx.fillRect(-5 * k, -0.8 * k, 10 * k, 1.6 * k); ctx.restore(); if (f.night > 0.3) f.glow(x + 4 * k, y - 41 * k, 1 * k, '#ffffff', f.night); ctx.fillStyle = hexA('#e87a20', 0.25); ctx.fillRect(x - 20 * k, y + 1, 50 * k, 2.5 * k); }
    // верхний мираж (фата-моргана) в ясный морозный день: дрожащие перевёрнутые полосы над горизонтом
    if (A.weather === 'clear' && f.night < 0.3) { ctx.save(); ctx.globalAlpha = 0.35; for (let x = 0; x < W; x += 6 * sc) { const q = x / W; const off = Math.sin(x * 0.08 + t * 2.5) * 1.2 * sc; ctx.fillStyle = aerial(f, q < 0.36 || q > 0.6 ? '#f4f8fb' : '#2a4a6a', 0.9); ctx.fillRect(x, hY - 8 * sc + off, 6 * sc, 1.6 * sc); } ctx.restore(); }
    // поморники над полыньёй и дальняя колония пингвинов на льду
    ctx.fillStyle = aerial(f, '#15171c', 0.8); for (let i = 0; i < 24; i++) { const x = W * (0.62 + f.h(i + 500) * 0.3), hh = (1.2 + f.h(i + 501)) * sc; ctx.fillRect(x, hY - hh - 1, 0.9 * sc, hh); }
    void H;
  },

  signage(f) {
    // надпись на ледовой стенке причала
    const { ctx, W, sc, quayY, waterY, dim } = f;
    const bandH = waterY - quayY - 4 * sc;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.max(5, bandH * 0.5)}px Inter, sans-serif`;
    ctx.fillStyle = dim('#1a3a9a', 0.5); ctx.fillText('ЮЖНЫЙ КРЕСТ · 72°S', W * 0.56, quayY + 4 * sc + bandH * 0.55);
    ctx.fillStyle = hexA('#d8402a', 0.6); ctx.fillRect(W * 0.44, quayY + 4 * sc + bandH * 0.2, 1.5 * sc, bandH * 0.7); ctx.fillRect(W * 0.68, quayY + 4 * sc + bandH * 0.2, 1.5 * sc, bandH * 0.7);
    ctx.restore();
  },

  events: [
    { id: 'flag_up', label: 'Подъём флага', from: 7.75, to: 8.5, draw(f, u) {
      const { ctx, W, sc, gY: y, t } = f;
      const px = W * 0.79, H = 70 * sc, rise = Math.min(1, u * 1.6);
      const fy = y - 10 * sc - rise * (H - 20 * sc);
      ctx.fillStyle = f.dim('#1a3a9a'); ctx.beginPath();
      for (let i = 0; i <= 8; i++) { const q = i / 8; const wv = Math.sin(t * 5 + q * 4) * 2 * sc * q; if (i === 0) ctx.moveTo(px + 1 * sc, fy + wv); else ctx.lineTo(px + 1 * sc + q * 22 * sc, fy + wv); }
      for (let i = 8; i >= 0; i--) { const q = i / 8; const wv = Math.sin(t * 5 + q * 4) * 2 * sc * q; ctx.lineTo(px + 1 * sc + q * 22 * sc, fy + 12 * sc + wv); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = f.dim('#f4f4f4'); for (let k = 0; k < 4; k++) ctx.fillRect(px + 4 * sc + (k % 2) * 8 * sc, fy + 3 * sc + Math.floor(k / 2) * 5 * sc, 2 * sc, 2 * sc);
      for (let k = 0; k < 4; k++) person(f, px - 30 * sc - k * 9 * sc, y, k % 2 ? '#d8402a' : '#e8701a', { face: 1, hat: '#2a3a5a' });
      person(f, px - 70 * sc, y, '#2a3a5a', { face: 1, hat: '#d8402a' }); ctx.fillStyle = f.dim('#d8a030'); ctx.fillRect(px - 67 * sc, y - 17 * sc, 7 * sc, 1.6 * sc); notes(f, px - 58 * sc, y - 24 * sc, 3);
    } },
    { id: 'heli', label: 'Борт снабжения', from: 11, to: 13, draw(f, u) {
      const { ctx, W, H, hY, sc, t } = f;
      const path = u < 0.4 ? u / 0.4 : u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
      const hover = u >= 0.4 && u <= 0.6;
      const x = -60 * sc + (W * 0.74 + 60 * sc) * path, y = hY - H * 0.16 - (1 - path) * H * 0.08 + (hover ? Math.sin(t * 2) * 3 * sc : 0);
      ctx.fillStyle = f.dim('#e8701a'); ctx.beginPath(); ctx.ellipse(x, y, 14 * sc, 6 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x - 30 * sc, y - 3 * sc, 20 * sc, 3 * sc); ctx.fillRect(x - 30 * sc, y - 9 * sc, 2 * sc, 7 * sc);
      ctx.fillStyle = f.win(999, '#c8e0f0'); ctx.beginPath(); ctx.ellipse(x + 7 * sc, y - 1 * sc, 5 * sc, 3.5 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = f.dim('#3a4046'); ctx.fillRect(x - 1 * sc, y - 9 * sc, 2 * sc, 4 * sc); ctx.fillRect(x - 10 * sc, y + 5 * sc, 20 * sc, 1.5 * sc);
      ctx.strokeStyle = hexA('#2a2a2e', 0.5); ctx.lineWidth = 1.5 * sc; ctx.beginPath(); ctx.moveTo(x - 26 * sc, y - 9 * sc); ctx.lineTo(x + 26 * sc, y - 9 * sc); ctx.stroke();
      ctx.strokeStyle = hexA('#2a2a2e', 0.9); ctx.beginPath(); ctx.moveTo(x - Math.cos(t * 30) * 26 * sc, y - 9 * sc); ctx.lineTo(x + Math.cos(t * 30) * 26 * sc, y - 9 * sc); ctx.stroke();
      if (hover) { ctx.strokeStyle = f.dim('#8a9098'); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x, y + 6 * sc); ctx.lineTo(x, y + 30 * sc); ctx.stroke(); ctx.fillStyle = f.dim('#2a6aa0'); ctx.fillRect(x - 6 * sc, y + 30 * sc, 12 * sc, 8 * sc); }
      if (hover || path > 0.85) { ctx.fillStyle = 'rgba(240,246,255,0.35)'; for (let k = 0; k < 10; k++) { ctx.beginPath(); ctx.arc(W * 0.74 + (k - 5) * 8 * sc + Math.sin(t * 5 + k) * 4 * sc, hY - 2 - Math.abs(Math.sin(t * 4 + k)) * 6 * sc, 3 * sc, 0, Math.PI * 2); ctx.fill(); } }
      f.glow(x + 26 * sc, y - 3 * sc, 1.2 * sc, '#ff4040', Math.floor(t * 3) % 2);
    } },
    { id: 'feeding', label: 'Кормление пингвинов', from: 15, to: 16, draw(f, u) {
      const { ctx, W, sc, gY: y, t } = f;
      const sx = W * 0.47 - 20 * sc;
      person(f, sx, y, '#d8402a', { face: -1, carry: 'bucket', hat: '#2a3a5a' });
      const gather = Math.min(1, u * 3);
      for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI - Math.PI; const r = (40 - gather * 26) * sc; const px = sx - 10 * sc + Math.cos(a) * r * 0.9, hop = Math.max(0, Math.sin(t * 6 + k * 1.3)) * 2 * sc; penguin(f, px, y - hop, sc * 0.9, { face: px < sx ? 1 : -1, walk: t * 5 + k }); }
      const ph = (t * 0.8) % 1; const fx = sx - 4 * sc - ph * 26 * sc, fy = y - 18 * sc - Math.sin(ph * Math.PI) * 14 * sc; ctx.fillStyle = f.dim('#c8d8e0'); ctx.beginPath(); ctx.ellipse(fx, fy, 2.6 * sc, 1 * sc, -0.5, 0, Math.PI * 2); ctx.fill();
    } },
    { id: 'sauna', label: 'Банный вечер', from: 19, to: 22, draw(f) {
      const { ctx, W, sc, gY: y, t } = f;
      const bw = Math.min(150 * sc, W * 0.19), bx = W * 0.14 + bw * 0.5 + 2 * sc;
      if (f.random() < 0.6) f.smoke(bx + 20 * sc, y - 34 * sc, 4 * sc);
      const ph = (t % 5) / 5, q = ph < 0.5 ? ph / 0.5 : 1 - (ph - 0.5) / 0.5;
      const x1 = bx + 30 * sc, x2 = bx + 70 * sc;
      for (let k = 0; k < 2; k++) { const px = x1 + (x2 - x1) * q + k * 8 * sc; person(f, px, y, '#f4f4f4', { walk: t * 12 + k, face: ph < 0.5 ? 1 : -1, scale: 0.95 }); if (f.random() < 0.15) f.smoke(px, y - 20 * sc, 1.2 * sc); }
      ctx.fillStyle = f.dim('#eef4f8', 0.4); ctx.beginPath(); ctx.ellipse(x2 + 8 * sc, y + 1, 22 * sc, 5 * sc, 0, Math.PI, 0); ctx.fill();
      if (q > 0.95) { ctx.fillStyle = hexA('#9ac0d8', 0.4); ctx.beginPath(); ctx.ellipse(x2 + 8 * sc, y - 2 * sc, 6 * sc, 2.5 * sc, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = f.dim('#4a7a3a'); for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.ellipse(bx + 8 * sc + k * 6 * sc, y - 14 * sc, 2 * sc, 4 * sc, 0, 0, Math.PI * 2); ctx.fill(); }
    } },
  ],

  backRow(f) {
    const { ctx, W, sc, gY, dim, t } = f;
    const y = gY - 9 * sc;
    const haze = (c: string) => dim(mix(c, f.A.palette.skyHor, 0.2), 0.8);
    // модули на опорах, соединённые крытыми переходами
    const mods: [number, string, number][] = [[0.02, '#2a6aa0', 26], [0.075, '#e8eef2', 22], [0.235, '#e8701a', 26], [0.44, '#2a6aa0', 24], [0.475, '#e8eef2', 26], [0.72, '#e8701a', 24], [0.97, '#2a6aa0', 26]];
    for (const [qx, col, ww] of mods) {
      const x = W * qx, w = ww * sc, h = 14 * sc;
      ctx.fillStyle = haze('#4a5058'); for (let k = 0; k < 3; k++) ctx.fillRect(x - w / 2 + 2 * sc + k * (w - 6 * sc) / 2, y - 8 * sc, 2 * sc, 9 * sc);
      ctx.fillStyle = haze(col); ctx.fillRect(x - w / 2, y - 8 * sc - h, w, h);
      ctx.fillStyle = haze('#e8eef2'); ctx.fillRect(x - w / 2 - 1 * sc, y - 8 * sc - h - 2 * sc, w + 2 * sc, 2 * sc);
      for (let k = 0; k < 3; k++) { ctx.fillStyle = f.win(qx * 100 + k); ctx.fillRect(x - w * 0.36 + k * w * 0.3, y - 8 * sc - h * 0.72, w * 0.18, h * 0.38); }
    }
    ctx.fillStyle = haze('#8a9098'); ctx.fillRect(W * 0.02, y - 8 * sc - 9 * sc, W * 0.055, 4 * sc); ctx.fillRect(W * 0.44, y - 8 * sc - 9 * sc, W * 0.035, 4 * sc);
    // радом — большой белый шар
    { const x = W * 0.6, r = 16 * sc; ctx.fillStyle = haze('#4a5058'); ctx.fillRect(x - 10 * sc, y - 16 * sc, 20 * sc, 16 * sc); ctx.fillStyle = haze('#f4f6f8'); ctx.beginPath(); ctx.arc(x, y - 16 * sc - r * 0.7, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = hexA('#8a9aa8', 0.35); ctx.lineWidth = 0.7; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x, y - 16 * sc - r * 0.7, r, r * (k / 4), 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x, y - 16 * sc - r * 0.7, r * (k / 4), r, 0, 0, Math.PI * 2); ctx.stroke(); } if (f.night > 0.3) f.glow(x, y - 16 * sc - r * 1.7, 1.5 * sc, '#ff4040', f.night * (Math.floor(t * 1.5) % 2)); }
    // антенное поле
    ctx.strokeStyle = haze('#8a9098'); ctx.lineWidth = 1 * sc;
    for (let k = 0; k < 7; k++) { const x = W * (0.8 + k * 0.025), h = (24 + f.h(k + 60) * 20) * sc; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke(); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x - 6 * sc, y); ctx.moveTo(x, y - h); ctx.lineTo(x + 6 * sc, y); ctx.stroke(); ctx.lineWidth = 1 * sc; }
    // мачта метеостанции с флюгером и чашками
    { const x = W * 0.33, h = 36 * sc; ctx.strokeStyle = haze('#d8d8d8'); ctx.lineWidth = 1.4 * sc; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke(); ctx.save(); ctx.translate(x, y - h); const rot = t * (2 + f.A.wind * 0.3); for (let k = 0; k < 3; k++) { const a = rot + (k / 3) * Math.PI * 2; ctx.strokeStyle = haze('#f4f6f8'); ctx.lineWidth = 0.8 * sc; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 6 * sc, Math.sin(a) * 2 * sc); ctx.stroke(); ctx.fillStyle = haze('#f4f6f8'); ctx.beginPath(); ctx.arc(Math.cos(a) * 6 * sc, Math.sin(a) * 2 * sc, 1.4 * sc, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); ctx.fillStyle = haze('#d8402a'); ctx.beginPath(); ctx.moveTo(x, y - h + 8 * sc); ctx.lineTo(x + 8 * sc * f.A.windDir, y - h + 6 * sc); ctx.lineTo(x + 8 * sc * f.A.windDir, y - h + 10 * sc); ctx.fill(); ctx.fillStyle = haze('#e8eef2'); ctx.fillRect(x - 4 * sc, y - 12 * sc, 8 * sc, 8 * sc); }
  },

  ground(f) {
    const { ctx, W, sc, gY, quayY, dim } = f;
    // следы ботинок, следы снегохода, страховочный леер на столбиках, кабельный лоток
    ctx.fillStyle = hexA('#4a6a88', 0.3);
    for (let i = 0; i < 18; i++) { const x = W * 0.05 + i * W * 0.052, y = gY + 3 * sc + Math.sin(i * 0.9) * 2.5 * sc; ctx.beginPath(); ctx.ellipse(x, y, 1.8 * sc, 1 * sc, 0.2, 0, Math.PI * 2); ctx.ellipse(x + 3 * sc, y + 1.4 * sc, 1.8 * sc, 1 * sc, 0.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = hexA('#4a6a88', 0.35); ctx.lineWidth = 1.2 * sc; ctx.beginPath(); ctx.moveTo(0, gY + 7 * sc); ctx.quadraticCurveTo(W * 0.3, gY + 5 * sc, W * 0.6, gY + 8 * sc); ctx.moveTo(0, gY + 9.5 * sc); ctx.quadraticCurveTo(W * 0.3, gY + 7.5 * sc, W * 0.6, gY + 10.5 * sc); ctx.stroke();
    for (let x = 20 * sc; x < W; x += 50 * sc) { ctx.fillStyle = dim('#d8402a'); ctx.fillRect(x - 1 * sc, gY - 9 * sc, 2 * sc, 9 * sc); }
    ctx.strokeStyle = dim('#d8402a'); ctx.lineWidth = 1; ctx.beginPath(); for (let x = 20 * sc; x + 50 * sc < W + 50 * sc; x += 50 * sc) { ctx.moveTo(x, gY - 8 * sc); ctx.quadraticCurveTo(x + 25 * sc, gY - 5 * sc, x + 50 * sc, gY - 8 * sc); } ctx.stroke();
    ctx.fillStyle = hexA('#2a3038', 0.5); ctx.fillRect(0, quayY + 1 * sc, W, 1.6 * sc);
    // отражение сияния на льду
    if (f.A.aurora > 0.05 && f.night > 0.3) { const g = ctx.createLinearGradient(0, gY, 0, quayY + 4 * sc); g.addColorStop(0, hexA('#60ffb0', 0.12 * f.A.aurora * f.night)); g.addColorStop(1, hexA('#60ffb0', 0)); ctx.fillStyle = g; ctx.fillRect(0, gY, W, quayY + 4 * sc - gY); }
  },

  backdrop(f) {
    const { ctx, W, H, hY, sc, t, dim, A } = f;
    const sky = A.palette.skyHor;
    // далёкий ледяной купол материка — огромный пологий, почти сливается с небом
    { ctx.fillStyle = dim(mix('#e8f0f6', sky, 0.55), 0.4); ctx.beginPath(); ctx.moveTo(W * 0.3, hY - H * 0.1); ctx.quadraticCurveTo(W * 0.7, hY - H * 0.34, W * 1.1, hY - H * 0.1); ctx.lineTo(W, hY); ctx.lineTo(W * 0.3, hY); ctx.fill(); ctx.strokeStyle = hexA('#9ab8d0', 0.25); ctx.lineWidth = 1; for (let k = 0; k < 6; k++) { const x = W * (0.45 + k * 0.08); ctx.beginPath(); ctx.moveTo(x, hY - H * 0.1 - (H * 0.2) * Math.sin(((x - W * 0.3) / (W * 0.8)) * Math.PI) * 0.9); ctx.lineTo(x + 10 * sc, hY - H * 0.1); ctx.stroke(); } }
    // нунатаки — тёмные пики над ледником
    ctx.fillStyle = dim(mix('#3a4652', sky, 0.4), 0.6);
    for (const [qx, qh, qw] of [[0.1, 0.22, 0.12], [0.3, 0.16, 0.1], [0.78, 0.26, 0.14], [0.92, 0.18, 0.1]]) { const x = W * qx, h = H * qh, w = W * qw; ctx.beginPath(); ctx.moveTo(x - w, hY - H * 0.1); ctx.lineTo(x - w * 0.2, hY - h); ctx.lineTo(x + w * 0.1, hY - h * 0.9); ctx.lineTo(x + w, hY - H * 0.1); ctx.fill(); ctx.fillStyle = dim('#eef4f8', 0.5); ctx.beginPath(); ctx.moveTo(x - w * 0.4, hY - h * 0.7); ctx.lineTo(x - w * 0.2, hY - h); ctx.lineTo(x + w * 0.1, hY - h * 0.9); ctx.lineTo(x + w * 0.3, hY - h * 0.7); ctx.fill(); ctx.fillStyle = dim(mix('#3a4652', sky, 0.4), 0.6); }
    // стена шельфового ледника
    const wallTop = hY - H * 0.11;
    const ice = ctx.createLinearGradient(0, wallTop, 0, hY);
    ice.addColorStop(0, dim('#f0f6fa', 0.5)); ice.addColorStop(0.5, dim('#c8dce8', 0.55)); ice.addColorStop(1, dim('#7aa8c8', 0.6));
    ctx.fillStyle = ice;
    ctx.beginPath(); ctx.moveTo(0, hY + 2);
    for (let x = 0; x <= W; x += 5) { const q = x / W; ctx.lineTo(x, wallTop + Math.sin(q * 40 + 1) * 3 * sc + Math.sin(q * 7) * 6 * sc); }
    ctx.lineTo(W, hY + 2); ctx.fill();
    ctx.fillStyle = dim('#ffffff', 0.4); ctx.beginPath(); ctx.moveTo(0, wallTop + 2); for (let x = 0; x <= W; x += 5) { const q = x / W; ctx.lineTo(x, wallTop + Math.sin(q * 40 + 1) * 3 * sc + Math.sin(q * 7) * 6 * sc - 3 * sc); } ctx.lineTo(W, wallTop - 10 * sc); ctx.lineTo(0, wallTop - 10 * sc); ctx.fill();
    // трещины и голубые гроты
    ctx.strokeStyle = hexA('#4a88b8', 0.45); ctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) { const x = f.h(i + 3) * W; ctx.beginPath(); ctx.moveTo(x, wallTop + 4 * sc); ctx.lineTo(x + (f.h(i) - 0.5) * 16 * sc, wallTop + (H * 0.11) * (0.4 + f.h(i + 9) * 0.5)); ctx.stroke(); }
    for (let i = 0; i < 4; i++) { const x = W * (0.15 + i * 0.24), r = (6 + f.h(i + 20) * 8) * sc; const g = ctx.createRadialGradient(x, hY, 0, x, hY, r); g.addColorStop(0, hexA('#1a6aa8', 0.6)); g.addColorStop(1, hexA('#1a6aa8', 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, hY, r, Math.PI, 0); ctx.fill(); }
    // ложные солнца (паргелии) в ясный морозный день
    if (A.weather === 'clear' && A.sunElev > 2 && A.sunElev < 20 && f.night < 0.1) {
      const sunX = W * Math.min(0.98, Math.max(0.02, (A.sunAz - 45) / 270)), sunY = hY - Math.sin(A.sunElev * Math.PI / 180) * H * 0.42;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const dx of [-1, 1]) { const g = ctx.createRadialGradient(sunX + dx * H * 0.22, sunY, 0, sunX + dx * H * 0.22, sunY, H * 0.06); g.addColorStop(0, 'rgba(255,230,180,0.45)'); g.addColorStop(0.5, 'rgba(255,170,140,0.15)'); g.addColorStop(1, 'rgba(255,200,160,0)'); ctx.fillStyle = g; ctx.fillRect(sunX + dx * H * 0.22 - H * 0.06, sunY - H * 0.06, H * 0.12, H * 0.12); }
      ctx.strokeStyle = 'rgba(255,240,220,0.18)'; ctx.lineWidth = 3 * sc; ctx.beginPath(); ctx.arc(sunX, sunY, H * 0.22, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // радиомачта и тарелка вдали
    { const x = W * 0.62; ctx.strokeStyle = dim('#8a9098'); ctx.lineWidth = 1.6 * sc; ctx.beginPath(); ctx.moveTo(x - 8 * sc, hY + 2); ctx.lineTo(x, hY - H * 0.3); ctx.lineTo(x + 8 * sc, hY + 2); for (let k = 1; k < 10; k++) { const yy = hY - k * H * 0.03; const hw = 8 * sc * (1 - k / 10); ctx.moveTo(x - hw, yy); ctx.lineTo(x + hw, yy); } ctx.stroke(); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(x, hY - H * 0.3); ctx.lineTo(x - W * 0.08, hY); ctx.moveTo(x, hY - H * 0.3); ctx.lineTo(x + W * 0.08, hY); ctx.stroke(); if (Math.sin(t * 2.5) > 0) f.glow(x, hY - H * 0.3, 2.5 * sc, '#ff3030', 1); if (Math.sin(t * 2.5 + 1) > 0.3) f.glow(x, hY - H * 0.15, 1.6 * sc, '#ff3030', 0.8); }
    { const x = W * 0.42, y = hY - 2; ctx.fillStyle = dim('#e8eef2'); ctx.fillRect(x - 2 * sc, y - 16 * sc, 4 * sc, 16 * sc); ctx.save(); ctx.translate(x, y - 18 * sc); ctx.rotate(-0.6 + Math.sin(t * 0.1) * 0.1); ctx.beginPath(); ctx.ellipse(0, 0, 12 * sc, 5 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dim('#8a9098'); ctx.fillRect(-0.5 * sc, -10 * sc, 1 * sc, 10 * sc); ctx.restore(); }
    // ветряки на леднике
    turbine(f, W * 0.2, hY - 4, H * 0.14, 0); turbine(f, W * 0.26, hY - 2, H * 0.12, 2); turbine(f, W * 0.88, hY - 3, H * 0.13, 4);
    // вертолётная площадка с вертолётом
    { const x = W * 0.74, y = hY; ctx.fillStyle = dim('#3a4046'); ctx.beginPath(); ctx.ellipse(x, y, 30 * sc, 6 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = dim('#f0c040'); ctx.lineWidth = 1.2 * sc; ctx.beginPath(); ctx.ellipse(x, y, 22 * sc, 4.4 * sc, 0, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = dim('#e8701a'); ctx.beginPath(); ctx.ellipse(x, y - 8 * sc, 12 * sc, 5 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x + 8 * sc, y - 11 * sc, 16 * sc, 2.5 * sc); ctx.fillRect(x + 22 * sc, y - 15 * sc, 2 * sc, 6 * sc); ctx.fillStyle = f.win(61, '#c8e0f0'); ctx.beginPath(); ctx.ellipse(x - 6 * sc, y - 9 * sc, 4 * sc, 3 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dim('#3a4046'); ctx.fillRect(x - 1 * sc, y - 16 * sc, 2 * sc, 4 * sc); ctx.strokeStyle = dim('#2a2a2e'); ctx.lineWidth = 1.2 * sc; const rot = t * 0.4; ctx.beginPath(); ctx.moveTo(x - Math.cos(rot) * 20 * sc, y - 16 * sc - Math.sin(rot) * 2 * sc); ctx.lineTo(x + Math.cos(rot) * 20 * sc, y - 16 * sc + Math.sin(rot) * 2 * sc); ctx.stroke(); ctx.fillStyle = dim('#2a2a2e'); ctx.fillRect(x - 10 * sc, y - 3 * sc, 20 * sc, 1.5 * sc); if (f.night > 0.3) f.glow(x + 23 * sc, y - 15 * sc, 1.2 * sc, '#ff4040', f.night * (Math.floor(t * 2) % 2)); }
    // топливные баки
    for (let k = 0; k < 3; k++) { const x = W * 0.5 + k * 16 * sc; ctx.fillStyle = dim('#e8eef2'); ctx.beginPath(); ctx.ellipse(x, hY - 8 * sc, 7 * sc, 7 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x - 7 * sc, hY - 8 * sc, 14 * sc, 8 * sc); ctx.fillStyle = dim('#d8402a'); ctx.fillRect(x - 7 * sc, hY - 5 * sc, 14 * sc, 2 * sc); }
    // колония императорских пингвинов вдали на льду
    ctx.fillStyle = dim('#15171c', 0.5); for (let i = 0; i < 40; i++) { const px = W * (0.28 + f.h(i + 70) * 0.12), py = hY - 1 - f.h(i + 80) * 4 * sc; ctx.fillRect(px, py - 3 * sc, 1.4 * sc, 3 * sc); }
    // отражение сияния на стене ледника
    if (A.aurora > 0.05 && f.night > 0.3) { ctx.fillStyle = hexA('#60ffb0', 0.1 * A.aurora * f.night); ctx.fillRect(0, hY - H * 0.11, W, H * 0.11); }
    // алмазная пыль в морозный ясный день
    if (A.weather === 'clear' && f.night < 0.5) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 40; i++) { const x = (f.h(i) * W + t * 6 * sc) % W, y = f.h(i + 7) * H * 0.7; const a = Math.max(0, Math.sin(t * 5 + i * 2.3)) * 0.6; ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; ctx.fillRect(x, y, 1.5 * sc, 1.5 * sc); } ctx.restore(); }
  },

  farWater(f) {
    const { ctx, W, hY, waterY, sc, t, dim } = f;
    // айсберги
    const bergs: [number, number, number][] = [[0.08, 0.3, 40], [0.3, 0.5, 26], [0.52, 0.35, 34], [0.86, 0.55, 22], [0.68, 0.7, 18]];
    bergs.forEach(([qx, qy, s], i) => {
      const x = ((W * qx + t * 1.5 * sc) % (W + 100 * sc)) - 50 * sc, y = hY + (waterY - hY) * qy + Math.sin(t * 0.5 + i) * 1 * sc, w = s * sc;
      ctx.fillStyle = dim('#eef4f8', 0.5); ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - w * 0.7, y - w * 0.4); ctx.lineTo(x - w * 0.2, y - w * 0.6 * (1 + f.h(i) * 0.5)); ctx.lineTo(x + w * 0.3, y - w * 0.35); ctx.lineTo(x + w * 0.8, y - w * 0.5); ctx.lineTo(x + w, y); ctx.fill();
      ctx.fillStyle = hexA('#7ab0d8', 0.5); ctx.beginPath(); ctx.moveTo(x + w * 0.3, y - w * 0.35); ctx.lineTo(x + w * 0.8, y - w * 0.5); ctx.lineTo(x + w, y); ctx.lineTo(x + w * 0.3, y); ctx.fill();
      ctx.fillStyle = hexA('#5aa0d0', 0.35); ctx.beginPath(); ctx.ellipse(x, y + 2, w * 1.1, w * 0.18, 0, 0, Math.PI); ctx.fill();
    });
    // кит: фонтан и спина
    { const ph = (t * 0.06) % 1; if (ph < 0.5) { const u = ph / 0.5, x = W * 0.45, y = hY + (waterY - hY) * 0.6; ctx.fillStyle = dim('#2a3a44'); ctx.beginPath(); ctx.ellipse(x, y + 2 - Math.sin(u * Math.PI) * 6 * sc, 30 * sc, 5 * sc, 0, Math.PI, 0); ctx.fill(); if (u > 0.2 && u < 0.6) { const v = (u - 0.2) / 0.4; ctx.fillStyle = `rgba(255,255,255,${(0.6 * (1 - v)).toFixed(3)})`; for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(x + 6 * sc + (k - 3) * 3 * sc * v, y - 4 * sc - v * 26 * sc + Math.abs(k - 3) * 3 * sc * v, (2 + v * 3) * sc, 0, Math.PI * 2); ctx.fill(); } } if (u > 0.7) { ctx.fillStyle = dim('#2a3a44'); const fl = (u - 0.7) / 0.3; ctx.beginPath(); ctx.moveTo(x - 30 * sc, y + 2); ctx.lineTo(x - 36 * sc, y - 20 * sc * fl); ctx.lineTo(x - 22 * sc, y - 14 * sc * fl); ctx.lineTo(x - 18 * sc, y - 20 * sc * fl); ctx.lineTo(x - 14 * sc, y + 2); ctx.fill(); } } }
    // косатка: спинной плавник проходит через кадр
    { const ph = (t * 0.03) % 1; if (ph < 0.5) { const u = ph / 0.5; const ox = W * (0.1 + u * 0.8), oy = hY + (waterY - hY) * 0.5; const up = Math.max(0, Math.sin(u * Math.PI * 4)); ctx.fillStyle = dim('#15171c'); ctx.beginPath(); ctx.moveTo(ox - 8 * sc, oy); ctx.quadraticCurveTo(ox - 2 * sc, oy - 16 * sc * up, ox + 1 * sc, oy - 18 * sc * up); ctx.lineTo(ox + 6 * sc, oy); ctx.fill(); ctx.beginPath(); ctx.ellipse(ox, oy + 1, 18 * sc, 3 * sc * up, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = `rgba(255,255,255,${(0.5 * up).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(ox - 20 * sc, oy + 1, 10 * sc, 1.5 * sc, 0, 0, Math.PI * 2); ctx.fill(); } }
    // тюлень на льдине и пингвины, выпрыгивающие из воды
    { const x = W * 0.76, y = hY + (waterY - hY) * 0.85 + Math.sin(t * 0.8) * 1.5 * sc; ctx.fillStyle = dim('#eef4f8', 0.5); ctx.beginPath(); ctx.ellipse(x, y, 26 * sc, 5 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dim('#8a8a86'); ctx.beginPath(); ctx.ellipse(x - 2 * sc, y - 5 * sc, 14 * sc, 4.5 * sc, 0.05, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x + 11 * sc, y - 8 * sc + Math.sin(t) * 1, 3 * sc, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = hexA('#5a5a58', 0.5); for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(x - 8 * sc + k * 3.5 * sc, y - 5 * sc + (k % 2) * 2 * sc, 1 * sc, 0, Math.PI * 2); ctx.fill(); } }
    for (let k = 0; k < 3; k++) { const ph = (t * 0.5 + k * 0.2) % 1; if (ph > 0.3) continue; const u = ph / 0.3, x = W * 0.2 + k * 14 * sc + u * 24 * sc, y = hY + (waterY - hY) * 0.75 - Math.sin(u * Math.PI) * 12 * sc; ctx.save(); ctx.translate(x, y); ctx.rotate(-(0.5 - u) * 1.5); ctx.fillStyle = '#15171c'; ctx.beginPath(); ctx.ellipse(0, 0, 6 * sc, 2.2 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f2f2ee'; ctx.beginPath(); ctx.ellipse(0, 0.8 * sc, 4.5 * sc, 1.1 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  },

  building(f, b, x, w) {
    const { ctx, sc, gY: y, t, dim, night } = f;
    if (b === 'market') {
      // лаборатория: купол с аквариумом-витриной и антенной
      const r = w * 0.42;
      dome(f, x, y, r, '#dfe6ec', 3, { door: true, lab: true });
      // витрина с подсветкой аквариума
      ctx.fillStyle = hexA('#60c0ff', f.lit ? 0.5 : 0.25); ctx.fillRect(x + r * 0.3, y - r * 0.5, r * 0.4, r * 0.3);
      ctx.fillStyle = hexA('#ffffff', 0.5); for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + r * 0.35 + ((t * 8 + k * 11) % (r * 0.3)), y - r * 0.5 + r * 0.3 - ((t * 10 + k * 7) % (r * 0.28)), 0.8 * sc, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = dim('#3a8aa8'); ctx.beginPath(); const fx = x + r * 0.5 + Math.sin(t * 1.5) * r * 0.08; ctx.ellipse(fx, y - r * 0.36, 4 * sc, 1.6 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = dim('#8a9098'); ctx.lineWidth = 1.2 * sc; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y - r - 22 * sc); ctx.moveTo(x - 5 * sc, y - r - 18 * sc); ctx.lineTo(x + 5 * sc, y - r - 18 * sc); ctx.moveTo(x - 3 * sc, y - r - 14 * sc); ctx.lineTo(x + 3 * sc, y - r - 14 * sc); ctx.stroke();
      ctx.fillStyle = dim('#2a6aa0'); ctx.fillRect(x - 24 * sc, y - r * 0.9, 48 * sc, 8 * sc); ctx.fillStyle = dim('#f4f6f8'); ctx.font = `bold ${5 * sc}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('ЛАБОРАТОРИЯ · LAB', x, y - r * 0.9 + 6 * sc); ctx.textAlign = 'left';
      // приёмный стол с ящиками проб и пингвин-воришка
      ctx.fillStyle = dim('#8a9098'); ctx.fillRect(x + r + 4 * sc, y - 10 * sc, 26 * sc, 2 * sc); ctx.fillRect(x + r + 6 * sc, y - 8 * sc, 2 * sc, 8 * sc); ctx.fillRect(x + r + 26 * sc, y - 8 * sc, 2 * sc, 8 * sc);
      for (let k = 0; k < 3; k++) { ctx.fillStyle = dim('#e8701a'); ctx.fillRect(x + r + 6 * sc + k * 8 * sc, y - 16 * sc, 7 * sc, 6 * sc); ctx.fillStyle = dim('#c8d8e0'); ctx.beginPath(); ctx.ellipse(x + r + 9.5 * sc + k * 8 * sc, y - 17 * sc, 3 * sc, 1.2 * sc, 0, 0, Math.PI * 2); ctx.fill(); }
      penguin(f, x + r + 34 * sc, y, sc, { face: -1, walk: t * 5 });
      person(f, x + r + 16 * sc, y, '#d8402a', { face: 1, hat: '#2a3a5a' });
      if (f.lit) f.glow(x + r + 20 * sc, y - r * 0.3, 2.5 * sc, '#9ad8ff', night * 0.7);
      return y - r - 22 * sc;
    }
    if (b === 'shop') {
      const top = moduleBox(f, x, y, w * 0.66, w * 0.3, '#e8701a', 11, 'СКЛАД №3');
      // тарелка на крыше и бочки
      ctx.fillStyle = dim('#e8eef2'); ctx.save(); ctx.translate(x + w * 0.22, top - 2 * sc); ctx.rotate(-0.7); ctx.beginPath(); ctx.ellipse(0, 0, 8 * sc, 3.5 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); ctx.fillRect(x + w * 0.22 - 1 * sc, top - 2 * sc, 2 * sc, 4 * sc);
      for (let k = 0; k < 4; k++) { const bx = x + w * 0.3 + k * 9 * sc; ctx.fillStyle = dim(k % 2 ? '#2a6aa0' : '#d8402a'); ctx.beginPath(); ctx.ellipse(bx, y - 5.5 * sc, 4 * sc, 5.5 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dim('#1a1a1a'); ctx.fillRect(bx - 4 * sc, y - 8 * sc, 8 * sc, 1 * sc); ctx.fillRect(bx - 4 * sc, y - 3 * sc, 8 * sc, 1 * sc); }
      // снегоход
      const sx = x - w * 0.5; ctx.fillStyle = dim('#d8402a'); ctx.beginPath(); ctx.moveTo(sx - 14 * sc, y - 6 * sc); ctx.lineTo(sx + 10 * sc, y - 8 * sc); ctx.lineTo(sx + 12 * sc, y - 3 * sc); ctx.lineTo(sx - 14 * sc, y - 3 * sc); ctx.fill(); ctx.fillStyle = dim('#1a1a1c'); ctx.fillRect(sx - 10 * sc, y - 3 * sc, 20 * sc, 3 * sc); ctx.fillStyle = f.win(70, '#c8e0f0'); ctx.beginPath(); ctx.moveTo(sx + 4 * sc, y - 8 * sc); ctx.lineTo(sx + 8 * sc, y - 14 * sc); ctx.lineTo(sx + 12 * sc, y - 8 * sc); ctx.fill(); ctx.fillStyle = dim('#2a2a2e'); ctx.fillRect(sx - 4 * sc, y - 12 * sc, 10 * sc, 4 * sc); ctx.fillRect(sx - 18 * sc, y - 2 * sc, 8 * sc, 1.5 * sc);
      return top;
    }
    if (b === 'shipyard') {
      // ледокол у ледового причала + кран
      const h = w * 0.9, x0 = x - w * 0.6;
      const bob = Math.sin(t * 0.7) * 1 * sc;
      ctx.save(); ctx.translate(0, bob);
      ctx.fillStyle = dim('#b8322a'); ctx.beginPath(); ctx.moveTo(x0, y - h * 0.1); ctx.lineTo(x0 + w * 1.2, y - h * 0.14); ctx.lineTo(x0 + w * 1.28, y - h * 0.34); ctx.lineTo(x0 - w * 0.02, y - h * 0.3); ctx.fill();
      ctx.fillStyle = dim('#1e1e22'); ctx.beginPath(); ctx.moveTo(x0, y - h * 0.1); ctx.lineTo(x0 + w * 1.2, y - h * 0.14); ctx.quadraticCurveTo(x0 + w * 1.1, y + 10 * sc, x0 + w * 0.9, y + 12 * sc); ctx.lineTo(x0 + w * 0.1, y + 12 * sc); ctx.quadraticCurveTo(x0, y + 4 * sc, x0, y - h * 0.1); ctx.fill();
      ctx.fillStyle = dim('#f0ece4'); ctx.fillRect(x0 + w * 0.3, y - h * 0.62, w * 0.5, h * 0.3); ctx.fillRect(x0 + w * 0.4, y - h * 0.76, w * 0.3, h * 0.16);
      for (let k = 0; k < 6; k++) { ctx.fillStyle = f.win(k + 80); ctx.fillRect(x0 + w * (0.33 + k * 0.08), y - h * 0.56, w * 0.05, h * 0.07); }
      for (let k = 0; k < 4; k++) { ctx.fillStyle = f.win(k + 90); ctx.fillRect(x0 + w * (0.43 + k * 0.07), y - h * 0.72, w * 0.045, h * 0.06); }
      ctx.fillStyle = dim('#e8701a'); ctx.fillRect(x0 + w * 0.62, y - h * 0.94, w * 0.08, h * 0.2); ctx.fillStyle = dim('#1e1e22'); ctx.fillRect(x0 + w * 0.62, y - h * 0.94, w * 0.08, h * 0.03);
      if (f.random() < 0.08) f.smoke(x0 + w * 0.66, y - h * 0.96, 3 * sc, true);
      // вертолётная площадка на корме, мачта с радаром
      ctx.fillStyle = dim('#3a4046'); ctx.fillRect(x0 + w * 0.02, y - h * 0.36, w * 0.26, 2.5 * sc); ctx.strokeStyle = dim('#f0c040'); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x0 + w * 0.15, y - h * 0.345, 6 * sc, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = dim('#f0ece4'); ctx.lineWidth = 2 * sc; ctx.beginPath(); ctx.moveTo(x0 + w * 0.55, y - h * 0.76); ctx.lineTo(x0 + w * 0.55, y - h * 1.05); ctx.stroke(); ctx.save(); ctx.translate(x0 + w * 0.55, y - h * 1.0); ctx.rotate(t * 2); ctx.fillStyle = dim('#f0ece4'); ctx.fillRect(-8 * sc, -1 * sc, 16 * sc, 2 * sc); ctx.restore();
      ctx.fillStyle = dim('#f0ece4'); ctx.font = `bold ${5 * sc}px Inter, sans-serif`; ctx.fillText('ПОЛЯРНИК', x0 + w * 0.82, y - h * 0.2);
      // якорная цепь и трап
      ctx.strokeStyle = dim('#5a5a5e'); ctx.lineWidth = 1.5 * sc; ctx.setLineDash([2 * sc, 1.5 * sc]); ctx.beginPath(); ctx.moveTo(x0 + w * 1.2, y - h * 0.14); ctx.quadraticCurveTo(x0 + w * 1.3, y, x0 + w * 1.36, y + 8 * sc); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      ctx.fillStyle = dim('#8a9098'); ctx.beginPath(); ctx.moveTo(x0 + w * 0.9, y - h * 0.3 + bob); ctx.lineTo(x0 + w * 1.1, y - 2 * sc); ctx.lineTo(x0 + w * 1.14, y - 2 * sc); ctx.lineTo(x0 + w * 0.93, y - h * 0.3 + bob); ctx.fill();
      // кран на причале
      const cx = x0 + w * 1.22; ctx.strokeStyle = dim('#f0c040'); ctx.lineWidth = 4 * sc; ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y - h * 1.1); ctx.lineTo(cx - w * 0.6, y - h * 1.1); ctx.moveTo(cx, y - h * 0.92); ctx.lineTo(cx - w * 0.35, y - h * 1.1); ctx.stroke();
      const sway = Math.sin(t * 0.6) * 3 * sc; ctx.strokeStyle = dim('#2a2a2a'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - w * 0.45, y - h * 1.1); ctx.lineTo(cx - w * 0.45 + sway, y - h * 0.7); ctx.stroke(); ctx.fillStyle = dim('#e8701a'); ctx.fillRect(cx - w * 0.45 + sway - 8 * sc, y - h * 0.7, 16 * sc, 10 * sc);
      if (f.lit) f.glow(cx, y - h * 1.12, 2 * sc, '#ff4040', night * (0.5 + 0.5 * Math.sin(t * 3)));
      ctx.fillStyle = dim('#2a6aa0'); ctx.fillRect(x - 26 * sc, y - h * 1.22, 52 * sc, 8 * sc); ctx.fillStyle = dim('#f4f6f8'); ctx.font = `bold ${5 * sc}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('ЛЕДОВЫЙ ПРИЧАЛ', x, y - h * 1.22 + 6 * sc); ctx.textAlign = 'left';
      return y - h * 1.22;
    }
    // Кают-компания: главный купол, баня с паром, флаги наций
    const r = w * 0.5;
    dome(f, x, y, r, '#e8eef2', 21, { door: true });
    ctx.fillStyle = dim('#d8402a'); ctx.font = `bold ${5.5 * sc}px Georgia, serif`; ctx.textAlign = 'center'; ctx.fillText('КАЮТ-КОМПАНИЯ', x, y - r * 0.9 + 4 * sc); ctx.textAlign = 'left';
    // баня-пристройка с трубой и паром
    const bx = x + r + 2 * sc; ctx.fillStyle = dim('#8a6a4a'); ctx.fillRect(bx, y - 20 * sc, 26 * sc, 20 * sc); ctx.fillStyle = hexA('#000000', 0.2); for (let k = 0; k < 5; k++) ctx.fillRect(bx, y - 20 * sc + k * 4 * sc, 26 * sc, 1); ctx.fillStyle = dim('#e8eef2'); ctx.beginPath(); ctx.moveTo(bx - 2 * sc, y - 20 * sc); ctx.lineTo(bx + 13 * sc, y - 28 * sc); ctx.lineTo(bx + 28 * sc, y - 20 * sc); ctx.fill(); ctx.fillStyle = dim('#3a3a3e'); ctx.fillRect(bx + 18 * sc, y - 32 * sc, 4 * sc, 8 * sc); if (f.random() < 0.2) f.smoke(bx + 20 * sc, y - 34 * sc, 3 * sc); windowRectSmall(f, bx + 4 * sc, y - 15 * sc, 7 * sc, 6 * sc);
    door(f, bx + 16 * sc, y - 12 * sc, 7 * sc, 12 * sc, '#3a2a1c');
    // флаги наций на верёвке
    const fx0 = x - r - 20 * sc, fx1 = x + r + 30 * sc, fy = y - r - 10 * sc;
    ctx.strokeStyle = dim('#8a9098'); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(fx0, fy + 20 * sc); ctx.quadraticCurveTo((fx0 + fx1) / 2, fy + 8 * sc, fx1, fy + 24 * sc); ctx.stroke();
    const flagsN = [['#ffffff', '#1a3a9a', '#d8402a'], ['#d8402a', '#ffffff', '#d8402a'], ['#1a3a9a', '#f0c040'], ['#2a8a4a', '#ffffff', '#d8402a'], ['#000000', '#d8402a', '#f0c040'], ['#ffffff', '#d8402a'], ['#1a3a9a', '#ffffff', '#d8402a']];
    flagsN.forEach((cols, i) => { const q = (i + 0.5) / flagsN.length, px = fx0 + (fx1 - fx0) * q, py = fy + 20 * sc + (4 * sc) * q - Math.sin(q * Math.PI) * 6 * sc, wv = Math.sin(t * 4 + i) * 1.5 * sc; cols.forEach((c, k) => { ctx.fillStyle = dim(c); ctx.fillRect(px, py + k * (7 * sc / cols.length), 10 * sc + wv, 7 * sc / cols.length + 0.5); }); });
    ctx.fillStyle = dim('#8a9098'); ctx.fillRect(fx0 - 1 * sc, fy + 20 * sc, 2 * sc, y - fy - 20 * sc); ctx.fillRect(fx1 - 1 * sc, fy + 24 * sc, 2 * sc, y - fy - 24 * sc);
    // указатель расстояний
    const px = Math.max(40 * sc, x - r - 56 * sc); ctx.fillStyle = dim('#6a4a2a'); ctx.fillRect(px - 1.5 * sc, y - 52 * sc, 3 * sc, 52 * sc);
    const signs: [string, 1 | -1, string][] = [['МОСКВА 15 940', -1, '#f0ece4'], ['ОСЛО 14 100', 1, '#f0ece4'], ['ПОЛЮС 1 320', -1, '#f0c040'], ['ЗНАКОМАЯ ВОДА', 1, '#80d0ff']];
    signs.forEach(([txt, d, c], i) => { const sy = y - 50 * sc + i * 9 * sc; const L = 36 * sc; ctx.fillStyle = dim(c); ctx.beginPath(); ctx.moveTo(px, sy); ctx.lineTo(px + d * L, sy); ctx.lineTo(px + d * (L + 4 * sc), sy + 3.5 * sc); ctx.lineTo(px + d * L, sy + 7 * sc); ctx.lineTo(px, sy + 7 * sc); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#1a1a1c'; ctx.font = `bold ${3.2 * sc}px Inter, sans-serif`; ctx.textAlign = d > 0 ? 'left' : 'right'; ctx.fillText(txt, px + d * 3 * sc, sy + 5 * sc); ctx.textAlign = 'left'; });
    return y - r - 12 * sc;
  },

  extras(f) {
    const { ctx, W, sc, gY: y, t, dim } = f;
    // колония пингвинов
    for (let i = 0; i < 8; i++) { const px = W * 0.405 + i * 6 * sc + Math.sin(t * 0.3 + i) * 2 * sc; penguin(f, px, y, sc * (0.8 + f.h(i) * 0.3), { walk: t * 4 + i, face: i % 3 === 0 ? -1 : 1 }); if (i % 4 === 1) penguin(f, px + 4 * sc, y, sc * 0.8, { chick: true }); }
    // пингвин едет на пузе
    const sp = (t * 0.1) % 1; penguin(f, W * 0.6 + sp * W * 0.1, y, sc, { slide: true, face: 1 });
    // снежные заносы и сани
    ctx.fillStyle = dim('#f4f8fb', 0.4); for (let i = 0; i < 6; i++) { const sx = f.h(i + 70) * W, sw = (24 + f.h(i) * 40) * sc; ctx.beginPath(); ctx.ellipse(sx, y + 1, sw, 5 * sc, 0, Math.PI, 0); ctx.fill(); }
    const sx = W * 0.25; ctx.fillStyle = dim('#8a6a4a'); ctx.fillRect(sx - 14 * sc, y - 6 * sc, 28 * sc, 2 * sc); ctx.fillRect(sx - 12 * sc, y - 2 * sc, 26 * sc, 1.5 * sc); ctx.fillRect(sx - 12 * sc, y - 6 * sc, 1.5 * sc, 4 * sc); ctx.fillRect(sx + 10 * sc, y - 6 * sc, 1.5 * sc, 4 * sc); ctx.fillStyle = dim('#e8701a'); ctx.fillRect(sx - 10 * sc, y - 14 * sc, 10 * sc, 8 * sc); ctx.fillRect(sx + 1 * sc, y - 14 * sc, 10 * sc, 8 * sc);
    flag(f, W * 0.645, y, 1, ['#e87a20', '#f4f4f4'], 26, 16, '#e8eef2');
    flag(f, W * 0.79, y, 2, ['#1a3a9a', '#f4f4f4', '#d8402a'], 26, 18, '#e8eef2');
    // буровая тренога: учёный берёт керн льда
    { const bx = W * 0.23 + 18 * sc; ctx.strokeStyle = dim('#8a9098'); ctx.lineWidth = 1.4 * sc; for (const dx of [-8, 0, 8]) { ctx.beginPath(); ctx.moveTo(bx + dx * sc, y); ctx.lineTo(bx, y - 30 * sc); ctx.stroke(); } const dr = (t * 0.4) % 1; ctx.fillStyle = dim('#d8d8d8'); ctx.fillRect(bx - 1 * sc, y - 28 * sc + dr * 16 * sc, 2 * sc, 12 * sc); ctx.fillStyle = dim('#e8701a'); ctx.fillRect(bx - 4 * sc, y - 30 * sc + dr * 16 * sc, 8 * sc, 4 * sc); for (let k = 0; k < 3; k++) { ctx.fillStyle = dim('#c8e0f0'); ctx.fillRect(bx + 12 * sc + k * 4 * sc, y - 10 * sc, 2.5 * sc, 10 * sc); } }
    // метеозонд взлетает
    const bph = (t * 0.03) % 1; if (bph < 0.6) { const bx = W * 0.5 + bph * 60 * sc * f.A.windDir, by = y - 30 * sc - bph * 400 * sc; ctx.fillStyle = dim('#f4f6f8', 0.4); ctx.beginPath(); ctx.arc(bx, by, 7 * sc, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = dim('#8a9098'); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(bx, by + 7 * sc); ctx.lineTo(bx, by + 18 * sc); ctx.stroke(); ctx.fillStyle = dim('#e8701a'); ctx.fillRect(bx - 2 * sc, by + 18 * sc, 4 * sc, 3 * sc); }
  },

  props(f) {
    const { ctx, W, sc, gY: y, dim } = f;
    // ледовые тумбы, трос, ящики проб
    for (let x = 30 * sc; x < W; x += 85 * sc) { ctx.fillStyle = dim('#4a5058'); ctx.fillRect(x - 3 * sc, y - 7 * sc, 6 * sc, 7 * sc); ctx.fillStyle = dim('#f0c040'); ctx.fillRect(x - 3 * sc, y - 7 * sc, 6 * sc, 1.5 * sc); }
    for (let k = 0; k < 4; k++) { ctx.fillStyle = dim('#e8701a'); ctx.fillRect(W * 0.3 + k * 9 * sc, y - 7 * sc, 8 * sc, 7 * sc); ctx.strokeStyle = hexA('#000000', 0.3); ctx.lineWidth = 0.8; ctx.strokeRect(W * 0.3 + k * 9 * sc, y - 7 * sc, 8 * sc, 7 * sc); }
    // поморник на ящике
    const bx = W * 0.3 + 2 * sc; ctx.fillStyle = dim('#5a5a58', 0.7); ctx.beginPath(); ctx.ellipse(bx + 3 * sc, y - 9.5 * sc, 4 * sc, 2.4 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(bx + 6.5 * sc, y - 12 * sc, 1.8 * sc, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dim('#2a2a2a'); ctx.fillRect(bx + 8 * sc, y - 12.3 * sc, 2.4 * sc, 1 * sc);
  },

  moored(f) {
    const { ctx, W, waterY, sc, t, dim } = f;
    // зодиак у причала
    const zx = W * 0.3, zy = waterY + 3 * sc + Math.sin(t * 1.3) * 1.5 * sc;
    ctx.fillStyle = dim('#2a2a2e'); ctx.beginPath(); ctx.moveTo(zx - 22 * sc, zy - 6 * sc); ctx.lineTo(zx + 24 * sc, zy - 8 * sc); ctx.quadraticCurveTo(zx + 28 * sc, zy - 2 * sc, zx + 22 * sc, zy + 2 * sc); ctx.lineTo(zx - 20 * sc, zy + 2 * sc); ctx.quadraticCurveTo(zx - 24 * sc, zy - 2 * sc, zx - 22 * sc, zy - 6 * sc); ctx.fill();
    ctx.fillStyle = dim('#d8402a'); ctx.beginPath(); ctx.ellipse(zx, zy - 7 * sc, 24 * sc, 3.5 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dim('#1a1a1c'); ctx.fillRect(zx - 24 * sc, zy - 14 * sc, 5 * sc, 10 * sc);
    // льдины у берега
    for (let i = 0; i < 7; i++) { const ix = ((f.h(i + 30) * W + t * 3 * sc) % (W + 60)) - 30, iy = waterY + 8 * sc + f.h(i + 40) * 40 * sc, iw = (10 + f.h(i) * 24) * sc; ctx.fillStyle = dim('#eef4f8', 0.4); ctx.beginPath(); ctx.ellipse(ix, iy, iw, iw * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = hexA('#8ab8d8', 0.4); ctx.beginPath(); ctx.ellipse(ix, iy + 2, iw, iw * 0.2, 0, 0, Math.PI); ctx.fill(); }
  },

  locals(f) {
    const { W, sc, gY: y, t } = f;
    // учёные в красных парках, тюлень Уэдделла у причала
    person(f, W * 0.7 - 60 * sc, y, '#d8402a', { face: -1, carry: 'box', hat: '#2a3a5a' });
    person(f, W * 0.23, y, '#d8402a', { face: 1, hat: '#d8402a' });
    const { ctx, dim } = f; const sx = W * 0.465, sy = y;
    ctx.fillStyle = dim('#6a6a68'); ctx.beginPath(); ctx.ellipse(sx, sy - 4 * sc, 16 * sc, 5 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(sx + 13 * sc, sy - 7 * sc + Math.sin(t * 0.6) * 1.5, 3.5 * sc, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dim('#8a8a88'); ctx.beginPath(); ctx.ellipse(sx + 2 * sc, sy - 3 * sc, 10 * sc, 2.5 * sc, 0, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 8; k++) { ctx.fillStyle = hexA('#3a3a38', 0.6); ctx.beginPath(); ctx.arc(sx - 10 * sc + k * 3 * sc, sy - 5 * sc + (k % 2) * 2 * sc, 1 * sc, 0, Math.PI * 2); ctx.fill(); }
  },

  foreground(f) {
    const { ctx, W, H, sc, t } = f;
    // позёмка
    if (f.precipEnabled && f.A.wind > 4) { ctx.strokeStyle = `rgba(240,246,255,${(0.14 + f.A.wind * 0.012).toFixed(3)})`; ctx.lineWidth = 1; for (let i = 0; i < 26; i++) { const x = (((f.h(i) * W + f.windTravel * (70 + i * 9) * sc) % (W + 100)) + W + 100) % (W + 100) - 50, y = f.gY - f.h(i + 3) * 14 * sc + Math.sin(t * 3 + i) * 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 26 * sc * f.A.windDir, y - 1); ctx.stroke(); } }
    // изморозь по краям кадра
    const fr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
    fr.addColorStop(0, 'rgba(220,235,250,0)'); fr.addColorStop(1, 'rgba(220,235,250,0.22)');
    ctx.fillStyle = fr; ctx.fillRect(0, 0, W, H);
  },

  lamp(f, x) {
    const { ctx, sc, quayY, night, dim } = f;
    const ly = quayY - 60 * sc;
    ctx.fillStyle = dim('#4a5058'); ctx.fillRect(x - 1.5 * sc, ly, 3 * sc, 54 * sc); ctx.fillRect(x - 6 * sc, ly - 2 * sc, 12 * sc, 5 * sc);
    ctx.fillStyle = dim('#f0c040'); ctx.fillRect(x - 1.5 * sc, quayY - 20 * sc, 3 * sc, 6 * sc);
    if (night > 0.25) { f.glow(x, ly + 1 * sc, 4 * sc, '#dfe8ff', night * 0.9); f.pool(x, quayY, 80 * sc, '#c8d8ff', 0.18 * night); }
  },
};

function windowRectSmall(f: PF, x: number, y: number, w: number, h: number) {
  f.ctx.fillStyle = f.win(x); f.ctx.fillRect(x, y, w, h); f.ctx.strokeStyle = f.dim('#3a3a3e'); f.ctx.lineWidth = 1; f.ctx.strokeRect(x, y, w, h);
}
