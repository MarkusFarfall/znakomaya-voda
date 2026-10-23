import { RARITY_INFO } from "../fish";
import { depthToU } from "../depth";
import { normalizeSonarMode, SONAR_MODE_LABEL, type SonarBand } from "../sonar";
import type { Frame } from "./frame";
import { clamp, FONTS, hash1, roundRect } from "./util";

const BRASS = "#c8a46a";
const CYAN = "#8fcbd0";
const DIM = "rgba(230,225,214,0.42)";

function sonarPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  roundRect(ctx, x, y, w, h, 8);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "rgba(7,19,28,0.94)");
  g.addColorStop(1, "rgba(5,11,18,0.9)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(143,203,208,0.22)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function smallLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  align: CanvasTextAlign = "left", color = DIM, size = 9) {
  ctx.font = `500 ${size}px ${FONTS.sans}`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** Новая панель эхолота: питание и режим читаются из состояния Engine. */
export function drawSonar(f: Frame, bands: SonarBand[]) {
  const { ctx, W, H, e, t } = f;
  const level = e.s.sonar;
  if (level <= 0 || !e.sonarActive) return;
  if (f.compact && (e.phase === "fight" || e.phase === "charging")) return;

  const mode = normalizeSonarMode(e.s.sonarMode);
  const w = f.compact ? 164 : 236;
  const h = f.compact ? clamp(H * 0.25, 142, 176) : clamp(H * 0.29, 190, 250);
  const x0 = W - w - 60;
  // Панель заканчивается НАД кнопкой перемещения, а не под ней.
  const y0 = H - h - f.botRes - 64;
  if (y0 < f.topRes) return;

  ctx.save();
  sonarPanel(ctx, x0, y0, w, h);
  ctx.fillStyle = CYAN;
  ctx.beginPath();
  ctx.arc(x0 + 14, y0 + 16, 2.6 + Math.sin(t * 4) * 0.5, 0, Math.PI * 2);
  ctx.fill();
  smallLabel(ctx, `ЭХОЛОТ  ${["", "I", "II", "III"][level]}`, x0 + 23, y0 + 19, "left", CYAN, 9.5);
  smallLabel(ctx, SONAR_MODE_LABEL[mode].toUpperCase(), x0 + w - 12, y0 + 19, "right", BRASS, 9);
  smallLabel(ctx, "СКАНИРОВАНИЕ", x0 + 12, y0 + 36, "left", DIM, 7.5);
  smallLabel(ctx, `${bands.length || 18} ЛУЧЕЙ`, x0 + w - 12, y0 + 36, "right", DIM, 7.5);

  const px0 = x0 + 12, py0 = y0 + 45;
  const pw = w - 48, pht = h - 76;
  ctx.save();
  roundRect(ctx, px0 - 4, py0 - 3, pw + 8, pht + 6, 4);
  ctx.clip();
  ctx.fillStyle = "#030a10";
  ctx.fillRect(px0 - 4, py0 - 3, pw + 8, pht + 6);

  const maxU = depthToU(f.loc.maxDepth);
  const near = e.navigation.nx, far = e.castNX(1);
  const left = Math.min(near, far), span = Math.max(0.0001, Math.abs(far - near));
  const dy = (depth: number) => py0 + (depthToU(Math.max(0, depth)) / maxU) * pht * 0.96;

  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const y = py0 + (i / 6) * pht;
    ctx.strokeStyle = i === 3 ? "rgba(143,203,208,0.12)" : "rgba(143,203,208,0.065)";
    ctx.beginPath(); ctx.moveTo(px0, y); ctx.lineTo(px0 + pw, y); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(143,203,208,0.045)";
  for (let i = 1; i < 4; i++) {
    const x = px0 + (i / 4) * pw;
    ctx.beginPath(); ctx.moveTo(x, py0); ctx.lineTo(x, py0 + pht); ctx.stroke();
  }

  const nx2px = (nx: number) => px0 + ((nx - left) / span) * pw;
  ctx.fillStyle = "rgba(143,203,208,0.035)";
  ctx.fillRect(nx2px(e.castNX(0.15)), py0, nx2px(e.castNX(1)) - nx2px(e.castNX(0.15)), pht);

  // Рельеф вычисляется один раз и используется и для заливки, и для линии.
  const bedPoints = mode === "bottom" ? 80 : 40;
  const bed = Array.from({ length: bedPoints + 1 }, (_, i) => ({
    x: px0 + (i / bedPoints) * pw,
    y: dy(e.bedAt(left + (i / bedPoints) * span)),
  }));
  ctx.beginPath();
  ctx.moveTo(px0, py0 + pht);
  bed.forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.lineTo(px0 + pw, py0 + pht);
  ctx.closePath();
  if (mode === "full") {
    const bedGradient = ctx.createLinearGradient(0, py0, 0, py0 + pht);
    bedGradient.addColorStop(0, "rgba(151,126,77,0.58)");
    bedGradient.addColorStop(1, "rgba(66,53,35,0.86)");
    ctx.fillStyle = bedGradient;
    ctx.fill();
  } else if (mode === "bottom") {
    ctx.fillStyle = "rgba(96,80,53,0.42)";
    ctx.fill();
  }

  ctx.beginPath();
  bed.forEach((point, i) => { if (i === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); });
  ctx.strokeStyle = mode === "bottom" ? "rgba(215,180,110,0.9)" : "rgba(200,164,106,0.52)";
  ctx.lineWidth = mode === "bottom" ? 1.5 : 1;
  ctx.stroke();

  if (mode !== "bottom") {
    const scroll = t * 11;
    bands.forEach((band, i) => {
      if (!band.count) return;
      const y = dy(band.depth);
      const n = Math.min(5, band.count);
      for (let k = 0; k < n; k++) {
        const hx = ((hash1(i * 17 + k * 3.1) * pw * 2 - scroll * (0.6 + hash1(k + i) * 0.6)) % pw + pw) % pw;
        const fresh = level >= 2 && k < band.fresh;
        ctx.strokeStyle = fresh ? BRASS : level >= 2 && band.best ? RARITY_INFO[band.best].color : "rgba(180,215,221,0.86)";
        ctx.lineWidth = fresh ? 1.8 : 1.25;
        const r = 3.1 + band.signal * 1.2;
        ctx.beginPath(); ctx.arc(px0 + hx, y + 3, r, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      }
      if (level >= 3 && band.legend) {
        ctx.strokeStyle = `rgba(215,180,110,${0.55 + Math.sin(t * 4) * 0.35})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(px0 + pw * 0.72, y + 6, 8, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      }
    });
  }

  if (e.line.value < f.loc.maxDepth) {
    const ly = dy(e.line.value);
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = "rgba(201,115,92,0.8)";
    ctx.beginPath(); ctx.moveTo(px0, ly); ctx.lineTo(px0 + pw, ly); ctx.stroke();
    ctx.setLineDash([]);
  }
  const targetY = dy(Math.min(e.s.targetDepth, e.maxDepth));
  ctx.strokeStyle = "rgba(227,201,150,0.62)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px0, targetY); ctx.lineTo(px0 + pw, targetY); ctx.stroke();
  ctx.fillStyle = BRASS;
  ctx.fillRect(px0 - 2, targetY - 1, 4, 2);

  if (["sinking", "waiting", "bite", "fight"].includes(e.phase)) {
    ctx.fillStyle = "#f4eee0";
    ctx.beginPath(); ctx.arc(nx2px(e.castNX()), dy(e.hookDepth), 2.5, 0, Math.PI * 2); ctx.fill();
  }
  const scanX = px0 + ((t * 34) % (pw + 24)) - 12;
  const scanGradient = ctx.createLinearGradient(scanX - 12, 0, scanX + 4, 0);
  scanGradient.addColorStop(0, "rgba(143,203,208,0)");
  scanGradient.addColorStop(1, "rgba(143,203,208,0.13)");
  ctx.fillStyle = scanGradient;
  ctx.fillRect(scanX - 12, py0, 16, pht);
  ctx.restore();

  ctx.font = `500 8px ${FONTS.sans}`;
  ctx.fillStyle = DIM;
  ctx.textAlign = "left";
  for (const depth of [0, f.loc.maxDepth * 0.1, f.loc.maxDepth * 0.4, f.loc.maxDepth]) {
    const y = depth === 0 ? py0 + 7 : dy(depth);
    ctx.fillText(`${Math.round(depth)}`, px0 + pw + 5, Math.min(py0 + pht, y + 3));
  }
  const footer = f.compact ? "B · SHIFT+B" : "B — питание  ·  SHIFT+B — режим";
  smallLabel(ctx, footer, x0 + 12, y0 + h - 10, "left", DIM, f.compact ? 7.5 : 8);
  smallLabel(ctx, level >= 3 && mode !== "bottom" ? "◎ ЛЕГЕНДА" : level >= 2 && mode !== "bottom" ? "◆ НОВЫЙ ВИД" : "— ЦЕЛЬ", x0 + w - 12, y0 + h - 10, "right", BRASS, 7.5);
  ctx.restore();
}
