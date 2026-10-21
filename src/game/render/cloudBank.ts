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
 * Кучевой банк — ОДИН непрерывный силуэт и одна заливка.
 *
 * Почему так: перекрывающиеся круги/радиальные градиенты дают «бублики» и кольца,
 * а отдельная прямоугольная подушка в основании читается как брикет с обрезанными
 * краями. Поэтому купола собираются в один путь (nonzero: пересечения не дают
 * швов), основание — плавная дуга, а свет и тень идут одним вертикальным
 * градиентом сверху вниз. Тень у днища добавляется поверх уже залитого силуэта
 * через `source-atop`, так что за его границы ничего не выходит.
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
  const h = W2 * (0.46 + rand() * 0.1);
  const n = 7 + Math.floor(rand() * 3);

  // Веса куполов: в середине крупнее, к краям мельче — узнаваемый кучевой профиль.
  const ws: number[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const w = 0.75 + 0.55 * Math.sin(Math.PI * Math.pow(u, 0.8)) * (0.75 + rand() * 0.5);
    ws.push(w);
    sum += w;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  let cx = -W2;
  for (let i = 0; i < n; i++) {
    const w = (ws[i] / sum) * W2 * 2;
    const u = (i + 0.5) / n;
    const bell = Math.sin(Math.PI * Math.pow(u, 0.75));
    const r = w * (0.62 + 0.3 * rand());
    const cy = -r * 0.12 - bell * h * (0.35 + 0.35 * rand());
    const ox = cx + w * 0.5 + (rand() - 0.5) * w * 0.12;
    ctx.moveTo(ox + r, cy);
    ctx.arc(ox, cy, r, 0, Math.PI * 2);
    cx += w;
  }
  // Днище: плоская волнистая дуга, связывающая крайние купола.
  ctx.moveTo(-W2 * 1.02, h * 0.02);
  ctx.bezierCurveTo(-W2 * 0.4, h * 0.13, W2 * 0.4, h * 0.13, W2 * 1.02, h * 0.02);
  ctx.bezierCurveTo(W2 * 0.5, -h * 0.02, -W2 * 0.5, -h * 0.02, -W2 * 1.02, h * 0.02);
  ctx.closePath();

  const g = ctx.createLinearGradient(0, -h * 1.55, 0, h * 0.16);
  g.addColorStop(0, hexA(lit, opacity));
  g.addColorStop(0.42, hexA(lit, opacity * 0.97));
  g.addColorStop(0.78, hexA(shade, opacity * 0.86));
  g.addColorStop(1, hexA(shade, opacity * 0.3));
  ctx.fillStyle = g;
  ctx.fill();

  // Тень у днища — только внутри силуэта.
  ctx.globalCompositeOperation = "source-atop";
  const under = ctx.createLinearGradient(0, h * 0.02, 0, -h * 0.7);
  under.addColorStop(0, hexA(shade, opacity * 0.32));
  under.addColorStop(1, hexA(shade, 0));
  ctx.fillStyle = under;
  ctx.fillRect(-W2 * 1.1, -h * 0.7, W2 * 2.2, h * 0.72);
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}
