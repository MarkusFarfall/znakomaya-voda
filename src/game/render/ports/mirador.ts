import { miradorHillY, groundedFoot } from '../portTerrain';
import type { PF, PortKit } from '../portFrame';
import { aerial, airplane, cityGlow, shoreLights } from '../portHorizon';
import { bollard, crate, cypress, dog, door, hull, lantern, notes, person, sign, silhouettes, table, windowRect } from '../portParts';
import { hexA, mix } from '../util';

/** Викторианский дом с эркером */
function paintedLady(f: PF, x: number, y: number, w: number, h: number, col: string, trim: string, seed: number) {
  const { ctx, sc } = f;
  const x0 = x - w / 2;
  ctx.fillStyle = f.dim(col); ctx.fillRect(x0, y - h, w, h);
  // эркер
  ctx.fillStyle = f.dim(mix(col, '#ffffff', 0.08)); ctx.fillRect(x0 + w * 0.55, y - h * 0.9, w * 0.4, h * 0.9);
  ctx.fillStyle = f.dim(trim); ctx.fillRect(x0 - 1 * sc, y - h - 3 * sc, w + 2 * sc, 3 * sc); ctx.fillRect(x0 + w * 0.53, y - h * 0.92, w * 0.44, 2 * sc);
  for (let k = 0; k < Math.floor(w / (5 * sc)); k++) ctx.fillRect(x0 + k * 5 * sc, y - h - 6 * sc, 2 * sc, 3 * sc);
  const rows = Math.max(1, Math.round(h / (16 * sc)));
  for (let r = 0; r < rows; r++) {
    windowRect(f, x0 + w * 0.12, y - h + h * ((r + 0.2) / rows), w * 0.22, h / rows * 0.5, trim, seed + r);
    windowRect(f, x0 + w * 0.62, y - h + h * ((r + 0.25) / rows), w * 0.26, h / rows * 0.5, trim, seed + r + 5);
  }
  ctx.fillStyle = f.dim('#3a3a44'); ctx.beginPath(); ctx.moveTo(x0 - 2 * sc, y - h - 3 * sc); ctx.lineTo(x0 + w * 0.3, y - h - w * 0.25); ctx.lineTo(x0 + w * 0.6, y - h - 3 * sc); ctx.fill();
}

