import type { PF, PortKit } from '../portFrame';
import { aerial, airplane, shoreLights } from '../portHorizon';
import { barrel, bollard, crate, door, fishCrate, flag, hull, mountainRidge, person, pine, ridgePath, silhouettes, snowCaps, table, windowRect } from '../portParts';
import { hexA, mix } from '../util';

/** Ганзейский пакгауз: узкий, высокий, вертикальная доска, крутой фронтон, подъёмная балка */
function brygge(f: PF, x: number, y: number, w: number, h: number, col: string, trim: string, seed: number, o: { hoist?: boolean; stilts?: boolean; snow?: boolean } = {}) {
  const { ctx, sc } = f;
  const x0 = x - w / 2;
  if (o.stilts) { ctx.fillStyle = f.dim('#3a3028'); for (let k = 0; k < 5; k++) ctx.fillRect(x0 + 3 * sc + (k / 4) * (w - 8 * sc), y - 8 * sc, 3 * sc, 10 * sc); ctx.fillRect(x0, y - 10 * sc, w, 3 * sc); }
  const by = o.stilts ? y - 10 * sc : y;
  ctx.fillStyle = f.dim(col); ctx.fillRect(x0, by - h, w, h);
  ctx.fillStyle = hexA('#000000', 0.16); for (let k = 0; k < w; k += 5 * sc) ctx.fillRect(x0 + k, by - h, 1, h);
  // фронтон
  const gh = w * 0.55;
  ctx.fillStyle = f.dim(col); ctx.beginPath(); ctx.moveTo(x0, by - h); ctx.lineTo(x, by - h - gh); ctx.lineTo(x0 + w, by - h); ctx.fill();
  ctx.fillStyle = hexA('#000000', 0.16); for (let k = 2 * sc; k < w - 2 * sc; k += 5 * sc) { const q = Math.abs(k - w / 2) / (w / 2); ctx.fillRect(x0 + k, by - h - gh * (1 - q), 1, gh * (1 - q)); }
  ctx.strokeStyle = f.dim(trim); ctx.lineWidth = 2 * sc; ctx.beginPath(); ctx.moveTo(x0 - 3 * sc, by - h + 1); ctx.lineTo(x, by - h - gh - 2 * sc); ctx.lineTo(x0 + w + 3 * sc, by - h + 1); ctx.stroke();
  if (o.snow) { ctx.strokeStyle = f.dim('#eef4f8', 0.5); ctx.lineWidth = 3 * sc; ctx.beginPath(); ctx.moveTo(x0 - 3 * sc, by - h + 1); ctx.lineTo(x, by - h - gh - 2 * sc); ctx.lineTo(x0 + w + 3 * sc, by - h + 1); ctx.stroke(); }
  // окна
  const rows = Math.max(1, Math.round(h / (26 * sc)));
  for (let r = 0; r < rows; r++) for (let k = 0; k < 2; k++) {
    windowRect(f, x0 + w * (0.18 + k * 0.42), by - h + h * ((r + 0.25) / rows), w * 0.2, h / rows * 0.4, trim, seed + r * 2 + k);
  }
  windowRect(f, x - w * 0.1, by - h - gh * 0.45, w * 0.2, gh * 0.3, trim, seed + 9);
  if (o.hoist) {
    ctx.fillStyle = f.dim('#3a3028'); ctx.fillRect(x - 1.5 * sc, by - h - gh * 0.9, 3 * sc, gh * 0.2); ctx.fillRect(x - 1.5 * sc, by - h - gh * 0.9, 14 * sc, 2 * sc);
    const sw = Math.sin(f.t * 1.1 + seed) * 2 * sc;
    ctx.strokeStyle = f.dim('#8a8a8a'); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x + 12 * sc, by - h - gh * 0.9 + 2 * sc); ctx.lineTo(x + 12 * sc + sw, by - h * 0.55); ctx.stroke();
    crate(f, x + 8 * sc + sw, by - h * 0.55 + 8 * sc, 8 * sc, 8 * sc, '#8a6a42');
  }
  return by - h - gh;
}

/** Вешала для сушки трески */
function hjell(f: PF, x: number, y: number, w: number) {
  const { ctx, sc, t } = f;
  const h = 46 * sc;
  ctx.strokeStyle = f.dim('#5a4a3a'); ctx.lineWidth = 2 * sc;
  for (let k = 0; k <= 3; k++) { const px = x + (k / 3) * w; ctx.beginPath(); ctx.moveTo(px - 7 * sc, y); ctx.lineTo(px, y - h); ctx.lineTo(px + 7 * sc, y); ctx.stroke(); }
  ctx.lineWidth = 1.4 * sc; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + w, y - h); ctx.moveTo(x, y - h * 0.6); ctx.lineTo(x + w, y - h * 0.6); ctx.stroke();
  for (let row = 0; row < 2; row++) {
    const ry = row ? y - h * 0.6 : y - h;
    const n = Math.floor(w / (5 * sc));
    for (let k = 0; k < n; k++) {
      const fx = x + 2 * sc + k * 5 * sc, sw = Math.sin(t * 2 + k + row) * 0.8 * sc;
      ctx.fillStyle = f.dim(k % 3 ? '#c8b088' : '#b89a78');
      ctx.beginPath(); ctx.moveTo(fx, ry); ctx.lineTo(fx + 2 * sc + sw, ry + 10 * sc); ctx.lineTo(fx + 1 * sc + sw, ry + 15 * sc); ctx.lineTo(fx - 1 * sc + sw, ry + 15 * sc); ctx.lineTo(fx - 2 * sc + sw, ry + 10 * sc); ctx.closePath(); ctx.fill();
    }
  }
}

function crane(f: PF, x: number, y: number, h: number, boom: number, dir: 1 | -1, col: string, load: boolean) {
  const { ctx, sc, t } = f;
  ctx.strokeStyle = f.dim(col); ctx.lineWidth = 4 * sc;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.lineTo(x + boom * dir, y - h); ctx.moveTo(x, y - h * 0.86); ctx.lineTo(x + boom * 0.6 * dir, y - h); ctx.stroke();
  ctx.lineWidth = 1.2 * sc; ctx.strokeStyle = hexA('#000000', 0.3);
  for (let k = 1; k < h / (14 * sc); k++) { ctx.beginPath(); ctx.moveTo(x - 2 * sc, y - k * 14 * sc); ctx.lineTo(x + 2 * sc, y - k * 14 * sc - 7 * sc); ctx.stroke(); }
  ctx.fillStyle = f.dim(col); ctx.fillRect(x - 6 * sc, y - h - 4 * sc, 12 * sc, 8 * sc);
  ctx.fillStyle = f.dim('#2a2a2a'); ctx.fillRect(x - boom * 0.22 * dir - 6 * sc, y - h - 2 * sc, 12 * sc, 6 * sc);
  if (load) {
    const sway = Math.sin(t * 0.7) * 4 * sc, lx = x + boom * 0.7 * dir + sway;
    ctx.strokeStyle = f.dim('#2a2a2a'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + boom * 0.7 * dir, y - h); ctx.lineTo(lx, y - h * 0.45); ctx.stroke();
    ctx.fillStyle = f.dim('#2a6aa0'); ctx.fillRect(lx - 10 * sc, y - h * 0.45, 20 * sc, 9 * sc);
    ctx.fillStyle = hexA('#000000', 0.2); for (let k = 0; k < 5; k++) ctx.fillRect(lx - 10 * sc + k * 4 * sc, y - h * 0.45, 1, 9 * sc);
  }
  if (f.night > 0.3 && !f.reflecting) f.glow(x, y - h - 5 * sc, 2 * sc, '#ff4040', f.night * (0.6 + 0.4 * Math.sin(t * 3)));
}

