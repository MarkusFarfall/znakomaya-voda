import { fishingRodPose } from "../fishingRod";
/** Люди на борту: фигура с двузвенными руками и ногами (IK) и удочка рыбака */
import { clamp } from "../util";
import { dot, ln, rbox, sh, type P, type Pen, type R } from "./kit";

/** Внешний вид рыбака по погоде — как в прежней игре (куртка, шапка, борода, трубка) */
export function look(r: R, extra: Partial<PersonOpts> = {}): Pick<PersonOpts, "coat" | "pants" | "hat" | "hatColor" | "beard" | "pipe"> & Partial<PersonOpts> {
  return {
    coat: r.coat,
    pants: "#2a3040",
    hat: r.rainy ? "sou" : r.cold ? "beanie" : "cap",
    hatColor: r.rainy ? r.coat : r.cold ? "#8a2a2a" : "#5a4a30",
    beard: "#9a9a96",
    pipe: true,
    ...extra,
  };
}

/** Дымок трубки у рыбака, когда тот спокоен */
export function pipeSmoke(r: R, out: PersonOut) {
  const calm = r.e.phase === "waiting" || r.e.phase === "idle" || r.e.phase === "sinking" || r.pose !== "fish";
  if (calm && Math.random() < r.p.dt * 1.8) r.emit("smoke", out.mouth[0], out.mouth[1] - 0.04, 0.05);
}

export interface PersonOpts {
  /** стоя — точка под ступнями; сидя — точка сиденья под тазом */
  x: number;
  y: number;
  face: 1 | -1;
  sit?: boolean;
  /** наклон корпуса вперёд, рад */
  lean?: number;
  bob?: number;
  coat: string;
  pants?: string;
  boots?: string;
  vest?: string;
  skin?: string;
  hat?: "cap" | "sou" | "beanie" | "hood" | "helmet" | "none";
  hatColor?: string;
  beard?: string;
  pipe?: boolean;
  scale?: number;
  /** цели рук: ближняя, дальняя (null — руки свободно висят) */
  hands?: [P | null, P | null];
  /** сидя: куда ставятся ступни относительно таза */
  footDx?: number;
  footY?: number;
  /** вызывается перед ближней рукой (чтобы удилище оказалось между туловищем и рукой) */
  between?: () => void;
}

export interface PersonOut {
  hands: [P, P];
  shoulder: P;
  head: P;
  hip: P;
  mouth: P;
}

function ik(a: P, b: P, l1: number, l2: number, pole: P): { mid: P; end: P } {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const d = Math.max(1e-4, Math.hypot(dx, dy));
  const dd = clamp(d, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.002);
  const a1 = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a1 * a1));
  const ux = dx / d, uy = dy / d;
  const c1: P = [a[0] + ux * a1 - uy * h, a[1] + uy * a1 + ux * h];
  const c2: P = [a[0] + ux * a1 + uy * h, a[1] + uy * a1 - ux * h];
  const mx = a[0] + ux * a1, my = a[1] + uy * a1;
  const s1 = (c1[0] - mx) * pole[0] + (c1[1] - my) * pole[1];
  const s2 = (c2[0] - mx) * pole[0] + (c2[1] - my) * pole[1];
  return { mid: s1 >= s2 ? c1 : c2, end: [a[0] + ux * dd, a[1] + uy * dd] };
}

