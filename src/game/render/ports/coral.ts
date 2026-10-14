import { coralHillY } from '../portTerrain';
import type { PF, PortKit } from '../portFrame';
import { aerial, airplane, shoreLights } from '../portHorizon';
import { bunting, crate, door, hull, notes, palm, person, sign, windowRect } from '../portParts';
import { hexA, mix } from '../util';

function stiltHouse(f: PF, x: number, y: number, w: number, h: number, col: string, roofCol: string, seed: number, o: { porch?: boolean; shutters?: string } = {}) {
  const { ctx, sc } = f;
  const x0 = x - w / 2;
  ctx.fillStyle = f.dim('#4a3624'); for (let k = 0; k < 4; k++) ctx.fillRect(x0 + 3 * sc + (k / 3) * (w - 9 * sc), y - 14 * sc, 3 * sc, 16 * sc);
  const by = y - 14 * sc;
  if (o.porch) { ctx.fillStyle = f.dim('#8a6a4a'); ctx.fillRect(x0 - 12 * sc, by - 1, w + 24 * sc, 3 * sc); ctx.fillStyle = f.dim('#f8f4e8'); for (let k = 0; k < 8; k++) ctx.fillRect(x0 - 12 * sc + k * (w + 24 * sc) / 7, by - 10 * sc, 1.4 * sc, 9 * sc); ctx.fillRect(x0 - 12 * sc, by - 10 * sc, w + 24 * sc, 1.4 * sc); ctx.fillStyle = f.dim('#4a3624'); ctx.fillRect(x0 - 12 * sc, by, 3 * sc, 14 * sc); ctx.fillRect(x0 + w + 9 * sc, by, 3 * sc, 14 * sc); }
  ctx.fillStyle = f.dim(col); ctx.fillRect(x0, by - h, w, h);
  ctx.fillStyle = hexA('#000000', 0.08); for (let k = 0; k < h; k += 5 * sc) ctx.fillRect(x0, by - h + k, w, 0.8);
  // ржавая гофрированная крыша
  ctx.fillStyle = f.dim(roofCol); ctx.beginPath(); ctx.moveTo(x0 - 12 * sc, by - h + 2 * sc); ctx.lineTo(x, by - h - w * 0.34); ctx.lineTo(x0 + w + 12 * sc, by - h + 2 * sc); ctx.fill();
  ctx.strokeStyle = hexA('#000000', 0.18); ctx.lineWidth = 0.8; for (let k = 1; k < 12; k++) { ctx.beginPath(); ctx.moveTo(x0 - 12 * sc + (w + 24 * sc) * k / 12, by - h + 2 * sc); ctx.lineTo(x, by - h - w * 0.34); ctx.stroke(); }
  ctx.fillStyle = hexA('#a0522d', 0.35); ctx.beginPath(); ctx.moveTo(x0 + w * 0.6, by - h + 1); ctx.lineTo(x0 + w * 0.75, by - h - w * 0.16); ctx.lineTo(x0 + w * 0.9, by - h + 1); ctx.fill();
  for (let k = 0; k < 2; k++) {
    const wx = x0 + w * (0.14 + k * 0.5), wy = by - h * 0.75, ww = w * 0.22, wh = h * 0.36;
    windowRect(f, wx, wy, ww, wh, '#f8f4e8', seed + k);
    if (o.shutters) { ctx.fillStyle = f.dim(o.shutters); ctx.fillRect(wx - 4 * sc, wy, 4 * sc, wh); ctx.fillRect(wx + ww, wy, 4 * sc, wh); ctx.fillStyle = hexA('#000000', 0.2); for (let q = 1; q < 5; q++) { ctx.fillRect(wx - 4 * sc, wy + wh * q / 5, 4 * sc, 0.8); ctx.fillRect(wx + ww, wy + wh * q / 5, 4 * sc, 0.8); } }
  }
  return by - h - w * 0.34;
}

