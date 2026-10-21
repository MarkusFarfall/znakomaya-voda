import { hexA } from "./util";

/** Детерминированный ПСЧ: облако должно выглядеть одинаково при каждой пересборке. */
function rnd(seed: number) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Кучевой банк.
 *
 * Форма собирается из куполов в ОДИН путь и заливается вертикальным градиентом
 * (свет сверху, тень снизу), а светлые «лбы» куполов добавляются радиальными
 * градиентами внутри того же клипа. Края спрайта размываются один раз при
 * пересборке (`filter: blur`), поэтому на кадре нет ни колец, ни жёсткой кромки.
 *
 * width — ПОЛНАЯ ширина облака (силуэт гарантированно укладывается в ±width/2).
 */
export function cloudBank(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  lit: string,
  shade: string,
  opacity = 0.65,
  seed = 0,
) {
  const W2 = Math.max(1, width) * 0.5;
  const rand = rnd(seed + 7);
  const h = W2 * (0.5 + rand() * 0.12);
  const n = 6 + Math.floor(rand() * 3);
  const step = (W2 * 2) / (n - 1);
  const baseY = h * 0.15;

  const puffs: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    // Профиль: купола в середине крупнее, к краям мельче — узнаваемый кучевой силуэт.
    const bell = 0.3 + 0.7 * Math.sin(Math.PI * Math.pow(u, 0.9));
    const r = step * (0.42 + bell * 0.62) * (0.8 + rand() * 0.45);
    const cx = -W2 + u * W2 * 2 + (rand() - 0.5) * step * 0.35;
    const cy = baseY - r * (0.25 + rand() * 0.7);
    // Крайние купола держим внутри поля, иначе кромка спрайта срежет силуэт.
    puffs.push([Math.max(-W2 + r * 0.85, Math.min(W2 - r * 0.85, cx)), cy, r]);
  }

  ctx.save();
  ctx.translate(x, y);
  const top = baseY - h * 2.0;

  const body = new Path2D();
  for (const [cx, cy, r] of puffs) {
    body.moveTo(cx + r, cy);
    body.arc(cx, cy, r, 0, Math.PI * 2);
  }
  const g = ctx.createLinearGradient(0, top, 0, baseY + h * 0.3);
  g.addColorStop(0, hexA(lit, opacity * 0.7));
  g.addColorStop(0.35, hexA(lit, opacity));
  g.addColorStop(0.72, hexA(shade, opacity * 0.98));
  g.addColorStop(1, hexA(shade, 0));
  ctx.fillStyle = g;
  ctx.fill(body);

  ctx.save();
  ctx.clip(body);
  // Освещённые «лбы» куполов.
  for (const [cx, cy, r] of puffs) {
    const rg = ctx.createRadialGradient(cx, cy - r * 0.45, 0, cx, cy - r * 0.45, r * 0.95);
    rg.addColorStop(0, hexA(lit, opacity * 0.5));
    rg.addColorStop(1, hexA(lit, 0));
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.45, r * 0.95, 0, Math.PI * 2);
    ctx.fill();
  }
  // Тень в основании.
  const under = ctx.createLinearGradient(0, baseY - h * 0.6, 0, baseY + h * 0.3);
  under.addColorStop(0, hexA(shade, 0));
  under.addColorStop(1, hexA(shade, opacity * 0.5));
  ctx.fillStyle = under;
  ctx.fill(body);
  ctx.restore();

  ctx.restore();
}
