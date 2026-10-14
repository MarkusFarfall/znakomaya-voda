import type { PF, PortKit } from '../portFrame';
import { aerial, airplane, birdFlock, cityGlow, shoreLights } from '../portHorizon';
import { barrel, bollard, bunting, cat, crate, dog, door, fishCrate, flag, hull, notes, person, rope, sign, silhouettes, splash, windowRect } from '../portParts';
import { hexA, mix } from '../util';

/** Домик посёлка на холме */
function cottage(f: PF, x: number, y: number, w: number, h: number, roof: string, seed: number) {
  const { ctx, sc } = f;
  ctx.fillStyle = f.dim('#e8e0d0');
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = f.dim(roof);
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 2 * sc, y - h); ctx.lineTo(x, y - h - w * 0.42); ctx.lineTo(x + w / 2 + 2 * sc, y - h); ctx.fill();
  ctx.fillStyle = f.win(seed);
  ctx.fillRect(x - w * 0.3, y - h * 0.7, w * 0.2, h * 0.3);
  ctx.fillRect(x + w * 0.1, y - h * 0.7, w * 0.2, h * 0.3);
  ctx.fillStyle = f.dim('#6a5a4a');
  ctx.fillRect(x + w * 0.2, y - h - w * 0.3, w * 0.1, w * 0.18);
}

/** Цвет кроны по сезону: весна — светлая с цветом, лето — зелень, осень — рыжая, зима — голые ветки */
function leafCol(f: PF, col: string, seed: number) {
  const s = f.A.season;
  if (s === 0) return mix(col, '#9ad070', 0.5);
  if (s === 2) return mix(['#d8742a', '#c8a030', '#b8402a'][seed % 3], col, 0.25);
  return col;
}

function tree(f: PF, x: number, y: number, r: number, col: string, seed: number) {
  const { ctx, sc, t } = f;
  ctx.fillStyle = f.dim('#4a3a2a');
  ctx.fillRect(x - 1.5 * sc, y - r * 0.9, 3 * sc, r * 0.9);
  const sway = Math.sin(t * 0.9 + seed) * 1.2 * sc;
  if (f.A.season === 3) {
    // голые ветки и снег
    ctx.strokeStyle = f.dim('#4a3a2a'); ctx.lineWidth = 1 * sc; ctx.lineCap = 'round';
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.45; ctx.beginPath(); ctx.moveTo(x, y - r * 0.9); ctx.lineTo(x + Math.cos(a) * r * 1.1 + sway, y - r * 0.9 + Math.sin(a) * r * 1.1); ctx.stroke(); }
    ctx.fillStyle = f.dim('#eef4f8', 0.5); ctx.beginPath(); ctx.ellipse(x, y - r * 1.5, r * 0.5, r * 0.15, 0, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const c = leafCol(f, col, seed);
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = f.dim(k === 2 ? mix(c, '#ffffff', 0.15) : c);
    ctx.beginPath(); ctx.arc(x + (k - 1) * r * 0.45 + sway * (k === 1 ? 1 : 0.6), y - r * (1.1 + (k === 1 ? 0.3 : 0)), r * (k === 1 ? 0.75 : 0.55), 0, Math.PI * 2); ctx.fill();
  }
  if (f.A.season === 0) { ctx.fillStyle = f.dim('#ffd0dc', 0.6); for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x + (f.h(seed * 7 + k) - 0.5) * r * 1.4 + sway, y - r * (0.9 + f.h(seed + k) * 0.8), 1.2 * sc, 0, Math.PI * 2); ctx.fill(); } }
}

/** Дом посёлка во втором ряду (меньше, в дымке) */
function backHouse(f: PF, x: number, y: number, w: number, h: number, wall: string, roof: string, seed: number, o: { chimney?: boolean; shed?: boolean } = {}) {
  const { ctx, sc } = f;
  const haze = (c: string) => f.dim(mix(c, f.A.palette.skyHor, 0.22), 0.8);
  ctx.fillStyle = haze(wall); ctx.fillRect(x - w / 2, y - h, w, h);
  if (o.shed) { ctx.fillStyle = haze(roof); ctx.beginPath(); ctx.moveTo(x - w / 2 - 2 * sc, y - h); ctx.lineTo(x + w / 2 + 2 * sc, y - h - w * 0.18); ctx.lineTo(x + w / 2 + 2 * sc, y - h); ctx.fill(); }
  else { ctx.fillStyle = haze(roof); ctx.beginPath(); ctx.moveTo(x - w / 2 - 3 * sc, y - h); ctx.lineTo(x, y - h - w * 0.4); ctx.lineTo(x + w / 2 + 3 * sc, y - h); ctx.fill(); }
  if (f.A.season === 3 || f.A.snow > 0.2) { ctx.strokeStyle = haze('#f0f4f8'); ctx.lineWidth = 2 * sc; ctx.beginPath(); ctx.moveTo(x - w / 2 - 3 * sc, y - h); ctx.lineTo(x, y - h - w * 0.4); ctx.lineTo(x + w / 2 + 3 * sc, y - h); ctx.stroke(); }
  for (let k = 0; k < 2; k++) { ctx.fillStyle = f.win(seed + k); ctx.fillRect(x - w * 0.32 + k * w * 0.42, y - h * 0.72, w * 0.2, h * 0.32); }
  if (o.chimney) { ctx.fillStyle = haze('#6a5a4a'); ctx.fillRect(x + w * 0.2, y - h - w * 0.3, w * 0.1, w * 0.2); if (f.random() < 0.03) f.smoke(x + w * 0.25, y - h - w * 0.32, 2 * sc); }
}