function crab(f: PF, x: number, y: number, s: number) {
  const { ctx, t } = f;
  ctx.fillStyle = f.dim('#e85a3a', 0.6);
  ctx.beginPath(); ctx.ellipse(x, y - 2 * s, 4 * s, 2.5 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.9 * s;
  for (let k = 0; k < 3; k++) { const dy = Math.sin(t * 12 + k) * 0.8 * s; ctx.beginPath(); ctx.moveTo(x - 3 * s, y - 2 * s); ctx.lineTo(x - 6 * s - k * s, y + dy); ctx.moveTo(x + 3 * s, y - 2 * s); ctx.lineTo(x + 6 * s + k * s, y - dy); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(x - 4 * s, y - 5 * s, 1.4 * s, 0, Math.PI * 2); ctx.arc(x + 4 * s, y - 5 * s, 1.4 * s, 0, Math.PI * 2); ctx.fill();
}

function torch(f: PF, x: number, y: number, h: number) {
  const { ctx, sc, t } = f;
  ctx.fillStyle = f.dim('#6a4a2a'); ctx.fillRect(x - 1.5 * sc, y - h, 3 * sc, h);
  ctx.fillStyle = f.dim('#3a2a1c'); ctx.beginPath(); ctx.moveTo(x - 4 * sc, y - h); ctx.lineTo(x + 4 * sc, y - h); ctx.lineTo(x + 3 * sc, y - h - 7 * sc); ctx.lineTo(x - 3 * sc, y - h - 7 * sc); ctx.fill();
  if (f.night > 0.2) {
    const fl = Math.sin(t * 11 + x) * 1.5 * sc, fh = (8 + Math.sin(t * 7 + x * 0.3) * 2) * sc;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,140,40,${(0.8 * f.night).toFixed(3)})`; ctx.beginPath(); ctx.moveTo(x - 3 * sc, y - h - 6 * sc); ctx.quadraticCurveTo(x + fl, y - h - 6 * sc - fh, x + 3 * sc, y - h - 6 * sc); ctx.fill();
    ctx.fillStyle = `rgba(255,230,120,${(0.9 * f.night).toFixed(3)})`; ctx.beginPath(); ctx.moveTo(x - 1.5 * sc, y - h - 6 * sc); ctx.quadraticCurveTo(x + fl * 0.6, y - h - 6 * sc - fh * 0.55, x + 1.5 * sc, y - h - 6 * sc); ctx.fill();
    ctx.restore();
    f.glow(x, y - h - 9 * sc, 3 * sc, '#ff9a40', f.night * 0.8);
    if (f.random() < 0.05) f.smoke(x, y - h - 12 * sc, 1.5 * sc, true);
  }
}

export const coralKit: PortKit = {
  layout: { market: 0.14, tavern: 0.34, shop: 0.53, dock: 0.7, shipyard: 0.88 },
  quay: 'sand',
  pal: { quay: '#e8d8b0', quayFace: '#c8b088', water: ['#40c8c8', '#0a5a78'], lamp: '#6a4a2a', lampLight: '#ff9a40' },
  walkers: { n: 7, cols: ['#f0e0b0', '#e06a4a', '#40a0b0', '#f0c040', '#d8a0c0', '#6ab07a'], speed: 0.85, hats: true },
  lampXs: [0.065, 0.46, 0.62, 0.8],
  birds: { kind: 'frigate', n: 3 },
  traffic: [
    { kind: 'pirogue', hull: '#f0c040', trim: '#8a6a4a', scale: 1.0, period: 38, lane: 0.62 },
    { kind: 'ferry', hull: '#f0f0ea', trim: '#40a0b0', scale: 0.7, period: 75, lane: 0.3, offset: 25 },
    { kind: 'zodiac', hull: '#2a2a2e', trim: '#f0c040', scale: 0.8, period: 22, lane: 0.5, offset: 7 },
  ],
  hotBoard: 0.075,
  lampTop: 50,
  hours: { market: [5, 13], shop: [8, 19], shipyard: [7, 17], tavern: [10, 27] },
  farShips: [
    { kind: 'cruise', depth: 0.12, period: 520, dir: 1, hull: '#1a2a3a' },
    { kind: 'sail', depth: 0.5, period: 100, dir: -1, offset: 20 },
    { kind: 'sail', depth: 0.68, period: 130, dir: 1, offset: 75 },
    { kind: 'ferry', depth: 0.3, period: 220, dir: -1, offset: 110, hull: '#f0f0ea' },
  ],

  horizon(f) {
    const { ctx, W, H, hY, sc, t } = f;
    // соседний атолл: низкая полоска песка с пальмами, видимая сквозь марево
    const ax0 = W * 0.52, ax1 = W * 0.8;
    ctx.fillStyle = aerial(f, '#f4ecd8', 0.9); ctx.beginPath(); ctx.moveTo(ax0, hY + 1); ctx.quadraticCurveTo((ax0 + ax1) / 2, hY - 3 * sc, ax1, hY + 1); ctx.fill();
    ctx.fillStyle = aerial(f, '#2f6a34', 0.88);
    for (let i = 0; i < 10; i++) { const x = ax0 + (ax1 - ax0) * (0.1 + i * 0.09) + f.h(i + 70) * 6; const h = (6 + f.h(i + 71) * 6) * sc; ctx.fillRect(x - 0.5 * sc, hY - h, 1 * sc, h); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.55 + Math.sin(t + i + k) * 0.05; ctx.beginPath(); ctx.moveTo(x, hY - h); ctx.lineTo(x + Math.cos(a) * 5 * sc, hY - h + Math.sin(a) * 3 * sc + 2 * sc); ctx.lineTo(x + Math.cos(a) * 3 * sc, hY - h + Math.sin(a) * 2 * sc + 3.5 * sc); ctx.fill(); } }
    // риф: полоса бурунов на горизонте — вода разбивается о внешний край
    for (let x = 0; x < W; x += 5 * sc) { const q = x / W; const inReef = q < 0.48 || q > 0.84; if (!inReef) continue; const a = Math.max(0, Math.sin(x * 0.05 + t * 2.2) * 0.5 + Math.sin(x * 0.017 - t * 1.4) * 0.5) * 0.7 * (1 - f.night * 0.5); ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; ctx.fillRect(x, hY + 2 * sc + Math.sin(q * 20) * 1.5 * sc, 4 * sc, 1.4 * sc * (0.5 + a)); }
    // лагуна между рифом и берегом — светлее
    { const g = ctx.createLinearGradient(0, hY + 2, 0, hY + (f.waterY - hY) * 0.25); g.addColorStop(0, hexA('#60e0e0', 0.35 * (1 - f.night * 0.8))); g.addColorStop(1, hexA('#60e0e0', 0)); ctx.fillStyle = g; ctx.fillRect(0, hY + 2, W, (f.waterY - hY) * 0.25); }
    // рыбаки по пояс в воде с сетью на мелководье
    for (let k = 0; k < 2; k++) { const x = W * (0.2 + k * 0.1) + Math.sin(t * 0.2 + k) * 6; const y = hY + (f.waterY - hY) * 0.12; ctx.fillStyle = aerial(f, '#5a3a2a', 0.6); ctx.fillRect(x - 1.5 * sc, y - 8 * sc, 3 * sc, 6 * sc); ctx.beginPath(); ctx.arc(x, y - 9.5 * sc, 1.8 * sc, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = aerial(f, '#c8a060', 0.6); ctx.beginPath(); ctx.ellipse(x, y - 11 * sc, 3 * sc, 1 * sc, 0, 0, Math.PI * 2); ctx.fill(); if (k === 0) { const th = (t * 0.5) % 1; ctx.strokeStyle = hexA('#f0e8d0', 0.5 * (1 - th)); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.ellipse(x + 8 * sc + th * 10 * sc, y - 2 * sc, 4 * sc + th * 10 * sc, 1.5 * sc + th * 3 * sc, 0, 0, Math.PI * 2); ctx.stroke(); } }
    // гидросамолёт низко над лагуной
    { const ph = (t % 70) / 70; const x = W + 40 * sc - (W + 80 * sc) * ph, y = H * 0.4 - Math.sin(ph * Math.PI) * H * 0.06; ctx.fillStyle = aerial(f, '#f0ece4', 0.7); ctx.fillRect(x - 6 * sc, y - 1 * sc, 12 * sc, 2 * sc); ctx.fillRect(x - 7 * sc, y - 3 * sc, 14 * sc, 1 * sc); ctx.fillRect(x - 4 * sc, y + 2 * sc, 7 * sc, 1 * sc); ctx.fillStyle = aerial(f, '#e06a4a', 0.7); ctx.fillRect(x - 6 * sc, y - 4 * sc, 2 * sc, 3 * sc); ctx.strokeStyle = hexA('#ffffff', 0.5); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x + 5 * sc, y - 1 * sc); ctx.lineTo(x + 5 * sc + Math.cos(t * 40) * 4 * sc, y - 1 * sc + Math.sin(t * 40) * 1 * sc); ctx.stroke(); }
    shoreLights(f, Array.from({ length: 6 }, (_, i) => [ax0 + (ax1 - ax0) * (0.15 + i * 0.14), 2, '#ffd890'] as [number, number, string]), hY - 1);
    airplane(f, 110, 0.06, 40);
  },

  signage(f) {
    // арка BIENVENIDOS у входа на пляж
    const { ctx, W, sc, gY: y, dim } = f;
    const x1 = W * 0.585, x2 = W * 0.625, top = y - 44 * sc;
    ctx.fillStyle = dim('#6a5238'); ctx.fillRect(x1 - 2 * sc, top, 4 * sc, y - top); ctx.fillRect(x2 - 2 * sc, top, 4 * sc, y - top);
    ctx.fillStyle = dim('#8a6a4a'); ctx.beginPath(); ctx.moveTo(x1 - 6 * sc, top + 2 * sc); ctx.quadraticCurveTo((x1 + x2) / 2, top - 14 * sc, x2 + 6 * sc, top + 2 * sc); ctx.lineTo(x2 + 6 * sc, top + 10 * sc); ctx.quadraticCurveTo((x1 + x2) / 2, top - 4 * sc, x1 - 6 * sc, top + 10 * sc); ctx.fill();
    ctx.fillStyle = dim('#f8f4e8'); ctx.font = `bold ${4 * sc}px Georgia, serif`; ctx.textAlign = 'center'; ctx.fillText('BIENVENIDOS', (x1 + x2) / 2, top + 1 * sc); ctx.fillText('PORT-CORAL', (x1 + x2) / 2, top + 6 * sc); ctx.textAlign = 'left';
    for (let k = 0; k < 6; k++) { ctx.fillStyle = dim(['#ff4a6a', '#ff8a30', '#f0c040'][k % 3]); ctx.beginPath(); ctx.arc(x1 + (k % 2 ? 3 : -3) * sc, y - 8 * sc - k * 6 * sc, 2 * sc, 0, Math.PI * 2); ctx.arc(x2 + (k % 2 ? -3 : 3) * sc, y - 10 * sc - k * 6 * sc, 2 * sc, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = dim('#2f6a34'); for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.ellipse(x1 + Math.sin(k) * 3 * sc, y - 5 * sc - k * 4.5 * sc, 2.4 * sc, 1.2 * sc, k, 0, Math.PI * 2); ctx.ellipse(x2 + Math.cos(k) * 3 * sc, y - 7 * sc - k * 4.5 * sc, 2.4 * sc, 1.2 * sc, k, 0, Math.PI * 2); ctx.fill(); }
    if (f.lit) for (let k = 0; k < 5; k++) f.glow(x1 + (x2 - x1) * ((k + 0.5) / 5), top - 6 * sc + Math.sin(k * 1.2) * 2 * sc, 1.3 * sc, ['#ff8a5a', '#ffd060', '#80d0ff'][k % 3], f.night);
  },

  events: [
    { id: 'launch', label: 'Выход пирог в море', from: 5.5, to: 8, draw(f) {
      const { ctx, W, sc, gY: y, waterY, t } = f;
      const ph = (t % 12) / 12;
      const drawPirogue = (px: number, py: number, s: number) => { ctx.fillStyle = f.dim('#f0c040'); ctx.beginPath(); ctx.moveTo(px - 20 * s, py - 4 * s); ctx.quadraticCurveTo(px, py - 9 * s, px + 20 * s, py - 4 * s); ctx.quadraticCurveTo(px, py + 1 * s, px - 20 * s, py - 4 * s); ctx.fill(); ctx.strokeStyle = f.dim('#8a6a4a'); ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.moveTo(px - 8 * s, py - 6 * s); ctx.lineTo(px - 8 * s, py - 13 * s); ctx.lineTo(px + 8 * s, py - 13 * s); ctx.lineTo(px + 8 * s, py - 6 * s); ctx.stroke(); ctx.fillStyle = f.dim('#8a6a4a'); ctx.fillRect(px - 14 * s, py - 14.5 * s, 28 * s, 2 * s); };
      if (ph < 0.55) { const q = ph / 0.55; const px = W * 0.25 + q * W * 0.17; ctx.fillStyle = hexA('#8a7050', 0.3); ctx.fillRect(W * 0.25 - 20 * sc, y, px - W * 0.25 + 20 * sc, 1.5 * sc); drawPirogue(px, y + 1, sc); person(f, px - 24 * sc, y, '#e06a4a', { walk: t * 6, face: 1, hat: '#c8a060' }); person(f, px + 24 * sc, y, '#40a0b0', { walk: t * 6 + 2, face: 1 }); }
      else { const q = (ph - 0.55) / 0.45; const px = W * 0.42 + q * W * 0.3, py = waterY + 6 * sc + q * 6 * sc; ctx.save(); ctx.globalAlpha = 1 - Math.max(0, q - 0.7) / 0.3; drawPirogue(px, py + Math.sin(t * 1.5) * 1.5 * sc, sc * (1 - q * 0.3)); person(f, px - 4 * sc, py - 4 * sc, '#e06a4a', { sit: true, face: 1, hat: '#c8a060', scale: 0.8 * (1 - q * 0.3) }); ctx.restore(); for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(255,255,255,${(0.3 * (1 - i / 6)).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(px - 20 * sc - i * 8 * sc, py + 2, 4 * sc, 1.2 * sc, 0, 0, Math.PI * 2); ctx.fill(); } }
    } },
    { id: 'siesta', label: 'Сиеста', from: 12.5, to: 15.5, activity: 0.3, draw(f) {
      const { ctx, W, sc, gY: y, t } = f;
      const hx = W * 0.345, hy = y - 13 * sc + Math.sin(t * 0.8) * 1.5;
      ctx.fillStyle = f.dim('#f0e0b0', 0.8); ctx.fillRect(hx - 9 * sc, hy - 3 * sc, 14 * sc, 4 * sc); ctx.fillStyle = f.dim('#e8c8a8', 0.8); ctx.beginPath(); ctx.arc(hx + 7 * sc, hy - 2 * sc, 2.6 * sc, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = f.dim('#c8a060'); ctx.beginPath(); ctx.ellipse(hx + 7 * sc, hy - 3 * sc, 3.6 * sc, 1.6 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = f.dim('#2a2a2a'); ctx.fillRect(hx - 12 * sc, hy - 2 * sc, 3 * sc, 1.6 * sc);
      notes(f, hx + 10 * sc, hy - 10 * sc, 2, '#f0ece4');
      person(f, W * 0.14 + 10 * sc, y, '#e06a4a', { sit: true, face: 1, hat: '#c8a060', scale: 0.85 });
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 12; i++) { const x = f.h(i + 990) * W, yy = y - 2 * sc - f.h(i + 991) * 10 * sc + Math.sin(t * 3 + i) * 1.5; ctx.fillStyle = `rgba(255,250,230,${(0.05 + 0.04 * Math.sin(t * 2 + i)).toFixed(3)})`; ctx.fillRect(x, yy, 30 * sc, 1 * sc); } ctx.restore();
    } },
    { id: 'fiesta', label: 'Фиеста', from: 18.5, to: 23.5, activity: 1.2, draw(f) {
      const { ctx, W, sc, gY: y, t } = f;
      const bx = W * 0.34 + 30 * sc;
      for (let k = 0; k < 2; k++) { const cx = bx + k * 34 * sc, sw = Math.sin(t * 3 + k * 1.5) * 4 * sc; person(f, cx - 4 * sc + sw, y, k ? '#f0c040' : '#e06a4a', { face: 1, scale: 0.95 }); person(f, cx + 4 * sc - sw, y, k ? '#40a0b0' : '#d8a0c0', { face: -1, scale: 0.95 }); ctx.fillStyle = f.dim(k ? '#e06a4a' : '#f0c040'); ctx.beginPath(); ctx.moveTo(cx + 4 * sc - sw, y - 6 * sc); ctx.lineTo(cx + 10 * sc - sw * 2, y); ctx.lineTo(cx - 2 * sc - sw * 0.5, y); ctx.fill(); }
      const jx = W * 0.6 - 30 * sc; person(f, jx, y, '#2a2a2a', { face: 1 });
      for (let k = 0; k < 3; k++) { const ph = (t * 1.2 + k / 3) % 1; const fx = jx - 6 * sc + ph * 12 * sc, fy = y - 16 * sc - Math.sin(ph * Math.PI) * 22 * sc; f.glow(fx, fy, 2.2 * sc, '#ff8a30', 0.9); ctx.fillStyle = '#fff0c0'; ctx.fillRect(fx - 0.8 * sc, fy - 0.8 * sc, 1.6 * sc, 1.6 * sc); }
      for (let k = 0; k < 4; k++) { const px = jx + 16 * sc + k * 8 * sc; person(f, px, y, ['#f0e0b0', '#6ab07a', '#d8a0c0', '#40a0b0'][k], { face: -1, hat: k % 2 ? '#c8a060' : undefined }); const clap = Math.sin(t * 8 + k) > 0 ? 1 : 0; ctx.fillStyle = f.dim('#e8c8a8', 0.8); ctx.fillRect(px - 4 * sc - clap * sc, y - 14 * sc, 1.6 * sc, 1.6 * sc); }
      notes(f, bx + 60 * sc, y - 26 * sc, 4, '#ffd060');
      bunting(f, W * 0.245, y - 70 * sc, W * 0.44, y - 72 * sc, 16 * sc, ['#ff8a5a', '#ffd060', '#80d0ff', '#ff6ab0'], 12, true);
    } },
    { id: 'biolum', label: 'Свечение планктона', from: 22, to: 28, draw(f) {
      if (f.night < 0.4) return;
      const { ctx, W, H, waterY, sc, t } = f;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let x = 0; x < W; x += 5 * sc) { const a = Math.max(0, Math.sin(x * 0.045 + t * 2.1) * 0.5 + Math.sin(x * 0.013 - t * 1.3) * 0.5) * f.night; if (a < 0.1) continue; ctx.fillStyle = `rgba(80,220,255,${(a * 0.7).toFixed(3)})`; ctx.fillRect(x, waterY + 1 + Math.sin(x * 0.2 + t * 3) * 1.2 * sc, 4 * sc, 1.6 * sc); }
      for (let i = 0; i < 30; i++) { const x = f.h(i + 1200) * W + Math.sin(t * 0.5 + i) * 6 * sc, y = waterY + 4 * sc + f.h(i + 1210) * (H - waterY) * 0.5; const a = Math.max(0, Math.sin(t * 2 + i * 1.3)) * f.night; ctx.fillStyle = `rgba(100,230,255,${(a * 0.8).toFixed(3)})`; ctx.fillRect(x, y, 1.6 * sc, 1.6 * sc); }
      ctx.restore();
    } },
  ],

  backRow(f) {
    const { ctx, W, sc, gY, dim, t } = f;
    const y = gY - 9 * sc;
    const haze = (c: string) => dim(mix(c, f.A.palette.skyHor, 0.2), 0.8);
    // ряд хижин на сваях ярких цветов
    const huts: [number, string, string][] = [[0.01, '#f080a0', '#8a6a5a'], [0.045, '#a0e060', '#a0522d'], [0.225, '#c090e0', '#8a6a5a'], [0.26, '#f0c040', '#a0522d'], [0.43, '#60c0d0', '#8a6a5a'], [0.465, '#f0a060', '#a0522d'], [0.6, '#e06a4a', '#8a6a5a'], [0.78, '#a0e060', '#a0522d'], [0.985, '#f080a0', '#8a6a5a']];
    for (const [qx, col, roof] of huts) {
      const x = W * qx, w = 22 * sc, h = 16 * sc;
      ctx.fillStyle = haze('#4a3624'); for (let k = 0; k < 3; k++) ctx.fillRect(x - w / 2 + 2 * sc + k * (w - 6 * sc) / 2, y - 8 * sc, 2 * sc, 9 * sc);
      ctx.fillStyle = haze(col); ctx.fillRect(x - w / 2, y - 8 * sc - h, w, h);
      ctx.fillStyle = haze(roof); ctx.beginPath(); ctx.moveTo(x - w / 2 - 5 * sc, y - 8 * sc - h + 1); ctx.lineTo(x, y - 8 * sc - h - w * 0.3); ctx.lineTo(x + w / 2 + 5 * sc, y - 8 * sc - h + 1); ctx.fill();
      ctx.fillStyle = f.win(qx * 100); ctx.fillRect(x - w * 0.3, y - 8 * sc - h * 0.75, w * 0.22, h * 0.4); ctx.fillStyle = haze('#f8f4e8'); ctx.fillRect(x + w * 0.1, y - 8 * sc - h * 0.8, w * 0.22, h * 0.8);
    }
    // белая церковь с колокольней и красной крышей
    { const x = W * 0.62, w = 30 * sc, h = 26 * sc; ctx.fillStyle = haze('#fbf8f0'); ctx.fillRect(x - w / 2, y - h, w, h); ctx.fillRect(x - w / 2 - 10 * sc, y - h - 16 * sc, 12 * sc, h + 16 * sc); ctx.fillStyle = haze('#c8452b'); ctx.beginPath(); ctx.moveTo(x - w / 2 - 2 * sc, y - h); ctx.lineTo(x + 2 * sc, y - h - 10 * sc); ctx.lineTo(x + w / 2 + 2 * sc, y - h); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - w / 2 - 12 * sc, y - h - 16 * sc); ctx.lineTo(x - w / 2 - 4 * sc, y - h - 26 * sc); ctx.lineTo(x - w / 2 + 4 * sc, y - h - 16 * sc); ctx.fill(); ctx.fillStyle = haze('#d8b060'); ctx.fillRect(x - w / 2 - 4.6 * sc, y - h - 32 * sc, 1.2 * sc, 6 * sc); ctx.fillRect(x - w / 2 - 6.5 * sc, y - h - 30 * sc, 5 * sc, 1.2 * sc); ctx.fillStyle = f.win(900); ctx.fillRect(x - w / 2 - 7 * sc, y - h - 12 * sc, 6 * sc, 7 * sc); ctx.beginPath(); ctx.arc(x - w / 2 - 4 * sc, y - h - 12 * sc, 3 * sc, Math.PI, 0); ctx.fill(); for (let k = 0; k < 3; k++) { ctx.fillStyle = f.win(901 + k); ctx.fillRect(x - w * 0.36 + k * w * 0.3, y - h * 0.7, w * 0.14, h * 0.45); ctx.beginPath(); ctx.arc(x - w * 0.36 + k * w * 0.3 + w * 0.07, y - h * 0.7, w * 0.07, Math.PI, 0); ctx.fill(); } const sw = Math.sin(t * 3) * (Math.sin(t * 0.17) > 0.92 ? 0.4 : 0.03); ctx.save(); ctx.translate(x - w / 2 - 4 * sc, y - h - 10 * sc); ctx.rotate(sw); ctx.fillStyle = haze('#b89040'); ctx.beginPath(); ctx.moveTo(-2 * sc, 0); ctx.lineTo(2 * sc, 0); ctx.lineTo(1.2 * sc, -3 * sc); ctx.lineTo(-1.2 * sc, -3 * sc); ctx.fill(); ctx.restore(); }
    // водонапорная башня и дайв-центр
    { const x = W * 0.8; ctx.fillStyle = haze('#8a8a86'); for (const dx of [-6, 6]) ctx.fillRect(x + dx * sc - 1 * sc, y - 40 * sc, 2 * sc, 40 * sc); ctx.fillStyle = haze('#d8d8d0'); ctx.beginPath(); ctx.ellipse(x, y - 44 * sc, 10 * sc, 8 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = haze('#60c0d0'); ctx.font = `bold ${3.5 * sc}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('CORAL', x, y - 43 * sc); ctx.textAlign = 'left'; }
    { const x = W * 0.33 + 60 * sc, w = 28 * sc, h = 18 * sc; ctx.fillStyle = haze('#f8f4e8'); ctx.fillRect(x - w / 2, y - h, w, h); ctx.fillStyle = haze('#a0522d'); ctx.fillRect(x - w / 2 - 2 * sc, y - h - 4 * sc, w + 4 * sc, 4 * sc); ctx.fillStyle = haze('#c8452b'); ctx.fillRect(x - w * 0.4, y - h * 0.8, w * 0.8, h * 0.32); ctx.fillStyle = haze('#f8f4e8'); ctx.beginPath(); ctx.moveTo(x - w * 0.4, y - h * 0.8); ctx.lineTo(x + w * 0.4, y - h * 0.48); ctx.lineTo(x + w * 0.4, y - h * 0.8); ctx.fill(); ctx.fillStyle = haze('#2a6a7a'); ctx.font = `bold ${3.4 * sc}px Inter, sans-serif`; ctx.fillText('DIVE', x - w * 0.18, y - h * 0.18); }
  },

  ground(f) {
    const { ctx, W, sc, gY, quayY, dim } = f;
    // следы на песке, ракушки, морская звезда, линия прилива с водорослями
    ctx.fillStyle = hexA('#8a7050', 0.28);
    for (let i = 0; i < 16; i++) { const x = W * 0.05 + i * W * 0.058, y = gY + 2 * sc + Math.sin(i * 1.3) * 3 * sc + 2 * sc; ctx.beginPath(); ctx.ellipse(x, y, 1.6 * sc, 1 * sc, 0, 0, Math.PI * 2); ctx.ellipse(x + 3 * sc, y + 1.5 * sc, 1.6 * sc, 1 * sc, 0, 0, Math.PI * 2); ctx.fill(); }
    for (let i = 0; i < 12; i++) { ctx.fillStyle = dim(['#f8f4e8', '#f0d0c0', '#e8c8a0'][i % 3]); ctx.beginPath(); ctx.ellipse(f.h(i + 800) * W, gY + 1 + f.h(i + 810) * 9 * sc, 1.6 * sc, 1.1 * sc, f.h(i) * 3, 0, Math.PI * 2); ctx.fill(); }
    { const sx = W * 0.615, sy = quayY + 1; ctx.fillStyle = dim('#f08060'); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a - 0.3) * 1.5 * sc, sy + Math.sin(a - 0.3) * 1 * sc); ctx.lineTo(sx + Math.cos(a) * 4 * sc, sy + Math.sin(a) * 2.4 * sc); ctx.lineTo(sx + Math.cos(a + 0.3) * 1.5 * sc, sy + Math.sin(a + 0.3) * 1 * sc); ctx.fill(); } }
    ctx.fillStyle = hexA('#3a5a3a', 0.4); for (let i = 0; i < 20; i++) ctx.fillRect(f.h(i + 820) * W, quayY + 3 * sc + Math.sin(i) * 1.5 * sc, (4 + f.h(i) * 10) * sc, 1.2 * sc);
    // замок из песка
    { const x = W * 0.245 + 40 * sc; ctx.fillStyle = dim('#d8c090'); ctx.fillRect(x - 6 * sc, gY - 5 * sc, 12 * sc, 5 * sc); ctx.fillRect(x - 7 * sc, gY - 7 * sc, 3 * sc, 2 * sc); ctx.fillRect(x - 1.5 * sc, gY - 7 * sc, 3 * sc, 2 * sc); ctx.fillRect(x + 4 * sc, gY - 7 * sc, 3 * sc, 2 * sc); ctx.fillStyle = dim('#e03030'); ctx.fillRect(x - 0.4 * sc, gY - 11 * sc, 0.8 * sc, 4 * sc); ctx.beginPath(); ctx.moveTo(x, gY - 11 * sc); ctx.lineTo(x + 3 * sc, gY - 10 * sc); ctx.lineTo(x, gY - 9 * sc); ctx.fill(); }
  },

  backdrop(f) {
    const { ctx, W, H, hY, sc, t, dim, A } = f;
    const sky = A.palette.skyHor;
    // второй вулканический остров далеко справа — только силуэт в мареве и облачная шапка
    { const x = W * 0.9, h = H * 0.13, hw = W * 0.16; ctx.fillStyle = dim(mix('#4a5a66', sky, 0.68), 0.45); ctx.beginPath(); ctx.moveTo(x - hw, hY + 2); ctx.lineTo(x - hw * 0.15, hY - h); ctx.lineTo(x + hw * 0.1, hY - h * 0.96); ctx.lineTo(x + hw, hY + 2); ctx.fill(); const cx = x - hw * 0.02, cy = hY - h - 6 * sc; ctx.fillStyle = hexA(mix('#ffffff', sky, 0.3), 0.55); for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(cx + (k - 2) * 9 * sc + Math.sin(t * 0.2 + k) * 2, cy + Math.abs(k - 2) * 1.5 * sc, (5 + (2 - Math.abs(k - 2)) * 2) * sc, 0, Math.PI * 2); ctx.fill(); } }
    // кучевые облака-башни над океаном у горизонта (тропическая конвекция)
    for (let i = 0; i < 3; i++) { const cx = W * (0.3 + i * 0.22) + Math.sin(t * 0.03 + i) * 10, cy = hY - H * 0.08, s = (14 + f.h(i + 300) * 10) * sc; ctx.fillStyle = hexA(mix('#ffffff', sky, 0.25 + f.night * 0.6), 0.75); ctx.beginPath(); ctx.arc(cx, cy - s * 0.6, s, 0, Math.PI * 2); ctx.arc(cx - s * 0.9, cy - s * 0.1, s * 0.7, 0, Math.PI * 2); ctx.arc(cx + s * 0.9, cy - s * 0.2, s * 0.75, 0, Math.PI * 2); ctx.arc(cx + s * 0.2, cy - s * 1.4, s * 0.6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = hexA(mix('#b8c0cc', sky, 0.3), 0.5); ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.3, s * 1.8, s * 0.3, 0, 0, Math.PI * 2); ctx.fill(); }
    // вулкан слева
    { const x = W * 0.18, h = H * 0.3, hw = W * 0.26;
      ctx.fillStyle = dim(mix('#4a4a56', sky, 0.3), 0.6); ctx.beginPath(); ctx.moveTo(x - hw, hY + 2); ctx.lineTo(x - hw * 0.1, hY - h); ctx.lineTo(x + hw * 0.08, hY - h * 0.98); ctx.lineTo(x + hw, hY + 2); ctx.fill();
      ctx.fillStyle = dim(mix('#3a6a44', sky, 0.25), 0.6); ctx.beginPath(); ctx.moveTo(x - hw, hY + 2); ctx.lineTo(x - hw * 0.45, hY - h * 0.5); ctx.lineTo(x - hw * 0.2, hY - h * 0.6); ctx.lineTo(x + hw * 0.3, hY - h * 0.5); ctx.lineTo(x + hw, hY + 2); ctx.fill();
      // лавовое свечение ночью и дым; в «день извержения» (раз в несколько дней) столб выше и идёт пепел
      const erupt = f.h(A.day * 3 + 1) > 0.62;
      if (f.night > 0.3) f.glow(x - hw * 0.01, hY - h * 0.98, (erupt ? 10 : 6) * sc, '#ff5a20', f.night * (0.5 + 0.3 * Math.sin(t * 2)));
      if (erupt) { ctx.strokeStyle = hexA('#ff6a30', 0.5 + 0.3 * f.night); ctx.lineWidth = 1.2 * sc; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x - hw * 0.01, hY - h * 0.97); ctx.quadraticCurveTo(x + (k - 1) * hw * 0.2, hY - h * 0.7, x + (k - 1) * hw * 0.42, hY - h * 0.35); ctx.stroke(); } }
      ctx.save(); for (let k = 0; k < (erupt ? 12 : 8); k++) { const q = ((t * 0.04 + k * 0.125) % 1); const px = x - hw * 0.01 + Math.sin(k * 2 + t * 0.3) * 10 * sc + q * 60 * sc * A.windDir, py = hY - h - q * (erupt ? 120 : 70) * sc, pr = (6 + q * (erupt ? 30 : 22)) * sc; ctx.fillStyle = `rgba(${erupt ? '110,100,100' : f.night > 0.5 ? '90,80,90' : '200,195,200'},${(0.3 * (1 - q)).toFixed(3)})`; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
    }
    // джунгли справа, холмы
    ctx.fillStyle = dim(mix('#2f6a3a', sky, 0.2), 0.65); ctx.beginPath(); ctx.moveTo(W * 0.5, hY + 2); ctx.quadraticCurveTo(W * 0.72, hY - H * 0.14, W * 0.9, hY - H * 0.06); ctx.quadraticCurveTo(W * 0.96, hY - H * 0.03, W * 1.02, hY - H * 0.08); ctx.lineTo(W, hY + 2); ctx.fill();
    for (let i = 0; i < 9; i++) { const q = 0.52 + i * 0.055; const x = W * q; palm(f, x, coralHillY(W, H, hY, x) + 3 * sc, (22 + f.h(i) * 14) * sc, (f.h(i + 3) - 0.5) * 16, i); }
    // белый пляж вдоль берега, зонтики и лежаки
    ctx.fillStyle = dim('#f4ecd8', 0.5); ctx.beginPath(); ctx.moveTo(W * 0.3, hY + 2); ctx.quadraticCurveTo(W * 0.6, hY - 4 * sc, W, hY + 2); ctx.lineTo(W, hY + 6 * sc); ctx.lineTo(W * 0.3, hY + 6 * sc); ctx.fill();
    for (let k = 0; k < 4; k++) { const ux = W * (0.66 + k * 0.07), uy = hY - 1; ctx.fillStyle = dim('#8a6a4a'); ctx.fillRect(ux - 0.5 * sc, uy - 9 * sc, 1 * sc, 9 * sc); ctx.fillStyle = dim(['#e06a4a', '#40a0b0', '#f0c040', '#d8a0c0'][k]); ctx.beginPath(); ctx.ellipse(ux, uy - 9 * sc, 7 * sc, 2.6 * sc, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = dim('#f8f4e8'); ctx.fillRect(ux - 6 * sc, uy - 2 * sc, 7 * sc, 1.6 * sc); ctx.fillStyle = dim('#c88a5a'); ctx.beginPath(); ctx.ellipse(ux - 2.5 * sc, uy - 2.6 * sc, 3 * sc, 1 * sc, 0, 0, Math.PI * 2); ctx.fill(); }
    // линия прибоя на рифе
    ctx.fillStyle = `rgba(255,255,255,${(0.5 * (1 - f.night * 0.5)).toFixed(3)})`;
    for (let x = 0; x < W; x += 6 * sc) { const q = x / W; const a = Math.max(0, Math.sin(x * 0.03 + t * 1.5) * 0.5 + Math.sin(x * 0.011 - t) * 0.5); ctx.fillRect(x, hY + 8 * sc + Math.sin(q * 6) * 3 * sc, 5 * sc, 1.2 * a * sc); }
    // фрегат в небе
    const bx = W * 0.5 + Math.sin(t * 0.1) * W * 0.3, by = H * 0.18 + Math.cos(t * 0.13) * 20;
    ctx.strokeStyle = dim('#1a1a1a', 0.5); ctx.lineWidth = 1.2 * sc; ctx.beginPath(); ctx.moveTo(bx - 14 * sc, by - 2 * sc); ctx.quadraticCurveTo(bx - 6 * sc, by - 6 * sc, bx, by); ctx.quadraticCurveTo(bx + 6 * sc, by - 6 * sc, bx + 14 * sc, by - 2 * sc); ctx.moveTo(bx, by); ctx.lineTo(bx - 2 * sc, by + 6 * sc); ctx.moveTo(bx, by); ctx.lineTo(bx + 2 * sc, by + 6 * sc); ctx.stroke();
  },

  farWater(f) {
    const { ctx, W, hY, waterY, sc, t, dim } = f;
    // кораллы сквозь воду
    ctx.save(); ctx.globalAlpha = 0.35 * (1 - f.night * 0.7);
    const cols = ['#e86a5a', '#f0b040', '#a060c0', '#40b0a0', '#f08080'];
    for (let i = 0; i < 18; i++) { const x = f.h(i + 11) * W, y = hY + (waterY - hY) * (0.45 + f.h(i + 23) * 0.5), r = (5 + f.h(i) * 9) * sc; ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2); ctx.fill(); if (i % 3 === 0) { ctx.strokeStyle = cols[(i + 1) % cols.length]; ctx.lineWidth = 1.2 * sc; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + (k - 1.5) * 3 * sc, y); ctx.lineTo(x + (k - 1.5) * 4 * sc, y - r * (0.6 + f.h(k + i) * 0.5)); ctx.stroke(); } } }
    ctx.restore();
    // морская черепаха под поверхностью
    { const tx = W * 0.5 + Math.sin(t * 0.08) * W * 0.2, ty = hY + (waterY - hY) * 0.75; ctx.save(); ctx.globalAlpha = 0.45 * (1 - f.night * 0.6); ctx.fillStyle = dim('#3a7a4a'); ctx.beginPath(); ctx.ellipse(tx, ty, 10 * sc, 5 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(tx + 11 * sc, ty, 2.6 * sc, 0, Math.PI * 2); ctx.fill(); const fl = Math.sin(t * 2) * 3 * sc; ctx.beginPath(); ctx.ellipse(tx - 2 * sc, ty - 5 * sc - fl, 6 * sc, 1.8 * sc, -0.5, 0, Math.PI * 2); ctx.ellipse(tx - 2 * sc, ty + 5 * sc + fl, 6 * sc, 1.8 * sc, 0.5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    // дельфины — выпрыгивают по очереди
    for (let k = 0; k < 2; k++) {
      const ph = ((t * 0.25 + k * 0.5) % 1); if (ph > 0.35) continue;
      const u = ph / 0.35, dx = W * (0.3 + k * 0.25) + u * 60 * sc, dy = hY + (waterY - hY) * 0.3 - Math.sin(u * Math.PI) * 26 * sc, ang = -(0.5 - u) * 1.6;
      ctx.save(); ctx.translate(dx, dy); ctx.rotate(ang); ctx.fillStyle = dim('#5a7a8a'); ctx.beginPath(); ctx.ellipse(0, 0, 11 * sc, 3.6 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(-1 * sc, -3 * sc); ctx.lineTo(2 * sc, -8 * sc); ctx.lineTo(4 * sc, -3 * sc); ctx.fill(); ctx.beginPath(); ctx.moveTo(-10 * sc, 0); ctx.lineTo(-15 * sc, -4 * sc); ctx.lineTo(-15 * sc, 4 * sc); ctx.fill(); ctx.restore();
      if (u < 0.15 || u > 0.85) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(dx, hY + (waterY - hY) * 0.3 + 2, 12 * sc, 2.5 * sc, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    // катамаран под парусом вдали
    const cx = W * 0.8 - ((t * 5 * sc) % (W * 0.5)), cy = hY + (waterY - hY) * 0.2;
    ctx.fillStyle = dim('#f0f0ea'); ctx.fillRect(cx - 14 * sc, cy - 3 * sc, 28 * sc, 3 * sc); ctx.beginPath(); ctx.moveTo(cx - 2 * sc, cy - 3 * sc); ctx.lineTo(cx - 2 * sc, cy - 34 * sc); ctx.lineTo(cx + 12 * sc, cy - 4 * sc); ctx.fill();
    ctx.fillStyle = dim('#e06a4a'); ctx.beginPath(); ctx.moveTo(cx - 3 * sc, cy - 3 * sc); ctx.lineTo(cx - 3 * sc, cy - 26 * sc); ctx.lineTo(cx - 14 * sc, cy - 4 * sc); ctx.fill();
  },

  building(f, b, x, w) {
    const { ctx, sc, gY: y, t, dim, night } = f;
    const x0 = x - w / 2;
    if (b === 'market') {
      // базар под плетёными навесами
      const h = w * 0.55;
      ctx.fillStyle = dim('#6a5238'); for (let k = 0; k < 5; k++) ctx.fillRect(x0 + (k / 4) * (w - 3 * sc), y - h * 0.8, 3 * sc, h * 0.8);
      // плетёная крыша
      ctx.fillStyle = dim('#c8a060'); ctx.beginPath(); ctx.moveTo(x0 - 10 * sc, y - h * 0.72); ctx.lineTo(x, y - h - 4 * sc); ctx.lineTo(x0 + w + 10 * sc, y - h * 0.72); ctx.lineTo(x0 + w + 10 * sc, y - h * 0.66); ctx.lineTo(x0 - 10 * sc, y - h * 0.66); ctx.fill();
      ctx.strokeStyle = hexA('#5a3a1a', 0.5); ctx.lineWidth = 0.8; for (let k = 0; k < 16; k++) { ctx.beginPath(); ctx.moveTo(x0 - 10 * sc + (w + 20 * sc) * k / 16, y - h * 0.66); ctx.lineTo(x, y - h - 2 * sc); ctx.stroke(); }
      for (let k = 0; k < 8; k++) { const q = k / 8; ctx.beginPath(); ctx.moveTo(x - (w / 2 + 10 * sc) * (1 - q), y - h * 0.72 - (h * 0.28 + 4 * sc) * q); ctx.lineTo(x + (w / 2 + 10 * sc) * (1 - q), y - h * 0.72 - (h * 0.28 + 4 * sc) * q); ctx.stroke(); }
      // цветные ткани между столбами
      for (let k = 0; k < 4; k++) { const cx0 = x0 + (k / 4) * (w - 3 * sc), cw = (w - 3 * sc) / 4; ctx.fillStyle = dim(['#e06a4a', '#f0c040', '#40a0b0', '#d8a0c0'][k]); ctx.beginPath(); ctx.moveTo(cx0 + 3 * sc, y - h * 0.64); ctx.quadraticCurveTo(cx0 + cw / 2, y - h * 0.5 + Math.sin(t * 2 + k) * 2, cx0 + cw, y - h * 0.64); ctx.lineTo(cx0 + cw, y - h * 0.6); ctx.quadraticCurveTo(cx0 + cw / 2, y - h * 0.46 + Math.sin(t * 2 + k) * 2, cx0 + 3 * sc, y - h * 0.6); ctx.fill(); }
      // прилавки с фруктами и рыбой
      ctx.fillStyle = dim('#8a6a4a'); ctx.fillRect(x0, y - h * 0.26, w, h * 0.26);
      ctx.fillStyle = hexA('#000000', 0.15); for (let k = 0; k < 10; k++) ctx.fillRect(x0 + k * w / 10, y - h * 0.26, 1, h * 0.26);
      const fruit = [['#f0c040', 3], ['#e8601a', 3.5], ['#60b040', 3], ['#f0a030', 3.2], ['#d83a30', 2.6]] as [string, number][];
      for (let k = 0; k < 5; k++) { const bx = x0 + w * (0.1 + k * 0.2); ctx.fillStyle = dim('#c8a060'); ctx.beginPath(); ctx.ellipse(bx, y - h * 0.27, 8 * sc, 3 * sc, 0, 0, Math.PI); ctx.fill(); ctx.fillStyle = dim(fruit[k][0]); for (let q = 0; q < 5; q++) { ctx.beginPath(); ctx.arc(bx + (q - 2) * 3 * sc, y - h * 0.28 - (q % 2) * 2.5 * sc, fruit[k][1] * sc * 0.6, 0, Math.PI * 2); ctx.fill(); } }
      // подвешенная рыба и связки бананов
      for (let k = 0; k < 5; k++) { const fx = x0 + w * (0.12 + k * 0.19), sw = Math.sin(t * 1.5 + k) * 1 * sc; ctx.strokeStyle = dim('#3a3a3a'); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(fx, y - h * 0.64); ctx.lineTo(fx + sw, y - h * 0.5); ctx.stroke(); ctx.fillStyle = dim(k % 2 ? '#c0d8e0' : '#f0d060'); ctx.beginPath(); ctx.ellipse(fx + sw, y - h * 0.44, 2.6 * sc, 6 * sc, 0, 0, Math.PI * 2); ctx.fill(); }
      // торговка
      person(f, x0 + w * 0.5, y - h * 0.26 + 14 * sc, '#e06a4a', { face: 1, hat: '#c8a060', scale: 0.85 });
      // попугай на балке
      { const px = x0 + w * 0.78, py = y - h * 0.66; ctx.fillStyle = dim('#e03030'); ctx.beginPath(); ctx.ellipse(px, py - 4 * sc, 2.4 * sc, 4 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dim('#2a6ad0'); ctx.beginPath(); ctx.ellipse(px - 1 * sc, py - 3 * sc, 1.4 * sc, 3 * sc, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dim('#f0c040'); ctx.beginPath(); ctx.arc(px + 0.5 * sc, py - 8.5 * sc + Math.sin(t * 3) * 0.5, 1.6 * sc, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dim('#2a2a2a'); ctx.fillRect(px + 1.5 * sc, py - 9 * sc, 1.6 * sc, 1.2 * sc); ctx.fillStyle = dim('#2a6ad0'); ctx.fillRect(px - 1 * sc, py, 1 * sc, 6 * sc); }
      ctx.fillStyle = dim('#f8f4e8'); ctx.fillRect(x - 20 * sc, y - h - 2 * sc, 40 * sc, 8 * sc); ctx.fillStyle = dim('#e06a4a'); ctx.font = `bold ${5.5 * sc}px Georgia, serif`; ctx.textAlign = 'center'; ctx.fillText('MERCADO · БАЗАР', x, y - h + 4 * sc); ctx.textAlign = 'left';
      if (f.lit) { for (let k = 0; k < 5; k++) f.glow(x0 + w * (0.1 + k * 0.2), y - h * 0.62, 1.8 * sc, '#ffd060', night * 0.8); f.pool(x, y - h * 0.3, w * 0.6, '#ffc060', 0.22 * night); }
      return y - h - 4 * sc;
    }
    if (b === 'shop') {
      const top = stiltHouse(f, x, y, w * 0.6, w * 0.5, '#40a0b0', '#8a6a5a', 7, { porch: true, shutters: '#f0c040' });
      // удочки и доска у перил, гамак под домом
      ctx.strokeStyle = dim('#3a2a1c'); ctx.lineWidth = 1 * sc; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x - w * 0.3 - 8 * sc + k * 4 * sc, y - 14 * sc); ctx.lineTo(x - w * 0.3 - 4 * sc + k * 4 * sc, y - 14 * sc - 30 * sc); ctx.stroke(); }
      ctx.fillStyle = dim('#f0e0b0'); ctx.beginPath(); ctx.ellipse(x + w * 0.3 + 14 * sc, y - 24 * sc, 3 * sc, 14 * sc, 0.15, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dim('#e06a4a'); ctx.fillRect(x + w * 0.3 + 12.5 * sc, y - 30 * sc, 3 * sc, 12 * sc);
      door(f, x - w * 0.07, y - 14 * sc - w * 0.2, w * 0.14, w * 0.2, '#f8f4e8');
      sign(f, x + w * 0.3, y - 14 * sc - w * 0.42, 18 * sc, 12 * sc, '#f0c040', (c) => { c.fillStyle = '#2a6a7a'; c.font = `bold ${6 * sc}px Georgia, serif`; c.textAlign = 'center'; c.fillText('РИФ', 0, 2.2 * sc); }, 2);
      // ступеньки
      ctx.fillStyle = dim('#8a6a4a'); for (let k = 0; k < 4; k++) ctx.fillRect(x - w * 0.3 - 20 * sc - k * 4 * sc, y - 12 * sc + k * 3.5 * sc, 10 * sc, 2.5 * sc);
      // гамак
      ctx.strokeStyle = dim('#f0e0b0'); ctx.lineWidth = 1.2 * sc; ctx.beginPath(); ctx.moveTo(x - w * 0.27, y - 12 * sc); ctx.quadraticCurveTo(x, y - 2 * sc + Math.sin(t) * 1, x + w * 0.27, y - 12 * sc); ctx.stroke();
      return top;
    }
    if (b === 'shipyard') {
      // верфь дяди Тоби: навес на столбах, катамаран наполовину покрашен
      const h = w * 0.7;
      ctx.fillStyle = dim('#6a5238'); for (let k = 0; k < 4; k++) ctx.fillRect(x0 + (k / 3) * (w - 3 * sc), y - h * 0.82, 3 * sc, h * 0.82);
      ctx.fillStyle = dim('#b89a5a'); ctx.beginPath(); ctx.moveTo(x0 - 12 * sc, y - h * 0.78); ctx.lineTo(x, y - h - 2 * sc); ctx.lineTo(x0 + w + 12 * sc, y - h * 0.78); ctx.lineTo(x0 + w + 12 * sc, y - h * 0.72); ctx.lineTo(x0 - 12 * sc, y - h * 0.72); ctx.fill();
      ctx.strokeStyle = hexA('#5a3a1a', 0.45); ctx.lineWidth = 0.8; for (let k = 0; k < 14; k++) { ctx.beginPath(); ctx.moveTo(x0 - 12 * sc + (w + 24 * sc) * k / 14, y - h * 0.72); ctx.lineTo(x, y - h); ctx.stroke(); }
      // блоки и два корпуса катамарана
      ctx.fillStyle = dim('#5a4a3a'); for (const q of [0.15, 0.4, 0.6, 0.85]) ctx.fillRect(x0 + w * q - 4 * sc, y - 8 * sc, 8 * sc, 8 * sc);
      const paintQ = 0.55 + Math.sin(t * 0.1) * 0.05;
      const drawHull = (yy: number, k: number) => { ctx.fillStyle = dim('#f0f0ea'); ctx.beginPath(); ctx.moveTo(x0 + w * 0.06, yy); ctx.lineTo(x0 + w * 0.94, yy - 3 * sc); ctx.quadraticCurveTo(x0 + w * 0.9, yy + 12 * sc, x0 + w * 0.7, yy + 13 * sc); ctx.lineTo(x0 + w * 0.2, yy + 13 * sc); ctx.quadraticCurveTo(x0 + w * 0.06, yy + 8 * sc, x0 + w * 0.06, yy); ctx.fill(); ctx.save(); ctx.beginPath(); ctx.rect(x0, yy - 5 * sc, w * paintQ * k, 20 * sc); ctx.clip(); ctx.fillStyle = dim('#40a0b0'); ctx.beginPath(); ctx.moveTo(x0 + w * 0.06, yy); ctx.lineTo(x0 + w * 0.94, yy - 3 * sc); ctx.quadraticCurveTo(x0 + w * 0.9, yy + 12 * sc, x0 + w * 0.7, yy + 13 * sc); ctx.lineTo(x0 + w * 0.2, yy + 13 * sc); ctx.quadraticCurveTo(x0 + w * 0.06, yy + 8 * sc, x0 + w * 0.06, yy); ctx.fill(); ctx.restore(); ctx.fillStyle = dim('#f0c040'); ctx.fillRect(x0 + w * 0.08, yy + 3 * sc, w * paintQ * k - w * 0.04, 1.6 * sc); };
      drawHull(y - 26 * sc, 1); drawHull(y - 8 * sc - 13 * sc, 0.8);
      ctx.fillStyle = dim('#8a6a4a'); ctx.fillRect(x0 + w * 0.2, y - 32 * sc, w * 0.6, 4 * sc);
      // маляр
      const px = x0 + w * paintQ; person(f, px, y, '#f0e0b0', { face: 1, hat: '#c8a060' });
      ctx.fillStyle = dim('#40a0b0'); ctx.fillRect(px + 3 * sc, y - 20 * sc + Math.sin(t * 5) * 4 * sc, 4 * sc, 2 * sc);
      for (let k = 0; k < 3; k++) { ctx.fillStyle = dim(['#40a0b0', '#f0c040', '#e06a4a'][k]); ctx.fillRect(x0 + w * 0.9 + k * 7 * sc, y - 6 * sc, 5 * sc, 6 * sc); ctx.fillStyle = dim('#8a8a8a'); ctx.fillRect(x0 + w * 0.9 + k * 7 * sc, y - 7 * sc, 5 * sc, 1.2 * sc); }
      // пироги с балансиром на песке
      for (let k = 0; k < 2; k++) { const bx = x0 + w * 1.04 + k * 24 * sc, by = y + 2 * sc; ctx.fillStyle = dim(k ? '#e06a4a' : '#6a4a2a'); ctx.beginPath(); ctx.moveTo(bx - 16 * sc, by - 4 * sc); ctx.quadraticCurveTo(bx, by - 10 * sc, bx + 16 * sc, by - 4 * sc); ctx.quadraticCurveTo(bx, by + 2 * sc, bx - 16 * sc, by - 4 * sc); ctx.fill(); ctx.strokeStyle = dim('#8a6a4a'); ctx.lineWidth = 1.2 * sc; ctx.beginPath(); ctx.moveTo(bx - 8 * sc, by - 6 * sc); ctx.lineTo(bx - 8 * sc, by - 14 * sc); ctx.lineTo(bx + 8 * sc, by - 14 * sc); ctx.lineTo(bx + 8 * sc, by - 6 * sc); ctx.stroke(); ctx.fillStyle = dim('#8a6a4a'); ctx.fillRect(bx - 12 * sc, by - 15.5 * sc, 24 * sc, 2 * sc); }
      ctx.fillStyle = dim('#f8f4e8'); ctx.fillRect(x - 24 * sc, y - h, 48 * sc, 8 * sc); ctx.fillStyle = dim('#2a6a7a'); ctx.font = `bold ${5 * sc}px Georgia, serif`; ctx.textAlign = 'center'; ctx.fillText('ВЕРФЬ ДЯДИ ТОБИ', x, y - h + 6 * sc); ctx.textAlign = 'left';
      return y - h - 2 * sc;
    }
    // бар «Пальма»: палапа, бамбуковая стойка, гирлянды, табуреты, барабаны
    const h = w * 0.6;
    ctx.fillStyle = dim('#6a5238'); for (let k = 0; k < 3; k++) ctx.fillRect(x0 + (k / 2) * (w - 3 * sc), y - h * 0.85, 3 * sc, h * 0.85);
    ctx.fillStyle = dim('#c8a060'); ctx.beginPath(); ctx.moveTo(x0 - 16 * sc, y - h * 0.62); ctx.quadraticCurveTo(x - w * 0.2, y - h * 0.9, x, y - h - 6 * sc); ctx.quadraticCurveTo(x + w * 0.2, y - h * 0.9, x0 + w + 16 * sc, y - h * 0.62); ctx.lineTo(x0 + w + 16 * sc, y - h * 0.56); ctx.lineTo(x0 - 16 * sc, y - h * 0.56); ctx.fill();
    ctx.strokeStyle = hexA('#5a3a1a', 0.5); ctx.lineWidth = 0.8; for (let k = 0; k < 18; k++) { const q = k / 18; ctx.beginPath(); ctx.moveTo(x0 - 16 * sc + (w + 32 * sc) * q, y - h * 0.56); ctx.lineTo(x, y - h - 4 * sc); ctx.stroke(); }
    for (let k = 0; k < 24; k++) ctx.fillRect(x0 - 16 * sc + (w + 32 * sc) * k / 24, y - h * 0.56, 1.5, (4 + f.h(k) * 4) * sc);
    // бамбуковая стойка
    ctx.fillStyle = dim('#d8b070'); ctx.fillRect(x0 + w * 0.1, y - h * 0.3, w * 0.8, h * 0.3);
    ctx.fillStyle = hexA('#5a3a1a', 0.4); for (let k = 0; k < 16; k++) ctx.fillRect(x0 + w * 0.1 + k * w * 0.05, y - h * 0.3, 1, h * 0.3);
    ctx.fillStyle = dim('#6a4a2a'); ctx.fillRect(x0 + w * 0.08, y - h * 0.32, w * 0.84, 2.5 * sc);
    // бутылки и кокосы на стойке
    for (let k = 0; k < 7; k++) { ctx.fillStyle = dim(['#2a9a5a', '#d8a030', '#e06a4a', '#40a0b0'][k % 4]); ctx.fillRect(x0 + w * (0.14 + k * 0.1), y - h * 0.32 - 7 * sc, 2.4 * sc, 7 * sc); }
    ctx.fillStyle = dim('#6a4a2a'); ctx.beginPath(); ctx.arc(x0 + w * 0.86, y - h * 0.32 - 3 * sc, 3 * sc, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dim('#f0c040'); ctx.fillRect(x0 + w * 0.86 - 0.5 * sc, y - h * 0.32 - 9 * sc, 1 * sc, 6 * sc);
    // барменша, табуреты, барабанщик
    person(f, x0 + w * 0.5, y - h * 0.3 + 14 * sc, '#d8a0c0', { face: 1, scale: 0.85 });
    for (const q of [0.2, 0.42, 0.65]) { ctx.fillStyle = dim('#6a4a2a'); ctx.fillRect(x0 + w * q - 3 * sc, y - 9 * sc, 6 * sc, 1.8 * sc); ctx.fillRect(x0 + w * q - 0.8 * sc, y - 9 * sc, 1.6 * sc, 9 * sc); }
    person(f, x0 + w * 0.42, y + 1, '#f0e0b0', { sit: true, face: 1, hat: '#c8a060', scale: 0.9 });
    { const dx = x0 + w * 1.1, beat = Math.abs(Math.sin(t * 6)) * 2 * sc; ctx.fillStyle = dim('#c8c8c8'); ctx.beginPath(); ctx.ellipse(dx, y - 10 * sc, 7 * sc, 2.5 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(dx - 7 * sc, y - 10 * sc, 14 * sc, 10 * sc); person(f, dx + 12 * sc, y, '#6ab07a', { face: -1, hat: '#e06a4a' }); ctx.strokeStyle = dim('#3a2a1c'); ctx.lineWidth = 1 * sc; ctx.beginPath(); ctx.moveTo(dx + 9 * sc, y - 15 * sc); ctx.lineTo(dx + 2 * sc, y - 12 * sc - beat); ctx.moveTo(dx + 9 * sc, y - 15 * sc); ctx.lineTo(dx - 2 * sc, y - 14 * sc + beat); ctx.stroke(); }
    // гирлянда под крышей
    bunting(f, x0 - 10 * sc, y - h * 0.58, x0 + w + 10 * sc, y - h * 0.58, 8 * sc, ['#ff8a5a', '#ffd060', '#80d0ff', '#ff6ab0'], 14, true);
    // вывеска
    sign(f, x0 + w + 4 * sc, y - h * 0.7, 22 * sc, 14 * sc, '#2a6a7a', (c) => { c.fillStyle = '#f0c040'; c.font = `bold ${5 * sc}px Georgia, serif`; c.textAlign = 'center'; c.fillText('ПАЛЬМА', 0, 1 * sc); c.fillStyle = '#f8f4e8'; c.font = `${3.5 * sc}px Inter, sans-serif`; c.fillText('ром · гамак · 220', 0, 5.5 * sc); }, 1);
    if (f.lit) f.pool(x, y - h * 0.3, w * 0.8, '#ffb060', 0.28 * night);
    return y - h - 6 * sc;
  },

  extras(f) {
    const { ctx, W, sc, gY: y, t, dim } = f;
    for (const [px, ph, lean, s] of [[0.03, 110, 10, 1], [0.245, 96, -12, 2], [0.44, 120, 8, 3], [0.62, 86, -6, 5], [0.985, 104, -10, 4], [0.78, 70, 12, 6]] as number[][]) palm(f, W * px, y, ph * sc, lean, s);
    // факел у бара
    torch(f, W * 0.3, y, 36 * sc);
    // большая гирлянда вдоль набережной
    bunting(f, W * 0.05, y - 92 * sc, W * 0.6, y - 90 * sc, 26 * sc, ['#ff8a5a', '#ffd060', '#80d0ff'], 18, true);
    // гибискус у домов
    for (let i = 0; i < 6; i++) { const hx = W * (0.45 + i * 0.03), hy = y - 6 * sc - f.h(i) * 6 * sc; ctx.fillStyle = dim('#2f6a34'); ctx.beginPath(); ctx.arc(hx, hy, 5 * sc, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dim(i % 2 ? '#ff4a6a' : '#ff8a30'); ctx.beginPath(); ctx.arc(hx + 2 * sc, hy - 2 * sc, 2 * sc, 0, Math.PI * 2); ctx.fill(); }
    // спящая собака в тени
    ctx.fillStyle = dim('#c8a060', 0.8); ctx.beginPath(); ctx.ellipse(W * 0.5, y - 3 * sc, 8 * sc, 3 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(W * 0.5 + 7 * sc, y - 4 * sc + Math.sin(t * 1.5) * 0.5, 3 * sc, 0, Math.PI * 2); ctx.fill();
    // доски для сёрфинга у лавки и дайв-флаг
    for (let k = 0; k < 3; k++) { const bx = W * 0.53 - 60 * sc + k * 6 * sc; ctx.fillStyle = dim(['#f0c040', '#40a0b0', '#f080a0'][k]); ctx.beginPath(); ctx.ellipse(bx, y - 16 * sc, 2.6 * sc, 16 * sc, 0.12 + k * 0.03, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = hexA('#ffffff', 0.4); ctx.fillRect(bx - 0.5 * sc, y - 28 * sc, 1 * sc, 20 * sc); }
    { const fx = W * 0.59; ctx.fillStyle = dim('#8a6a4a'); ctx.fillRect(fx - 0.8 * sc, y - 40 * sc, 1.6 * sc, 40 * sc); const wv = Math.sin(t * 5) * 2 * sc; ctx.fillStyle = dim('#d8402a'); ctx.beginPath(); ctx.moveTo(fx, y - 40 * sc); ctx.lineTo(fx + 14 * sc, y - 39 * sc + wv); ctx.lineTo(fx + 14 * sc, y - 29 * sc + wv); ctx.lineTo(fx, y - 30 * sc); ctx.fill(); ctx.strokeStyle = dim('#f8f4e8'); ctx.lineWidth = 1.6 * sc; ctx.beginPath(); ctx.moveTo(fx + 1 * sc, y - 39 * sc); ctx.lineTo(fx + 13 * sc, y - 30 * sc + wv); ctx.stroke(); }
    // игуана на камне у верфи
    { const ix = W * 0.88 - 90 * sc, iy = y; ctx.fillStyle = dim('#6a6a60'); ctx.beginPath(); ctx.ellipse(ix, iy - 2 * sc, 9 * sc, 3 * sc, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = dim('#4a7a3a'); ctx.beginPath(); ctx.ellipse(ix, iy - 4.5 * sc, 7 * sc, 2 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(ix + 7 * sc, iy - 5 * sc + Math.sin(t * 0.5) * 0.4, 1.8 * sc, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.2 * sc; ctx.beginPath(); ctx.moveTo(ix - 7 * sc, iy - 4 * sc); ctx.quadraticCurveTo(ix - 14 * sc, iy - 3 * sc, ix - 17 * sc, iy - 6 * sc); ctx.stroke(); ctx.fillStyle = dim('#6a9a4a'); for (let k = 0; k < 6; k++) ctx.fillRect(ix - 5 * sc + k * 2 * sc, iy - 7.5 * sc, 0.8 * sc, 1.5 * sc); }
  },

  props(f) {
    const { ctx, W, sc, gY: y, t, dim } = f;
    // ящики с фруктами, кокосы
    crate(f, W * 0.455, y, 14 * sc, 10 * sc, '#b08a5a'); crate(f, W * 0.455 + 14 * sc, y, 12 * sc, 10 * sc, '#c8a060');
    ctx.fillStyle = dim('#f0c040'); for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(W * 0.455 + 3 * sc + k * 2.6 * sc, y - 11 * sc, 1.8 * sc, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = dim('#6a4a2a'); for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(W * 0.6 + (k % 3) * 5 * sc, y - 2.5 * sc - Math.floor(k / 3) * 4 * sc, 2.6 * sc, 0, Math.PI * 2); ctx.fill(); }
    // сети на просушке
    ctx.strokeStyle = hexA(dim('#d8c8a0'), 0.7); ctx.lineWidth = 0.6; const nx = W * 0.655; for (let k = 0; k <= 6; k++) { ctx.beginPath(); ctx.moveTo(nx + k * 5 * sc, y - 30 * sc); ctx.lineTo(nx + k * 5 * sc + 3 * sc, y - 4 * sc); ctx.stroke(); } for (let k = 0; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(nx, y - 30 * sc + k * 6 * sc); ctx.quadraticCurveTo(nx + 15 * sc, y - 27 * sc + k * 6 * sc, nx + 32 * sc, y - 30 * sc + k * 6 * sc); ctx.stroke(); }
    ctx.fillStyle = dim('#6a5238'); ctx.fillRect(nx - 1.5 * sc, y - 34 * sc, 3 * sc, 34 * sc); ctx.fillRect(nx + 32 * sc, y - 34 * sc, 3 * sc, 34 * sc);
    // крабы бегают по песку
    for (let k = 0; k < 4; k++) { const cx = W * (0.3 + k * 0.17) + Math.sin(t * 0.7 + k * 2) * 18 * sc; crab(f, cx, y + 1, sc * 0.9); }
    // пеликан на столбе
    const px = W * 0.7 - 70 * sc; ctx.fillStyle = dim('#6a5238'); ctx.fillRect(px - 2 * sc, y - 18 * sc, 4 * sc, 18 * sc); ctx.fillStyle = dim('#b8a890'); ctx.beginPath(); ctx.ellipse(px, y - 22 * sc, 5.5 * sc, 3.8 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(px + 3 * sc, y - 27 * sc, 2.6 * sc, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dim('#e0a050'); ctx.fillRect(px + 4 * sc, y - 27 * sc, 8 * sc, 2.2 * sc);
  },

  moored(f) {
    const { W, waterY, sc, t } = f;
    hull(f, W * 0.2, waterY + 2 * sc, sc * 0.9, '#f0f0ea', '#2a7ab0', { bob: Math.sin(t * 1.1 + 2) * 1.5 * sc, sail: true });
    hull(f, W * 0.46, waterY + 2 * sc, sc * 0.7, '#e06a4a', '#f0e0b0', { bob: Math.sin(t * 1.1 + 4.4) * 1.5 * sc });
    // пирога с балансиром на воде
    const { ctx, dim } = f; const bx = W * 0.07, by = waterY + 3 * sc + Math.sin(t * 1.2) * 1.5 * sc;
    ctx.fillStyle = dim('#f0c040'); ctx.beginPath(); ctx.moveTo(bx - 22 * sc, by - 4 * sc); ctx.quadraticCurveTo(bx, by - 10 * sc, bx + 22 * sc, by - 4 * sc); ctx.quadraticCurveTo(bx, by + 2 * sc, bx - 22 * sc, by - 4 * sc); ctx.fill();
    ctx.strokeStyle = dim('#8a6a4a'); ctx.lineWidth = 1.4 * sc; ctx.beginPath(); ctx.moveTo(bx - 10 * sc, by - 6 * sc); ctx.lineTo(bx - 10 * sc, by - 14 * sc); ctx.lineTo(bx + 10 * sc, by - 14 * sc); ctx.lineTo(bx + 10 * sc, by - 6 * sc); ctx.stroke();
    ctx.fillStyle = dim('#8a6a4a'); ctx.fillRect(bx - 16 * sc, by - 16 * sc, 32 * sc, 2.5 * sc);
  },

  locals(f) {
    const { ctx, W, sc, gY: y, t, dim } = f;
    // дети бегут за мячом
    const ph = (t * 0.12) % 1, kx = W * 0.3 + ph * W * 0.35;
    person(f, kx, y, '#f0c040', { walk: t * 9, face: 1, scale: 0.65 }); person(f, kx - 14 * sc, y, '#40a0b0', { walk: t * 9 + 2, face: 1, scale: 0.6 });
    ctx.fillStyle = dim('#e03030'); ctx.beginPath(); ctx.arc(kx + 12 * sc, y - 2.5 * sc - Math.abs(Math.sin(t * 6)) * 8 * sc, 2.5 * sc, 0, Math.PI * 2); ctx.fill();
    // куры
    for (let k = 0; k < 2; k++) { const cx = W * 0.84 + k * 10 * sc + Math.sin(t * 0.4 + k) * 5 * sc, peck = Math.max(0, Math.sin(t * 6 + k * 2)) * 2 * sc; ctx.fillStyle = dim(k ? '#8a4a2a' : '#f0ece0'); ctx.beginPath(); ctx.ellipse(cx, y - 3 * sc, 3.5 * sc, 2.5 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(cx + 3 * sc, y - 5.5 * sc + peck, 1.6 * sc, 0, Math.PI * 2); ctx.fill(); }
  },

  foreground(f) {
    const { ctx, W, H, sc, t } = f;
    // листья пальм в углах кадра
    ctx.fillStyle = f.dim('#2a5a30', 0.6);
    for (const [cx, cy, dir] of [[-20 * sc, -10 * sc, 1], [W + 20 * sc, 30 * sc, -1]] as [number, number, number][]) {
      for (let i = 0; i < 5; i++) { const a = dir > 0 ? 0.2 + i * 0.3 : Math.PI - 0.2 - i * 0.3; const Lf = (120 + f.h(i) * 60) * sc; const sw = Math.sin(t * 0.8 + i) * 0.03; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cx + Math.cos(a + sw) * Lf * 0.5, cy + Math.sin(a + sw) * Lf * 0.5 - 14 * sc, cx + Math.cos(a + sw) * Lf, cy + Math.sin(a + sw) * Lf + 10 * sc); ctx.quadraticCurveTo(cx + Math.cos(a + sw) * Lf * 0.5, cy + Math.sin(a + sw) * Lf * 0.5 + 8 * sc, cx, cy); ctx.fill(); }
    }
    // светлячки ночью, бабочки днём
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const x = W * (0.4 + f.h(i) * 0.5) + Math.sin(t * 0.6 + i) * 20 * sc, y = H * 0.55 - f.h(i + 5) * 60 * sc + Math.cos(t * 0.8 + i * 2) * 8 * sc;
      if (f.night > 0.4) { const a = Math.max(0, Math.sin(t * 2.2 + i * 1.7)) * f.night; ctx.fillStyle = `rgba(255,240,120,${(a * 0.9).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, 1.2 * sc, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
    if (f.night < 0.5) for (let i = 0; i < 4; i++) { const x = W * (0.45 + i * 0.12) + Math.sin(t * 0.9 + i) * 24 * sc, y = H * 0.56 - 20 * sc + Math.sin(t * 2.3 + i * 2) * 10 * sc; const fl = Math.abs(Math.sin(t * 9 + i)) * 2.5 * sc; ctx.fillStyle = f.dim(i % 2 ? '#f0a030' : '#60a0e0', 0.6); ctx.beginPath(); ctx.ellipse(x - 1.5 * sc, y, fl + 0.5, 1.8 * sc, 0, 0, Math.PI * 2); ctx.ellipse(x + 1.5 * sc, y, fl + 0.5, 1.8 * sc, 0, 0, Math.PI * 2); ctx.fill(); }
    // пепел в день извержения — медленно оседает
    if (f.h(f.A.day * 3 + 1) > 0.62) { ctx.fillStyle = `rgba(90,86,86,${(0.5 * (1 - f.night * 0.5)).toFixed(3)})`; for (let i = 0; i < 40; i++) { const x = ((f.h(i + 950) * W + f.windTravel * (8 + i * 0.5) * sc) % (W + 40) + W + 40) % (W + 40) - 20, y = ((f.h(i + 960) * H + t * (10 + f.h(i) * 10) * sc) % H); ctx.fillRect(x, y, 1.4 * sc, 1.4 * sc); } }
  },

  lamp(f, x) {
    torch(f, x, f.gY, 46 * f.sc);
    if (f.night > 0.25) f.pool(x, f.quayY, 60 * f.sc, '#ff9a40', 0.2 * f.night);
  },
};