export function drawPerson(p: Pen, o: PersonOpts): PersonOut {
  const { ctx } = p;
  const c = p.c;
  const s = o.scale ?? 1;
  const f = o.face;
  const lean = clamp(o.lean ?? 0.05, -0.7, 0.95);
  const thigh = 0.44 * s, shin = 0.44 * s, torso = 0.54 * s, ua = 0.29 * s, fa = 0.27 * s, hr = 0.115 * s;
  const hip: P = o.sit ? [o.x, o.y - 0.02 + (o.bob ?? 0)] : [o.x, o.y - 0.9 * s + (o.bob ?? 0)];
  const sho: P = [hip[0] + f * Math.sin(lean) * torso, hip[1] - Math.cos(lean) * torso];
  const head: P = [sho[0] + f * Math.sin(lean + 0.1) * 0.22 * s, sho[1] - Math.cos(lean + 0.1) * 0.22 * s];
  const skin = c(o.skin ?? "#d8a888");
  const coat = c(o.coat), coatD = c(sh(o.coat, 0.7));
  const pantsC = o.pants ?? "#2a3040";
  const pants = c(pantsC), pantsD = c(sh(pantsC, 0.68));
  const boot = c(o.boots ?? "#1a1a1c");

  // ноги
  const gy = o.sit ? (o.footY ?? o.y + 0.42 * s) : o.y;
  const fN: P = o.sit ? [o.x + f * (o.footDx ?? 0.5) * s, gy - 0.07] : [o.x + f * 0.13 * s, gy - 0.07];
  const fF: P = o.sit ? [fN[0] - f * 0.1, gy - 0.07] : [o.x - f * 0.12 * s, gy - 0.07];
  const polL: P = o.sit ? [f * 0.4, -1] : [f, 0.15];
  const lN = ik(hip, fN, thigh, shin, polL);
  const lF = ik(hip, fF, thigh, shin, polL);
  const drawLeg = (leg: { mid: P; end: P }, cs: string, cb: string) => {
    ln(ctx, hip[0], hip[1], leg.mid[0], leg.mid[1], 0.15 * s, cs);
    ln(ctx, leg.mid[0], leg.mid[1], leg.end[0], leg.end[1], 0.115 * s, cs);
    const [ax, ay] = leg.end;
    ctx.fillStyle = cb;
    ctx.beginPath();
    ctx.moveTo(ax - f * 0.07, ay - 0.1);
    ctx.lineTo(ax + f * 0.06, ay - 0.1);
    ctx.lineTo(ax + f * 0.07, ay - 0.02);
    ctx.lineTo(ax + f * 0.24, ay + 0.0);
    ctx.lineTo(ax + f * 0.24, ay + 0.07);
    ctx.lineTo(ax - f * 0.08, ay + 0.07);
    ctx.closePath();
    ctx.fill();
  };
  drawLeg(lF, pantsD, c(sh(o.boots ?? "#1a1a1c", 0.8)));

  // дальняя рука
  const defN: P = [sho[0] + f * 0.04, sho[1] + ua + fa - 0.06];
  const defF: P = [sho[0] - f * 0.03, sho[1] + ua + fa - 0.08];
  const tF = o.hands?.[1] ?? defF;
  const aF = ik(sho, tF, ua, fa, [-f * 0.4, 1]);
  ln(ctx, sho[0], sho[1], aF.mid[0], aF.mid[1], 0.105 * s, coatD);
  ln(ctx, aF.mid[0], aF.mid[1], aF.end[0], aF.end[1], 0.088 * s, coatD);
  dot(ctx, aF.end[0], aF.end[1], 0.048 * s, c(sh(o.skin ?? "#d8a888", 0.82)));

  // туловище
  ctx.lineCap = "round";
  ln(ctx, hip[0] - f * 0.02, hip[1] - 0.02, sho[0], sho[1] + 0.02, 0.31 * s, coatD);
  ln(ctx, hip[0] + f * 0.015, hip[1] - 0.02, sho[0] + f * 0.01, sho[1] + 0.02, 0.27 * s, coat);
  if (o.vest) ln(ctx, hip[0] + f * 0.05, hip[1] - 0.05, sho[0] + f * 0.04, sho[1] + 0.04, 0.2 * s, c(o.vest));
  ln(ctx, hip[0] - 0.14 * s, hip[1] - 0.06, hip[0] + 0.14 * s, hip[1] - 0.06, 0.04 * s, c("#1a1a1c"), "butt");
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.moveTo(sho[0] - f * 0.07, sho[1] + 0.06);
  ctx.lineTo(hip[0] - f * 0.07, hip[1] - 0.12);
  ctx.stroke();

  // голова
  ln(ctx, sho[0], sho[1], head[0], head[1] + hr * 0.5, 0.1 * s, skin);
  dot(ctx, head[0], head[1], hr, skin);
  dot(ctx, head[0] - f * hr * 0.55, head[1] + 0.01, hr * 0.24, c(sh(o.skin ?? "#d8a888", 0.85)));
  // нос, глаз, рот
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(head[0] + f * hr * 0.9, head[1] - 0.01);
  ctx.lineTo(head[0] + f * (hr + 0.04), head[1] + 0.03);
  ctx.lineTo(head[0] + f * hr * 0.85, head[1] + 0.045);
  ctx.fill();
  dot(ctx, head[0] + f * hr * 0.45, head[1] - hr * 0.18, 0.014 * s, c("#101010"));
  ln(ctx, head[0] + f * hr * 0.4, head[1] - hr * 0.4, head[0] + f * hr * 0.75, head[1] - hr * 0.35, 0.014, c("#5a4a3a"));
  const mouth: P = [head[0] + f * hr * 0.78, head[1] + hr * 0.42];
  if (o.beard) {
    ctx.fillStyle = c(o.beard);
    ctx.beginPath();
    ctx.moveTo(head[0] - f * hr * 0.2, head[1] + hr * 0.15);
    ctx.quadraticCurveTo(head[0] + f * hr * 1.0, head[1] + hr * 0.2, head[0] + f * hr * 0.95, head[1] + hr * 0.75);
    ctx.quadraticCurveTo(head[0] + f * hr * 0.3, head[1] + hr * 1.9, head[0] - f * hr * 0.6, head[1] + hr * 0.7);
    ctx.fill();
  }
  if (o.pipe) {
    ln(ctx, mouth[0], mouth[1], mouth[0] + f * 0.12, mouth[1] + 0.02, 0.022, c("#3a2210"));
    rbox(ctx, mouth[0] + f * 0.1 - (f < 0 ? 0.05 : 0), mouth[1] - 0.04, 0.05, 0.07, 0.015, c("#2a1808"));
  }
  // шапка
  const hc = c(o.hatColor ?? "#2a2f3a");
  ctx.fillStyle = hc;
  const hat = o.hat ?? "cap";
  if (hat === "cap") {
    ctx.beginPath();
    ctx.arc(head[0], head[1] - 0.01, hr * 1.1, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(head[0] + f * hr * 0.4, head[1] - hr * 0.55);
    ctx.lineTo(head[0] + f * (hr + 0.12), head[1] - hr * 0.35);
    ctx.lineTo(head[0] + f * hr * 0.5, head[1] - hr * 0.3);
    ctx.fill();
  } else if (hat === "sou") {
    ctx.beginPath();
    ctx.arc(head[0], head[1] - 0.01, hr * 1.12, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(head[0] + f * hr * 0.2, head[1] - hr * 0.4);
    ctx.lineTo(head[0] + f * (hr + 0.1), head[1] - hr * 0.3);
    ctx.lineTo(head[0] - f * (hr + 0.2), head[1] + hr * 0.8);
    ctx.lineTo(head[0] - f * (hr + 0.02), head[1] - hr * 0.25);
    ctx.fill();
  } else if (hat === "beanie") {
    ctx.beginPath();
    ctx.arc(head[0], head[1] - 0.005, hr * 1.12, Math.PI * 1.0, Math.PI * 2.0);
    ctx.fill();
    dot(ctx, head[0], head[1] - hr * 1.18, hr * 0.28, hc);
    ln(ctx, head[0] - hr * 1.05, head[1] - hr * 0.2, head[0] + hr * 1.05, head[1] - hr * 0.2, 0.05, c(sh(o.hatColor ?? "#2a2f3a", 1.25)), "butt");
  } else if (hat === "hood") {
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.arc(head[0] - f * 0.02, head[1], hr * 1.28, Math.PI * 0.6, Math.PI * 2.0);
    ctx.fill();
    dot(ctx, head[0] + f * hr * 0.35, head[1] + 0.005, hr * 0.78, skin);
  } else if (hat === "helmet") {
    ctx.fillStyle = c("#f0b020");
    ctx.beginPath();
    ctx.arc(head[0], head[1] - 0.01, hr * 1.14, Math.PI, Math.PI * 2);
    ctx.fill();
    ln(ctx, head[0] - hr * 1.2, head[1] - 0.02, head[0] + f * hr * 1.5, head[1] - 0.02, 0.035, c("#c89010"), "butt");
    ln(ctx, head[0], head[1] - hr * 1.12, head[0] + f * 0.02, head[1] - 0.02, 0.03, c("#c89010"));
  }

  // ближняя нога
  drawLeg(lN, pants, boot);

  o.between?.();

  // ближняя рука (поверх всего)
  const tN = o.hands?.[0] ?? defN;
  const aN = ik(sho, tN, ua, fa, [-f * 0.4, 1]);
  ln(ctx, sho[0], sho[1], aN.mid[0], aN.mid[1], 0.115 * s, coat);
  ln(ctx, aN.mid[0], aN.mid[1], aN.end[0], aN.end[1], 0.095 * s, coat);
  ln(ctx, aN.mid[0], aN.mid[1] - 0.02, aN.end[0], aN.end[1] - 0.02, 0.025, "rgba(255,255,255,0.12)");
  dot(ctx, aN.end[0], aN.end[1], 0.052 * s, skin);

  return { hands: [aN.end, aF.end], shoulder: sho, head, hip, mouth };
}

/** Рыбак с удочкой: поза удилища по фазе игры; возвращает кончик в метрах */
export function fisher(r: R, o: PersonOpts, rodExtra = 0): P {
  const { ctx, p, e, t } = r;
  const c = p.c;
  const sit = !!o.sit;
  const hipY = sit ? o.y : o.y - 0.9;
  const gx = o.x + 0.42;
  const gy = hipY - (sit ? 0.36 : 0.1);

  const { angle: rodA, bend } = fishingRodPose(e, t);
  const L = 2.6 + rodExtra;
  const dx = Math.cos(rodA), dy = Math.sin(rodA);
  const tipX = gx + dx * L * (1 - bend * 0.14);
  const tipY = gy + dy * L * (1 - bend * 0.28) + bend * L * 0.38;
  const cxr = gx + dx * L * 0.62, cyr = gy + dy * L * 0.62;
  const mx = (gx + cxr) / 2 + (tipX - gx) * 0.2, my = (gy + cyr) / 2 + (tipY - gy) * 0.2;
  const nx = -dy, ny = dx;
  const reel: P = [gx + nx * 0.1 + dx * 0.04, gy + ny * 0.1 + dy * 0.04];
  const crank = e.reeling || e.phase === "sinking" ? t * (e.reeling ? 14 : 4) : 0;
  const hN: P = [reel[0] + Math.cos(crank) * 0.1, reel[1] + Math.sin(crank) * 0.1];
  const hF: P = [gx - dx * 0.02, gy - dy * 0.02];
  const rod = () => {
    ctx.lineCap = "round";
    ctx.strokeStyle = c("#241810");
    ctx.lineWidth = 0.085;
    ctx.beginPath();
    ctx.moveTo(gx - dx * 0.45, gy - dy * 0.45);
    ctx.quadraticCurveTo(cxr, cyr, mx, my);
    ctx.stroke();
    ctx.lineWidth = 0.045;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.quadraticCurveTo(cxr + (tipX - cxr) * 0.3, cyr + (tipY - cyr) * 0.1, tipX, tipY);
    ctx.stroke();
    ln(ctx, gx - dx * 0.42, gy - dy * 0.42, gx + dx * 0.16, gy + dy * 0.16, 0.1, c("#8a6a40"));
    ln(ctx, gx - dx * 0.4, gy - dy * 0.4 - 0.02, gx + dx * 0.14, gy + dy * 0.14 - 0.02, 0.02, "rgba(255,255,255,0.22)");
    // кольца
    for (const k of [0.34, 0.52, 0.72, 0.9]) {
      const qx = gx + (mx - gx) * k * 1.4, qy = gy + (my - gy) * k * 1.4;
      if (k < 0.72) {
        ctx.strokeStyle = c("#8a8a90");
        ctx.lineWidth = 0.012;
        ctx.beginPath();
        ctx.arc(qx + nx * 0.035, qy + ny * 0.035, 0.03, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // катушка
    dot(ctx, reel[0], reel[1], 0.085, c("#9a9aa4"));
    dot(ctx, reel[0], reel[1], 0.055, c("#5a5a62"));
    ln(ctx, reel[0] - 0.02, reel[1] - 0.12, reel[0] - 0.02, reel[1] - 0.03, 0.02, c("#b8b8c0"));
    // рукоять катушки
    ln(ctx, reel[0], reel[1], hN[0], hN[1], 0.022, c("#b8b8c0"));
    dot(ctx, hN[0], hN[1], 0.034, c("#2a2a2c"));
  };
  drawPerson(p, { ...o, lean: (o.lean ?? 0.05) - bend * 0.14, hands: [hN, hF], between: rod });
  return [tipX, tipY];
}