export const homeKit: PortKit = {
  layout: { tavern: 0.12, market: 0.33, shop: 0.52, dock: 0.66, shipyard: 0.86 },
  quay: 'wood',
  pal: { quay: '#6a5238', quayFace: '#4a3a28', water: ['#3a8a96', '#0e3446'], lamp: '#1c1e22', lampLight: '#ffcf7a' },
  walkers: { n: 7, cols: ['#3a3a44', '#5a3a2a', '#2a3a5a', '#4a4a3a', '#6a2a2a', '#7a6a4a'], speed: 1 },
  lampXs: [0.195, 0.405, 0.595, 0.755],
  birds: { kind: 'gull', n: 6 },
  traffic: [
    { kind: 'fisher', hull: '#e8e4dc', trim: '#c84030', scale: 0.9, period: 42, lane: 0.55 },
    { kind: 'sail', hull: '#f2f0ea', trim: '#c84030', scale: 0.8, period: 70, lane: 0.25, offset: 20 },
  ],
  hotBoard: 0.43,
  lampTop: 46,
  hours: { market: [5, 14], shop: [8, 20], shipyard: [7, 19], tavern: [9, 26] },
  cold: (f) => f.A.season === 3,
  farShips: [
    { kind: 'tanker', depth: 0.05, period: 420, dir: 1, hull: '#2a3038' },
    { kind: 'trawler', depth: 0.45, period: 150, dir: -1, offset: 60, hull: '#3a4048' },
    { kind: 'sail', depth: 0.7, period: 110, dir: 1, offset: 20 },
    { kind: 'ferry', depth: 0.25, period: 260, dir: -1, offset: 140, hull: '#f0ece4' },
  ],

  horizon(f) {
    const { ctx, W, H, hY, sc, t, A } = f;
    // противоположный берег залива: низкая полоса холмов, едва различимая в дымке
    ctx.fillStyle = aerial(f, '#5a7a6a', 0.95);
    ctx.beginPath(); ctx.moveTo(W * 0.28, hY + 1);
    for (let x = W * 0.28; x <= W * 0.78; x += 6) { const q = (x - W * 0.28) / (W * 0.5); ctx.lineTo(x, hY - H * 0.035 * Math.sin(q * Math.PI) * (0.7 + Math.sin(q * 14 + 2) * 0.3)); }
    ctx.lineTo(W * 0.78, hY + 1); ctx.fill();
    // дальний посёлок на том берегу и его маяк
    ctx.fillStyle = aerial(f, '#e8e0d0', 0.9);
    for (let i = 0; i < 14; i++) { const x = W * (0.42 + i * 0.018) + f.h(i + 30) * 4; const hh = (2 + f.h(i + 31) * 3) * sc; ctx.fillRect(x, hY - H * 0.035 * Math.sin(((x - W * 0.28) / (W * 0.5)) * Math.PI) * 0.75 - hh + 1, 2.5 * sc, hh); }
    ctx.fillStyle = aerial(f, '#f0ece4', 0.85); ctx.fillRect(W * 0.7 - 1 * sc, hY - H * 0.03 - 9 * sc, 2 * sc, 9 * sc);
    if (f.night > 0.3 && Math.sin(t * 0.9 + 2) > 0.6) f.glow(W * 0.7, hY - H * 0.03 - 10 * sc, 1.4 * sc, '#fff0b0', f.night * 0.7);
    shoreLights(f, Array.from({ length: 10 }, (_, i) => [W * (0.43 + i * 0.025), 3 + f.h(i + 40) * 4, i % 3 ? '#ffd890' : '#ffb060'] as [number, number, string]), hY - H * 0.02);
    cityGlow(f, W * 0.55, W * 0.16, '#ffb870');
    // лодки у дальнего берега — точки с мачтами
    ctx.fillStyle = aerial(f, '#2a3038', 0.85);
    for (let i = 0; i < 5; i++) { const x = W * (0.3 + i * 0.1) + Math.sin(t * 0.03 + i) * 8; ctx.fillRect(x - 3 * sc, hY + 1, 6 * sc, 1.2 * sc); ctx.fillRect(x - 0.4 * sc, hY - 5 * sc, 0.8 * sc, 6 * sc); }
    airplane(f, 90, 0.08);
    if (A.season === 0 || A.season === 2) birdFlock(f, 60, 0.14, 11, 20);
    // дождевой фронт над морем уже учтён в общем слое; здесь — дымка нагретого воздуха летом
    if (A.season === 1 && A.sunElev > 25) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let x = 0; x < W; x += 12 * sc) { const a = 0.05 + 0.04 * Math.sin(x * 0.05 + t * 3); ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; ctx.fillRect(x, hY - 3 * sc + Math.sin(x * 0.1 + t * 5) * 1.5, 10 * sc, 3 * sc); } ctx.restore(); }
  },

  signage(f) {
    const { ctx, W, sc, gY: y, dim } = f;
    const x = W * 0.54;
    ctx.fillStyle = dim('#5a4a3a'); ctx.fillRect(x - 1.5 * sc, y - 34 * sc, 3 * sc, 34 * sc);
    ctx.fillStyle = dim('#8a6a42'); ctx.beginPath(); ctx.moveTo(x - 24 * sc, y - 32 * sc); ctx.lineTo(x + 20 * sc, y - 32 * sc); ctx.lineTo(x + 26 * sc, y - 27 * sc); ctx.lineTo(x + 20 * sc, y - 22 * sc); ctx.lineTo(x - 24 * sc, y - 22 * sc); ctx.fill();
    ctx.strokeStyle = hexA('#000000', 0.3); ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = dim('#f0e8d8'); ctx.font = `bold ${4.6 * sc}px Georgia, serif`; ctx.textAlign = 'center'; ctx.fillText('ЗНАКОМАЯ ВОДА', x - 2 * sc, y - 25.5 * sc); ctx.textAlign = 'left';
    ctx.fillStyle = dim('#8a6a42'); ctx.fillRect(x - 18 * sc, y - 19 * sc, 32 * sc, 7 * sc);
    ctx.fillStyle = dim('#f0e8d8'); ctx.font = `${3.4 * sc}px Inter, sans-serif`; ctx.fillText('пристань · до маяка 1 км', x - 16.5 * sc, y - 14 * sc);
    // чайка на вывеске
    ctx.fillStyle = dim('#f4f4f4', 0.8); ctx.beginPath(); ctx.ellipse(x + 10 * sc, y - 35 * sc, 3.2 * sc, 2 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x + 12.8 * sc, y - 37.4 * sc, 1.5 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dim('#f0a030'); ctx.fillRect(x + 14 * sc, y - 37.6 * sc, 2 * sc, 0.8 * sc);
  },

  events: [
    { id: 'catch_return', label: 'Возвращение с лова', from: 5.5, to: 8.5, draw(f) {
      const { W, sc, gY: y, t } = f;
      const x0 = W * 0.62, x1 = W * 0.36;
      for (let k = 0; k < 3; k++) { const ph = (t * 0.07 + k * 0.33) % 1; person(f, x0 + (x1 - x0) * ph, y, ['#3a3a44', '#5a3a2a', '#2a3a5a'][k], { walk: t * 7 + k, face: -1, carry: 'crate', hat: '#d8a030' }); }
      for (let k = 0; k < 3; k++) fishCrate(f, W * 0.41 + k * 9 * sc, y, 8 * sc, 6 * sc);
      for (let k = 0; k < 2; k++) { const gx = W * 0.395 + k * 14 * sc; f.ctx.fillStyle = f.dim('#f4f4f4', 0.8); f.ctx.beginPath(); f.ctx.ellipse(gx, y - 9 * sc, 3.2 * sc, 2 * sc, 0, 0, Math.PI * 2); f.ctx.fill(); f.ctx.beginPath(); f.ctx.arc(gx + 2.6 * sc, y - 11.4 * sc, 1.5 * sc, 0, Math.PI * 2); f.ctx.fill(); }
    } },
    { id: 'noon_bell', label: 'Полуденный звон', from: 11.9, to: 12.3, draw(f, u) {
      const { ctx, W, H, sc, t } = f;
      const lift = Math.min(1, u * 4);
      ctx.strokeStyle = f.dim('#5a5a68', 0.6); ctx.lineWidth = 1 * sc;
      for (let k = 0; k < 8; k++) { const a = t * 0.8 + k * 0.8; const r = (20 + k * 6) * sc * lift; const x = W * 0.13 + Math.cos(a) * r * 2, y = H * 0.44 - lift * 40 * sc + Math.sin(a) * r * 0.5; const fl = Math.sin(t * 9 + k) * 3 * sc; ctx.beginPath(); ctx.moveTo(x - 4 * sc, y - fl); ctx.quadraticCurveTo(x, y, x + 4 * sc, y - fl); ctx.stroke(); }
      person(f, W * 0.2, f.gY, '#4a4a5a', { face: -1, hat: '#3a3a3a' });
    } },
    { id: 'kids_pier', label: 'Прыжки с пирса', from: 16, to: 19, seasons: [1], draw(f) {
      const { ctx, W, sc, gY: y, waterY, t } = f;
      const ph = (t % 6) / 6;
      const x0 = W * 0.56, x1 = W * 0.66 - 70 * sc;
      if (ph < 0.5) person(f, x0 + (x1 - x0) * (ph / 0.5), y, '#c84030', { walk: t * 11, face: 1, scale: 0.7 });
      else if (ph < 0.75) { const q = (ph - 0.5) / 0.25; const jx = x1 + q * 26 * sc, jy = y - Math.sin(q * Math.PI) * 18 * sc + q * q * (waterY + 6 * sc - y); ctx.save(); ctx.translate(jx, jy); ctx.rotate(q * 1.2); person(f, 0, 0, '#c84030', { face: 1, scale: 0.7 }); ctx.restore(); }
      else splash(f, x1 + 26 * sc, waterY + 6 * sc, (ph - 0.75) / 0.25, sc);
      person(f, x0 - 10 * sc, y, '#2a5a8a', { face: 1, scale: 0.68 }); person(f, x0 - 18 * sc, y, '#f0c040', { face: 1, scale: 0.64 });
      ctx.fillStyle = f.dim('#f0e0a0'); ctx.fillRect(x0 - 30 * sc, y - 10 * sc, 8 * sc, 3 * sc); ctx.fillStyle = f.dim('#4a7ab0'); ctx.fillRect(x0 - 29 * sc, y - 12 * sc, 7 * sc, 2 * sc);
    } },
    { id: 'tavern_evening', label: 'Вечер в «Старом якоре»', from: 19.5, to: 25, activity: 0.8, draw(f) {
      const { ctx, W, sc, gY: y, t } = f;
      const bw = Math.min(150 * sc, W * 0.19), x = W * 0.12, x0 = x - bw / 2, h = bw * 0.95;
      for (let k = 0; k < 3; k++) silhouettes(f, x0 + bw * (0.12 + k * 0.3), y - h + h * 0.54, bw * 0.16, h * 0.2, 2, k * 3);
      ctx.fillStyle = f.dim('#6a4a2a'); ctx.fillRect(x0 + bw + 6 * sc, y - 9 * sc, 22 * sc, 2 * sc); ctx.fillRect(x0 + bw + 8 * sc, y - 9 * sc, 2 * sc, 9 * sc); ctx.fillRect(x0 + bw + 24 * sc, y - 9 * sc, 2 * sc, 9 * sc);
      person(f, x0 + bw + 2 * sc, y, '#3a3a44', { sit: true, face: 1 }); person(f, x0 + bw + 32 * sc, y, '#5a3a2a', { sit: true, face: -1, hat: '#3a3a3a' });
      ctx.fillStyle = f.dim('#e8d8a0'); for (let k = 0; k < 3; k++) ctx.fillRect(x0 + bw + 9 * sc + k * 6 * sc, y - 12 * sc, 2.5 * sc, 3 * sc);
      if (f.lit) { f.glow(x0 + bw + 17 * sc, y - 14 * sc, 2 * sc, '#ffcf7a', f.night * 0.9); f.pool(x0 + bw + 17 * sc, y - 2 * sc, 30 * sc, '#ffbe6e', 0.25 * f.night); }
      person(f, x0 + bw + 44 * sc, y, '#8a3a2a', { face: -1, hat: '#2a2a2a' });
      const sq = 3 * sc + Math.abs(Math.sin(t * 3)) * 4 * sc; ctx.fillStyle = f.dim('#c8402a'); ctx.fillRect(x0 + bw + 40 * sc - sq, y - 13 * sc, sq * 2, 5 * sc); ctx.fillStyle = f.dim('#f0ece4'); for (let k = 0; k < 4; k++) ctx.fillRect(x0 + bw + 40 * sc - sq + 1 + k * (sq * 2 - 2) / 4, y - 13 * sc, 1, 5 * sc);
      notes(f, x0 + bw + 50 * sc, y - 22 * sc, 3);
      rope(f, x0 + bw, y - h * 0.5, W * 0.195, y - 44 * sc, 10 * sc, '#3a3a3a', 0.6);
      for (let k = 1; k < 8; k++) { const q = k / 8; const lx = x0 + bw + (W * 0.195 - x0 - bw) * q, ly = y - h * 0.5 + (h * 0.5 - 44 * sc) * q + Math.sin(q * Math.PI) * 10 * sc; if (f.lit) f.glow(lx, ly + 2 * sc, 1.4 * sc, '#ffd890', f.night); else { ctx.fillStyle = f.dim('#f0d080'); ctx.beginPath(); ctx.arc(lx, ly + 2 * sc, 1.4 * sc, 0, Math.PI * 2); ctx.fill(); } }
    } },
    { id: 'night_fisher', label: 'Ночной рыбак', from: 1, to: 4.5, activity: 0.2, draw(f) {
      const { ctx, W, sc, gY: y, t } = f;
      const x = W * 0.66 - 64 * sc;
      person(f, x, y + 1, '#2a2a3a', { sit: true, face: 1, hat: '#3a3a44' });
      ctx.strokeStyle = f.dim('#3a2a1c'); ctx.lineWidth = 0.9 * sc; ctx.beginPath(); ctx.moveTo(x + 3 * sc, y - 8 * sc); ctx.lineTo(x + 22 * sc, y - 24 * sc); ctx.stroke();
      ctx.strokeStyle = hexA('#ffffff', 0.35); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x + 22 * sc, y - 24 * sc); ctx.lineTo(x + 26 * sc + Math.sin(t) * 2, f.waveY(x + 26 * sc)); ctx.stroke();
      ctx.fillStyle = f.dim('#2a2a2a'); ctx.fillRect(x - 10 * sc, y - 7 * sc, 4 * sc, 7 * sc);
      const fl = 0.8 + Math.sin(t * 9) * 0.15;
      f.glow(x - 8 * sc, y - 5 * sc, 2.5 * sc, '#ffb850', fl); f.pool(x - 8 * sc, y, 26 * sc, '#ffa040', 0.3 * fl);
      f.glow(x + 26 * sc + Math.sin(t) * 2, f.waveY(x + 26 * sc) - 1, 1 * sc, '#80ff80', 0.8);
      ctx.fillStyle = f.dim('#4a7ab0'); ctx.fillRect(x - 15 * sc, y - 5 * sc, 2.6 * sc, 5 * sc);
      cat(f, x - 24 * sc, y, '#2a2a2c', 1);
    } },
  ],

  backRow(f) {
    const { W, sc, gY } = f;
    const y = gY - 9 * sc;
    // второй ряд: белёные дома под черепицей между главными зданиями
    backHouse(f, W * 0.015, y, 26 * sc, 20 * sc, '#e8e0d0', '#a24a30', 101, { chimney: true });
    backHouse(f, W * 0.22, y, 30 * sc, 22 * sc, '#efe8dc', '#8a3a2a', 103, { chimney: true });
    backHouse(f, W * 0.265, y, 22 * sc, 16 * sc, '#d8ccb8', '#6a5a4a', 105, { shed: true });
    backHouse(f, W * 0.43, y, 34 * sc, 24 * sc, '#e8e0d0', '#a24a30', 107, { chimney: true });
    backHouse(f, W * 0.595, y, 28 * sc, 18 * sc, '#efe8dc', '#8a3a2a', 109);
    backHouse(f, W * 0.76, y, 24 * sc, 16 * sc, '#d8ccb8', '#6a5a4a', 111, { shed: true });
    backHouse(f, W * 0.975, y, 28 * sc, 22 * sc, '#e8e0d0', '#a24a30', 113, { chimney: true });
    // деревья между домами
    tree(f, W * 0.05, y + 2, 7 * sc, '#3f6a3c', 21); tree(f, W * 0.3, y + 2, 6 * sc, '#2f5a36', 22); tree(f, W * 0.63, y + 2, 7 * sc, '#3f6a3c', 23); tree(f, W * 0.8, y + 2, 5 * sc, '#2f5a36', 24);
  },

  ground(f) {
    const { ctx, W, sc, gY, quayY, dim } = f;
    // мох у края досок и выбеленные солью места
    ctx.fillStyle = hexA('#5a7a4a', 0.28);
    for (let i = 0; i < 14; i++) { const x = f.h(i + 400) * W; ctx.beginPath(); ctx.ellipse(x, quayY + 2 * sc, (6 + f.h(i) * 10) * sc, 1.6 * sc, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = hexA('#ffffff', 0.07);
    for (let i = 0; i < 10; i++) ctx.fillRect(f.h(i + 420) * W, gY + f.h(i + 430) * 6 * sc, (10 + f.h(i) * 20) * sc, 1.2 * sc);
    // номера причалов краской
    ctx.fillStyle = hexA('#f0e8d8', 0.55); ctx.font = `bold ${5 * sc}px Inter, sans-serif`;
    for (let k = 0; k < 4; k++) ctx.fillText(`${k + 1}`, W * (0.1 + k * 0.25), quayY + 3 * sc);
    // чешуя блестит у рынка
    if (f.A.sunVis > 0.3) { ctx.fillStyle = `rgba(255,255,255,${(0.5 * f.A.sunVis).toFixed(3)})`; for (let i = 0; i < 8; i++) { const a = Math.sin(f.t * 4 + i * 2) > 0.6 ? 1 : 0; if (a) ctx.fillRect(W * 0.3 + f.h(i + 440) * W * 0.08, gY + 1 + f.h(i + 450) * 5 * sc, 1.2, 1.2); } }
    void dim;
  },

  backdrop(f) {
    const { ctx, W, H, hY, sc, t, night, dim } = f;
    // самая дальняя гряда — синеватая, с лесом, почти растворена в воздухе
    ctx.fillStyle = dim(mix('#6a7a8a', f.A.palette.skyHor, 0.68), 0.45);
    ctx.beginPath(); ctx.moveTo(0, hY + 2);
    for (let x = 0; x <= W; x += 6) { const q = x / W; ctx.lineTo(x, hY - H * 0.17 * (0.45 + Math.sin(q * 2.6 + 2.2) * 0.3 + Math.sin(q * 8.3 + 1) * 0.15 + Math.sin(q * 23) * 0.08)); }
    ctx.lineTo(W, hY + 2); ctx.fill();
    // дальние холмы
    const far = dim(mix('#6a8a74', f.A.palette.skyHor, 0.45), 0.6);
    ctx.fillStyle = far;
    ctx.beginPath(); ctx.moveTo(0, hY + 2);
    for (let x = 0; x <= W; x += 6) { const q = x / W; ctx.lineTo(x, hY - H * 0.1 * (0.5 + Math.sin(q * 4.2 + 1) * 0.3 + Math.sin(q * 11 + 3) * 0.2)); }
    ctx.lineTo(W, hY + 2); ctx.fill();
    // поля и виноградники на дальних склонах — полосы
    ctx.strokeStyle = hexA(dim('#8aa060'), 0.35); ctx.lineWidth = 1.2 * sc;
    for (let k = 0; k < 7; k++) { const x0 = W * 0.3 + k * 9 * sc, q0 = x0 / W; ctx.beginPath(); ctx.moveTo(x0, hY - H * 0.1 * (0.5 + Math.sin(q0 * 4.2 + 1) * 0.3 + Math.sin(q0 * 11 + 3) * 0.2) + 4 * sc); ctx.lineTo(x0 + 10 * sc, hY - 2); ctx.stroke(); }
    // ветряк на дальнем холме
    { const wx = W * 0.36, wy = hY - H * 0.1 * (0.5 + Math.sin((wx / W) * 4.2 + 1) * 0.3 + Math.sin((wx / W) * 11 + 3) * 0.2) + 2; ctx.fillStyle = dim(mix('#f0ece4', f.A.palette.skyHor, 0.3), 0.6); ctx.fillRect(wx - 1 * sc, wy - 16 * sc, 2 * sc, 16 * sc); ctx.save(); ctx.translate(wx, wy - 16 * sc); ctx.rotate(t * (0.6 + f.A.wind * 0.08)); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.2 * sc; for (let k = 0; k < 3; k++) { ctx.rotate((Math.PI * 2) / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -9 * sc); ctx.stroke(); } ctx.restore(); }
    // ближний холм с маяком (правый) и холм с часовней (левый)
    const hill = (cx: number, hw: number, hh: number, col: string) => {
      ctx.fillStyle = dim(col, 0.7);
      ctx.beginPath(); ctx.moveTo(cx - hw, hY + 2);
      for (let x = cx - hw; x <= cx + hw; x += 5) { const q = (x - cx) / hw; ctx.lineTo(x, hY - hh * Math.max(0, 1 - q * q) * (0.9 + Math.sin(x * 0.03) * 0.08)); }
      ctx.lineTo(cx + hw, hY + 2); ctx.fill();
    };
    hill(W * 0.82, W * 0.42, H * 0.2, '#4e7452');
    hill(W * 0.12, W * 0.34, H * 0.13, '#56805a');
    // деревья на холмах
    for (let i = 0; i < 14; i++) {
      const q = f.h(i * 3 + 1);
      const x = W * (0.45 + q * 0.55), hh = H * 0.2 * Math.max(0, 1 - ((x - W * 0.82) / (W * 0.42)) ** 2) * 0.92;
      tree(f, x, hY - hh + 2, (5 + f.h(i) * 4) * sc, i % 3 ? '#2f5a36' : '#3f6a3c', i);
    }
    for (let i = 0; i < 6; i++) { const x = W * (0.02 + f.h(i + 40) * 0.3); const hh = H * 0.13 * Math.max(0, 1 - ((x - W * 0.12) / (W * 0.34)) ** 2) * 0.9; tree(f, x, hY - hh + 2, (4 + f.h(i + 9) * 3) * sc, '#355f3a', i + 7); }
    // домики посёлка
    const homes: [number, number][] = [[0.56, 0.6], [0.62, 0.75], [0.69, 0.85], [0.74, 0.7], [0.6, 0.95], [0.66, 1.0], [0.9, 0.5], [0.95, 0.75], [0.5, 0.8]];
    homes.forEach(([qx, k], i) => {
      const x = W * qx; const hh = H * 0.2 * Math.max(0, 1 - ((x - W * 0.82) / (W * 0.42)) ** 2);
      cottage(f, x, hY - hh * k + 4, (18 + f.h(i) * 8) * sc, (12 + f.h(i + 3) * 6) * sc, i % 2 ? '#8a3a2a' : '#a24a30', i * 11);
    });
    // часовня с колокольней
    { const x = W * 0.12, y = hY - H * 0.12 + 3;
      ctx.fillStyle = dim('#efe8dc'); ctx.fillRect(x - 14 * sc, y - 18 * sc, 28 * sc, 18 * sc); ctx.fillRect(x - 5 * sc, y - 38 * sc, 10 * sc, 20 * sc);
      ctx.fillStyle = dim('#6a7a9a'); ctx.beginPath(); ctx.moveTo(x - 16 * sc, y - 18 * sc); ctx.lineTo(x, y - 28 * sc); ctx.lineTo(x + 16 * sc, y - 18 * sc); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 6 * sc, y - 38 * sc); ctx.lineTo(x, y - 50 * sc); ctx.lineTo(x + 6 * sc, y - 38 * sc); ctx.fill();
      ctx.fillStyle = dim('#d8b060'); ctx.fillRect(x - 0.6 * sc, y - 56 * sc, 1.2 * sc, 7 * sc); ctx.fillRect(x - 2.5 * sc, y - 54 * sc, 5 * sc, 1.2 * sc);
      ctx.fillStyle = f.win(5); ctx.fillRect(x - 2 * sc, y - 36 * sc, 4 * sc, 6 * sc);
      // колокол
      const sw = Math.sin(t * 3) * (Math.sin(t * 0.2) > 0.9 ? 0.4 : 0.05);
      ctx.save(); ctx.translate(x, y - 34 * sc); ctx.rotate(sw); ctx.fillStyle = dim('#b89040'); ctx.beginPath(); ctx.moveTo(-2 * sc, 0); ctx.lineTo(2 * sc, 0); ctx.lineTo(1.2 * sc, -3 * sc); ctx.lineTo(-1.2 * sc, -3 * sc); ctx.fill(); ctx.restore();
    }
    // маяк
    { const x = W * 0.8, base = hY - H * 0.2 * 0.99 + 2;
      ctx.fillStyle = dim('#e8e4dc'); ctx.beginPath(); ctx.moveTo(x - 9 * sc, base); ctx.lineTo(x - 6 * sc, base - 56 * sc); ctx.lineTo(x + 6 * sc, base - 56 * sc); ctx.lineTo(x + 9 * sc, base); ctx.fill();
      ctx.fillStyle = dim('#c0392b'); ctx.beginPath(); ctx.moveTo(x - 8.2 * sc, base - 16 * sc); ctx.lineTo(x - 7.4 * sc, base - 30 * sc); ctx.lineTo(x + 7.4 * sc, base - 30 * sc); ctx.lineTo(x + 8.2 * sc, base - 16 * sc); ctx.fill();
      ctx.fillStyle = dim('#2a2a2e'); ctx.fillRect(x - 8 * sc, base - 58 * sc, 16 * sc, 2 * sc);
      ctx.fillStyle = night > 0.3 ? '#fff4c0' : dim('#9ab8c8'); ctx.fillRect(x - 5 * sc, base - 68 * sc, 10 * sc, 10 * sc);
      ctx.fillStyle = dim('#2a2a2e'); ctx.beginPath(); ctx.moveTo(x - 7 * sc, base - 68 * sc); ctx.lineTo(x, base - 76 * sc); ctx.lineTo(x + 7 * sc, base - 68 * sc); ctx.fill();
      // домик смотрителя
      ctx.fillStyle = dim('#e8e4dc'); ctx.fillRect(x + 10 * sc, base - 14 * sc, 22 * sc, 14 * sc);
      ctx.fillStyle = dim('#8a3a2a'); ctx.beginPath(); ctx.moveTo(x + 8 * sc, base - 14 * sc); ctx.lineTo(x + 21 * sc, base - 24 * sc); ctx.lineTo(x + 34 * sc, base - 14 * sc); ctx.fill();
      ctx.fillStyle = f.win(77); ctx.fillRect(x + 14 * sc, base - 10 * sc, 5 * sc, 5 * sc); ctx.fillRect(x + 23 * sc, base - 10 * sc, 5 * sc, 5 * sc);
      if (night > 0.25) {
        const ly = base - 63 * sc;
        f.glow(x, ly, 4 * sc, '#fff0b0', night);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 2; k++) {
          const a = t * 0.9 + k * Math.PI;
          const dx = Math.cos(a), vis = Math.max(0, Math.sin(a) * -1 + 0.2);
          if (vis <= 0) continue;
          const len = W * 0.55 * vis;
          const beam = ctx.createLinearGradient(x, ly, x + dx * len, ly);
          beam.addColorStop(0, `rgba(255,240,190,${(0.22 * night).toFixed(3)})`); beam.addColorStop(1, 'rgba(255,240,190,0)');
          ctx.fillStyle = beam;
          ctx.beginPath(); ctx.moveTo(x, ly - 2 * sc); ctx.lineTo(x + dx * len, ly - 30 * sc * vis - 6 * sc); ctx.lineTo(x + dx * len, ly + 24 * sc * vis + 6 * sc); ctx.lineTo(x, ly + 2 * sc); ctx.fill();
        }
        ctx.restore();
      }
    }
    // коптильня деда Матвея — дымит всегда
    { const x = W * 0.43, y = hY + 1;
      ctx.fillStyle = dim('#5a4a3a'); ctx.fillRect(x - 10 * sc, y - 12 * sc, 20 * sc, 12 * sc);
      ctx.fillStyle = dim('#3a3a3a'); ctx.beginPath(); ctx.moveTo(x - 12 * sc, y - 12 * sc); ctx.lineTo(x, y - 19 * sc); ctx.lineTo(x + 12 * sc, y - 12 * sc); ctx.fill();
      ctx.fillRect(x + 4 * sc, y - 24 * sc, 4 * sc, 8 * sc);
      if (f.random() < 0.12) f.smoke(x + 6 * sc, y - 25 * sc, 3 * sc, true);
    }
  },

  farWater(f) {
    const { ctx, W, H, hY, waterY, sc, t, dim } = f;
    // каменный волнорез с огнём на оконечности
    const wy = hY + (waterY - hY) * 0.18;
    ctx.fillStyle = dim('#5a5a58', 0.7); ctx.beginPath(); ctx.moveTo(W * 0.6, wy + 1); ctx.lineTo(W * 0.62, wy - 4 * sc); ctx.lineTo(W * 0.93, wy - 5 * sc); ctx.lineTo(W * 0.95, wy + 1); ctx.fill();
    ctx.fillStyle = hexA('#000000', 0.2); for (let k = 0; k < 14; k++) ctx.fillRect(W * (0.62 + k * 0.022), wy - 4 * sc + (k % 2) * 1.5 * sc, 4 * sc, 1.2 * sc);
    ctx.fillStyle = dim('#f0ece4'); ctx.fillRect(W * 0.935 - 2.5 * sc, wy - 16 * sc, 5 * sc, 12 * sc); ctx.fillStyle = dim('#2a9a5a'); ctx.fillRect(W * 0.935 - 2.5 * sc, wy - 10 * sc, 5 * sc, 3 * sc);
    if (f.night > 0.3 && Math.sin(t * 1.8) > 0.2) f.glow(W * 0.935, wy - 17 * sc, 1.8 * sc, '#40ff80', f.night);
    // брызги о волнорез при волне
    if (f.A.waves > 1) { ctx.fillStyle = `rgba(255,255,255,${(0.35 * Math.max(0, Math.sin(t * 2.5))).toFixed(3)})`; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(W * 0.65 + k * W * 0.06, wy - 6 * sc - Math.max(0, Math.sin(t * 2.5 + k)) * 8 * sc, 2.5 * sc, 0, Math.PI * 2); ctx.fill(); } }
    // лебеди у берега
    for (let k = 0; k < 2; k++) {
      const sx = W * 0.16 + k * 16 * sc + Math.sin(t * 0.15 + k) * 20 * sc, sy = hY + (waterY - hY) * 0.62 + Math.sin(t * 1.2 + k) * 1 * sc;
      ctx.fillStyle = dim('#f4f4f0'); ctx.beginPath(); ctx.ellipse(sx, sy, 5 * sc, 2.4 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.4 * sc; ctx.beginPath(); ctx.moveTo(sx + 3 * sc, sy - 1 * sc); ctx.quadraticCurveTo(sx + 7 * sc, sy - 6 * sc, sx + 5 * sc, sy - 7 * sc); ctx.stroke();
      ctx.fillStyle = dim('#f0a030'); ctx.fillRect(sx + 5 * sc, sy - 7.5 * sc, 2 * sc, 0.9 * sc);
    }
    // буй с колоколом
    const bx = W * 0.3, by = hY + (waterY - hY) * 0.45 + Math.sin(t * 1.3) * 2 * sc;
    ctx.fillStyle = dim('#c84030'); ctx.beginPath(); ctx.moveTo(bx - 5 * sc, by); ctx.lineTo(bx + 5 * sc, by); ctx.lineTo(bx + 3 * sc, by - 8 * sc); ctx.lineTo(bx - 3 * sc, by - 8 * sc); ctx.fill();
    ctx.fillStyle = dim('#2a2a2a'); ctx.fillRect(bx - 0.8 * sc, by - 16 * sc, 1.6 * sc, 8 * sc);
    if (f.night > 0.3 && Math.sin(t * 2.5) > 0) f.glow(bx, by - 17 * sc, 1.6 * sc, '#ff6040', f.night);
    // дальний рыбак в лодке
    const fx = W * 0.62 + Math.sin(t * 0.05) * 20, fy = hY + (waterY - hY) * 0.3;
    ctx.fillStyle = dim('#8a6a4a'); ctx.beginPath(); ctx.moveTo(fx - 10 * sc, fy - 2 * sc); ctx.lineTo(fx + 10 * sc, fy - 2.5 * sc); ctx.lineTo(fx + 7 * sc, fy + 2 * sc); ctx.lineTo(fx - 7 * sc, fy + 2 * sc); ctx.fill();
    ctx.fillStyle = dim('#3a3a44'); ctx.fillRect(fx - 1.5 * sc, fy - 7 * sc, 3 * sc, 5 * sc);
    ctx.strokeStyle = dim('#3a2a1c'); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(fx + 1 * sc, fy - 5 * sc); ctx.lineTo(fx + 12 * sc, fy - 12 * sc); ctx.stroke();
    void H;
  },

  building(f, b, x, w) {
    const { ctx, sc, gY: y, t, dim, night } = f;
    const x0 = x - w / 2;
    if (b === 'market') {
      const h = w * 0.55;
      for (let k = 0; k < 3; k++) {
        const sx = x0 + (k / 3) * w, sw = w / 3 - 4 * sc;
        ctx.fillStyle = dim('#5a4430'); ctx.fillRect(sx + 2 * sc, y - h * 0.7, 2 * sc, h * 0.7); ctx.fillRect(sx + sw - 2 * sc, y - h * 0.7, 2 * sc, h * 0.7);
        const stripes = k === 1 ? ['#f0e8d8', '#2a5a8a'] : ['#f0e8d8', '#b83a2a'];
        for (let s = 0; s < 6; s++) {
          ctx.fillStyle = dim(stripes[s % 2]);
          ctx.beginPath(); ctx.moveTo(sx + (s / 6) * sw, y - h * 0.7); ctx.lineTo(sx + ((s + 1) / 6) * sw, y - h * 0.7); ctx.lineTo(sx + ((s + 1) / 6) * sw + 2 * sc, y - h * 0.56 + Math.sin(t * 2 + s) * 0.6); ctx.lineTo(sx + (s / 6) * sw + 2 * sc, y - h * 0.56 + Math.sin(t * 2 + s) * 0.6); ctx.fill();
        }
        ctx.fillStyle = dim('#6a5236'); ctx.fillRect(sx, y - h * 0.26, sw, h * 0.26);
        ctx.fillStyle = hexA('#000000', 0.2); ctx.fillRect(sx, y - h * 0.26, sw, 1.5);
        for (let q = 0; q < 3; q++) { ctx.fillStyle = dim(q === 1 ? '#c8d8e0' : '#a8b8c0'); ctx.beginPath(); ctx.ellipse(sx + sw * (0.2 + q * 0.3), y - h * 0.28, 5 * sc, 2 * sc, 0.2 * (q - 1), 0, Math.PI * 2); ctx.fill(); }
        // лёд
        ctx.fillStyle = hexA('#dff4ff', 0.6); ctx.fillRect(sx + 2 * sc, y - h * 0.3, sw - 4 * sc, 2 * sc);
      }
      // весы
      ctx.strokeStyle = dim('#3a3a3a'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - h * 0.68); ctx.lineTo(x, y - h * 0.5); ctx.stroke();
      const sw2 = Math.sin(t * 1.1) * 1.5 * sc;
      ctx.fillStyle = dim('#c8a040'); ctx.beginPath(); ctx.ellipse(x + sw2, y - h * 0.48, 5 * sc, 1.6 * sc, 0, 0, Math.PI * 2); ctx.fill();
      // вывеска РЫБА
      ctx.fillStyle = dim('#f0e8d8'); ctx.fillRect(x - 16 * sc, y - h * 0.86, 32 * sc, 9 * sc);
      ctx.fillStyle = dim('#8a3a2a'); ctx.font = `bold ${7 * sc}px Georgia, serif`; ctx.textAlign = 'center'; ctx.fillText('РЫБА', x, y - h * 0.86 + 7 * sc); ctx.textAlign = 'left';
      cat(f, x0 + w + 6 * sc, y, '#2a2a2c', -1);
      // весы-безмен на столбе и ведро со льдом
      ctx.fillStyle = dim('#8a8a8a'); ctx.fillRect(x0 - 12 * sc, y - 8 * sc, 7 * sc, 8 * sc); ctx.fillStyle = hexA('#dff4ff', 0.7); ctx.fillRect(x0 - 11 * sc, y - 9 * sc, 5 * sc, 2 * sc);
      // покупательница с корзиной — пока рынок открыт
      if (!f.closed) person(f, x0 + w * 0.5 + 10 * sc, y, '#6a2a4a', { face: -1, hat: '#e8d8a0', carry: 'bucket' });
      else { ctx.fillStyle = dim('#8a6a42'); ctx.fillRect(x0 + 2 * sc, y - h * 0.26 - 3 * sc, w - 4 * sc, 3 * sc); }
      if (f.lit && !f.closed) f.pool(x, y - h * 0.4, w * 0.5, '#ffcf7a', 0.25 * night);
      return y - h * 0.9;
    }
    if (b === 'shop') {
      const h = w * 0.62;
      ctx.fillStyle = dim('#ece4d4'); ctx.fillRect(x0, y - h, w, h);
      ctx.fillStyle = hexA('#000000', 0.08); for (let k = 0; k < 6; k++) ctx.fillRect(x0 + f.h(k + 30) * w, y - h + f.h(k) * h, 3 * sc, 1);
      // черепица
      ctx.fillStyle = dim('#a04a32'); ctx.beginPath(); ctx.moveTo(x0 - 8 * sc, y - h); ctx.lineTo(x, y - h - w * 0.36); ctx.lineTo(x0 + w + 8 * sc, y - h); ctx.fill();
      ctx.strokeStyle = hexA('#000000', 0.18); ctx.lineWidth = 0.8;
      for (let k = 1; k < 7; k++) { const q = k / 7; const yy = y - h - w * 0.36 * (1 - q); ctx.beginPath(); ctx.moveTo(x - (w / 2 + 8 * sc) * q, yy); ctx.lineTo(x + (w / 2 + 8 * sc) * q, yy); ctx.stroke(); }
      // витрина с удочками
      const vx = x0 + w * 0.12, vy = y - h * 0.78, vw = w * 0.42, vh = h * 0.5;
      ctx.fillStyle = f.win(3, '#ffd890'); ctx.fillRect(vx, vy, vw, vh);
      ctx.strokeStyle = dim('#3a2a1c'); ctx.lineWidth = 1 * sc;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(vx + 4 * sc + k * 6 * sc, vy + vh - 2); ctx.lineTo(vx + 7 * sc + k * 6 * sc, vy + 3 * sc); ctx.stroke(); }
      ctx.fillStyle = dim('#2a5a8a'); ctx.fillRect(vx - 3 * sc, vy - 2 * sc, vw + 6 * sc, 2 * sc); ctx.fillRect(vx - 3 * sc, vy, 3 * sc, vh); ctx.fillRect(vx + vw, vy, 3 * sc, vh);
      door(f, x0 + w * 0.66, y - h * 0.5, w * 0.2, h * 0.5, '#4a6a8a');
      // ящик с цветами
      ctx.fillStyle = dim('#6a4a2a'); ctx.fillRect(vx, vy + vh + 1, vw, 4 * sc);
      for (let k = 0; k < 7; k++) { ctx.fillStyle = dim(['#e05070', '#f0c040', '#f08060'][k % 3]); ctx.beginPath(); ctx.arc(vx + 3 * sc + k * (vw - 6 * sc) / 6, vy + vh - 1 * sc, 2 * sc, 0, Math.PI * 2); ctx.fill(); }
      sign(f, x0 + w, y - h * 0.8, 16 * sc, 12 * sc, '#8ab0c8', (c) => { c.strokeStyle = '#2a2018'; c.lineWidth = 1.4 * sc; c.beginPath(); c.arc(0, 1 * sc, 3 * sc, Math.PI * 0.1, Math.PI * 1.3); c.stroke(); c.beginPath(); c.moveTo(0.8 * sc, -4 * sc); c.lineTo(0.8 * sc, 1 * sc); c.stroke(); }, 1);
      // труба
      ctx.fillStyle = dim('#8a7a6a'); ctx.fillRect(x0 + w * 0.75, y - h - w * 0.2, 6 * sc, w * 0.12);
      return y - h - w * 0.36;
    }
    if (b === 'shipyard') {
      const h = w * 0.7;
      // сарай с открытым фасадом
      ctx.fillStyle = dim('#6a5a46'); ctx.fillRect(x0, y - h * 0.72, w, h * 0.72);
      ctx.fillStyle = dim('#3a3028'); ctx.fillRect(x0 + w * 0.08, y - h * 0.66, w * 0.84, h * 0.66);
      ctx.fillStyle = hexA('#000000', 0.25); for (let k = 0; k < 12; k++) ctx.fillRect(x0 + (k / 12) * w, y - h * 0.72, 1, h * 0.72);
      // крыша гофра
      ctx.fillStyle = dim('#7a7a7a'); ctx.beginPath(); ctx.moveTo(x0 - 6 * sc, y - h * 0.72); ctx.lineTo(x, y - h - 4 * sc); ctx.lineTo(x0 + w + 6 * sc, y - h * 0.72); ctx.fill();
      ctx.strokeStyle = hexA('#000000', 0.2); ctx.lineWidth = 0.8; for (let k = 1; k < 14; k++) { const q = k / 14; ctx.beginPath(); ctx.moveTo(x0 - 6 * sc + (w + 12 * sc) * q, y - h * 0.72); ctx.lineTo(x, y - h - 4 * sc); ctx.stroke(); }
      // лодка на козлах внутри
      ctx.fillStyle = dim('#8a6a4a'); for (const dx of [0.25, 0.65]) { ctx.beginPath(); ctx.moveTo(x0 + w * dx - 6 * sc, y); ctx.lineTo(x0 + w * dx, y - 12 * sc); ctx.lineTo(x0 + w * dx + 6 * sc, y); ctx.fill(); }
      ctx.fillStyle = dim('#c8a070'); ctx.beginPath(); ctx.moveTo(x0 + w * 0.12, y - 12 * sc); ctx.lineTo(x0 + w * 0.82, y - 12 * sc); ctx.quadraticCurveTo(x0 + w * 0.78, y - 30 * sc, x0 + w * 0.6, y - 32 * sc); ctx.lineTo(x0 + w * 0.3, y - 32 * sc); ctx.quadraticCurveTo(x0 + w * 0.12, y - 28 * sc, x0 + w * 0.12, y - 12 * sc); ctx.fill();
      ctx.strokeStyle = hexA('#000000', 0.3); ctx.lineWidth = 0.8; for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(x0 + w * 0.14, y - 12 * sc - k * 4 * sc); ctx.lineTo(x0 + w * 0.8, y - 12 * sc - k * 4 * sc); ctx.stroke(); }
      // котёл со смолой
      ctx.fillStyle = dim('#2a2a2a'); ctx.beginPath(); ctx.ellipse(x0 + w * 0.92, y - 4 * sc, 5 * sc, 4 * sc, 0, 0, Math.PI * 2); ctx.fill();
      if (f.random() < 0.06) f.smoke(x0 + w * 0.92, y - 8 * sc, 2.5 * sc, true);
      // инструменты и доски
      ctx.fillStyle = dim('#b89060'); for (let k = 0; k < 5; k++) ctx.fillRect(x0 - 10 * sc, y - 2 * sc - k * 2 * sc, 22 * sc, 1.6 * sc);
      ctx.fillStyle = dim('#d8d8d8'); ctx.fillRect(x0 + w * 0.04, y - h * 0.5, 1.5 * sc, 16 * sc); ctx.fillStyle = dim('#5a3a1c'); ctx.fillRect(x0 + w * 0.04 - 1 * sc, y - h * 0.5 - 5 * sc, 3.5 * sc, 5 * sc);
      // мастер с рубанком
      person(f, x0 + w * 0.5, y, '#5a4a3a', { carry: null, face: 1, hat: '#8a6a4a' });
      ctx.fillStyle = dim('#d8d8d8'); ctx.fillRect(x0 + w * 0.5 + 3 * sc + Math.sin(t * 4) * 3 * sc, y - 13 * sc, 5 * sc, 2 * sc);
      // вывеска
      ctx.fillStyle = dim('#3a2a1c'); ctx.fillRect(x - 20 * sc, y - h * 0.88, 40 * sc, 8 * sc);
      ctx.fillStyle = dim('#e8d8b0'); ctx.font = `${5.5 * sc}px Georgia, serif`; ctx.textAlign = 'center'; ctx.fillText('ЛОДОЧНЫЙ САРАЙ', x, y - h * 0.88 + 6 * sc); ctx.textAlign = 'left';
      if (f.lit) { ctx.fillStyle = f.win(12); ctx.fillRect(x0 + w * 0.1, y - h * 0.6, w * 0.8, h * 0.52); ctx.globalAlpha = 1; f.pool(x, y - h * 0.3, w * 0.6, '#ffc070', 0.2 * night); }
      return y - h - 4 * sc;
    }
    // таверна
    const h = w * 0.95;
    ctx.fillStyle = dim('#ece6d8'); ctx.fillRect(x0, y - h, w, h);
    ctx.fillStyle = hexA('#000000', 0.06); for (let k = 0; k < 10; k++) ctx.fillRect(x0 + f.h(k + 50) * w, y - h + f.h(k + 60) * h, 4 * sc, 1.2);
    ctx.fillStyle = dim('#8a3a2a'); ctx.beginPath(); ctx.moveTo(x0 - 8 * sc, y - h); ctx.lineTo(x, y - h - w * 0.4); ctx.lineTo(x0 + w + 8 * sc, y - h); ctx.fill();
    ctx.strokeStyle = hexA('#000000', 0.15); ctx.lineWidth = 0.8; for (let k = 1; k < 8; k++) { const q = k / 8; const yy = y - h - w * 0.4 * (1 - q); ctx.beginPath(); ctx.moveTo(x - (w / 2 + 8 * sc) * q, yy); ctx.lineTo(x + (w / 2 + 8 * sc) * q, yy); ctx.stroke(); }
    // мансардное окно
    ctx.fillStyle = dim('#ece6d8'); ctx.fillRect(x - 8 * sc, y - h - w * 0.24, 16 * sc, w * 0.14);
    ctx.fillStyle = dim('#6a2a1a'); ctx.beginPath(); ctx.moveTo(x - 10 * sc, y - h - w * 0.24); ctx.lineTo(x, y - h - w * 0.31); ctx.lineTo(x + 10 * sc, y - h - w * 0.24); ctx.fill();
    windowRect(f, x - 5 * sc, y - h - w * 0.22, 10 * sc, w * 0.1, '#5a4a3a', 21);
    // окна двух этажей
    for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) {
      const wx = x0 + w * (0.12 + k * 0.3), wy = y - h + h * (0.14 + r * 0.4), ww = w * 0.16, wh = h * 0.2;
      windowRect(f, wx, wy, ww, wh, '#5a4a3a', r * 3 + k);
      ctx.fillStyle = dim('#2a5a8a'); ctx.fillRect(wx - 3 * sc, wy, 3 * sc, wh); ctx.fillRect(wx + ww, wy, 3 * sc, wh);
      if (r === 1) { ctx.fillStyle = dim('#6a4a2a'); ctx.fillRect(wx - 2 * sc, wy + wh, ww + 4 * sc, 3 * sc); for (let q = 0; q < 4; q++) { ctx.fillStyle = dim(['#e05070', '#f0c040'][q % 2]); ctx.beginPath(); ctx.arc(wx + 2 * sc + q * ww / 3, wy + wh - 1 * sc, 1.8 * sc, 0, Math.PI * 2); ctx.fill(); } }
    }
    door(f, x - w * 0.09, y - h * 0.3, w * 0.18, h * 0.3, '#3a2a1c', true);
    // фонари у двери
    for (const dx of [-w * 0.14, w * 0.14]) { ctx.fillStyle = dim('#2a2a2a'); ctx.fillRect(x + dx - 1.5 * sc, y - h * 0.34, 3 * sc, 5 * sc); if (f.lit) f.glow(x + dx, y - h * 0.32, 2 * sc, '#ffcf7a', night * 0.8); }
    // вывеска «Старый якорь»
    sign(f, x0 + w, y - h * 0.8, 20 * sc, 16 * sc, '#c8a46a', (c) => {
      c.strokeStyle = '#2a2018'; c.lineWidth = 1.4 * sc; c.beginPath(); c.arc(0, 2 * sc, 4 * sc, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
      c.beginPath(); c.moveTo(0, -5 * sc); c.lineTo(0, 4 * sc); c.moveTo(-3 * sc, -2.5 * sc); c.lineTo(3 * sc, -2.5 * sc); c.stroke();
      c.beginPath(); c.arc(0, -6 * sc, 1.2 * sc, 0, Math.PI * 2); c.stroke();
    }, 2);
    // труба с дымом
    const chx = x0 + w * 0.76;
    ctx.fillStyle = dim('#4a3a32'); ctx.fillRect(chx, y - h - w * 0.26, 8 * sc, w * 0.2);
    if (f.random() < 0.1) f.smoke(chx + 4 * sc, y - h - w * 0.28, 3.5 * sc);
    // флюгер-рыба на коньке: поворачивается по ветру
    { const vx = x, vy = y - h - w * 0.4; ctx.fillStyle = dim('#2a2a2e'); ctx.fillRect(vx - 0.7 * sc, vy - 12 * sc, 1.4 * sc, 12 * sc); ctx.fillRect(vx - 6 * sc, vy - 9 * sc, 12 * sc, 1 * sc);
      ctx.save(); ctx.translate(vx, vy - 12 * sc); ctx.scale(f.A.windDir * (0.6 + 0.4 * Math.cos(t * 0.7)), 1); ctx.fillStyle = dim('#b89040'); ctx.beginPath(); ctx.moveTo(-7 * sc, 0); ctx.quadraticCurveTo(0, -3.5 * sc, 6 * sc, 0); ctx.quadraticCurveTo(0, 3.5 * sc, -7 * sc, 0); ctx.moveTo(5 * sc, 0); ctx.lineTo(9 * sc, -3 * sc); ctx.lineTo(9 * sc, 3 * sc); ctx.fill(); ctx.restore(); }
    // гуляющие у входа — двое разговаривают
    if (f.activity > 0.5) { person(f, x0 + w + 26 * sc, y, '#2a3a5a', { face: 1, hat: '#3a3a44' }); person(f, x0 + w + 36 * sc, y, '#8a6a4a', { face: -1 }); ctx.fillStyle = hexA('#f0e8d8', 0.6 + 0.4 * Math.sin(t * 3)); for (let k = 0; k < 3; k++) ctx.fillRect(x0 + w + 28 * sc + k * 2 * sc, y - 25 * sc, 1, 1); }
    // лавка со стариком и бочка-столик
    ctx.fillStyle = dim('#6a4a2a'); ctx.fillRect(x0 - 26 * sc, y - 6 * sc, 20 * sc, 1.8 * sc); ctx.fillRect(x0 - 24 * sc, y - 6 * sc, 1.6 * sc, 6 * sc); ctx.fillRect(x0 - 9 * sc, y - 6 * sc, 1.6 * sc, 6 * sc);
    person(f, x0 - 16 * sc, y, '#4a4a5a', { sit: true, face: 1, hat: '#3a3a3a' });
    barrel(f, x0 - 36 * sc, y, 4 * sc, 9 * sc, '#6a4a2e');
    ctx.fillStyle = dim('#e8d8a0'); ctx.fillRect(x0 - 37.5 * sc, y - 12 * sc, 3 * sc, 3 * sc);
    dog(f, x0 - 4 * sc, y, '#b08a5a', -1);
    if (f.lit) f.pool(x, y - 10 * sc, w * 0.8, '#ffbe6e', 0.22 * night);
    return y - h - w * 0.4;
  },

  extras(f) {
    const { ctx, W, sc, gY: y, t, dim } = f;
    // сохнущие сети между шестами
    const x = W * 0.235;
    ctx.strokeStyle = dim('#3a2a1c'); ctx.lineWidth = 2 * sc;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 52 * sc); ctx.moveTo(x + 40 * sc, y); ctx.lineTo(x + 40 * sc, y - 52 * sc); ctx.stroke();
    ctx.strokeStyle = hexA(dim('#9a9a78'), 0.75); ctx.lineWidth = 0.6;
    const sag = Math.sin(t) * 2 * sc;
    for (let k = 0; k <= 9; k++) { ctx.beginPath(); ctx.moveTo(x + (40 * sc * k) / 9, y - 50 * sc); ctx.lineTo(x + (40 * sc * k) / 9 + sag, y - 14 * sc); ctx.stroke(); }
    for (let k = 0; k <= 6; k++) { ctx.beginPath(); ctx.moveTo(x, y - 50 * sc + k * 6 * sc); ctx.quadraticCurveTo(x + 20 * sc + sag, y - 46 * sc + k * 6 * sc, x + 40 * sc, y - 50 * sc + k * 6 * sc); ctx.stroke(); }
    ctx.fillStyle = dim('#d8a030'); for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x + 4 * sc + k * 8 * sc, y - 49 * sc + k % 2 * 3 * sc, 1.6 * sc, 0, Math.PI * 2); ctx.fill(); }
    // перевёрнутая лодка на берегу
    const bx = W * 0.44;
    ctx.fillStyle = dim('#7a5230'); ctx.beginPath(); ctx.moveTo(bx - 24 * sc, y); ctx.quadraticCurveTo(bx - 20 * sc, y - 10 * sc, bx, y - 11 * sc); ctx.quadraticCurveTo(bx + 20 * sc, y - 10 * sc, bx + 26 * sc, y); ctx.fill();
    ctx.fillStyle = dim('#d8c090'); ctx.fillRect(bx - 22 * sc, y - 3 * sc, 46 * sc, 1.6 * sc);
    ctx.strokeStyle = hexA('#000000', 0.25); ctx.lineWidth = 0.8; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(bx - 22 * sc + k * 2 * sc, y - k * 2.6 * sc); ctx.lineTo(bx + 22 * sc - k * 2 * sc, y - k * 2.6 * sc); ctx.stroke(); }
    // бельевая верёвка у таверны
    const lx = W * 0.21, ly = y - 42 * sc;
    ctx.fillStyle = dim('#5a4a3a'); ctx.fillRect(lx - 1 * sc, ly - 4 * sc, 2 * sc, y - ly + 4 * sc);
    rope(f, W * 0.12 + 70 * sc, ly - 6 * sc, lx, ly, 5 * sc, '#8a8a8a', 0.7);
    const cloth = ['#e8e4dc', '#4a7ab0', '#e05070', '#f0e0a0', '#e8e4dc'];
    for (let k = 0; k < 5; k++) {
      const q = (k + 1) / 6, cx = W * 0.12 + 70 * sc + (lx - W * 0.12 - 70 * sc) * q, cy = ly - 6 * sc + 6 * sc * q + Math.sin(q * Math.PI) * 5 * sc;
      const wv = Math.sin(t * 3 + k) * 2 * sc;
      ctx.fillStyle = dim(cloth[k]); ctx.beginPath(); ctx.moveTo(cx - 3 * sc, cy); ctx.lineTo(cx + 3 * sc, cy); ctx.lineTo(cx + 3 * sc + wv, cy + 8 * sc); ctx.lineTo(cx - 3 * sc + wv, cy + 8 * sc); ctx.fill();
    }
    // колодец
    const wx = W * 0.775;
    ctx.fillStyle = dim('#8a8a80'); ctx.fillRect(wx - 7 * sc, y - 8 * sc, 14 * sc, 8 * sc);
    ctx.fillStyle = dim('#5a4a3a'); ctx.fillRect(wx - 8 * sc, y - 22 * sc, 2 * sc, 14 * sc); ctx.fillRect(wx + 6 * sc, y - 22 * sc, 2 * sc, 14 * sc);
    ctx.fillStyle = dim('#8a3a2a'); ctx.beginPath(); ctx.moveTo(wx - 11 * sc, y - 22 * sc); ctx.lineTo(wx, y - 29 * sc); ctx.lineTo(wx + 11 * sc, y - 22 * sc); ctx.fill();
    // яблоня: весной цветёт, летом зелёная, осенью с яблоками, зимой голая
    const ax = W * 0.98;
    ctx.fillStyle = dim('#4a3a2a'); ctx.fillRect(ax - 2 * sc, y - 40 * sc, 4 * sc, 40 * sc);
    if (f.A.season === 3) { ctx.strokeStyle = dim('#4a3a2a'); ctx.lineWidth = 1.5 * sc; for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.4; ctx.beginPath(); ctx.moveTo(ax, y - 40 * sc); ctx.lineTo(ax + Math.cos(a) * 24 * sc, y - 40 * sc + Math.sin(a) * 24 * sc); ctx.stroke(); } }
    else {
      ctx.fillStyle = dim(leafCol(f, '#3f7a3c', 1)); ctx.beginPath(); ctx.arc(ax, y - 50 * sc, 20 * sc, 0, Math.PI * 2); ctx.arc(ax - 12 * sc, y - 42 * sc, 13 * sc, 0, Math.PI * 2); ctx.arc(ax + 10 * sc, y - 40 * sc, 12 * sc, 0, Math.PI * 2); ctx.fill();
      if (f.A.season >= 1) { ctx.fillStyle = dim(f.A.season === 2 ? '#d83a30' : '#9ad060'); for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.arc(ax + (f.h(k + 80) - 0.5) * 34 * sc, y - 36 * sc - f.h(k + 90) * 26 * sc, 1.6 * sc, 0, Math.PI * 2); ctx.fill(); } }
      else { ctx.fillStyle = dim('#ffd8e0'); for (let k = 0; k < 14; k++) { ctx.beginPath(); ctx.arc(ax + (f.h(k + 80) - 0.5) * 36 * sc, y - 34 * sc - f.h(k + 90) * 30 * sc, 1.3 * sc, 0, Math.PI * 2); ctx.fill(); } }
      // опавшие листья осенью
      if (f.A.season === 2) { for (let k = 0; k < 10; k++) { ctx.fillStyle = dim(['#d8742a', '#c8a030', '#b8402a'][k % 3]); ctx.fillRect(ax - 30 * sc + f.h(k + 95) * 50 * sc, y - 1 - f.h(k + 97) * 3 * sc, 2.5 * sc, 1.5 * sc); } }
    }
    // якорь-памятник на постаменте
    { const px = W * 0.805; ctx.fillStyle = dim('#8a8a80'); ctx.fillRect(px - 9 * sc, y - 6 * sc, 18 * sc, 6 * sc); ctx.fillStyle = dim('#2a2a2e'); ctx.fillRect(px - 1.2 * sc, y - 24 * sc, 2.4 * sc, 18 * sc); ctx.fillRect(px - 5 * sc, y - 21 * sc, 10 * sc, 1.4 * sc); ctx.strokeStyle = dim('#2a2a2e'); ctx.lineWidth = 2 * sc; ctx.beginPath(); ctx.arc(px, y - 12 * sc, 6 * sc, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(px, y - 25 * sc, 1.6 * sc, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = dim('#d8c090'); ctx.fillRect(px - 5 * sc, y - 4 * sc, 10 * sc, 1.2 * sc); }
    // рында на столбе у причала
    { const rx = W * 0.59; ctx.fillStyle = dim('#5a4a3a'); ctx.fillRect(rx - 1.5 * sc, y - 30 * sc, 3 * sc, 30 * sc); ctx.fillRect(rx - 1.5 * sc, y - 30 * sc, 10 * sc, 2 * sc); const sw = Math.sin(t * 2.2) * (f.A.wind > 8 ? 0.3 : 0.05); ctx.save(); ctx.translate(rx + 7 * sc, y - 28 * sc); ctx.rotate(sw); ctx.fillStyle = dim('#c8a040'); ctx.beginPath(); ctx.moveTo(-2.5 * sc, 5 * sc); ctx.lineTo(2.5 * sc, 5 * sc); ctx.lineTo(1.5 * sc, 0); ctx.lineTo(-1.5 * sc, 0); ctx.fill(); ctx.restore(); }
    // флаги на причале
    flag(f, W * 0.6, y, 1, ['#2a5a8a', '#e8e4dc'], 26, 16);
    flag(f, W * 0.73, y, 2, ['#2a5a8a', '#e8e4dc'], 26, 16);
    // ярмарочные гирлянды в выходные
    if (f.fair) {
      bunting(f, W * 0.05, y - 100 * sc, W * 0.26, y - 100 * sc, 22 * sc, ['#d8402a', '#f0c040', '#2a70b0', '#3a9a5a', '#f0f0e8']);
      bunting(f, W * 0.26, y - 100 * sc, W * 0.46, y - 100 * sc, 22 * sc, ['#d8402a', '#f0c040', '#2a70b0', '#3a9a5a', '#f0f0e8']);
    }
  },

  props(f) {
    const { W, sc, gY: y } = f;
    crate(f, W * 0.455, y, 14 * sc, 11 * sc, '#7a5a38'); crate(f, W * 0.455 + 14 * sc, y, 12 * sc, 11 * sc, '#8a6a42'); crate(f, W * 0.455 + 5 * sc, y - 11 * sc, 13 * sc, 11 * sc, '#7a5a38');
    fishCrate(f, W * 0.485, y, 16 * sc, 8 * sc);
    barrel(f, W * 0.49 + 26 * sc, y, 4.5 * sc, 11 * sc, '#5a3a24'); barrel(f, W * 0.49 + 36 * sc, y, 4.5 * sc, 11 * sc, '#6a4a2e');
    for (let k = 0; k < 3; k++) { f.ctx.strokeStyle = f.dim('#c8b080'); f.ctx.lineWidth = 1.4 * sc; f.ctx.beginPath(); f.ctx.ellipse(W * 0.4, y - 2 * sc - k * 1.6 * sc, (7 - k) * sc, 2.4 * sc, 0, 0, Math.PI * 2); f.ctx.stroke(); }
    for (let x = 12 * sc; x < W; x += 90 * sc) bollard(f, x, y + 2 * sc, '#2a2a2a');
    // велосипед у сарая
    const bx = W * 0.935;
    f.ctx.strokeStyle = f.dim('#2a2a2e'); f.ctx.lineWidth = 1 * sc;
    f.ctx.beginPath(); f.ctx.arc(bx - 6 * sc, y - 4 * sc, 4 * sc, 0, Math.PI * 2); f.ctx.arc(bx + 6 * sc, y - 4 * sc, 4 * sc, 0, Math.PI * 2); f.ctx.stroke();
    f.ctx.beginPath(); f.ctx.moveTo(bx - 6 * sc, y - 4 * sc); f.ctx.lineTo(bx - 1 * sc, y - 11 * sc); f.ctx.lineTo(bx + 5 * sc, y - 11 * sc); f.ctx.lineTo(bx + 6 * sc, y - 4 * sc); f.ctx.lineTo(bx, y - 4 * sc); f.ctx.lineTo(bx - 1 * sc, y - 11 * sc); f.ctx.stroke();
  },

  moored(f) {
    const { W, waterY, sc, t } = f;
    hull(f, W * 0.25, waterY + 2 * sc, sc * 0.75, '#e8e4dc', '#c84030', { bob: Math.sin(t * 1.1 + 2.5) * 1.5 * sc });
    hull(f, W * 0.44, waterY + 2 * sc, sc * 0.65, '#7a5230', '#d8c090', { bob: Math.sin(t * 1.1 + 4.4) * 1.5 * sc });
    hull(f, W * 0.07, waterY + 2 * sc, sc * 0.6, '#4a7ab0', '#f0ece0', { bob: Math.sin(t * 1.1 + 1) * 1.5 * sc });
  },

  locals(f) {
    const { W, sc, gY: y, t, waterY } = f;
    // мальчишка с удочкой на краю причала
    const kx = W * 0.66 - 56 * sc;
    person(f, kx, y + 1, '#c84030', { sit: true, face: 1, scale: 0.8 });
    f.ctx.strokeStyle = f.dim('#3a2a1c'); f.ctx.lineWidth = 0.9 * sc; f.ctx.beginPath(); f.ctx.moveTo(kx + 3 * sc, y - 8 * sc); f.ctx.lineTo(kx + 20 * sc, y - 22 * sc); f.ctx.stroke();
    f.ctx.strokeStyle = hexA('#ffffff', 0.4); f.ctx.lineWidth = 0.6; f.ctx.beginPath(); f.ctx.moveTo(kx + 20 * sc, y - 22 * sc); f.ctx.lineTo(kx + 24 * sc, f.waveY(kx + 24 * sc)); f.ctx.stroke();
    // куры у таверны
    for (let k = 0; k < 3; k++) {
      const cx = W * 0.2 + k * 12 * sc + Math.sin(t * 0.5 + k) * 6 * sc, peck = Math.max(0, Math.sin(t * 6 + k * 2)) * 2 * sc;
      f.ctx.fillStyle = f.dim(k === 1 ? '#8a4a2a' : '#f0ece0'); f.ctx.beginPath(); f.ctx.ellipse(cx, y - 3 * sc, 3.5 * sc, 2.5 * sc, 0, 0, Math.PI * 2); f.ctx.fill();
      f.ctx.beginPath(); f.ctx.arc(cx + 3 * sc, y - 5.5 * sc + peck, 1.6 * sc, 0, Math.PI * 2); f.ctx.fill();
      f.ctx.fillStyle = f.dim('#d83a30'); f.ctx.fillRect(cx + 2.5 * sc, y - 7.5 * sc + peck, 1.2 * sc, 1.5 * sc);
    }
    // чайка на тумбе (тумбы стоят с шагом 90·sc от 12·sc)
    const gx = 12 * sc + 90 * sc * Math.round((W * 0.59 - 12 * sc) / (90 * sc));
    f.ctx.fillStyle = f.dim('#f4f4f4', 0.8); f.ctx.beginPath(); f.ctx.ellipse(gx, y - 10 * sc, 3.5 * sc, 2.2 * sc, 0, 0, Math.PI * 2); f.ctx.fill(); f.ctx.beginPath(); f.ctx.arc(gx + 3 * sc, y - 12.5 * sc, 1.6 * sc, 0, Math.PI * 2); f.ctx.fill();
    f.ctx.fillStyle = f.dim('#f0a030'); f.ctx.fillRect(gx + 4.5 * sc, y - 12.8 * sc, 2 * sc, 0.9 * sc);
    void waterY;
  },

  foreground(f) {
    const { ctx, W, H, sc, t } = f;
    // сезонные частицы: лепестки весной, листья осенью, пыльца в лучах летом
    if (f.A.season === 0 || f.A.season === 2) {
      for (let i = 0; i < 18; i++) {
        const ph = ((t * (0.05 + f.h(i) * 0.04) + f.h(i + 9)) % 1);
        const x = ((f.h(i + 3) * W + f.windTravel * (12 + i) * sc) % (W + 60) + W + 60) % (W + 60) - 30, y = ph * H * 0.8 + Math.sin(t * 2 + i) * 6 * sc;
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * 2 + i); ctx.fillStyle = f.dim(f.A.season === 0 ? '#ffd0dc' : ['#d8742a', '#c8a030', '#b8402a'][i % 3], 0.6); ctx.fillRect(-1.6 * sc, -1 * sc, 3.2 * sc, 2 * sc); ctx.restore();
      }
    }
    if (f.A.season === 1 && f.A.sunVis > 0.5 && f.night < 0.2) { ctx.fillStyle = `rgba(255,240,200,${(0.35 * f.A.sunVis).toFixed(3)})`; for (let i = 0; i < 20; i++) { const x = f.h(i + 500) * W + Math.sin(t * 0.4 + i) * 10 * sc, y = H * 0.3 + f.h(i + 510) * H * 0.4 + Math.cos(t * 0.3 + i) * 8 * sc; ctx.fillRect(x, y, 1.2, 1.2); } }
    // светлячки летними ночами
    if (f.night > 0.4 && (f.A.season === 1 || f.A.season === 0)) {
      const { ctx, W, sc, gY, t } = f;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 16; i++) {
        const x = W * (0.86 + f.h(i) * 0.14) + Math.sin(t * 0.7 + i) * 14 * sc, y = gY - 20 * sc - f.h(i + 5) * 50 * sc + Math.cos(t * 0.9 + i * 2) * 8 * sc;
        const a = Math.max(0, Math.sin(t * 2 + i * 1.7)) * f.night;
        ctx.fillStyle = `rgba(200,255,120,${(a * 0.9).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, 1.2 * sc, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  },

  lamp(f, x) {
    const { ctx, sc, quayY, waterY, t, night, dim } = f;
    const ly = quayY - 46 * sc;
    ctx.fillStyle = dim('#1c1e22');
    ctx.fillRect(x - 1.2 * sc, ly, 2.4 * sc, 40 * sc);
    ctx.beginPath(); ctx.moveTo(x - 4 * sc, ly); ctx.lineTo(x + 4 * sc, ly); ctx.lineTo(x + 3 * sc, ly - 7 * sc); ctx.lineTo(x - 3 * sc, ly - 7 * sc); ctx.fill();
    ctx.fillRect(x - 4.5 * sc, ly - 8 * sc, 9 * sc, 1.5 * sc);
    if (night > 0.25) {
      f.glow(x, ly - 3 * sc, 3 * sc, '#ffcf7a', night);
      f.pool(x, quayY, 70 * sc, '#ffc878', 0.22 * night);
      ctx.fillStyle = `rgba(255,200,120,${(0.25 * night).toFixed(3)})`;
      for (let k = 0; k < 6; k++) ctx.fillRect(x - 1.5 + Math.sin(t * 3 + k * 1.7 + x) * 2, waterY + 6 + k * 9 * sc, 3, 6 * sc);
    }
  },
};
