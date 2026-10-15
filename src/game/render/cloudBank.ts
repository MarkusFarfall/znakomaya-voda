import { hexA } from "./util";

/** One continuous, shaded cloud bank: no independently illuminated circular beads. */
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
  const w = Math.max(1, width),
    h = w * (0.19 + Math.sin(seed * 2.7) * 0.025);
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createLinearGradient(0, -h, 0, h * 0.65);
  g.addColorStop(0, hexA(lit, opacity * 0.78));
  g.addColorStop(0.4, hexA(lit, opacity));
  g.addColorStop(0.75, hexA(shade, opacity * 0.65));
  g.addColorStop(1, hexA(shade, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-w, h * 0.35);
  ctx.bezierCurveTo(
    -w * 0.95,
    -h * 0.05,
    -w * 0.79,
    -h * 0.32,
    -w * 0.57,
    -h * 0.24,
  );
  ctx.bezierCurveTo(
    -w * 0.52,
    -h * 0.72,
    -w * 0.32,
    -h * 0.93,
    -w * 0.12,
    -h * 0.69,
  );
  ctx.bezierCurveTo(
    w * 0.02,
    -h * 1.2,
    w * 0.35,
    -h * 1.04,
    w * 0.43,
    -h * 0.47,
  );
  ctx.bezierCurveTo(
    w * 0.64,
    -h * 0.62,
    w * 0.81,
    -h * 0.28,
    w * 0.83,
    h * 0.03,
  );
  ctx.bezierCurveTo(w * 0.98, h * 0.08, w * 1.04, h * 0.35, w, h * 0.56);
  ctx.bezierCurveTo(w * 0.3, h * 0.66, -w * 0.5, h * 0.72, -w, h * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