export const nordhavnKit: PortKit = {
  layout: { market: 0.14, tavern: 0.33, shop: 0.5, dock: 0.66, shipyard: 0.86 },
  quay: 'concrete',
  pal: { quay: '#4a4a4c', quayFace: '#2e2e30', water: ['#2e6a7a', '#08202c'], lamp: '#3a3e44', lampLight: '#dfe8ff' },
  walkers: { n: 6, cols: ['#e8c030', '#3a3a44', '#c84030', '#2a3a5a', '#e8c030'], speed: 0.9, hats: true },
  lampXs: [0.07, 0.386, 0.55, 0.745, 0.96],
  birds: { kind: 'gull', n: 7 },
  traffic: [
    { kind: 'trawler', hull: '#2a2a2e', trim: '#f0ece4', scale: 1.0, period: 48, lane: 0.5 },
    { kind: 'ferry', hull: '#1a1a1c', trim: '#f0ece4', scale: 1.15, period: 95, lane: 0.2, offset: 30 },
    { kind: 'tug', hull: '#c8402a', trim: '#f0ece4', scale: 0.9, period: 60, lane: 0.72, offset: 12 },
  ],
  hotBoard: 0.085,
  lampTop: 64,
  hours: { market: [5.5, 13], shop: [9, 18], shipyard: [7, 22], tavern: [11, 25] },
  cold: (f) => f.A.season === 3 || (f.A.season !== 1 && f.night > 0.5),
  farShips: [
    { kind: 'container', depth: 0.08, period: 380, dir: -1, hull: '#1e2a36' },
    { kind: 'cruise', depth: 0.2, period: 330, dir: 1, offset: 120, hull: '#1a1a1c' },
    { kind: 'trawler', depth: 0.5, period: 140, dir: 1, offset: 40, hull: '#2a2a2e' },
    { kind: 'trawler', depth: 0.65, period: 170, dir: -1, offset: 95, hull: '#8e2a1e' },
    { kind: 'tug', depth: 0.35, period: 200, dir: -1, offset: 10, hull: '#c8402a' },
  ],

  horizon(f) {
    const { ctx, W, H, hY, sc, t, A } = f;
    // противоположный берег фьорда: крутой склон с снегом и рыбацкая деревня у воды
    ctx.fillStyle = aerial(f, '#3a4a52', 0.92);
    ctx.beginPath(); ctx.moveTo(0, hY + 1);
    for (let x = 0; x <= W * 0.5; x += 5) { const q = x / (W * 0.5); ctx.lineTo(x, hY - H * 0.07 * (1 - q) * (0.8 + Math.sin(q * 20) * 0.2) - H * 0.01); }
    ctx.lineTo(W * 0.5, hY + 1); ctx.fill();
    ctx.fillStyle = aerial(f, '#eef4f8', 0.9);
    ctx.beginPath(); ctx.moveTo(0, hY - H * 0.08); for (let x = 0; x <= W * 0.3; x += 5) { const q = x / (W * 0.5); ctx.lineTo(x, hY - H * 0.07 * (1 - q) * (0.8 + Math.sin(q * 20) * 0.2) - H * 0.01); } ctx.lineTo(W * 0.3, hY - H * 0.08 * 0.4 - 10 * sc); ctx.lineTo(0, hY - H * 0.08 - 14 * sc); ctx.fill();
    // деревня: красные домики и причал
    for (let i = 0; i < 9; i++) { const x = W * (0.08 + i * 0.032) + f.h(i + 50) * 5; const hh = (2.5 + f.h(i + 51) * 2) * sc; ctx.fillStyle = aerial(f, i % 3 ? '#9a2a1e' : '#e8d8b0', 0.88); ctx.fillRect(x, hY - hh, 3 * sc, hh); ctx.fillStyle = aerial(f, '#2a2a2e', 0.88); ctx.fillRect(x - 0.5 * sc, hY - hh - 1 * sc, 4 * sc, 1 * sc); }
    ctx.fillStyle = aerial(f, '#3a3028', 0.85); ctx.fillRect(W * 0.07, hY, W * 0.3, 1.2 * sc);
    shoreLights(f, Array.from({ length: 9 }, (_, i) => [W * (0.085 + i * 0.032), 1.5, '#ffd890'] as [number, number, string]), hY - 1);
    // буровая платформа далеко в море — факел горит днём и ночью
    { const x = W * 0.84, y = hY + 1; const d = 0.9; ctx.fillStyle = aerial(f, '#4a4a52', d); for (const dx of [-7, 7]) ctx.fillRect(x + dx * sc - 1.2 * sc, y - 9 * sc, 2.4 * sc, 9 * sc); ctx.fillRect(x - 11 * sc, y - 13 * sc, 22 * sc, 4 * sc); ctx.fillStyle = aerial(f, '#e8eef2', d); ctx.fillRect(x - 8 * sc, y - 18 * sc, 10 * sc, 5 * sc); ctx.fillStyle = aerial(f, '#d8a030', d); ctx.fillRect(x + 4 * sc, y - 24 * sc, 1.6 * sc, 11 * sc); ctx.strokeStyle = aerial(f, '#4a4a52', d); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x - 2 * sc, y - 18 * sc); ctx.lineTo(x - 2 * sc, y - 30 * sc); ctx.stroke(); const fl = 1 + Math.sin(t * 9) * 0.3; f.glow(x + 4.8 * sc, y - 26 * sc, 2.2 * sc * fl, '#ff9a30', 0.7); ctx.fillStyle = `rgba(255,200,80,${(0.8).toFixed(2)})`; ctx.beginPath(); ctx.moveTo(x + 3 * sc, y - 24 * sc); ctx.quadraticCurveTo(x + 5 * sc + A.windDir * 3 * sc, y - 30 * sc * fl, x + 7 * sc, y - 24 * sc); ctx.fill(); if (f.random() < 0.06 && !f.reflecting) f.smoke(x + 5 * sc, y - 30 * sc, 1.6 * sc, true); if (f.night > 0.3) { f.glow(x - 2 * sc, y - 31 * sc, 1 * sc, '#ff4040', f.night * (Math.floor(t * 2) % 2)); ctx.fillStyle = `rgba(255,220,160,${(0.6 * f.night).toFixed(3)})`; for (let k = 0; k < 5; k++) ctx.fillRect(x - 7 * sc + k * 2.6 * sc, y - 16 * sc, 1 * sc, 1 * sc); } }
    // скоростной паром пересекает фьорд с большим буруном
    { const ph = (t % 48) / 48, dir = Math.floor(t / 48) % 2 ? -1 : 1; const x = dir > 0 ? -40 * sc + (W + 80 * sc) * ph : W + 40 * sc - (W + 80 * sc) * ph, y = hY + (f.waterY - hY) * 0.09; const k = sc * 0.5; ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.fillStyle = aerial(f, '#f0ece4', 0.7); ctx.beginPath(); ctx.moveTo(-22 * k, 0); ctx.lineTo(-20 * k, -6 * k); ctx.lineTo(18 * k, -6 * k); ctx.lineTo(26 * k, 0); ctx.fill(); ctx.fillRect(-16 * k, -13 * k, 30 * k, 7 * k); ctx.fillStyle = aerial(f, '#1a3a9a', 0.7); ctx.fillRect(-20 * k, -3 * k, 42 * k, 1.5 * k); ctx.fillStyle = f.night > 0.3 ? 'rgba(255,205,120,0.85)' : aerial(f, '#9ab8c8', 0.7); for (let c = 0; c < 7; c++) ctx.fillRect(-14 * k + c * 4 * k, -11 * k, 2.4 * k, 2.4 * k); ctx.restore(); ctx.fillStyle = `rgba(255,255,255,${(0.5 * (1 - f.night * 0.5)).toFixed(3)})`; for (let i = 0; i < 8; i++) { const q = i / 8; ctx.beginPath(); ctx.ellipse(x - dir * (20 + q * 60) * k, y + 1 + q, (6 + q * 14) * k, (1.2 + q * 1.2) * k, 0, 0, Math.PI * 2); ctx.fill(); } }
    airplane(f, 120, 0.1, 30);
  },

  signage(f) {
    // буквы NORDHAVN на крыше Фискехаллен
    const { ctx, W, sc, gY: y, dim } = f;
    const bw = Math.min(150 * sc, W * 0.19), x = W * 0.14, top = y - bw * 0.5 - bw * 0.13;
    const txt = 'NORDHAVN'; ctx.font = `bold ${8 * sc}px Inter, sans-serif`; const tw = ctx.measureText(txt).width;
    ctx.fillStyle = dim('#3a3e44'); for (let k = 0; k < 5; k++) ctx.fillRect(x - tw / 2 + (k / 4) * tw - 0.8 * sc, top - 14 * sc, 1.6 * sc, 14 * sc);
    ctx.fillRect(x - tw / 2 - 2 * sc, top - 14 * sc, tw + 4 * sc, 1.2 * sc);
    ctx.textAlign = 'center';
    if (f.lit) { ctx.save(); ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 6 * sc; ctx.fillStyle = '#f8f8f4'; ctx.fillText(txt, x, top - 5 * sc); ctx.restore(); }
    else { ctx.fillStyle = dim('#f0ece4'); ctx.fillText(txt, x, top - 5 * sc); }
    ctx.textAlign = 'left';
  },

  events: [
    { id: 'auction', label: 'Рыбный аукцион', from: 6, to: 9.5, draw(f) {
      const { ctx, W, sc, gY: y, t } = f;
      const x = W * 0.14, bw = Math.min(150 * sc, W * 0.19);
      for (let k = 0; k < 6; k++) person(f, x - 26 * sc + k * 9 * sc + (k % 2) * 3 * sc, y + (k % 2) * 2, ['#2a3a5a', '#e8c030', '#3a3a44', '#c84030', '#e8c030', '#5a5a5a'][k], { face: k < 3 ? 1 : -1, hat: k % 2 ? '#e8c030' : undefined });
      crate(f, x - 6 * sc, y, 12 * sc, 8 * sc, '#8a6a42');
      person(f, x, y - 8 * sc, '#f0ece4', { face: 1, hat: '#2a2a2a' });
      const arm = Math.sin(t * 4) > 0 ? 1 : 0; ctx.fillStyle = f.dim('#f0ece4'); ctx.fillRect(x + 3 * sc, y - 22 * sc - arm * 6 * sc, 1.6 * sc, 6 * sc);
      ctx.fillStyle = f.dim('#f0ece4'); ctx.fillRect(x - 40 * sc, y - 30 * sc, 18 * sc, 10 * sc); ctx.fillStyle = f.dim('#8e2a1e'); ctx.font = `bold ${4.5 * sc}px Inter, sans-serif`; ctx.fillText(`${38 + Math.floor(t / 3) % 9} kr`, x - 38 * sc, y - 23 * sc);
      for (let k = 0; k < 4; k++) fishCrate(f, x + bw * 0.3 + k * 10 * sc, y, 9 * sc, 6 * sc, '#c8d8e0');
    } },
    { id: 'school', label: 'Школьники идут домой', from: 13.5, to: 14.5, draw(f) {
      const { W, sc, gY: y, t } = f;
      const x = W * (1.1 - ((t * 0.05) % 1) * 1.2);
      person(f, x, y, '#2a3a5a', { walk: t * 7, face: -1, hat: '#c84030' });
      for (let k = 0; k < 5; k++) person(f, x + 10 * sc + k * 8 * sc, y, '#f0e040', { walk: t * 8 + k, face: -1, scale: 0.65, hat: ['#c84030', '#2a3a5a', '#3a9a5a'][k % 3] });
    } },
    { id: 'dock_shift', label: 'Смена в сухом доке', from: 10, to: 18, draw(f) {
      const { ctx, W, sc, gY: y, t } = f;
      const bw = Math.min(150 * sc, W * 0.19), x0 = W * 0.86 - bw / 2;
      const hx = x0 + bw * 0.14;
      person(f, hx, y, '#e8701a', { face: 1, hat: '#f0c040' });
      const sw = Math.sin(t * 5); ctx.strokeStyle = f.dim('#5a3a1c'); ctx.lineWidth = 1.2 * sc; ctx.beginPath(); ctx.moveTo(hx + 2 * sc, y - 13 * sc); ctx.lineTo(hx + 9 * sc, y - 13 * sc - sw * 9 * sc); ctx.stroke(); ctx.fillStyle = f.dim('#3a3a3e'); ctx.fillRect(hx + 7 * sc, y - 15.5 * sc - sw * 9 * sc, 4 * sc, 4 * sc);
      if (sw < -0.95 && f.random() < 0.5) f.spark(hx + 9 * sc, y - 4 * sc);
      person(f, x0 + bw * 0.55 + Math.sin(t * 0.4) * 20 * sc, y, '#3a3a44', { walk: t * 6, face: Math.cos(t * 0.4) > 0 ? 1 : -1, cart: true, hat: '#f0c040' });
      // переносной прожектор на треноге
      ctx.strokeStyle = f.dim('#8a8a8a'); ctx.lineWidth = 1 * sc; for (const dx of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(x0 - 24 * sc + dx * sc, y); ctx.lineTo(x0 - 24 * sc, y - 18 * sc); ctx.stroke(); }
      ctx.fillStyle = f.dim('#f0c040'); ctx.fillRect(x0 - 28 * sc, y - 24 * sc, 8 * sc, 6 * sc); if (f.night > 0.2) f.glow(x0 - 24 * sc, y - 21 * sc, 3 * sc, '#ffffff', f.night);
    } },
    { id: 'terrace', label: 'Вечер в Шёхусет', from: 18, to: 24, draw(f) {
      const { ctx, W, sc, gY: y } = f;
      const bw = Math.min(150 * sc, W * 0.19), x = W * 0.33, x0 = x - bw / 2;
      const w = bw * 0.78, h = bw * 0.68, wx0 = x - w / 2;
      for (let k = 0; k < 2; k++) silhouettes(f, wx0 + w * (0.18 + k * 0.42), y - h + h * 0.6, w * 0.2, h * 0.16, 2, k * 5 + 1);
      table(f, x0 - 2 * sc, y - 8 * sc, 6 * sc, '#4a3a2c');
      person(f, x0 - 10 * sc, y - 7 * sc, '#8e2a1e', { sit: true, face: 1, hat: '#e8c030', scale: 0.9 }); person(f, x0 + 8 * sc, y - 7 * sc, '#2a3a5a', { sit: true, face: -1, scale: 0.9 });
      if (f.lit) { f.glow(x0 - 2 * sc, y - 18 * sc, 1.6 * sc, '#ffcf7a', f.night); f.pool(x0 - 2 * sc, y - 6 * sc, 24 * sc, '#ffbe6e', 0.25 * f.night); }
      ctx.fillStyle = f.dim('#e8d8a0'); ctx.fillRect(x0 - 5 * sc, y - 20 * sc, 2.4 * sc, 3 * sc); ctx.fillRect(x0 + 1 * sc, y - 20 * sc, 2.4 * sc, 3 * sc);
      ctx.fillStyle = f.dim('#f4f4f4', 0.8); ctx.beginPath(); ctx.ellipse(x0 + 20 * sc, y - 2.5 * sc, 3.2 * sc, 2 * sc, 0, 0, Math.PI * 2); ctx.fill();
    } },
    { id: 'aurora_watch', label: 'Смотрят сияние', from: 22, to: 27, seasons: [0, 2, 3], draw(f) {
      if (f.A.aurora < 0.15) return;
      const { ctx, W, sc, gY: y, t } = f;
      const x = W * 0.62;
      person(f, x, y, '#d8402a', { face: 1, hat: '#f0ece4' }); person(f, x + 9 * sc, y, '#2a3a5a', { face: 1, hat: '#e8c030' }); person(f, x + 30 * sc, y, '#3a3a44', { face: -1 });
      ctx.strokeStyle = f.dim('#8a8a8a'); ctx.lineWidth = 1 * sc; for (const dx of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(x + 22 * sc + dx * sc, y); ctx.lineTo(x + 22 * sc, y - 16 * sc); ctx.stroke(); }
      ctx.fillStyle = f.dim('#2a2a2a'); ctx.fillRect(x + 19 * sc, y - 20 * sc, 6 * sc, 4 * sc);
      if (Math.sin(t * 0.7) > 0.98) f.glow(x + 22 * sc, y - 18 * sc, 6 * sc, '#ffffff', 1);
      ctx.fillStyle = hexA('#e8c8a8', 0.9); ctx.fillRect(x + 1 * sc, y - 20 * sc, 2 * sc, 1.5 * sc); ctx.fillRect(x + 10 * sc, y - 20 * sc, 2 * sc, 1.5 * sc);
    } },
  ],

  backRow(f) {
    const { ctx, W, sc, gY, dim } = f;
    const y = gY - 9 * sc;
    const haze = (c: string) => dim(mix(c, f.A.palette.skyHor, 0.2), 0.8);
    const snow = f.A.season === 3 || f.A.snow > 0.1;
    // плотный ряд пакгаузов-брюгген
    const row: [number, string, number][] = [[0.0, '#8e2a1e', 34], [0.03, '#d8a030', 30], [0.062, '#f0ece4', 36], [0.2, '#8e2a1e', 32], [0.235, '#e8d8b0', 28], [0.27, '#3a5a6a', 34], [0.42, '#b8722a', 30], [0.455, '#8e2a1e', 36], [0.6, '#f0ece4', 30], [0.625, '#8e2a1e', 34], [0.78, '#d8a030', 28], [0.97, '#8e2a1e', 32], [1.0, '#e8d8b0', 30]];
    for (const [qx, col, hh] of row) {
      const x = W * qx, w = 20 * sc, h = hh * sc;
      ctx.fillStyle = haze(col); ctx.fillRect(x - w / 2, y - h, w, h);
      ctx.fillStyle = hexA('#000000', 0.12); for (let k = 0; k < w; k += 4 * sc) ctx.fillRect(x - w / 2 + k, y - h, 1, h);
      ctx.fillStyle = haze(col); ctx.beginPath(); ctx.moveTo(x - w / 2, y - h); ctx.lineTo(x, y - h - w * 0.55); ctx.lineTo(x + w / 2, y - h); ctx.fill();
      ctx.strokeStyle = haze('#f0ece4'); ctx.lineWidth = 1.2 * sc; ctx.beginPath(); ctx.moveTo(x - w / 2 - 1, y - h); ctx.lineTo(x, y - h - w * 0.55 - 1); ctx.lineTo(x + w / 2 + 1, y - h); ctx.stroke();
      if (snow) { ctx.strokeStyle = haze('#f4f8fb'); ctx.lineWidth = 2 * sc; ctx.stroke(); }
      for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) { ctx.fillStyle = f.win(qx * 100 + r * 2 + k); ctx.fillRect(x - w * 0.32 + k * w * 0.42, y - h + h * (0.2 + r * 0.4), w * 0.2, h * 0.2); }
    }
    // белая церковь с чёрным шпилем
    { const x = W * 0.33, w = 26 * sc, h = 30 * sc; ctx.fillStyle = haze('#f4f2ec'); ctx.fillRect(x - w / 2, y - h, w, h); ctx.fillRect(x - 5 * sc, y - h - 22 * sc, 10 * sc, 22 * sc); ctx.fillStyle = haze('#2a2a2e'); ctx.beginPath(); ctx.moveTo(x - w / 2 - 2 * sc, y - h); ctx.lineTo(x, y - h - 10 * sc); ctx.lineTo(x + w / 2 + 2 * sc, y - h); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 6 * sc, y - h - 22 * sc); ctx.lineTo(x, y - h - 46 * sc); ctx.lineTo(x + 6 * sc, y - h - 22 * sc); ctx.fill(); ctx.fillStyle = haze('#d8b060'); ctx.fillRect(x - 0.6 * sc, y - h - 52 * sc, 1.2 * sc, 7 * sc); ctx.fillRect(x - 2.5 * sc, y - h - 50 * sc, 5 * sc, 1.2 * sc); for (let k = 0; k < 3; k++) { ctx.fillStyle = f.win(k + 77); ctx.fillRect(x - w * 0.36 + k * w * 0.3, y - h * 0.7, w * 0.14, h * 0.4); ctx.beginPath(); ctx.arc(x - w * 0.36 + k * w * 0.3 + w * 0.07, y - h * 0.7, w * 0.07, Math.PI, 0); ctx.fill(); } }
    // современный отель
    { const x = W * 0.86, w = 60 * sc, h = 40 * sc; ctx.fillStyle = haze('#4a5a6a'); ctx.fillRect(x - w / 2, y - h, w, h); ctx.fillStyle = haze('#6a7a8a'); ctx.fillRect(x - w / 2, y - h - 3 * sc, w, 3 * sc); for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) { ctx.fillStyle = f.win(r * 7 + k + 200, '#ffe0a0'); ctx.fillRect(x - w / 2 + 3 * sc + k * 8.2 * sc, y - h + 4 * sc + r * 12 * sc, 5.5 * sc, 7 * sc); } ctx.fillStyle = f.lit ? '#ff6a6a' : haze('#c84040'); ctx.font = `bold ${5 * sc}px Inter, sans-serif`; ctx.fillText('HOTEL NORD', x - w / 2 + 4 * sc, y - h - 6 * sc); }
    // киоск с сосисками и очередь
    { const x = W * 0.545, w = 18 * sc, h = 16 * sc; ctx.fillStyle = haze('#c8402a'); ctx.fillRect(x - w / 2, y - h, w, h); ctx.fillStyle = haze('#f0ece4'); ctx.fillRect(x - w / 2 - 3 * sc, y - h - 4 * sc, w + 6 * sc, 4 * sc); ctx.fillStyle = f.win(301, '#ffe0a0'); ctx.fillRect(x - w * 0.35, y - h * 0.8, w * 0.7, h * 0.4); ctx.fillStyle = haze('#f0ece4'); ctx.font = `bold ${3.5 * sc}px Inter, sans-serif`; ctx.fillText('PØLSE', x - w * 0.3, y - h - 1 * sc); if (f.random() < 0.04) f.smoke(x + w * 0.3, y - h - 5 * sc, 1.5 * sc); }
  },

  ground(f) {
    const { ctx, W, sc, gY, quayY } = f;
    // масляные пятна, следы шин погрузчика, решётка водостока
    ctx.fillStyle = hexA('#101418', 0.3);
    for (let i = 0; i < 6; i++) { const x = f.h(i + 600) * W; ctx.beginPath(); ctx.ellipse(x, gY + 2 * sc + f.h(i + 610) * 6 * sc, (6 + f.h(i) * 10) * sc, 1.8 * sc, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = hexA('#000000', 0.22); ctx.lineWidth = 1.2 * sc; ctx.setLineDash([3 * sc, 2 * sc]);
    ctx.beginPath(); ctx.moveTo(W * 0.1, gY + 4 * sc); ctx.quadraticCurveTo(W * 0.4, gY + 2 * sc, W * 0.7, gY + 5 * sc); ctx.moveTo(W * 0.1, gY + 7 * sc); ctx.quadraticCurveTo(W * 0.4, gY + 5 * sc, W * 0.7, gY + 8 * sc); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = hexA('#000000', 0.45); for (const q of [0.3, 0.62, 0.9]) { for (let k = 0; k < 5; k++) ctx.fillRect(W * q + k * 2.4 * sc, gY + 4 * sc, 1.2 * sc, 5 * sc); }
    // белая штриховка зоны погрузки у дока
    ctx.fillStyle = hexA('#ffffff', 0.25); for (let k = 0; k < 8; k++) ctx.fillRect(W * 0.6 + k * 7 * sc, gY + 1, 2 * sc, quayY + 4 * sc - gY - 1);
  },

  backdrop(f) {
    const { ctx, W, H, hY, sc, dim, A } = f;
    const sky = A.palette.skyHor;
    // самая дальняя гряда — почти растворена в небе, с ледяными шапками
    mountainRidge(f, hY + 2, H * 0.44, 7.7, dim(mix('#8a9aa8', sky, 0.62), 0.5), 1.2);
    snowCaps(f, hY + 2, H * 0.44, 7.7, dim(mix('#f4f8fb', sky, 0.5), 0.8), 1.2, 0.3);
    // дальние горы со снегом
    mountainRidge(f, hY + 2, H * 0.36, 2.2, dim(mix('#6a7a88', sky, 0.35), 0.6), 1.6);
    snowCaps(f, hY + 2, H * 0.36, 2.2, dim('#eef4f8', 0.82), 1.6, 0.21);
    // Glacier follows the mountain silhouette, never an ice polygon suspended in the sky.
    ctx.save(); ridgePath(f, hY + 2, H * 0.36, 2.2, 1.6); ctx.clip();
    ctx.fillStyle = dim('#c8dce8', 0.5);
    ctx.beginPath(); ctx.moveTo(W * 0.52, hY - H * 0.25); ctx.quadraticCurveTo(W * 0.55, hY - H * 0.1, W * 0.5, hY - H * 0.02); ctx.lineTo(W * 0.62, hY - H * 0.02); ctx.quadraticCurveTo(W * 0.6, hY - H * 0.14, W * 0.6, hY - H * 0.26); ctx.fill();
    ctx.strokeStyle = hexA('#5a8ab0', 0.4); ctx.lineWidth = 1; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(W * (0.53 + k * 0.015), hY - H * 0.22); ctx.lineTo(W * (0.52 + k * 0.02), hY - H * 0.04); ctx.stroke(); }
    ctx.restore();
    // ближние тёмные склоны и лес
    mountainRidge(f, hY + 2, H * 0.15, 5.1, dim('#3a4a52'), 1);
    ctx.fillStyle = dim('#1e2e24');
    for (let x = 0; x < W; x += 7 * sc) { const q = x / W; const n = Math.sin(q * 5.1 + 5.1) * 0.5 + Math.sin(q * 13.7 + 11.7) * 0.3 + Math.sin(q * 31 + 20.9) * 0.2; const base = hY - H * 0.15 * (0.55 + n * 0.45) + 8 * sc; pine(f, x, base + 6 * sc, (10 + f.h(x) * 8) * sc, '#1e3a2a'); }
    // рорбу — красные домики у воды
    for (let i = 0; i < 6; i++) {
      const x = W * (0.03 + i * 0.07) + f.h(i) * 10, w = 16 * sc, h = 11 * sc, y = hY + 2;
      ctx.fillStyle = dim('#3a3028'); for (let k = 0; k < 3; k++) ctx.fillRect(x - w / 2 + k * w / 2.2, y - 4 * sc, 1.5 * sc, 5 * sc);
      ctx.fillStyle = dim('#9a2a1e'); ctx.fillRect(x - w / 2, y - 4 * sc - h, w, h);
      ctx.fillStyle = dim('#2a2a2e'); ctx.beginPath(); ctx.moveTo(x - w / 2 - 1.5 * sc, y - 4 * sc - h); ctx.lineTo(x, y - 4 * sc - h - w * 0.4); ctx.lineTo(x + w / 2 + 1.5 * sc, y - 4 * sc - h); ctx.fill();
      ctx.fillStyle = f.win(i + 30); ctx.fillRect(x - 2 * sc, y - 4 * sc - h * 0.7, 4 * sc, 3.5 * sc);
    }
    // контейнерный терминал и краны справа
    for (let i = 0; i < 8; i++) { const cx = W * 0.72 + (i % 4) * 22 * sc, cy = hY + 2 - Math.floor(i / 4) * 9 * sc; ctx.fillStyle = dim(['#2a6aa0', '#c8402a', '#d8a030', '#3a8a5a'][i % 4]); ctx.fillRect(cx, cy - 9 * sc, 20 * sc, 9 * sc); ctx.fillStyle = hexA('#000000', 0.2); for (let k = 0; k < 5; k++) ctx.fillRect(cx + k * 4 * sc, cy - 9 * sc, 1, 9 * sc); }
    crane(f, W * 0.93, hY + 2, 120 * sc, 70 * sc, -1, '#c8a030', false);
    crane(f, W * 0.66, hY + 2, 95 * sc, 60 * sc, 1, '#c8a030', false);
    // орлан-белохвост кружит над фьордом
    { const t = f.t; const ex = W * 0.4 + Math.cos(t * 0.12) * W * 0.12, ey = H * 0.2 + Math.sin(t * 0.24) * H * 0.04; const s = sc * 1.6; const fl = Math.sin(t * 1.4) * 2 * s; ctx.strokeStyle = dim('#3a2a1c', 0.6); ctx.lineWidth = 2 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ex - 12 * s, ey - fl); ctx.quadraticCurveTo(ex - 5 * s, ey - 2 * s, ex, ey); ctx.quadraticCurveTo(ex + 5 * s, ey - 2 * s, ex + 12 * s, ey - fl); ctx.stroke(); ctx.fillStyle = dim('#f0ece4', 0.6); ctx.beginPath(); ctx.moveTo(ex - 2 * s, ey); ctx.lineTo(ex + 2 * s, ey); ctx.lineTo(ex, ey + 4 * s); ctx.fill(); }
    // пар над тёплой водой у берега зимой
    if (f.A.season === 3 && f.night < 0.5) { for (let k = 0; k < 6; k++) { const px = W * (0.1 + k * 0.15) + Math.sin(f.t * 0.3 + k) * 10 * sc, py = hY + 4 + Math.sin(f.t * 0.5 + k * 2) * 2; const g = ctx.createRadialGradient(px, py, 0, px, py, 26 * sc); g.addColorStop(0, 'rgba(230,240,250,0.22)'); g.addColorStop(1, 'rgba(230,240,250,0)'); ctx.fillStyle = g; ctx.fillRect(px - 26 * sc, py - 14 * sc, 52 * sc, 28 * sc); } }
    // маяк на шхере
    { const x = W * 0.46, y = hY + 1; ctx.fillStyle = dim('#5a5a5a'); ctx.beginPath(); ctx.ellipse(x, y, 14 * sc, 4 * sc, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = dim('#f0ece4'); ctx.fillRect(x - 3 * sc, y - 18 * sc, 6 * sc, 16 * sc); ctx.fillStyle = dim('#c0392b'); ctx.fillRect(x - 3 * sc, y - 12 * sc, 6 * sc, 4 * sc); ctx.fillStyle = dim('#2a2a2e'); ctx.fillRect(x - 3.5 * sc, y - 21 * sc, 7 * sc, 3 * sc); if (f.night > 0.3 && Math.sin(f.t * 1.5) > 0.3) f.glow(x, y - 19 * sc, 2 * sc, '#ffffff', f.night); }
  },

  farWater(f) {
    const { ctx, W, hY, waterY, sc, t, dim } = f;
    // траулер на рейде
    const x = W * 0.3 + Math.sin(t * 0.03) * 10, y = hY + (waterY - hY) * 0.28;
    ctx.fillStyle = dim('#2a2a2e'); ctx.beginPath(); ctx.moveTo(x - 34 * sc, y - 4 * sc); ctx.lineTo(x + 36 * sc, y - 6 * sc); ctx.lineTo(x + 30 * sc, y + 3 * sc); ctx.lineTo(x - 30 * sc, y + 3 * sc); ctx.fill();
    ctx.fillStyle = dim('#f0ece4'); ctx.fillRect(x + 6 * sc, y - 16 * sc, 18 * sc, 12 * sc); ctx.fillStyle = f.win(44); ctx.fillRect(x + 8 * sc, y - 14 * sc, 14 * sc, 3 * sc);
    ctx.strokeStyle = dim('#d8a030'); ctx.lineWidth = 2 * sc; ctx.beginPath(); ctx.moveTo(x - 22 * sc, y - 4 * sc); ctx.lineTo(x - 18 * sc, y - 24 * sc); ctx.lineTo(x - 12 * sc, y - 4 * sc); ctx.stroke();
    ctx.fillStyle = dim('#c8402a'); ctx.fillRect(x + 18 * sc, y - 22 * sc, 3 * sc, 6 * sc);
    if (f.random() < 0.05) f.smoke(x + 19 * sc, y - 24 * sc, 2 * sc, true);
    // тюлень на камне
    const sx = W * 0.56, sy = hY + (waterY - hY) * 0.55;
    ctx.fillStyle = dim('#4a4a48'); ctx.beginPath(); ctx.ellipse(sx, sy, 16 * sc, 5 * sc, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = dim('#8a8a86'); ctx.beginPath(); ctx.ellipse(sx + 2 * sc, sy - 5 * sc, 9 * sc, 3.5 * sc, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + 10 * sc, sy - 7 * sc + Math.sin(t * 0.8) * 1, 2.6 * sc, 0, Math.PI * 2); ctx.fill();
    // льдины зимой
    if (f.A.ice > 0.1) for (let i = 0; i < 9; i++) {
      const ix = ((f.h(i) * W + t * 4 * sc) % (W + 60)) - 30, iy = hY + (waterY - hY) * (0.3 + f.h(i + 5) * 0.65), iw = (8 + f.h(i + 9) * 22) * sc;
      ctx.fillStyle = dim('#e8f2f8', 0.5); ctx.beginPath(); ctx.ellipse(ix, iy, iw, iw * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hexA('#9ac0d8', 0.4); ctx.beginPath(); ctx.ellipse(ix, iy + 1.5, iw, iw * 0.2, 0, 0, Math.PI); ctx.fill();
    }
  },

  building(f, b, x, w) {
    const { ctx, sc, gY: y, t, dim, night } = f;
    const x0 = x - w / 2;
    const snow = f.A.season === 3 || f.A.snow > 0.1;
    if (b === 'market') {
      // Фискехаллен: длинный зал с шедовой стеклянной крышей
      const h = w * 0.5;
      ctx.fillStyle = dim('#e8d8b0'); ctx.fillRect(x0, y - h, w, h);
      ctx.fillStyle = hexA('#000000', 0.12); for (let k = 0; k < w; k += 6 * sc) ctx.fillRect(x0 + k, y - h, 1, h);
      for (let k = 0; k < 4; k++) {
        const sx = x0 + (k / 4) * w, sw = w / 4;
        ctx.fillStyle = f.lit ? hexA('#ffd890', 0.75) : dim('#9ab8c8');
        ctx.beginPath(); ctx.moveTo(sx, y - h); ctx.lineTo(sx + sw * 0.4, y - h - w * 0.13); ctx.lineTo(sx + sw, y - h); ctx.fill();
        ctx.fillStyle = dim('#3a3e44'); ctx.beginPath(); ctx.moveTo(sx + sw * 0.4, y - h - w * 0.13); ctx.lineTo(sx + sw * 0.4 + 2 * sc, y - h - w * 0.13); ctx.lineTo(sx + sw + 2 * sc, y - h); ctx.lineTo(sx + sw, y - h); ctx.fill();
        if (snow) { ctx.fillStyle = dim('#eef4f8', 0.5); ctx.beginPath(); ctx.moveTo(sx, y - h); ctx.lineTo(sx + sw * 0.4, y - h - w * 0.13); ctx.lineTo(sx + sw * 0.4, y - h - w * 0.13 + 3 * sc); ctx.lineTo(sx + 1, y - h + 2 * sc); ctx.fill(); }
      }
      // большие ворота и окна
      for (let k = 0; k < 3; k++) windowRect(f, x0 + w * (0.08 + k * 0.33), y - h * 0.8, w * 0.22, h * 0.3, '#3a3e44', k);
      ctx.fillStyle = dim('#3a3e44'); ctx.fillRect(x - w * 0.14, y - h * 0.42, w * 0.28, h * 0.42);
      ctx.fillStyle = f.win(5, '#ffe0a0'); ctx.fillRect(x - w * 0.12, y - h * 0.4, w * 0.24, h * 0.3);
      ctx.fillStyle = dim('#2a5a8a'); ctx.fillRect(x0 - 2 * sc, y - h * 0.95, w + 4 * sc, 7 * sc);
      ctx.fillStyle = dim('#f0ece4'); ctx.font = `bold ${5.5 * sc}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('FISKEHALLEN · РЫБНЫЙ ЗАЛ', x, y - h * 0.95 + 5.3 * sc); ctx.textAlign = 'left';
      // конвейер с ящиками
      ctx.fillStyle = dim('#5a5a5e'); ctx.fillRect(x0 + w * 0.6, y - 9 * sc, w * 0.55, 3 * sc); for (let k = 0; k < 6; k++) ctx.fillRect(x0 + w * 0.6 + k * w * 0.1, y - 6 * sc, 2 * sc, 6 * sc);
      for (let k = 0; k < 4; k++) { const cx = x0 + w * 0.6 + ((k * w * 0.14 + t * 8 * sc) % (w * 0.55)); fishCrate(f, cx, y - 9 * sc, 10 * sc, 6 * sc, '#c8d8e0'); }
      // погрузчик
      const lx = x0 + w * 0.9 + Math.sin(t * 0.3) * w * 0.3;
      ctx.fillStyle = dim('#e8c030'); ctx.fillRect(lx - 9 * sc, y - 12 * sc, 14 * sc, 9 * sc); ctx.fillRect(lx - 4 * sc, y - 19 * sc, 7 * sc, 7 * sc);
      ctx.fillStyle = dim('#2a2a2a'); ctx.beginPath(); ctx.arc(lx - 6 * sc, y - 2.5 * sc, 2.8 * sc, 0, Math.PI * 2); ctx.arc(lx + 3 * sc, y - 2.5 * sc, 2.8 * sc, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(lx + 6 * sc, y - 20 * sc, 1.5 * sc, 20 * sc);
      if (f.lit) f.pool(x, y - h * 0.4, w * 0.7, '#ffd890', 0.2 * night);
      return y - h - w * 0.13;
    }
    if (b === 'shop') return brygge(f, x, y, w * 0.62, w * 0.72, '#b8722a', '#f0ece4', 11, { hoist: true, stilts: true, snow });
    if (b === 'shipyard') {
      // сухой док с траулером
      const h = w * 0.9;
      ctx.fillStyle = dim('#2a2a2e'); ctx.beginPath(); ctx.moveTo(x0 - 10 * sc, y); ctx.lineTo(x0 + w + 10 * sc, y); ctx.lineTo(x0 + w, y + 18 * sc); ctx.lineTo(x0, y + 18 * sc); ctx.fill();
      ctx.fillStyle = hexA('#000000', 0.3); for (let k = 0; k < 6; k++) ctx.fillRect(x0 + w * (0.15 + k * 0.14) - 3 * sc, y + 10 * sc, 6 * sc, 8 * sc);
      // корпус траулера: красное днище, чёрный борт
      ctx.fillStyle = dim('#a02a20'); ctx.beginPath(); ctx.moveTo(x0 + w * 0.08, y - h * 0.26); ctx.lineTo(x0 + w * 0.92, y - h * 0.3); ctx.quadraticCurveTo(x0 + w * 0.86, y + 8 * sc, x0 + w * 0.68, y + 10 * sc); ctx.lineTo(x0 + w * 0.22, y + 10 * sc); ctx.quadraticCurveTo(x0 + w * 0.08, y - h * 0.05, x0 + w * 0.08, y - h * 0.26); ctx.fill();
      ctx.fillStyle = dim('#1e1e22'); ctx.beginPath(); ctx.moveTo(x0 + w * 0.08, y - h * 0.26); ctx.lineTo(x0 + w * 0.92, y - h * 0.3); ctx.lineTo(x0 + w * 0.94, y - h * 0.5); ctx.lineTo(x0 + w * 0.06, y - h * 0.46); ctx.fill();
      ctx.fillStyle = dim('#f0ece4'); ctx.fillRect(x0 + w * 0.5, y - h * 0.72, w * 0.26, h * 0.24);
      ctx.fillStyle = f.win(7); ctx.fillRect(x0 + w * 0.52, y - h * 0.68, w * 0.22, h * 0.07);
      ctx.fillStyle = dim('#c8402a'); ctx.fillRect(x0 + w * 0.66, y - h * 0.84, 5 * sc, h * 0.12);
      ctx.fillStyle = dim('#f0ece4'); ctx.font = `bold ${4.5 * sc}px Inter, sans-serif`; ctx.fillText('POLARSTJERNE', x0 + w * 0.12, y - h * 0.36);
      // леса
      ctx.strokeStyle = dim('#8a8a8a'); ctx.lineWidth = 1.2 * sc;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x0 + w * 0.02, y - k * h * 0.14); ctx.lineTo(x0 + w * 0.02, y - (k + 1) * h * 0.14); ctx.moveTo(x0 + w * 0.02, y - k * h * 0.14); ctx.lineTo(x0 + w * 0.1, y - k * h * 0.14); ctx.stroke(); }
      // кран над доком
      crane(f, x0 + w * 1.02, y, h * 1.3, w * 0.85, -1, '#c8a030', true);
      // сварщик — искры
      const wx = x0 + w * 0.3, wy = y - h * 0.36;
      person(f, wx, y - h * 0.26 + 10 * sc, '#3a3a44', { hat: '#5a5a5a', face: 1 });
      if (f.random() < 0.5) { f.spark(wx + 6 * sc, wy); if (!f.reflecting) f.glow(wx + 6 * sc, wy, 3 * sc, '#9ad0ff', 0.6 + f.random() * 0.4); }
      // прожектор
      ctx.fillStyle = dim('#3a3e44'); ctx.fillRect(x0 - 8 * sc, y - h * 1.1, 3 * sc, h * 1.1); ctx.fillRect(x0 - 12 * sc, y - h * 1.12, 11 * sc, 5 * sc);
      if (f.lit) { f.glow(x0 - 6 * sc, y - h * 1.08, 4 * sc, '#dfe8ff', night); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(x0 - 6 * sc, y - h * 1.08, x0 + w * 0.5, y); g.addColorStop(0, `rgba(200,220,255,${(0.16 * night).toFixed(3)})`); g.addColorStop(1, 'rgba(200,220,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0 - 6 * sc, y - h * 1.08); ctx.lineTo(x0 + w * 0.9, y); ctx.lineTo(x0 - 10 * sc, y); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = dim('#f0ece4'); ctx.fillRect(x0 + w * 0.1, y - h * 1.02, w * 0.5, 8 * sc);
      ctx.fillStyle = dim('#2a2a2e'); ctx.font = `bold ${5 * sc}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('NORDHAVN MEKANISKE', x0 + w * 0.35, y - h * 1.02 + 6 * sc); ctx.textAlign = 'left';
      return y - h * 1.3;
    }
    // Шёхусет — красный морской дом с террасой
    const top = brygge(f, x, y, w * 0.78, w * 0.68, '#8e2a1e', '#f0ece4', 21, { snow });
    // терраса с перилами
    ctx.fillStyle = dim('#4a3a2c'); ctx.fillRect(x0 - 10 * sc, y - 8 * sc, w * 0.5, 3 * sc);
    ctx.fillStyle = dim('#f0ece4'); for (let k = 0; k < 6; k++) ctx.fillRect(x0 - 10 * sc + k * w * 0.09, y - 18 * sc, 1.5 * sc, 10 * sc); ctx.fillRect(x0 - 10 * sc, y - 18 * sc, w * 0.5, 1.5 * sc);
    door(f, x - w * 0.07, y - w * 0.22, w * 0.14, w * 0.22, '#2a2018');
    // рога над дверью, фонарь
    ctx.strokeStyle = dim('#e8e0d0'); ctx.lineWidth = 1.2 * sc; ctx.beginPath(); ctx.moveTo(x - 6 * sc, y - w * 0.25); ctx.quadraticCurveTo(x - 8 * sc, y - w * 0.31, x - 3 * sc, y - w * 0.33); ctx.moveTo(x + 6 * sc, y - w * 0.25); ctx.quadraticCurveTo(x + 8 * sc, y - w * 0.31, x + 3 * sc, y - w * 0.33); ctx.stroke();
    if (f.lit) { f.glow(x + w * 0.14, y - w * 0.28, 2.2 * sc, '#ffcf7a', night); f.pool(x, y - 8 * sc, w * 0.7, '#ffbe6e', 0.2 * night); }
    // труба и дым
    const chx = x0 + w * 0.6; ctx.fillStyle = dim('#3a3a3e'); ctx.fillRect(chx, top + w * 0.14, 7 * sc, w * 0.16); if (f.random() < 0.12) f.smoke(chx + 3.5 * sc, top + w * 0.12, 3.5 * sc);
    // вывеска
    ctx.fillStyle = dim('#f0ece4'); ctx.fillRect(x - 22 * sc, y - w * 0.46, 44 * sc, 8 * sc); ctx.fillStyle = dim('#8e2a1e'); ctx.font = `bold ${5.5 * sc}px Georgia, serif`; ctx.textAlign = 'center'; ctx.fillText('SJØHUSET', x, y - w * 0.46 + 6.2 * sc); ctx.textAlign = 'left';
    barrel(f, x0 + w * 0.48, y, 4.5 * sc, 11 * sc, '#5a3a24'); barrel(f, x0 + w * 0.48 + 10 * sc, y, 4.5 * sc, 11 * sc, '#6a4a2e');
    return top;
  },

  extras(f) {
    const { ctx, W, sc, gY: y, dim } = f;
    hjell(f, W * 0.215, y, 50 * sc);
    hjell(f, W * 0.395, y, 46 * sc);
    // штабель контейнеров на набережной
    for (let i = 0; i < 3; i++) { const cx = W * 0.565 + (i % 2) * 20 * sc, cy = y - Math.floor(i / 2) * 10 * sc; ctx.fillStyle = dim(['#2a6aa0', '#c8402a', '#3a8a5a'][i]); ctx.fillRect(cx, cy - 10 * sc, 18 * sc, 10 * sc); ctx.fillStyle = hexA('#000000', 0.2); for (let k = 0; k < 5; k++) ctx.fillRect(cx + k * 3.6 * sc, cy - 10 * sc, 1, 10 * sc); ctx.fillStyle = dim('#f0ece4'); ctx.font = `${3 * sc}px Inter, sans-serif`; ctx.fillText('NHVN', cx + 2 * sc, cy - 3 * sc); }
    flag(f, W * 0.6, y, 1, ['#b83a2a', '#f0ece4', '#2a4a8a', '#f0ece4', '#b83a2a'], 26, 18);
    flag(f, W * 0.78, y, 2, ['#b83a2a', '#f0ece4', '#2a4a8a', '#f0ece4', '#b83a2a'], 26, 18);
    // стол для разделки рыбы
    const tx = W * 0.44; ctx.fillStyle = dim('#8a8a8a'); ctx.fillRect(tx - 14 * sc, y - 11 * sc, 28 * sc, 2 * sc); ctx.fillRect(tx - 12 * sc, y - 9 * sc, 2 * sc, 9 * sc); ctx.fillRect(tx + 10 * sc, y - 9 * sc, 2 * sc, 9 * sc);
    ctx.fillStyle = dim('#c8d8e0'); ctx.beginPath(); ctx.ellipse(tx - 4 * sc, y - 12 * sc, 5 * sc, 1.8 * sc, 0, 0, Math.PI * 2); ctx.ellipse(tx + 5 * sc, y - 12 * sc, 5 * sc, 1.8 * sc, 0.3, 0, Math.PI * 2); ctx.fill();
    person(f, tx - 2 * sc, y, '#e8c030', { face: 1, hat: '#e8c030' });
    // снежные сугробы зимой и снегоуборщик
    if (f.A.season === 3 || f.A.snow > 0.1) {
      ctx.fillStyle = dim('#eef4f8', 0.5); for (let i = 0; i < 7; i++) { const sx = f.h(i + 70) * W, sw = (20 + f.h(i) * 40) * sc; ctx.beginPath(); ctx.ellipse(sx, y + 1, sw, 4 * sc, 0, Math.PI, 0); ctx.fill(); }
      const px = W * 0.06; ctx.fillStyle = dim('#e8701a'); ctx.fillRect(px - 14 * sc, y - 14 * sc, 24 * sc, 10 * sc); ctx.fillRect(px - 10 * sc, y - 22 * sc, 12 * sc, 8 * sc); ctx.fillStyle = f.win(88, '#c8e0f0'); ctx.fillRect(px - 8 * sc, y - 21 * sc, 8 * sc, 5 * sc); ctx.fillStyle = dim('#1a1a1c'); for (const dx of [-9, 6]) { ctx.beginPath(); ctx.arc(px + dx * sc, y - 3 * sc, 3.5 * sc, 0, Math.PI * 2); ctx.fill(); } ctx.fillStyle = dim('#f0c040'); ctx.beginPath(); ctx.moveTo(px + 10 * sc, y - 10 * sc); ctx.lineTo(px + 20 * sc, y - 12 * sc); ctx.lineTo(px + 20 * sc, y); ctx.lineTo(px + 10 * sc, y); ctx.fill(); if (f.lit) f.glow(px - 2 * sc, y - 24 * sc, 1.5 * sc, '#ffb030', f.night * (Math.floor(f.t * 2) % 2));
    }
    // метеостанция на крыше склада: вращающиеся чашки анемометра
    { const ax = W * 0.5 + 24 * sc, ay = y - 100 * sc; ctx.fillStyle = dim('#8a8a8a'); ctx.fillRect(ax - 0.8 * sc, ay, 1.6 * sc, 16 * sc); ctx.save(); ctx.translate(ax, ay); const rot = f.t * (2 + f.A.wind * 0.3); ctx.strokeStyle = dim('#d8d8d8'); ctx.lineWidth = 0.8 * sc; for (let k = 0; k < 3; k++) { const a = rot + (k / 3) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 5 * sc, Math.sin(a) * 1.6 * sc); ctx.stroke(); ctx.fillStyle = dim('#d8d8d8'); ctx.beginPath(); ctx.arc(Math.cos(a) * 5 * sc, Math.sin(a) * 1.6 * sc, 1.2 * sc, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
  },

  props(f) {
    const { ctx, W, sc, gY: y, dim } = f;
    for (let x = 30 * sc; x < W; x += 80 * sc) bollard(f, x, y + 2 * sc, '#1a1a1c');
    // цепи
    ctx.strokeStyle = dim('#5a5a5e'); ctx.lineWidth = 1.5 * sc; ctx.setLineDash([2 * sc, 1.5 * sc]);
    for (let x = 30 * sc; x + 80 * sc < W; x += 80 * sc) { ctx.beginPath(); ctx.moveTo(x, y - 6 * sc); ctx.quadraticCurveTo(x + 40 * sc, y + 2 * sc, x + 80 * sc, y - 6 * sc); ctx.stroke(); }
    ctx.setLineDash([]);
    for (let i = 0; i < 4; i++) crate(f, W * 0.02 + i * 11 * sc, y, 9 * sc, 12 * sc, i % 2 ? '#2a5a8a' : '#8a3a2a');
    for (let i = 0; i < 4; i++) barrel(f, W * 0.47 + i * 10 * sc, y, 4.5 * sc, 11 * sc, i % 2 ? '#2a5a8a' : '#d8a030', '#1a1a1a');
    // ворон на тумбе
    const rx = W * 0.49; ctx.fillStyle = dim('#15171c', 0.5); ctx.beginPath(); ctx.ellipse(rx, y - 10 * sc, 3.6 * sc, 2.2 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(rx + 3 * sc, y - 12.5 * sc, 1.7 * sc, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(rx + 4.5 * sc, y - 12.8 * sc, 2.4 * sc, 1 * sc);
  },

  moored(f) {
    const { W, waterY, sc, t } = f;
    hull(f, W * 0.28, waterY + 2 * sc, sc * 1.35, '#3a3a3a', '#d8a030', { bob: Math.sin(t * 1.1 + 2.8) * 1.5 * sc, wheelhouse: true, long: 1.1 });
    hull(f, W * 0.47, waterY + 2 * sc, sc * 0.8, '#8e2a1e', '#e8e4dc', { bob: Math.sin(t * 1.1 + 4.6) * 1.5 * sc, cabin: true });
    hull(f, W * 0.06, waterY + 2 * sc, sc * 0.7, '#f0ece4', '#2a4a8a', { bob: Math.sin(t * 1.1 + 0.6) * 1.5 * sc, mast: true });
  },

  locals(f) {
    const { ctx, W, sc, gY: y, t, dim } = f;
    // рыбак в оранжевом комбинезоне с ящиком у причала
    person(f, W * 0.66 - 60 * sc, y, '#e8701a', { face: -1, carry: 'crate', hat: '#2a2a2a' });
    // чайки на сушильне
    for (let k = 0; k < 3; k++) { const gx = W * 0.22 + k * 20 * sc; ctx.fillStyle = dim('#f4f4f4', 0.8); ctx.beginPath(); ctx.ellipse(gx, y - 48 * sc, 3 * sc, 2 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(gx + 2.6 * sc, y - 50 * sc, 1.4 * sc, 0, Math.PI * 2); ctx.fill(); }
    // пар из дыхания зимой — лёгкие клубы
    if (f.A.season === 3 && f.random() < 0.02) f.smoke(W * 0.44 + 2 * sc, y - 20 * sc, 1.5 * sc);
    // рыбак с удочкой на краю набережной и ведро
    const fx = W * 0.6 - 30 * sc; person(f, fx, y, '#2a3a5a', { face: 1, carry: 'rod', hat: '#e8c030' });
    ctx.strokeStyle = hexA('#ffffff', 0.35); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(fx + 14 * sc, y - 27 * sc); ctx.quadraticCurveTo(fx + 20 * sc, y - 10 * sc, fx + 22 * sc + Math.sin(t) * 2, f.waveY(fx + 22 * sc)); ctx.stroke();
    ctx.fillStyle = dim('#7a8a98'); ctx.fillRect(fx - 10 * sc, y - 6 * sc, 5 * sc, 6 * sc);
    // тюлень выныривает у причала
    { const ph = (t * 0.08) % 1; if (ph < 0.3) { const u = Math.sin((ph / 0.3) * Math.PI); const sx = W * 0.56, sy = f.waterY + 14 * sc - u * 7 * sc; ctx.fillStyle = dim('#5a5a58'); ctx.beginPath(); ctx.arc(sx, sy, 3.5 * sc, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#1a1a1c'; ctx.fillRect(sx - 1.5 * sc, sy - 1.5 * sc, 1 * sc, 1 * sc); ctx.fillRect(sx + 0.8 * sc, sy - 1.5 * sc, 1 * sc, 1 * sc); } }
  },

  foreground(f) {
    // позёмка при ветре зимой
    if (f.precipEnabled && (f.A.season === 3 || f.A.snow > 0.1) && f.A.wind > 5) {
      const { ctx, W, sc, gY } = f;
      ctx.strokeStyle = `rgba(240,246,255,${(0.18 + f.A.wind * 0.01).toFixed(3)})`; ctx.lineWidth = 1;
      for (let i = 0; i < 20; i++) { const x = ((f.h(i) * W + f.windTravel * (60 + i * 8) * sc) % (W + 100) + W + 100) % (W + 100) - 50, y = gY - f.h(i + 3) * 10 * sc; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 20 * sc * f.A.windDir, y - 1); ctx.stroke(); }
    }
  },

  lamp(f, x) {
    const { ctx, sc, quayY, night, dim } = f;
    const ly = quayY - 64 * sc;
    ctx.fillStyle = dim('#3a3e44'); ctx.fillRect(x - 1.5 * sc, ly, 3 * sc, 58 * sc);
    ctx.fillRect(x - 7 * sc, ly, 14 * sc, 4 * sc); ctx.fillRect(x - 6 * sc, ly - 4 * sc, 12 * sc, 4 * sc);
    if (night > 0.25) { f.glow(x, ly + 2 * sc, 4 * sc, '#dfe8ff', night * 0.9); f.pool(x, quayY, 90 * sc, '#c8d8ff', 0.2 * night); }
  },
};