export const miradorKit: PortKit = {
  layout: { shop: 0.13, market: 0.32, tavern: 0.51, dock: 0.68, shipyard: 0.88 },
  quay: 'wood',
  pal: { quay: '#5a4838', quayFace: '#3a2e24', water: ['#3a7a7a', '#0a2a30'], lamp: '#2a2a30', lampLight: '#ffe6b0' },
  walkers: { n: 8, cols: ['#3a3a44', '#8a6a5a', '#2a3a5a', '#b8b0a0', '#6a2a2a', '#d8c8a0'], speed: 1.1, hats: true },
  fogBase: 0.22,
  lampXs: [0.04, 0.19, 0.247, 0.585, 0.965],
  birds: { kind: 'pelican', n: 4 },
  traffic: [
    { kind: 'ferry', hull: '#f0ece4', trim: '#1a3a6a', scale: 0.95, period: 58, lane: 0.42 },
    { kind: 'fireboat', hull: '#c8402a', trim: '#f0ece4', scale: 0.9, period: 130, lane: 0.3, offset: 40 },
    { kind: 'fisher', hull: '#3a5a4a', trim: '#e8e4dc', scale: 0.8, period: 44, lane: 0.68, offset: 9 },
  ],
  hotBoard: 0.265,
  lampTop: 52,
  hours: { market: [7, 19], shop: [9, 21], shipyard: [8, 18], tavern: [11, 26] },
  farShips: [
    { kind: 'container', depth: 0.1, period: 300, dir: 1, hull: '#1e2a36' },
    { kind: 'container', depth: 0.3, period: 360, dir: -1, offset: 150, hull: '#2a3038' },
    { kind: 'cruise', depth: 0.18, period: 400, dir: -1, offset: 60, hull: '#1a1a2a' },
    { kind: 'sail', depth: 0.6, period: 95, dir: 1, offset: 15 },
    { kind: 'sail', depth: 0.75, period: 120, dir: -1, offset: 70 },
    { kind: 'tug', depth: 0.42, period: 180, dir: 1, offset: 100, hull: '#c8402a' },
  ],

  horizon(f) {
    const { ctx, W, H, hY, sc, t } = f;
    // другой берег залива: холмы и даунтаун с небоскрёбами, тонущими в тумане
    ctx.fillStyle = aerial(f, '#5a6a78', 0.95);
    ctx.beginPath(); ctx.moveTo(W * 0.5, hY + 1);
    for (let x = W * 0.5; x <= W; x += 6) { const q = (x - W * 0.5) / (W * 0.5); ctx.lineTo(x, hY - H * 0.045 * (0.5 + Math.sin(q * 3 + 0.4) * 0.3 + Math.sin(q * 11) * 0.2)); }
    ctx.lineTo(W, hY + 1); ctx.fill();
    const towers: [number, number, number][] = [[0.56, 26, 5], [0.585, 40, 6], [0.605, 32, 4], [0.63, 58, 7], [0.655, 44, 5], [0.675, 36, 5], [0.7, 70, 8], [0.725, 48, 6], [0.75, 30, 4], [0.77, 54, 6], [0.8, 38, 5], [0.83, 24, 5], [0.86, 44, 6]];
    for (const [qx, hh, ww] of towers) { const x = W * qx, h = hh * sc, w = ww * sc; ctx.fillStyle = aerial(f, '#3a4652', 0.9); ctx.fillRect(x - w / 2, hY - h, w, h + 1); if (f.night > 0.2) { ctx.fillStyle = `rgba(255,220,160,${(0.55 * f.night).toFixed(3)})`; for (let r = 0; r < Math.floor(h / (3 * sc)); r++) for (let c = 0; c < Math.floor(w / (2 * sc)); c++) if (f.h(qx * 1000 + r * 7 + c) > 0.45) ctx.fillRect(x - w / 2 + 0.5 * sc + c * 2 * sc, hY - h + 1 * sc + r * 3 * sc, 1 * sc, 1.4 * sc); } }
    // пирамидальная башня и антенна с красным огнём
    { const x = W * 0.7; ctx.fillStyle = aerial(f, '#3a4652', 0.9); ctx.beginPath(); ctx.moveTo(x - 4 * sc, hY - 70 * sc); ctx.lineTo(x, hY - 92 * sc); ctx.lineTo(x + 4 * sc, hY - 70 * sc); ctx.fill(); ctx.fillRect(x - 0.5 * sc, hY - 104 * sc, 1 * sc, 12 * sc); if (f.night > 0.2 && Math.floor(t * 1.2) % 2 === 0) f.glow(x, hY - 104 * sc, 1.2 * sc, '#ff4040', f.night); }
    cityGlow(f, W * 0.7, W * 0.28, '#ffc890');
    shoreLights(f, Array.from({ length: 14 }, (_, i) => [W * (0.52 + i * 0.026), 2 + f.h(i + 60) * 3, i % 4 === 0 ? '#ff9a60' : '#ffd890'] as [number, number, string]), hY - 1);
    // второй мост на дальнем плане (серый, стальной) — лишь намёк в дымке
    { const y = hY - H * 0.03; ctx.strokeStyle = aerial(f, '#6a7a86', 0.93); ctx.lineWidth = 1.5 * sc; ctx.beginPath(); ctx.moveTo(W * 0.5, y); ctx.lineTo(W * 0.62, y); ctx.stroke(); ctx.lineWidth = 0.8; for (const tx of [W * 0.53, W * 0.59]) { ctx.beginPath(); ctx.moveTo(tx, y + 2); ctx.lineTo(tx, y - 14 * sc); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(W * 0.5, y - 4 * sc); ctx.quadraticCurveTo(W * 0.515, y, W * 0.53, y - 14 * sc); ctx.quadraticCurveTo(W * 0.56, y + 2 * sc, W * 0.59, y - 14 * sc); ctx.quadraticCurveTo(W * 0.605, y, W * 0.62, y - 4 * sc); ctx.stroke(); }
    // слой тумана, лежащий на воде и прячущий низ города
    { const fc = f.A.palette.fog; const g = ctx.createLinearGradient(0, hY - H * 0.05, 0, hY + 2); g.addColorStop(0, hexA(fc, 0)); g.addColorStop(1, hexA(fc, 0.5 * (1 - f.night * 0.5))); ctx.fillStyle = g; ctx.fillRect(W * 0.45, hY - H * 0.05, W * 0.55, H * 0.05 + 2); }
    airplane(f, 75, 0.07); airplane(f, 140, 0.12, 50);
  },

  signage(f) {
    // буквы MIRADOR на холме
    const { ctx, W, H, hY, sc, dim } = f;
    const txt = 'MIRADOR', x = W * 0.64;
    const yy = miradorHillY(W, H, hY, x) + 12 * sc;
    ctx.font = `bold ${7 * sc}px Inter, sans-serif`; ctx.textAlign = 'center';
    ctx.fillStyle = dim(mix('#2a3a3a', f.A.palette.skyHor, 0.3), 0.7); ctx.fillText(txt, x + 1, yy + 1);
    ctx.fillStyle = dim(mix('#f4f2ec', f.A.palette.skyHor, 0.25), 0.7); ctx.fillText(txt, x, yy);
    ctx.textAlign = 'left';
    if (f.lit) f.pool(x, yy - 2 * sc, 30 * sc, '#ffffff', 0.12 * f.night);
  },

  events: [
    { id: 'joggers', label: 'Утренняя пробежка', from: 6.5, to: 8.5, draw(f) {
      const { W, sc, gY: y, t } = f;
      for (let k = 0; k < 2; k++) { const x = -20 * sc + (W + 40 * sc) * ((t * 0.06 + k * 0.5) % 1); person(f, x, y, k ? '#f0c040' : '#e05070', { walk: t * 12 + k, face: 1, scale: 0.95 }); if (k === 0) dog(f, x + 12 * sc, y, '#8a6a4a', 1); }
    } },
    { id: 'tourists', label: 'Туристы на пирсе', from: 11, to: 16.5, draw(f) {
      const { ctx, W, sc, gY: y, t } = f;
      const ex = W * 0.46; ctx.strokeStyle = f.dim('#6a4a2a'); ctx.lineWidth = 1.2 * sc; for (const dx of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(ex + dx * sc, y); ctx.lineTo(ex, y - 22 * sc); ctx.stroke(); }
      ctx.fillStyle = f.dim('#f4f2ec'); ctx.fillRect(ex - 7 * sc, y - 24 * sc, 14 * sc, 11 * sc); ctx.strokeStyle = f.dim('#c0452b'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ex - 6 * sc, y - 16 * sc); ctx.lineTo(ex + 6 * sc, y - 16 * sc); ctx.moveTo(ex - 3 * sc, y - 16 * sc); ctx.lineTo(ex - 3 * sc, y - 21 * sc); ctx.moveTo(ex + 2 * sc, y - 16 * sc); ctx.lineTo(ex + 2 * sc, y - 21 * sc); ctx.stroke();
      person(f, ex + 12 * sc, y, '#3a3a44', { face: -1, hat: '#2a2a2a' }); ctx.fillStyle = f.dim('#c0452b'); ctx.fillRect(ex + 8 * sc + Math.sin(t * 2) * 1.5 * sc, y - 14 * sc, 3 * sc, 1 * sc);
      for (let k = 0; k < 4; k++) person(f, W * 0.76 + 40 * sc + k * 7 * sc, y, ['#b8b0a0', '#2a3a5a', '#d8c8a0', '#8a6a5a'][k], { face: -1, hat: k % 2 ? '#f0ece4' : undefined });
      const dir: 1 | -1 = Math.cos(t * 0.2) > 0 ? 1 : -1, kx = W * 0.3 + Math.sin(t * 0.2) * W * 0.1;
      person(f, kx, y, '#f0c040', { walk: t * 6, face: dir, scale: 0.65, balloon: '#e03030' });
      person(f, kx - 10 * sc * dir, y, '#8a6a5a', { walk: t * 6 + 1, face: dir });
    } },
    { id: 'terrace', label: 'Терраса «Кита»', from: 17, to: 21, draw(f) {
      const { ctx, W, sc, gY: y, t } = f;
      const bw = Math.min(150 * sc, W * 0.19), x = W * 0.51, bx0 = x - bw * 0.45;
      for (let k = 0; k < 2; k++) { const tx = bx0 - 16 * sc + k * 24 * sc; table(f, tx, y, 5 * sc, '#2a2a30'); person(f, tx - 8 * sc, y, k ? '#8a6a5a' : '#2a3a5a', { sit: true, face: 1, scale: 0.9 }); person(f, tx + 8 * sc, y, k ? '#d8c8a0' : '#b8b0a0', { sit: true, face: -1, scale: 0.9 }); ctx.fillStyle = f.dim('#f0ece4'); ctx.fillRect(tx - 3 * sc, y - 12 * sc, 6 * sc, 1.2 * sc); if (f.lit) f.glow(tx, y - 12 * sc, 1.4 * sc, '#ff9a60', f.night * 0.8); }
      const wx = bx0 + 20 * sc + Math.sin(t * 0.6) * 10 * sc;
      person(f, wx, y, '#f0ece4', { walk: t * 5, face: -1 }); ctx.fillStyle = f.dim('#d8d8d8'); ctx.fillRect(wx + 4 * sc, y - 17 * sc, 6 * sc, 1 * sc);
      const h = bw * 0.72, by = y - 10 * sc; silhouettes(f, bx0 + bw * 0.9 * 0.08, by - h * 0.82, bw * 0.9 * 0.6, h * 0.55, 4, 7);
    } },
    { id: 'foghorn', label: 'Ревун маяка и джаз', from: 21, to: 26, draw(f) {
      const { ctx, W, hY, sc, gY: y, t } = f;
      const lx = W * 0.47, ly = hY - 23 * sc;
      const a = t * 0.6, dx = Math.cos(a), vis = Math.max(0, -Math.sin(a) + 0.3);
      if (vis > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const len = W * 0.5 * vis; const g = ctx.createLinearGradient(lx, ly, lx + dx * len, ly); g.addColorStop(0, `rgba(255,240,200,${(0.18 * (0.5 + f.A.fog)).toFixed(3)})`); g.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lx, ly - 1.5 * sc); ctx.lineTo(lx + dx * len, ly - 26 * sc * vis - 4 * sc); ctx.lineTo(lx + dx * len, ly + 18 * sc * vis + 4 * sc); ctx.lineTo(lx, ly + 1.5 * sc); ctx.fill(); ctx.restore(); }
      const jx = W * 0.585 + 14 * sc;
      person(f, jx, y, '#2a2a3a', { face: 1, hat: '#3a3a44' }); person(f, jx + 10 * sc, y, '#3a3a44', { face: -1 }); person(f, jx + 20 * sc, y, '#1a1a2a', { face: -1, hat: '#2a2a2a' });
      ctx.strokeStyle = f.dim('#d8a030'); ctx.lineWidth = 1.6 * sc; ctx.beginPath(); ctx.moveTo(jx + 2 * sc, y - 14 * sc); ctx.quadraticCurveTo(jx + 6 * sc, y - 6 * sc, jx + 8 * sc, y - 8 * sc); ctx.stroke();
      ctx.fillStyle = f.dim('#6a4a2a'); ctx.beginPath(); ctx.ellipse(jx + 22 * sc, y - 12 * sc, 3 * sc, 6 * sc, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = f.dim('#2a2a2a'); ctx.fillRect(jx + 21 * sc, y - 24 * sc, 1 * sc, 10 * sc);
      notes(f, jx + 12 * sc, y - 22 * sc, 5);
      ctx.fillStyle = f.dim('#2a2a2a'); ctx.fillRect(jx - 10 * sc, y - 3 * sc, 10 * sc, 3 * sc); ctx.fillStyle = f.dim('#d8a030'); ctx.fillRect(jx - 8 * sc, y - 4 * sc, 1.5 * sc, 1 * sc); ctx.fillRect(jx - 5 * sc, y - 4 * sc, 1.5 * sc, 1 * sc);
    } },
  ],

  backRow(f) {
    const { ctx, W, sc, gY, dim, t } = f;
    const y = gY - 9 * sc;
    const haze = (c: string) => dim(mix(c, f.A.palette.skyHor, 0.22), 0.8);
    // ряд лавок с маркизами и вывесками
    const shops: [number, string, string, string][] = [[0.02, '#9a7a6a', '#1a3a6a', 'BAIT'], [0.065, '#c8b8a0', '#b83a2a', 'CHOWDER'], [0.235, '#6a7a6a', '#d8a030', 'ANTIQUES'], [0.42, '#7a8a96', '#1a3a6a', 'SALT&SEA'], [0.455, '#c8b8a0', '#3a7a5a', 'BOOKS'], [0.785, '#9a7a6a', '#b83a2a', 'TAFFY'], [0.98, '#7a8a96', '#1a3a6a', 'INN']];
    for (const [qx, wall, awn, label] of shops) {
      const x = W * qx, w = 30 * sc, h = 34 * sc;
      ctx.fillStyle = haze(wall); ctx.fillRect(x - w / 2, y - h, w, h);
      ctx.fillStyle = haze('#e8e4dc'); ctx.fillRect(x - w / 2 - 2 * sc, y - h - 3 * sc, w + 4 * sc, 3 * sc);
      for (let k = 0; k < 2; k++) { ctx.fillStyle = f.win(qx * 100 + k); ctx.fillRect(x - w * 0.34 + k * w * 0.44, y - h * 0.82, w * 0.24, h * 0.3); }
      for (let s = 0; s < 6; s++) { ctx.fillStyle = haze(s % 2 ? '#f0ece4' : awn); ctx.beginPath(); ctx.moveTo(x - w / 2 + (s / 6) * w, y - h * 0.42); ctx.lineTo(x - w / 2 + ((s + 1) / 6) * w, y - h * 0.42); ctx.lineTo(x - w / 2 + ((s + 1) / 6) * w + 3 * sc, y - h * 0.32); ctx.lineTo(x - w / 2 + (s / 6) * w + 3 * sc, y - h * 0.32); ctx.fill(); }
      ctx.fillStyle = f.win(qx * 100 + 5, '#ffe0a0'); ctx.fillRect(x - w * 0.3, y - h * 0.3, w * 0.6, h * 0.3);
      ctx.fillStyle = haze('#2a2a30'); ctx.font = `bold ${3.4 * sc}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(label, x, y - h * 0.46); ctx.textAlign = 'left';
    }
    // башня с часами (показывает игровое время)
    { const x = W * 0.6, w = 22 * sc, h = 96 * sc; ctx.fillStyle = haze('#c8b8a0'); ctx.fillRect(x - w / 2, y - h, w, h); ctx.fillStyle = hexA('#000000', 0.1); for (let k = 0; k < h; k += 6 * sc) ctx.fillRect(x - w / 2, y - h + k, w, 1); ctx.fillStyle = haze('#8a9a96'); ctx.beginPath(); ctx.moveTo(x - w / 2 - 3 * sc, y - h); ctx.lineTo(x, y - h - 18 * sc); ctx.lineTo(x + w / 2 + 3 * sc, y - h); ctx.fill(); ctx.fillStyle = haze('#8a9a96'); ctx.fillRect(x - 0.8 * sc, y - h - 26 * sc, 1.6 * sc, 8 * sc);
      for (let r = 0; r < 4; r++) { ctx.fillStyle = f.win(r + 500); ctx.fillRect(x - 3 * sc, y - h * (0.2 + r * 0.17), 6 * sc, 7 * sc); ctx.beginPath(); ctx.arc(x, y - h * (0.2 + r * 0.17), 3 * sc, Math.PI, 0); ctx.fill(); }
      const cy = y - h * 0.84, cr = 7 * sc; ctx.fillStyle = f.lit ? '#fff4d8' : haze('#f6f3ec'); ctx.beginPath(); ctx.arc(x, cy, cr, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = haze('#2a2a30'); ctx.lineWidth = 1; ctx.stroke();
      const hr = f.A.hour ?? 10.17; const ha = (hr / 12) * Math.PI * 2 - Math.PI / 2, ma = ((hr % 1)) * Math.PI * 2 - Math.PI / 2;
      ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 1.2 * sc; ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + Math.cos(ha) * cr * 0.5, cy + Math.sin(ha) * cr * 0.5); ctx.stroke(); ctx.lineWidth = 0.8 * sc; ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + Math.cos(ma) * cr * 0.75, cy + Math.sin(ma) * cr * 0.75); ctx.stroke();
      if (f.lit) f.glow(x, cy, cr * 0.6, '#fff0c0', f.night * 0.5); }
    // вертикальная неоновая вывеска HOTEL
    { const x = W * 0.33, hh = 46 * sc; ctx.fillStyle = haze('#6a7a6a'); ctx.fillRect(x - 16 * sc, y - 40 * sc, 32 * sc, 40 * sc); for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) { ctx.fillStyle = f.win(r * 3 + k + 600); ctx.fillRect(x - 12 * sc + k * 9 * sc, y - 36 * sc + r * 14 * sc, 6 * sc, 8 * sc); } ctx.fillStyle = haze('#2a2a30'); ctx.fillRect(x + 16 * sc, y - 40 * sc - hh, 7 * sc, hh); const on = Math.sin(t * 8) > -0.9 || !f.lit; ctx.save(); if (f.lit && on) { ctx.shadowColor = '#ff60a0'; ctx.shadowBlur = 8 * sc; ctx.fillStyle = '#ff8ac0'; } else ctx.fillStyle = haze('#c86090'); ctx.font = `bold ${5 * sc}px Inter, sans-serif`; ctx.textAlign = 'center'; 'HOTEL'.split('').forEach((ch, i) => ctx.fillText(ch, x + 19.5 * sc, y - 40 * sc - hh + 8 * sc + i * 8 * sc)); ctx.textAlign = 'left'; ctx.restore(); }
  },

  ground(f) {
    const { ctx, W, sc, gY, quayY } = f;
    // трамвайные рельсы вдоль набережной и мокрый блеск настила (туман)
    ctx.fillStyle = hexA('#1a1a1c', 0.6); ctx.fillRect(0, gY + 1.5 * sc, W, 1.2 * sc); ctx.fillRect(0, gY + 6 * sc, W, 1.2 * sc);
    ctx.fillStyle = hexA('#8a8a86', 0.3); ctx.fillRect(0, gY + 1.5 * sc, W, 0.5); ctx.fillRect(0, gY + 6 * sc, W, 0.5);
    const sheen = ctx.createLinearGradient(0, gY, 0, quayY + 4 * sc); sheen.addColorStop(0, hexA(f.A.palette.skyHor, 0.05 + f.A.fog * 0.1)); sheen.addColorStop(1, hexA(f.A.palette.skyHor, 0)); ctx.fillStyle = sheen; ctx.fillRect(0, gY, W, quayY + 4 * sc - gY);
    // люк и жвачка на досках
    ctx.fillStyle = hexA('#000000', 0.35); ctx.beginPath(); ctx.ellipse(W * 0.45, gY + 9 * sc, 5 * sc, 1.6 * sc, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hexA('#d8d8d0', 0.25); for (let i = 0; i < 12; i++) ctx.fillRect(f.h(i + 700) * W, gY + 2 + f.h(i + 710) * 8 * sc, 1.5 * sc, 1 * sc);
  },

  backdrop(f) {
    const { ctx, W, H, hY, sc, t, dim, A } = f;
    const sky = A.palette.skyHor;
    // самые дальние хребты за заливом — две гряды, растворённые в дымке
    ctx.fillStyle = dim(mix('#7a8a98', sky, 0.7), 0.45);
    ctx.beginPath(); ctx.moveTo(0, hY + 2);
    for (let x = 0; x <= W; x += 6) { const q = x / W; ctx.lineTo(x, hY - H * 0.2 * (0.45 + Math.sin(q * 2.3 + 1.7) * 0.3 + Math.sin(q * 7.1 + 0.4) * 0.15 + Math.sin(q * 19) * 0.1)); }
    ctx.lineTo(W, hY + 2); ctx.fill();
    // дальние холмы в дымке
    ctx.fillStyle = dim(mix('#5a6a78', sky, 0.5), 0.5);
    ctx.beginPath(); ctx.moveTo(0, hY + 2);
    for (let x = 0; x <= W; x += 6) { const q = x / W; ctx.lineTo(x, hY - H * 0.14 * (0.4 + Math.sin(q * 3.1 + 0.5) * 0.35 + Math.sin(q * 9 + 2) * 0.2)); }
    ctx.lineTo(W, hY + 2); ctx.fill();
    // туман стекает с холмов в залив языками
    if (f.night < 0.7) { const fc = A.palette.fog; for (let k = 0; k < 4; k++) { const fx = W * (0.05 + k * 0.25) + Math.sin(f.t * 0.1 + k) * 20 * sc, fy = hY - H * 0.06 + k * 4 * sc; const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 60 * sc); g.addColorStop(0, hexA(fc, 0.35 * (0.6 + A.fog))); g.addColorStop(1, hexA(fc, 0)); ctx.fillStyle = g; ctx.fillRect(fx - 60 * sc, fy - 20 * sc, 120 * sc, 40 * sc); } }
    // висячий мост слева
    { const x1 = W * 0.02, x2 = W * 0.42, deck = hY - H * 0.07, tw = [W * 0.12, W * 0.32];
      const red = dim(mix('#c0452b', sky, 0.3), 0.7);
      ctx.strokeStyle = red; ctx.lineWidth = 2.4 * sc; ctx.beginPath(); ctx.moveTo(x1, deck); ctx.lineTo(x2, deck); ctx.stroke();
      ctx.fillStyle = red;
      for (const tx of tw) { ctx.fillRect(tx - 3 * sc, deck - H * 0.16, 6 * sc, hY - deck + H * 0.16 + 3 * sc); ctx.fillRect(tx - 5 * sc, deck - H * 0.12, 10 * sc, 2 * sc); ctx.fillRect(tx - 5 * sc, deck - H * 0.06, 10 * sc, 2 * sc); }
      ctx.lineWidth = 1.2 * sc; ctx.beginPath(); ctx.moveTo(x1, deck - H * 0.06); ctx.quadraticCurveTo((x1 + tw[0]) / 2, deck + 4, tw[0], deck - H * 0.16);
      ctx.quadraticCurveTo((tw[0] + tw[1]) / 2, deck + H * 0.02, tw[1], deck - H * 0.16); ctx.quadraticCurveTo((tw[1] + x2) / 2, deck + 4, x2, deck - H * 0.06); ctx.stroke();
      ctx.lineWidth = 0.6; for (let x = tw[0]; x < tw[1]; x += 7 * sc) { const u = (x - tw[0]) / (tw[1] - tw[0]); const cy = deck - H * 0.16 + (H * 0.16 + H * 0.02) * 4 * u * (1 - u) * 0.5; ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x, deck); ctx.stroke(); }
      if (f.night > 0.3) { for (let x = x1 + 6 * sc; x < x2; x += 14 * sc) f.glow(x, deck - 2 * sc, 1.2 * sc, '#ffd890', f.night * 0.7); for (const tx of tw) f.glow(tx, deck - H * 0.16, 1.6 * sc, '#ff4040', f.night * (0.5 + 0.5 * Math.sin(t * 2))); }
    }
    // холм с викторианскими домами
    ctx.fillStyle = dim('#4e5a66', 0.7);
    ctx.beginPath(); ctx.moveTo(W * 0.4, hY + 2); ctx.quadraticCurveTo(W * 0.72, hY - H * 0.26, W * 1.05, hY - H * 0.05); ctx.lineTo(W, hY + 2); ctx.fill();
    const ladies: [number, number, string, string][] = [[0.52, 0.5, '#d8b0b8', '#f4f0e8'], [0.58, 0.72, '#9ab0c8', '#f4f0e8'], [0.645, 0.88, '#e8d8a0', '#7a5a4a'], [0.71, 0.97, '#b8c8a0', '#f4f0e8'], [0.775, 0.93, '#d8a080', '#f4f0e8'], [0.84, 0.78, '#a0b8c8', '#2a3a4a'], [0.9, 0.58, '#e0c8d8', '#f4f0e8'], [0.96, 0.38, '#c8b890', '#5a4a3a'], [0.62, 0.55, '#c8a8c8', '#f4f0e8'], [0.74, 0.65, '#a8c0b0', '#f4f0e8']];
    ladies.forEach(([qx, k, c, tr], i) => {
      const x = W * qx, w = (14 + f.h(i) * 6) * sc;
      const base = groundedFoot(px => miradorHillY(W, H, hY, px), x, w / 2, (2 + (1 - k) * 18) * sc);
      paintedLady(f, x, base, w, (18 + f.h(i + 2) * 10) * sc, c, tr, i * 7);
    });
    // кипарисы на обрыве справа
    for (let i = 0; i < 4; i++) cypress(f, W * (0.86 + i * 0.045), hY - H * 0.05 * (1 - i * 0.1) + 2, (30 + f.h(i) * 16) * sc, -8 - i * 2);
    // маяк с ревуном на мысу
    { const x = W * 0.47, y = hY + 1; ctx.fillStyle = dim('#5a5a58'); ctx.beginPath(); ctx.ellipse(x, y, 20 * sc, 5 * sc, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = dim('#f0ece4'); ctx.fillRect(x - 3 * sc, y - 22 * sc, 6 * sc, 20 * sc); ctx.fillStyle = dim('#2a2a2e'); ctx.fillRect(x - 3.6 * sc, y - 25 * sc, 7.2 * sc, 3 * sc); const pulse = Math.max(0, Math.sin(t * 0.8)); if (f.night > 0.2 || A.fog > 0.3) f.glow(x, y - 23 * sc, 2.5 * sc, '#fff0b0', Math.max(f.night, A.fog * 0.7) * pulse); }
    // пеликан низко над водой
    { const px = ((t * 18 * sc) % (W + 100)) - 50, py = hY - 8 * sc + Math.sin(t * 0.9) * 4 * sc; ctx.fillStyle = dim('#8a8a86', 0.8); ctx.beginPath(); ctx.ellipse(px, py, 7 * sc, 2.4 * sc, 0, 0, Math.PI * 2); ctx.fill(); const fl = Math.sin(t * 5) * 6 * sc; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.6 * sc; ctx.beginPath(); ctx.moveTo(px - 2 * sc, py); ctx.lineTo(px - 10 * sc, py - fl); ctx.moveTo(px - 2 * sc, py); ctx.lineTo(px + 6 * sc, py - fl); ctx.stroke(); ctx.fillStyle = dim('#e0a050', 0.8); ctx.fillRect(px + 6 * sc, py - 1 * sc, 6 * sc, 1.6 * sc); }
    // остров с тюрьмой-крепостью в проливе
    { const x = W * 0.3, y = hY + 1; ctx.fillStyle = dim(mix('#5a5a58', A.palette.skyHor, 0.45), 0.6); ctx.beginPath(); ctx.ellipse(x, y, 34 * sc, 5 * sc, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = dim(mix('#c8c0a8', A.palette.skyHor, 0.4), 0.6); ctx.fillRect(x - 16 * sc, y - 12 * sc, 32 * sc, 10 * sc); ctx.fillRect(x - 4 * sc, y - 18 * sc, 8 * sc, 6 * sc); ctx.fillStyle = hexA('#000000', 0.25); for (let k = 0; k < 6; k++) ctx.fillRect(x - 13 * sc + k * 5 * sc, y - 9 * sc, 2 * sc, 3 * sc); if (f.night > 0.3 && Math.sin(t * 1.2) > 0) f.glow(x, y - 19 * sc, 1.6 * sc, '#ffffff', f.night * 0.8); }
    // воздушные змеи над набережной в ветреный день
    if (A.wind > 5 && f.night < 0.4) { for (let k = 0; k < 2; k++) { const kx = W * (0.5 + k * 0.2) + Math.sin(t * 0.8 + k) * 20 * sc, ky = H * (0.2 + k * 0.08) + Math.cos(t * 1.1 + k) * 12 * sc; ctx.fillStyle = dim(k ? '#d8402a' : '#2a70b0'); ctx.beginPath(); ctx.moveTo(kx, ky - 7 * sc); ctx.lineTo(kx + 5 * sc, ky); ctx.lineTo(kx, ky + 8 * sc); ctx.lineTo(kx - 5 * sc, ky); ctx.fill(); ctx.strokeStyle = hexA('#ffffff', 0.3); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(kx, ky + 8 * sc); ctx.quadraticCurveTo(kx - 30 * sc * A.windDir, ky + 60 * sc, kx - 60 * sc * A.windDir, f.gY); ctx.stroke(); ctx.strokeStyle = dim(k ? '#f0c040' : '#f0ece4'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(kx, ky + 8 * sc); for (let i = 1; i <= 5; i++) ctx.lineTo(kx + Math.sin(t * 6 + i) * 3 * sc, ky + 8 * sc + i * 4 * sc); ctx.stroke(); } }
  },

  farWater(f) {
    const { ctx, W, hY, waterY, sc, t, dim } = f;
    // понтон с морскими львами
    const px = W * 0.34, py = hY + (waterY - hY) * 0.5 + Math.sin(t * 1.2) * 1.5 * sc;
    ctx.fillStyle = dim('#6a5a48'); ctx.fillRect(px - 30 * sc, py - 3 * sc, 60 * sc, 5 * sc);
    for (let k = 0; k < 4; k++) {
      const lx = px - 22 * sc + k * 14 * sc, raise = k === 1 ? Math.max(0, Math.sin(t * 1.5)) * 6 * sc : 0;
      ctx.fillStyle = dim(k % 2 ? '#5a4a3a' : '#6a5a4a');
      ctx.beginPath(); ctx.ellipse(lx, py - 6 * sc, 7 * sc, 3.5 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(lx + 6 * sc, py - 10 * sc - raise, 3 * sc, 2.6 * sc, 0.3, 0, Math.PI * 2); ctx.fill();
    }
    // буй со светом и колоколом
    const bx = W * 0.6, by = hY + (waterY - hY) * 0.35 + Math.sin(t * 1.4 + 1) * 2 * sc;
    ctx.fillStyle = dim('#3a9a5a'); ctx.beginPath(); ctx.moveTo(bx - 5 * sc, by); ctx.lineTo(bx + 5 * sc, by); ctx.lineTo(bx + 3 * sc, by - 9 * sc); ctx.lineTo(bx - 3 * sc, by - 9 * sc); ctx.fill();
    ctx.fillStyle = dim('#2a2a2a'); ctx.fillRect(bx - 1 * sc, by - 17 * sc, 2 * sc, 8 * sc);
    if (f.night > 0.3 && Math.sin(t * 2) > 0.2) f.glow(bx, by - 18 * sc, 1.6 * sc, '#40ff80', f.night);
    // контейнеровоз на горизонте
    const cx = W * 0.15 - ((t * 3 * sc) % (W * 0.4)), cy = hY + 3;
    ctx.fillStyle = dim('#2a3a4a', 0.6); ctx.fillRect(cx - 40 * sc, cy - 7 * sc, 80 * sc, 7 * sc);
    ctx.fillStyle = dim('#f0ece4', 0.6); ctx.fillRect(cx + 26 * sc, cy - 16 * sc, 10 * sc, 9 * sc);
    for (let k = 0; k < 6; k++) { ctx.fillStyle = dim(['#c8402a', '#2a6aa0', '#d8a030'][k % 3], 0.6); ctx.fillRect(cx - 36 * sc + k * 10 * sc, cy - 12 * sc, 9 * sc, 5 * sc); }
  },

  building(f, b, x, w) {
    const { ctx, sc, gY: y, t, dim, night } = f;
    const x0 = x - w / 2;
    if (b === 'market') {
      // Консервный ряд: кирпич, гофра, трубы, надпись на крыше, переходной мост
      const h = w * 0.62;
      ctx.fillStyle = dim('#8a5a48'); ctx.fillRect(x0, y - h, w, h);
      ctx.fillStyle = hexA('#000000', 0.12); for (let r = 0; r < h / (4 * sc); r++) { ctx.fillRect(x0, y - h + r * 4 * sc, w, 0.8); for (let k = (r % 2) * 5 * sc; k < w; k += 10 * sc) ctx.fillRect(x0 + k, y - h + r * 4 * sc, 0.8, 4 * sc); }
      ctx.fillStyle = dim('#6a7a80'); ctx.fillRect(x0 - 4 * sc, y - h - 6 * sc, w + 8 * sc, 6 * sc);
      ctx.fillStyle = hexA('#000000', 0.2); for (let k = 0; k < w + 8 * sc; k += 4 * sc) ctx.fillRect(x0 - 4 * sc + k, y - h - 6 * sc, 1, 6 * sc);
      // окна-ленты в металлических рамах
      for (let k = 0; k < 5; k++) windowRect(f, x0 + w * (0.06 + k * 0.19), y - h * 0.82, w * 0.14, h * 0.26, '#3a3a44', k, '#ffd890');
      for (let k = 0; k < 2; k++) { ctx.fillStyle = dim('#3a3a44'); ctx.fillRect(x0 + w * (0.1 + k * 0.5), y - h * 0.4, w * 0.3, h * 0.4); ctx.fillStyle = f.win(k + 9, '#ffe0a0'); ctx.fillRect(x0 + w * (0.12 + k * 0.5), y - h * 0.38, w * 0.26, h * 0.34); }
      // надпись на крыше
      const letters = 'CANNERY ROW';
      ctx.fillStyle = dim('#2a2a2e'); for (let k = 0; k < 4; k++) ctx.fillRect(x0 + w * (0.1 + k * 0.26), y - h - 20 * sc, 1.5 * sc, 14 * sc);
      ctx.font = `bold ${8 * sc}px Inter, sans-serif`; ctx.textAlign = 'center';
      if (f.lit) { ctx.save(); ctx.shadowColor = '#ff6a6a'; ctx.shadowBlur = 8 * sc; ctx.fillStyle = `rgba(255,120,120,${(0.85 + 0.15 * Math.sin(t * 9)).toFixed(3)})`; ctx.fillText(letters, x, y - h - 9 * sc); ctx.restore(); }
      else { ctx.fillStyle = dim('#d84040'); ctx.fillText(letters, x, y - h - 9 * sc); }
      ctx.textAlign = 'left';
      // трубы
      for (const dx of [0.82, 0.9]) { ctx.fillStyle = dim('#5a4a3a'); ctx.fillRect(x0 + w * dx, y - h - 60 * sc, 7 * sc, 60 * sc); ctx.fillStyle = dim('#3a3a3a'); ctx.fillRect(x0 + w * dx - 1, y - h - 62 * sc, 7 * sc + 2, 3 * sc); if (f.random() < 0.07) f.smoke(x0 + w * dx + 3.5 * sc, y - h - 64 * sc, 4 * sc); }
      // переходной мост к соседнему корпусу
      ctx.fillStyle = dim('#6a5a48'); ctx.fillRect(x0 + w, y - h * 0.75, 40 * sc, h * 0.18);
      ctx.fillStyle = f.win(31); for (let k = 0; k < 4; k++) ctx.fillRect(x0 + w + 4 * sc + k * 9 * sc, y - h * 0.72, 6 * sc, h * 0.1);
      ctx.fillStyle = dim('#8a5a48'); ctx.fillRect(x0 + w + 40 * sc, y - h * 0.9, 18 * sc, h * 0.9);
      ctx.fillStyle = dim('#6a7a80'); ctx.fillRect(x0 + w + 38 * sc, y - h * 0.9 - 4 * sc, 22 * sc, 4 * sc);
      // ящики с консервами
      for (let k = 0; k < 3; k++) crate(f, x0 + w * 0.42 + k * 11 * sc, y, 10 * sc, 8 * sc, '#c8b48a');
      if (f.lit) f.pool(x, y - h * 0.3, w * 0.8, '#ffd090', 0.18 * night);
      return y - h - 22 * sc;
    }
    if (b === 'shop') {
      // Викторианская витрина
      const h = w * 0.8, ww = w * 0.72, wx0 = x - ww / 2;
      ctx.fillStyle = dim('#7a8a96'); ctx.fillRect(wx0, y - h, ww, h);
      ctx.fillStyle = hexA('#000000', 0.1); for (let k = 0; k < h; k += 5 * sc) ctx.fillRect(wx0, y - h + k, ww, 0.8);
      // карниз
      ctx.fillStyle = dim('#e8e4dc'); ctx.fillRect(wx0 - 4 * sc, y - h - 6 * sc, ww + 8 * sc, 6 * sc);
      for (let k = 0; k < 8; k++) ctx.fillRect(wx0 + (k / 8) * ww + 2 * sc, y - h - 11 * sc, 3 * sc, 5 * sc);
      ctx.fillStyle = dim('#3a3a44'); ctx.fillRect(wx0 - 2 * sc, y - h - 13 * sc, ww + 4 * sc, 2.5 * sc);
      // окна второго этажа
      for (let k = 0; k < 2; k++) { windowRect(f, wx0 + ww * (0.14 + k * 0.48), y - h * 0.88, ww * 0.24, h * 0.3, '#e8e4dc', k + 2); ctx.fillStyle = dim('#e8e4dc'); ctx.fillRect(wx0 + ww * (0.12 + k * 0.48), y - h * 0.58, ww * 0.28, 2 * sc); }
      // маркиза
      for (let s = 0; s < 8; s++) { ctx.fillStyle = dim(s % 2 ? '#f0ece4' : '#1a3a6a'); ctx.beginPath(); ctx.moveTo(wx0 - 2 * sc + (s / 8) * (ww + 4 * sc), y - h * 0.52); ctx.lineTo(wx0 - 2 * sc + ((s + 1) / 8) * (ww + 4 * sc), y - h * 0.52); ctx.lineTo(wx0 - 2 * sc + ((s + 1) / 8) * (ww + 4 * sc) + 6 * sc, y - h * 0.42); ctx.lineTo(wx0 - 2 * sc + (s / 8) * (ww + 4 * sc) + 6 * sc, y - h * 0.42); ctx.fill(); }
      // витрина с марлином
      const vx = wx0 + ww * 0.08, vy = y - h * 0.4, vw = ww * 0.56, vh = h * 0.34;
      ctx.fillStyle = f.win(4, '#ffe8c0'); ctx.fillRect(vx, vy, vw, vh);
      ctx.fillStyle = dim('#3a5a8a'); ctx.beginPath(); ctx.moveTo(vx + vw * 0.1, vy + vh * 0.5); ctx.quadraticCurveTo(vx + vw * 0.5, vy + vh * 0.2, vx + vw * 0.9, vy + vh * 0.5); ctx.quadraticCurveTo(vx + vw * 0.5, vy + vh * 0.8, vx + vw * 0.1, vy + vh * 0.5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(vx + vw * 0.86, vy + vh * 0.5); ctx.lineTo(vx + vw * 1.0, vy + vh * 0.3); ctx.lineTo(vx + vw * 0.98, vy + vh * 0.7); ctx.fill();
      ctx.fillStyle = dim('#2a2a30'); ctx.fillRect(vx + vw * 0.02, vy + vh * 0.46, vw * 0.12, 1.4 * sc);
      ctx.strokeStyle = dim('#2a2a30'); ctx.lineWidth = 1 * sc; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(vx + vw * 0.15 + k * 5 * sc, vy + vh); ctx.lineTo(vx + vw * 0.2 + k * 5 * sc, vy + vh * 0.75); ctx.stroke(); }
      ctx.fillStyle = dim('#1a3a6a'); ctx.fillRect(vx - 3 * sc, vy - 3 * sc, vw + 6 * sc, 3 * sc); ctx.fillRect(vx - 3 * sc, vy, 3 * sc, vh); ctx.fillRect(vx + vw, vy, 3 * sc, vh);
      door(f, wx0 + ww * 0.72, y - h * 0.4, ww * 0.2, h * 0.4, '#2a3a4a');
      // чугунные колонны
      ctx.fillStyle = dim('#1a2a3a'); ctx.fillRect(wx0 - 1 * sc, y - h * 0.52, 3 * sc, h * 0.52); ctx.fillRect(wx0 + ww - 2 * sc, y - h * 0.52, 3 * sc, h * 0.52);
      ctx.fillStyle = dim('#e8e4dc'); ctx.font = `bold ${4.5 * sc}px Georgia, serif`; ctx.textAlign = 'center'; ctx.fillText('OLD PIER TACKLE', x, y - h * 0.55); ctx.textAlign = 'left';
      sign(f, wx0 + ww, y - h * 0.78, 16 * sc, 12 * sc, '#1a3a6a', (c) => { c.fillStyle = '#f0ece4'; c.beginPath(); c.moveTo(-5 * sc, 0); c.quadraticCurveTo(0, -4 * sc, 5 * sc, 0); c.quadraticCurveTo(0, 4 * sc, -5 * sc, 0); c.fill(); c.beginPath(); c.moveTo(4 * sc, 0); c.lineTo(7 * sc, -3 * sc); c.lineTo(7 * sc, 3 * sc); c.fill(); }, 3);
      return y - h - 13 * sc;
    }
    if (b === 'shipyard') {
      // марина: плавучие доки, мачты, подъёмник с яхтой в стропах
      const h = w * 0.9;
      ctx.fillStyle = dim('#6a5a48'); ctx.fillRect(x0 - 10 * sc, y - 3 * sc, w + 20 * sc, 4 * sc);
      // яхты у понтона — мачты
      for (let k = 0; k < 6; k++) {
        const mx = x0 + w * (0.05 + k * 0.17), mh = (50 + f.h(k + 20) * 40) * sc, sway = Math.sin(t * 1.2 + k) * 1.5 * sc;
        ctx.strokeStyle = dim('#c8c8c8'); ctx.lineWidth = 1.4 * sc; ctx.beginPath(); ctx.moveTo(mx, y - 2 * sc); ctx.lineTo(mx + sway, y - mh); ctx.stroke();
        ctx.strokeStyle = hexA(dim('#8a8a8a'), 0.7); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(mx + sway, y - mh); ctx.lineTo(mx + 14 * sc, y - 2 * sc); ctx.moveTo(mx + sway, y - mh); ctx.lineTo(mx - 12 * sc, y - 2 * sc); ctx.stroke();
        ctx.fillStyle = dim(k % 2 ? '#f2f0ea' : '#2a4a6a'); ctx.beginPath(); ctx.moveTo(mx - 14 * sc, y - 2 * sc); ctx.lineTo(mx + 16 * sc, y - 3 * sc); ctx.lineTo(mx + 12 * sc, y + 4 * sc); ctx.lineTo(mx - 10 * sc, y + 4 * sc); ctx.fill();
        if (f.lit && k % 2 === 0) f.glow(mx + sway, y - mh, 1 * sc, '#ffffff', night * 0.7);
        ctx.fillStyle = dim('#c84030'); ctx.beginPath(); ctx.moveTo(mx + sway, y - mh + 2 * sc); ctx.lineTo(mx + sway + 6 * sc + Math.sin(t * 6 + k) * 1.5, y - mh + 4 * sc); ctx.lineTo(mx + sway, y - mh + 6 * sc); ctx.fill();
      }
      // подъёмник (travel-lift)
      const lx = x0 + w * 0.72, lw = w * 0.34, lh = h * 0.7;
      ctx.fillStyle = dim('#2a6ab0'); ctx.fillRect(lx, y - lh, 5 * sc, lh); ctx.fillRect(lx + lw, y - lh, 5 * sc, lh); ctx.fillRect(lx, y - lh, lw + 5 * sc, 6 * sc);
      ctx.fillStyle = dim('#1a1a1c'); for (const dx of [0, lw]) { ctx.beginPath(); ctx.arc(lx + dx + 2.5 * sc, y - 1 * sc, 5 * sc, 0, Math.PI * 2); ctx.fill(); }
      const bob = Math.sin(t * 0.6) * 1.5 * sc;
      ctx.strokeStyle = dim('#d8d8a0'); ctx.lineWidth = 1.6 * sc; for (const q of [0.25, 0.75]) { ctx.beginPath(); ctx.moveTo(lx + 2.5 * sc + lw * q, y - lh + 6 * sc); ctx.lineTo(lx + 2.5 * sc + lw * q, y - lh * 0.5 + bob); ctx.stroke(); }
      ctx.fillStyle = dim('#f2f0ea'); ctx.beginPath(); ctx.moveTo(lx + 4 * sc, y - lh * 0.5 + bob); ctx.lineTo(lx + lw, y - lh * 0.52 + bob); ctx.quadraticCurveTo(lx + lw - 6 * sc, y - lh * 0.28 + bob, lx + lw * 0.7, y - lh * 0.25 + bob); ctx.lineTo(lx + lw * 0.25, y - lh * 0.25 + bob); ctx.quadraticCurveTo(lx + 4 * sc, y - lh * 0.35 + bob, lx + 4 * sc, y - lh * 0.5 + bob); ctx.fill();
      ctx.fillStyle = dim('#1a3a6a'); ctx.fillRect(lx + 6 * sc, y - lh * 0.48 + bob, lw - 12 * sc, 2 * sc);
      ctx.fillStyle = dim('#a02a20'); ctx.beginPath(); ctx.moveTo(lx + lw * 0.25, y - lh * 0.25 + bob); ctx.lineTo(lx + lw * 0.7, y - lh * 0.25 + bob); ctx.lineTo(lx + lw * 0.55, y - lh * 0.1 + bob); ctx.lineTo(lx + lw * 0.4, y - lh * 0.1 + bob); ctx.fill();
      ctx.fillStyle = dim('#f0ece4'); ctx.fillRect(x - 22 * sc, y - h * 0.98, 44 * sc, 8 * sc); ctx.fillStyle = dim('#1a3a6a'); ctx.font = `bold ${5.5 * sc}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('MARINA MIRADOR', x, y - h * 0.98 + 6 * sc); ctx.textAlign = 'left';
      person(f, lx - 10 * sc, y, '#e8701a', { face: 1, hat: '#f0ece4' });
      return y - h;
    }
    // Суши-бар «Кит» на сваях над водой
    const h = w * 0.72, bw = w * 0.9, bx0 = x - bw / 2;
    ctx.fillStyle = dim('#3a2e24'); for (let k = 0; k < 6; k++) ctx.fillRect(bx0 + 4 * sc + (k / 5) * (bw - 10 * sc), y - 8 * sc, 3 * sc, 14 * sc);
    ctx.fillStyle = dim('#5a4838'); ctx.fillRect(bx0 - 6 * sc, y - 10 * sc, bw + 12 * sc, 4 * sc);
    const by = y - 10 * sc;
    ctx.fillStyle = dim('#4a3a30'); ctx.fillRect(bx0, by - h, bw, h);
    ctx.fillStyle = hexA('#000000', 0.15); for (let k = 0; k < bw; k += 5 * sc) ctx.fillRect(bx0 + k, by - h, 1, h);
    // крыша с загнутыми краями
    ctx.fillStyle = dim('#2a2a30'); ctx.beginPath(); ctx.moveTo(bx0 - 14 * sc, by - h + 6 * sc); ctx.quadraticCurveTo(bx0 - 2 * sc, by - h - 2 * sc, bx0 + bw * 0.5, by - h - bw * 0.22); ctx.quadraticCurveTo(bx0 + bw + 2 * sc, by - h - 2 * sc, bx0 + bw + 14 * sc, by - h + 6 * sc); ctx.lineTo(bx0 + bw + 6 * sc, by - h + 6 * sc); ctx.quadraticCurveTo(bx0 + bw * 0.5, by - h - bw * 0.14, bx0 - 6 * sc, by - h + 6 * sc); ctx.fill();
    // большое окно с тёплым интерьером
    const gx = bx0 + bw * 0.08, gw = bw * 0.6, gyy = by - h * 0.82, gh = h * 0.55;
    ctx.fillStyle = f.win(8, '#ffd8a0'); ctx.fillRect(gx, gyy, gw, gh);
    ctx.fillStyle = hexA('#5a3a2a', 0.6); ctx.fillRect(gx, gyy + gh * 0.6, gw, gh * 0.08);
    for (let k = 0; k < 3; k++) { ctx.fillStyle = hexA('#3a2a20', 0.7); ctx.beginPath(); ctx.arc(gx + gw * (0.2 + k * 0.3), gyy + gh * 0.5, 3 * sc, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(gx + gw * (0.2 + k * 0.3) - 3 * sc, gyy + gh * 0.52, 6 * sc, 6 * sc); }
    ctx.strokeStyle = dim('#2a2a30'); ctx.lineWidth = 1.2 * sc; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(gx + gw * k / 4, gyy); ctx.lineTo(gx + gw * k / 4, gyy + gh); ctx.stroke(); }
    // норэн (занавес) и дверь
    ctx.fillStyle = dim('#1a3a6a'); ctx.fillRect(bx0 + bw * 0.72, by - h * 0.62, bw * 0.22, h * 0.22);
    ctx.fillStyle = dim('#f0ece4'); ctx.font = `bold ${6 * sc}px Georgia, serif`; ctx.fillText('鯨', bx0 + bw * 0.78, by - h * 0.46);
    door(f, bx0 + bw * 0.74, by - h * 0.42, bw * 0.18, h * 0.42, '#2a2018');
    // фонарики
    for (let k = 0; k < 6; k++) lantern(f, bx0 + bw * (0.06 + k * 0.17), by - h + 4 * sc, k % 2 ? '#ff5040' : '#ffb040', 3 * sc, k);
    // неоновый кит
    const nx = bx0 + bw * 0.42, ny = by - h - bw * 0.06;
    ctx.save(); if (f.lit) { ctx.shadowColor = '#60c0ff'; ctx.shadowBlur = 8 * sc; ctx.strokeStyle = `rgba(120,200,255,${(0.8 + 0.2 * Math.sin(t * 7)).toFixed(3)})`; } else ctx.strokeStyle = dim('#60a0c8');
    ctx.lineWidth = 1.6 * sc; ctx.beginPath(); ctx.moveTo(nx - 14 * sc, ny); ctx.quadraticCurveTo(nx - 4 * sc, ny - 10 * sc, nx + 8 * sc, ny - 2 * sc); ctx.quadraticCurveTo(nx + 12 * sc, ny - 8 * sc, nx + 16 * sc, ny - 8 * sc); ctx.moveTo(nx + 8 * sc, ny - 2 * sc); ctx.quadraticCurveTo(nx + 12 * sc, ny + 4 * sc, nx + 16 * sc, ny + 3 * sc); ctx.moveTo(nx + 8 * sc, ny - 2 * sc); ctx.quadraticCurveTo(nx - 2 * sc, ny + 5 * sc, nx - 14 * sc, ny); ctx.stroke(); ctx.restore();
    ctx.fillStyle = dim('#f0ece4'); ctx.font = `bold ${5 * sc}px Georgia, serif`; ctx.textAlign = 'center'; ctx.fillText('СУШИ-БАР «КИТ»', nx, ny + 12 * sc); ctx.textAlign = 'left';
    if (f.lit) f.pool(x, by - h * 0.4, bw * 0.8, '#ffc880', 0.25 * night);
    return by - h - bw * 0.22;
  },

  extras(f) {
    const { ctx, W, sc, gY: y, t, dim } = f;
    // колесо обозрения за мариной
    const cx = W * 0.76, cy = y - 118 * sc, r = 62 * sc;
    ctx.strokeStyle = dim('#d8d0c0'); ctx.lineWidth = 2 * sc; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1 * sc; ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + t * 0.07;
      ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke();
      const gx = cx + Math.cos(a) * r, gy = cy + Math.sin(a) * r;
      ctx.fillStyle = dim(['#b83a2a', '#2a5a8a', '#d8a030', '#3a9a5a'][i % 4]); ctx.fillRect(gx - 4 * sc, gy, 8 * sc, 7 * sc);
      if (f.night > 0.3) f.glow(gx, gy - 1, 1.3 * sc, ['#ffd890', '#80d0ff', '#ff9a9a'][i % 3], f.night * (0.6 + 0.4 * Math.sin(t * 3 + i)));
    }
    if (f.night > 0.3) for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2 - t * 2; f.glow(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.9 * sc, '#ffffff', f.night * (Math.floor(t * 4 + i) % 3 === 0 ? 0.9 : 0.2)); }
    ctx.strokeStyle = dim('#d8d0c0'); ctx.lineWidth = 3 * sc; ctx.beginPath(); ctx.moveTo(cx - 36 * sc, y); ctx.lineTo(cx, cy); ctx.lineTo(cx + 36 * sc, y); ctx.stroke();
    // трамвай курсирует по набережной
    const period = 52, ph = (t % period) / period, dir = Math.floor(t / period) % 2 ? 1 : -1;
    const tx = dir > 0 ? -90 * sc + (W + 180 * sc) * ph : W + 90 * sc - (W + 180 * sc) * ph;
    ctx.strokeStyle = hexA('#000000', 0.3); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y - 60 * sc); ctx.lineTo(W, y - 60 * sc); ctx.stroke();
    ctx.fillStyle = dim('#1a1a1c'); ctx.fillRect(0, y - 1, W, 1.2); ctx.fillRect(0, y - 5 * sc, W, 1);
    ctx.fillStyle = dim('#2a5a3a'); ctx.fillRect(tx - 34 * sc, y - 26 * sc, 68 * sc, 22 * sc);
    ctx.fillStyle = dim('#e8d8a0'); ctx.fillRect(tx - 34 * sc, y - 26 * sc, 68 * sc, 5 * sc); ctx.fillRect(tx - 36 * sc, y - 28 * sc, 72 * sc, 2.5 * sc);
    for (let k = 0; k < 6; k++) { ctx.fillStyle = f.win(k + 40, '#ffe8b0'); ctx.fillRect(tx - 30 * sc + k * 10.5 * sc, y - 20 * sc, 8 * sc, 8 * sc); }
    ctx.fillStyle = dim('#1a1a1c'); for (const dx of [-22, 22]) { ctx.beginPath(); ctx.arc(tx + dx * sc, y - 3 * sc, 3 * sc, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = dim('#3a3a3a'); ctx.lineWidth = 1 * sc; ctx.beginPath(); ctx.moveTo(tx, y - 28 * sc); ctx.lineTo(tx - 10 * sc * dir, y - 60 * sc); ctx.stroke();
    if (f.night > 0.3) { f.glow(tx + 34 * sc * dir, y - 14 * sc, 1.8 * sc, '#ffffff', f.night); f.glow(tx - 10 * sc * dir, y - 60 * sc, 1 * sc, '#80c0ff', f.random() < 0.1 ? 1 : 0.2); }
    ctx.fillStyle = dim('#f0ece4'); ctx.font = `${3.5 * sc}px Inter, sans-serif`; ctx.fillText('MIRADOR WHARF', tx - 14 * sc, y - 22.5 * sc);
    // тележка с чаудером и очередь
    { const cx = W * 0.405; ctx.fillStyle = dim('#f0ece4'); ctx.fillRect(cx - 10 * sc, y - 16 * sc, 20 * sc, 12 * sc); ctx.fillStyle = dim('#b83a2a'); ctx.fillRect(cx - 12 * sc, y - 18 * sc, 24 * sc, 3 * sc); for (let s = 0; s < 6; s++) { ctx.fillStyle = dim(s % 2 ? '#f0ece4' : '#b83a2a'); ctx.beginPath(); ctx.moveTo(cx - 14 * sc + (s / 6) * 28 * sc, y - 30 * sc); ctx.lineTo(cx - 14 * sc + ((s + 1) / 6) * 28 * sc, y - 30 * sc); ctx.lineTo(cx - 14 * sc + ((s + 1) / 6) * 28 * sc, y - 25 * sc); ctx.lineTo(cx - 14 * sc + (s / 6) * 28 * sc, y - 25 * sc); ctx.fill(); } ctx.fillStyle = dim('#3a3a3a'); ctx.fillRect(cx - 1 * sc, y - 25 * sc, 2 * sc, 7 * sc); ctx.beginPath(); ctx.arc(cx - 7 * sc, y - 2.5 * sc, 2.5 * sc, 0, Math.PI * 2); ctx.arc(cx + 7 * sc, y - 2.5 * sc, 2.5 * sc, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dim('#2a2a30'); ctx.font = `bold ${3 * sc}px Inter, sans-serif`; ctx.fillText('CHOWDER', cx - 8 * sc, y - 9 * sc); if (f.random() < 0.08) f.smoke(cx + 4 * sc, y - 19 * sc, 1.4 * sc); person(f, cx + 1 * sc, y - 4 * sc, '#f0ece4', { face: 1, hat: '#f0ece4', scale: 0.85 }); if (f.activity > 0.4) { person(f, cx + 18 * sc, y, '#8a6a5a', { face: -1 }); person(f, cx + 27 * sc, y, '#2a3a5a', { face: -1, hat: '#3a3a44' }); } }
    // кипарис на набережной и скамейки
    cypress(f, W * 0.44, y, 70 * sc, 6);
    for (const bx of [W * 0.605, W * 0.8]) { ctx.fillStyle = dim('#3a5a3a'); ctx.fillRect(bx - 10 * sc, y - 7 * sc, 20 * sc, 2 * sc); ctx.fillRect(bx - 10 * sc, y - 12 * sc, 20 * sc, 1.6 * sc); ctx.fillRect(bx - 9 * sc, y - 7 * sc, 1.6 * sc, 7 * sc); ctx.fillRect(bx + 7 * sc, y - 7 * sc, 1.6 * sc, 7 * sc); }
    person(f, W * 0.605 + 2 * sc, y, '#8a6a5a', { sit: true, face: -1, hat: '#3a3a44' });
  },

  props(f) {
    const { ctx, W, sc, gY: y, t, dim } = f;
    for (let x = 12 * sc; x < W; x += 90 * sc) bollard(f, x, y + 2 * sc, '#2a2a2a');
    // пеликаны на сваях у марины
    for (let k = 0; k < 2; k++) { const px = W * 0.66 - 70 * sc + k * 130 * sc, py = y - 4 * sc; ctx.fillStyle = dim('#5a4838'); ctx.fillRect(px - 2 * sc, py - 14 * sc, 4 * sc, 14 * sc); ctx.fillStyle = dim('#9a9a96'); ctx.beginPath(); ctx.ellipse(px, py - 18 * sc, 5 * sc, 3.5 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(px + 3 * sc, py - 23 * sc, 2.4 * sc, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dim('#e0a050'); ctx.fillRect(px + 4 * sc, py - 23 * sc, 7 * sc, 2 * sc); }
    // старый автомобиль у магазина
    const ax = W * 0.22; ctx.fillStyle = dim('#8a3a2a'); ctx.fillRect(ax - 16 * sc, y - 10 * sc, 32 * sc, 8 * sc); ctx.fillRect(ax - 8 * sc, y - 17 * sc, 16 * sc, 7 * sc); ctx.fillStyle = f.win(50, '#c8e0f0'); ctx.fillRect(ax - 6 * sc, y - 16 * sc, 12 * sc, 5 * sc); ctx.fillStyle = dim('#1a1a1c'); for (const dx of [-10, 10]) { ctx.beginPath(); ctx.arc(ax + dx * sc, y - 2 * sc, 3 * sc, 0, Math.PI * 2); ctx.fill(); }
    // уличный музыкант с саксофоном и нотами
    const mx = W * 0.625; person(f, mx, y, '#2a2a3a', { face: 1, hat: '#3a3a44' });
    ctx.strokeStyle = dim('#d8a030'); ctx.lineWidth = 1.6 * sc; ctx.beginPath(); ctx.moveTo(mx + 2 * sc, y - 14 * sc); ctx.quadraticCurveTo(mx + 6 * sc, y - 6 * sc, mx + 8 * sc, y - 8 * sc); ctx.stroke();
    ctx.fillStyle = hexA(dim('#f0ece4'), 0.8); ctx.font = `${6 * sc}px serif`; for (let k = 0; k < 3; k++) { const ph = (t * 0.5 + k * 0.33) % 1; ctx.globalAlpha = 1 - ph; ctx.fillText('♪', mx + 10 * sc + ph * 14 * sc + Math.sin(ph * 8) * 3, y - 20 * sc - ph * 26 * sc); } ctx.globalAlpha = 1;
  },

  moored(f) {
    const { W, waterY, sc, t } = f;
    hull(f, W * 0.26, waterY + 2 * sc, sc * 1.0, '#e8e4dc', '#3a5a4a', { bob: Math.sin(t * 1.1 + 2.1) * 1.5 * sc, wheelhouse: true, long: 1.05 });
    hull(f, W * 0.08, waterY + 2 * sc, sc * 0.8, '#f2f0ea', '#1a3a6a', { bob: Math.sin(t * 1.1 + 0.4) * 1.5 * sc, mast: true });
    // морской лев на ближнем понтоне у причала
    const { ctx, dim } = f; const px = W * 0.44, py = waterY + 2 * sc + Math.sin(t * 1.3) * 1.5 * sc;
    ctx.fillStyle = dim('#6a5a48'); ctx.fillRect(px - 16 * sc, py - 2 * sc, 32 * sc, 4 * sc);
    ctx.fillStyle = dim('#5a4a3a'); ctx.beginPath(); ctx.ellipse(px, py - 5 * sc, 9 * sc, 4 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(px + 8 * sc, py - 10 * sc + Math.sin(t * 0.7) * 2 * sc, 3.5 * sc, 3 * sc, 0.3, 0, Math.PI * 2); ctx.fill();
  },

  locals(f) {
    const { ctx, W, sc, gY: y, t, dim } = f;
    // голуби у тележки
    for (let k = 0; k < 4; k++) { const px = W * 0.37 + k * 7 * sc + Math.sin(t * 0.6 + k * 2) * 4 * sc, peck = Math.max(0, Math.sin(t * 7 + k * 1.3)) * 1.5 * sc; ctx.fillStyle = dim(k % 2 ? '#6a6a78' : '#8a8a96'); ctx.beginPath(); ctx.ellipse(px, y - 2.2 * sc, 2.8 * sc, 1.8 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(px + 2.4 * sc, y - 4 * sc + peck, 1.2 * sc, 0, Math.PI * 2); ctx.fill(); }
    // рыбак на пирсе с крабовой ловушкой
    { const fx = W * 0.535; person(f, fx, y, '#3a4a3a', { face: 1, carry: 'rod', hat: '#d8a030' }); ctx.strokeStyle = dim('#5a5a5e'); ctx.lineWidth = 0.8; ctx.strokeRect(fx - 14 * sc, y - 8 * sc, 9 * sc, 8 * sc); ctx.beginPath(); ctx.moveTo(fx - 14 * sc, y - 8 * sc); ctx.lineTo(fx - 5 * sc, y); ctx.moveTo(fx - 5 * sc, y - 8 * sc); ctx.lineTo(fx - 14 * sc, y); ctx.stroke(); ctx.strokeStyle = hexA('#ffffff', 0.3); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(fx + 14 * sc, y - 27 * sc); ctx.quadraticCurveTo(fx + 20 * sc, y - 10 * sc, fx + 21 * sc, f.waveY(fx + 21 * sc)); ctx.stroke(); }
    // турист с фотоаппаратом и чайка, ворующая картошку
    person(f, W * 0.775, y, '#b8b0a0', { face: -1, hat: '#d8c8a0' }); ctx.fillStyle = dim('#2a2a2a'); ctx.fillRect(W * 0.775 - 7 * sc, y - 17 * sc, 4 * sc, 3 * sc);
    const gx = W * 0.815 + Math.sin(t * 2) * 3 * sc; ctx.fillStyle = dim('#f4f4f4', 0.8); ctx.beginPath(); ctx.ellipse(gx, y - 3 * sc, 3.5 * sc, 2.2 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(gx + 3 * sc, y - 5.5 * sc, 1.6 * sc, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dim('#f0c040'); ctx.fillRect(gx + 4.5 * sc, y - 5.8 * sc, 2 * sc, 0.9 * sc); ctx.fillRect(gx + 1 * sc, y - 1 * sc, 2 * sc, 1 * sc);
  },

  foreground(f) {
    // клочья тумана на переднем плане
    const { ctx, W, H, t } = f;
    const fc = f.A.palette.fog;
    for (let k = 0; k < 3; k++) {
      const x = ((t * (12 + k * 6) + k * W * 0.4) % (W * 1.6)) - W * 0.3, y = H * (0.55 + k * 0.12);
      const g = ctx.createRadialGradient(x, y, 0, x, y, W * 0.22);
      g.addColorStop(0, hexA(fc, 0.16 * (1 - f.night * 0.5))); g.addColorStop(1, hexA(fc, 0));
      ctx.fillStyle = g; ctx.fillRect(x - W * 0.22, y - W * 0.1, W * 0.44, W * 0.2);
    }
  },

  lamp(f, x) {
    const { ctx, sc, quayY, waterY, t, night, dim } = f;
    const ly = quayY - 52 * sc;
    ctx.fillStyle = dim('#2a2a30'); ctx.fillRect(x - 1.4 * sc, ly, 2.8 * sc, 46 * sc); ctx.fillRect(x - 5 * sc, quayY - 8 * sc, 10 * sc, 3 * sc);
    ctx.fillRect(x - 9 * sc, ly, 18 * sc, 1.5 * sc);
    for (const dx of [-8, 0, 8]) { const gy = ly - (dx === 0 ? 6 : 3) * sc; ctx.fillStyle = night > 0.25 ? '#fff4d8' : dim('#d8d8d8'); ctx.beginPath(); ctx.arc(x + dx * sc, gy, 3 * sc, 0, Math.PI * 2); ctx.fill(); if (night > 0.25 || f.A.fog > 0.4) f.glow(x + dx * sc, gy, 4 * sc, '#ffe6b0', Math.max(night, f.A.fog * 0.5) * 0.9); }
    if (night > 0.25) { f.pool(x, quayY, 70 * sc, '#ffd8a0', 0.2 * night); ctx.fillStyle = `rgba(255,220,160,${(0.22 * night).toFixed(3)})`; for (let k = 0; k < 6; k++) ctx.fillRect(x - 1.5 + Math.sin(t * 3 + k * 1.7 + x) * 2, waterY + 6 + k * 9 * sc, 3, 6 * sc); }
  },
};
