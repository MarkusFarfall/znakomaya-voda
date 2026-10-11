/**
 * Суда как проработанные рисунки + живые слои.
 *
 * Рисунок задаёт вид судна. Код добавляет то, что должно двигаться:
 *   рыбак с удочкой (поза и леска по фазе игры), гребец и вёсла, весло каяка, рулевой у штурвала и румпеля,
 *   дым труб, пузыри винта, ночные огни и свет окон, тёмная подводная часть, закатный и ночной тон.
 *
 * Привязки (u, v) — доли габаритов рисунка: u слева направо, v сверху вниз. Подобраны по самим картинкам.
 * Локальные координаты: метры, 0 по X — середина судна, 0 по Y — ватерлиния, вверх — минус.
 */
import type { BoatStyle } from "../../types";
import { clamp, glow } from "../util";
import { halo, ln, rbox, type P, type R } from "./kit";
import { drawPerson, look, pipeSmoke, type PersonOpts, type PersonOut } from "./person";
import { getSprite, levelFor, tinted } from "./sprites";

const TAU = Math.PI * 2;

interface Spot {
  u: number;
  v: number;
}
interface Lamp extends Spot {
  c: string;
  s?: number;
}
interface Strip {
  u0: number;
  u1: number;
  v: number;
  /** высота полосы окон, доля высоты рисунка */
  h: number;
}
interface Art {
  /** ширина рисунка в метрах */
  w: number;
  /** где ватерлиния: доля высоты рисунка сверху */
  wl: number;
  /** масштаб человека: подогнан под пропорции рисунка */
  ps: number;
  /** лёгкое раскачивание мачты, рад на метр высоты */
  sway?: number;
  smoke?: (Spot & { rate: number; size: number })[];
  lamps?: Lamp[];
  strips?: Strip[];
  ports?: Spot[];
  prop?: Spot;
}

export const ART: Record<BoatStyle, Art> = {
  row: { w: 5.65, wl: 0.85, ps: 1, lamps: [{ u: 0.988, v: 0.13, c: "#ffc070", s: 0.07 }] },
  kayak: { w: 5.26, wl: 0.62, ps: 0.95, lamps: [{ u: 0.985, v: 0.13, c: "#ffffff", s: 0.05 }] },
  dinghy: { w: 7.05, wl: 0.8, ps: 0.65, lamps: [{ u: 0.998, v: 0.44, c: "#30ff60", s: 0.06 }, { u: 0.52, v: 0.2, c: "#ffffff", s: 0.06 }], prop: { u: 0.014, v: 0.91 } },
  barkas: {
    w: 8.07,
    wl: 0.9,
    ps: 0.5,
    sway: 0.004,
    smoke: [{ u: 0.336, v: 0.434, rate: 5, size: 0.14 }],
    lamps: [{ u: 0.656, v: 0.015, c: "#ffffff", s: 0.07 }],
    ports: [{ u: 0.344, v: 0.626 }, { u: 0.403, v: 0.626 }],
  },
  cutter: {
    w: 8.8,
    wl: 0.81,
    ps: 0.55,
    smoke: [{ u: 0.465, v: 0.259, rate: 3, size: 0.2 }],
    lamps: [{ u: 0.547, v: 0.014, c: "#ffffff", s: 0.08 }],
    strips: [{ u0: 0.569, u1: 0.706, v: 0.41, h: 0.06 }],
    prop: { u: 0.087, v: 0.92 },
  },
  yacht: {
    w: 9.55,
    wl: 0.885,
    ps: 0.85,
    sway: 0.006,
    lamps: [{ u: 0.542, v: 0.02, c: "#ffffff", s: 0.08 }, { u: 0.96, v: 0.81, c: "#30ff60", s: 0.06 }],
    ports: [{ u: 0.315, v: 0.815 }, { u: 0.39, v: 0.815 }, { u: 0.46, v: 0.815 }, { u: 0.563, v: 0.815 }],
  },
  seiner: {
    w: 11.5,
    wl: 0.805,
    ps: 0.5,
    smoke: [{ u: 0.633, v: 0.235, rate: 4, size: 0.24 }],
    lamps: [{ u: 0.717, v: 0.016, c: "#ffffff", s: 0.1 }],
    strips: [{ u0: 0.737, u1: 0.87, v: 0.381, h: 0.06 }],
    ports: [{ u: 0.752, v: 0.545 }, { u: 0.83, v: 0.56 }, { u: 0.88, v: 0.56 }],
    prop: { u: 0.113, v: 0.926 },
  },
  trawler: {
    w: 12.6,
    wl: 0.814,
    ps: 0.5,
    smoke: [{ u: 0.428, v: 0.256, rate: 4, size: 0.26 }],
    lamps: [{ u: 0.537, v: 0.054, c: "#ffffff", s: 0.1 }, { u: 0.858, v: 0.186, c: "#ffffff", s: 0.1 }],
    strips: [
      { u0: 0.489, u1: 0.662, v: 0.392, h: 0.055 },
      { u0: 0.55, u1: 0.64, v: 0.515, h: 0.035 },
    ],
    prop: { u: 0.066, v: 0.93 },
  },
  research: {
    w: 13.9,
    wl: 0.85,
    ps: 0.5,
    smoke: [{ u: 0.52, v: 0.23, rate: 3, size: 0.26 }],
    strips: [{ u0: 0.6, u1: 0.74, v: 0.42, h: 0.065 }],
    prop: { u: 0.09, v: 0.94 },
  },
};

/* ───────────────────────── люди ───────────────────────── */

type Who = Partial<PersonOpts> & { x: number; y: number };

function who(r: R, ps: number, o: Who, extra: Partial<PersonOpts> = {}): PersonOpts {
  return { ...look(r, { scale: ps, ...extra }), face: 1, ...o } as PersonOpts;
}

/** Человек на палубе: стоит спокойно или работает руками */
function crewman(r: R, ps: number, x: number, y: number, phase: number, work: boolean, extra: Partial<PersonOpts> = {}): PersonOut {
  const a = Math.sin(r.t * 1.6 + phase);
  const b = Math.cos(r.t * 1.6 + phase);
  const hands: [P, P] | undefined = work
    ? [
        [x + 0.4 * ps, y - 0.85 * ps + 0.05 * ps * a],
        [x + 0.36 * ps, y - 0.8 * ps + 0.05 * ps * b],
      ]
    : undefined;
  return drawPerson(r.p, who(r, ps, { x, y, lean: 0.12 + (work ? 0.12 * a : 0.02 * Math.sin(r.t * 0.9 + phase)), hands }, extra));
}

/** Рыбак с удилищем: поза по фазе игры, возвращает кончик удилища (локальные метры) */
function fisherS(r: R, o: PersonOpts, rodExtra = 0): P {
  const { ctx, p, e, t } = r;
  const c = p.c;
  const s = o.scale ?? 1;
  const wk = 0.55 + 0.45 * s;
  const sit = !!o.sit;
  const hipY = sit ? o.y : o.y - 0.9 * s;
  const gx = o.x + 0.42 * s;
  const gy = hipY - (sit ? 0.36 : 0.1) * s;

  let rodA = -0.85;
  let bend = 0;
  switch (e.phase) {
    case "charging": rodA = -0.85 - e.power * 1.3; break;
    case "casting": rodA = -2.1 + Math.min(1, e.castT * 3) * 1.6; break;
    case "waiting": case "sinking": rodA = -0.55 + Math.sin(t * 1.3) * 0.03; break;
    case "bite": rodA = -0.45 + Math.sin(t * 30) * 0.08; bend = 0.25; break;
    case "fight": {
      const h = e.hooked;
      rodA = -0.95 - (e.reeling ? 0.18 : 0) + e.pullDir * 0.18;
      bend = clamp(h?.tension ?? 0, 0, 1.2) * (h && h.jump > 0 ? 0.5 : 1);
      break;
    }
    case "caught": rodA = -1.1; break;
  }
  const L = (2.6 + rodExtra) * (0.5 + 0.5 * s);
  const dx = Math.cos(rodA), dy = Math.sin(rodA);
  const tipX = gx + dx * L * (1 - bend * 0.14);
  const tipY = gy + dy * L * (1 - bend * 0.28) + bend * L * 0.38;
  const cxr = gx + dx * L * 0.62, cyr = gy + dy * L * 0.62;
  const mx = (gx + cxr) / 2 + (tipX - gx) * 0.2, my = (gy + cyr) / 2 + (tipY - gy) * 0.2;
  const nx = -dy, ny = dx;
  const reel: P = [gx + nx * 0.1 * s + dx * 0.04 * s, gy + ny * 0.1 * s + dy * 0.04 * s];
  const crank = e.reeling || e.phase === "sinking" ? t * (e.reeling ? 14 : 4) : 0;
  const hN: P = [reel[0] + Math.cos(crank) * 0.1 * s, reel[1] + Math.sin(crank) * 0.1 * s];
  const hF: P = [gx - dx * 0.02 * s, gy - dy * 0.02 * s];
  const rod = () => {
    ctx.lineCap = "round";
    ctx.strokeStyle = c("#241810");
    ctx.lineWidth = 0.085 * wk;
    ctx.beginPath();
    ctx.moveTo(gx - dx * 0.45 * s, gy - dy * 0.45 * s);
    ctx.quadraticCurveTo(cxr, cyr, mx, my);
    ctx.stroke();
    ctx.lineWidth = 0.045 * wk;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.quadraticCurveTo(cxr + (tipX - cxr) * 0.3, cyr + (tipY - cyr) * 0.1, tipX, tipY);
    ctx.stroke();
    ln(ctx, gx - dx * 0.42 * s, gy - dy * 0.42 * s, gx + dx * 0.16 * s, gy + dy * 0.16 * s, 0.1 * wk, c("#8a6a40"));
    ctx.fillStyle = c("#9a9aa4");
    ctx.beginPath();
    ctx.arc(reel[0], reel[1], 0.085 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = c("#5a5a62");
    ctx.beginPath();
    ctx.arc(reel[0], reel[1], 0.055 * s, 0, TAU);
    ctx.fill();
    ln(ctx, reel[0], reel[1], hN[0], hN[1], 0.022 * wk, c("#b8b8c0"));
    ctx.fillStyle = c("#2a2a2c");
    ctx.beginPath();
    ctx.arc(hN[0], hN[1], 0.034 * s, 0, TAU);
    ctx.fill();
  };
  drawPerson(p, { ...o, hands: [hN, hF], between: rod });
  return [tipX, tipY];
}

/* ───────────────────────── весло плоскодонки ───────────────────────── */

function oar(r: R, a: P, b: P, alpha: number, dark: boolean) {
  const { ctx, p } = r;
  ctx.save();
  ctx.globalAlpha = alpha;
  const wood = p.c(dark ? "#86663e" : "#c9a26a");
  ln(ctx, a[0], a[1], b[0], b[1], 0.065, wood);
  ln(ctx, a[0], a[1], a[0] + (b[0] - a[0]) * 0.18, a[1] + (b[1] - a[1]) * 0.18, 0.085, p.c("#4a3220"));
  ctx.translate(b[0], b[1]);
  ctx.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]));
  rbox(ctx, -0.34, -0.085, 0.64, 0.17, 0.06, wood);
  ln(ctx, -0.3, 0, 0.26, 0, 0.018, "rgba(0,0,0,0.28)", "butt");
  ctx.restore();
}

/** Ограничить рисование областью выше линии y (борт скрывает ноги и низ фигуры) */
function clipAboveY(r: R, y: number) {
  r.ctx.save();
  r.ctx.beginPath();
  r.ctx.rect(-60, -60, 120, 60 + y);
  r.ctx.clip();
}

function lampGlow(r: R, x: number, y: number, col: string, size: number) {
  const on = clamp(r.night * 1.4 + (r.weather === "fog" ? 0.7 : 0), 0, 1);
  if (on < 0.15) return;
  glow(r.ctx, x, y, size, col, on);
  halo(r.ctx, x, y, size * 10, col, 0.22 * on);
}

/* ───────────────────────── отрисовка судна ───────────────────────── */

export function drawArt(r: R, style: BoatStyle): P | null {
  const A = ART[style];
  const sp = getSprite(style);
  const { ctx, p } = r;
  const Wm = A.w;
  if (!sp) return [Wm * 0.3, -1.2];
  const Hm = (Wm * sp.h) / sp.w;
  // экранный размер судна → подходящий уровень цепочки копий (сжатие всегда меньше чем в 2 раза)
  const tm = ctx.getTransform();
  const mp = levelFor(sp, Math.hypot(tm.a, tm.b) * Wm);
  const X = (u: number) => (u - 0.5) * Wm;
  const Y = (v: number) => (v - A.wl) * Hm;
  const ps = A.ps;
  const top = -A.wl * Hm;

  /* — подготовка поз до того, как нарисован корпус (дальнее весло) — */
  const lx = X(0.47);
  const railY = Y(0.53);
  const lockY = railY - 0.1;
  let H: P = [0, 0], Bn: P = [0, 0], Bf: P = [0, 0];
  let drive = false;
  let rowPhase = 0;
  const rowing = style === "row" && r.pose === "helm";
  if (style === "row") {
    const rate = rowing ? 1.2 + 1.5 * r.speed : 0;
    const u = (((r.t * rate) / TAU) % 1 + 1) % 1;
    rowPhase = u;
    drive = u < 0.42;
    const sweep = drive ? 0.75 - 1.5 * (u / 0.42) : -0.75 + 1.5 * ((u - 0.42) / 0.58);
    const lift = drive ? 0 : Math.sin(((u - 0.42) / 0.58) * Math.PI);
    H = [lx - 0.95 * Math.sin(sweep), lockY - 0.3 - 0.1 * lift];
    Bn = [lx + 1.9 * Math.sin(sweep), 0.42 - lift * 0.62];
    Bf = [lx + 1.9 * Math.sin(sweep), -0.12 - lift * 0.34];
    if (rowing) oar(r, [H[0], H[1] - 0.18], Bf, 0.55, true);
  }

  /* — корпус — */
  ctx.save();
  if (A.sway) ctx.transform(1, 0, Math.sin(r.t * 0.8) * A.sway + (r.speed > 0.04 ? 0.012 * r.wind : 0), 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(mp.c, -Wm / 2, top, Wm, Hm);
  if (r.night > 0.02) {
    const t = tinted(style, "#060a12", mp.level);
    if (t) {
      ctx.globalAlpha = clamp(r.night * 0.74, 0, 0.8);
      ctx.drawImage(t, -Wm / 2, top, Wm, Hm);
      ctx.globalAlpha = 1;
    }
  }
  if (p.golden > 0.05) {
    const t = tinted(style, "#ff8a40", mp.level);
    if (t) {
      ctx.globalAlpha = clamp(p.golden * 0.22, 0, 0.3);
      ctx.drawImage(t, -Wm / 2, top, Wm, Hm);
      ctx.globalAlpha = 1;
    }
  }
  // подводная часть темнеет и зеленеет
  const deep = tinted(style, "#0b3a46", mp.level);
  if (deep) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-Wm, 0, Wm * 2, Hm);
    ctx.clip();
    ctx.globalAlpha = 0.5 + 0.2 * r.night;
    ctx.drawImage(deep, -Wm / 2, top, Wm, Hm);
    ctx.restore();
  }
  ctx.restore();

  /* — ночные огни: свет окон и лампы — */
  const on = clamp((r.night - 0.2) * 1.8, 0, 1);
  if (on > 0 && A.strips) {
    for (const s of A.strips) {
      const x0 = X(s.u0), x1 = X(s.u1), y = Y(s.v), h = s.h * Hm;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = `rgba(255,196,110,${0.85 * on})`;
      ctx.fillRect(x0, y - h / 2, x1 - x0, h);
      ctx.restore();
      halo(ctx, (x0 + x1) / 2, y, (x1 - x0) * 0.8, "#ffb45c", 0.3 * on);
    }
  }
  if (on > 0 && A.ports) {
    for (const s of A.ports) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = `rgba(255,200,120,${0.9 * on})`;
      ctx.beginPath();
      ctx.arc(X(s.u), Y(s.v), 0.012 * Wm, 0, TAU);
      ctx.fill();
      ctx.restore();
      halo(ctx, X(s.u), Y(s.v), 0.05 * Wm, "#ffb45c", 0.3 * on);
    }
  }
  if (A.lamps) for (const l of A.lamps) lampGlow(r, X(l.u), Y(l.v), l.c, l.s ?? 0.07);

  /* — дым и пузыри винта — */
  if (A.smoke) {
    for (const s of A.smoke) {
      const rate = s.rate + 14 * r.speed;
      if (Math.random() < r.p.dt * rate) r.emit("smoke", X(s.u), Y(s.v), s.size);
    }
  }
  if (A.prop && r.speed > 0.12 && Math.random() < r.p.dt * (10 + 40 * r.speed)) r.emit("bubble", X(A.prop.u), Y(A.prop.v), 0.05);

  /* ─────────────── люди и снасти по судам ─────────────── */
  let tip: P | null = null;
  const fish = r.pose === "fish";
  const helm = r.pose === "helm";

  switch (style) {
    case "row": {
      const sx = X(0.45);
      const seat = Y(0.44);
      clipAboveY(r, railY + 0.02);
      if (rowing) {
        const lean = drive ? 0.55 - 0.9 * (rowPhase / 0.42) : -0.35 + 0.9 * ((rowPhase - 0.42) / 0.58);
        drawPerson(p, who(r, ps, { x: sx, y: seat, face: -1, sit: true, lean, footDx: 0.55, footY: seat + 0.3, hands: [H, [H[0] + 0.05, H[1] - 0.03]] }));
      } else if (fish) {
        tip = fisherS(r, who(r, ps, { x: sx, y: seat, sit: true, footDx: 0.5, footY: seat + 0.3 }));
      } else {
        const out = drawPerson(p, who(r, ps, { x: sx, y: seat, sit: true, lean: 0.12 + Math.sin(r.t * 0.9) * 0.02, footDx: 0.5, footY: seat + 0.3, bob: Math.sin(r.t * 1.2) * 0.008 }));
        pipeSmoke(r, out);
      }
      // вёсла: на ходу — в уключинах, иначе лежат поперёк банок
      if (rowing) {
        ctx.restore();
        clipAboveY(r, railY - 0.02);
        oar(r, [H[0], H[1] - 0.18], Bf, 0.85, true);
        ctx.restore();
        oar(r, H, Bn, 1, false);
        if (drive) {
          ctx.strokeStyle = "rgba(255,255,255,0.7)";
          ctx.lineWidth = 0.025;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.ellipse(Bn[0] + 0.1 * i, 0.05, 0.18 + 0.12 * i, 0.04, 0, 0, TAU);
            ctx.stroke();
          }
          if (Math.random() < p.dt * 14) r.emit("spray", Bn[0], 0.05, 0.05);
        }
      } else {
        for (let k = 0; k < 2; k++) oar(r, [X(0.1) + k * 0.1, Y(0.43) - 0.05 * k], [X(0.88), Y(0.4) - 0.06 * k], 1, k === 1);
        ctx.restore();
      }
      break;
    }

    case "kayak": {
      const sx = X(0.476);
      const seat = Y(0.33);
      const bob = Math.sin(r.t * 1.1) * 0.01;
      const rate = helm ? 1.0 + 1.3 * r.speed : 0;
      const ph = r.t * rate;
      const psi = helm ? 0.72 * Math.sin(ph) : -0.12;
      const pc: P = [sx + 0.1, seat - 0.55];
      const half = 1.25;
      const endA: P = [pc[0] + Math.cos(psi) * half, pc[1] + Math.sin(psi) * half];
      const endB: P = [pc[0] - Math.cos(psi) * half, pc[1] - Math.sin(psi) * half];
      const hn: P = [pc[0] + Math.cos(psi) * 0.34, pc[1] + Math.sin(psi) * 0.34];
      const hf: P = [pc[0] - Math.cos(psi) * 0.34, pc[1] - Math.sin(psi) * 0.34];
      const kl = { coat: "#e8c020", hat: "helmet" as const, vest: "#d83a2a", pants: "#202428", beard: undefined, pipe: false };
      clipAboveY(r, Y(0.36));
      if (fish) tip = fisherS(r, who(r, ps, { x: sx, y: seat, sit: true, footDx: 0.8, footY: seat + 0.1 }, kl));
      else {
        const idle: [P, P] = [[pc[0] + 0.3, pc[1] + 0.05], [pc[0] - 0.2, pc[1] + 0.05]];
        drawPerson(p, who(r, ps, { x: sx, y: seat, sit: true, lean: helm ? 0.1 * Math.sin(ph + 1.4) + 0.12 : 0.1, footDx: 0.8, footY: seat + 0.1, bob, hands: helm ? [hn, hf] : idle }, kl));
      }
      ctx.restore();
      if (fish) {
        ln(ctx, sx - 1.0, seat - 0.3, sx + 1.2, seat - 0.18, 0.04, p.c("#2a2a2a"));
        ctx.fillStyle = p.c("#e0b020");
        ctx.beginPath();
        ctx.ellipse(sx - 1.1, seat - 0.31, 0.28, 0.08, 0, 0, TAU);
        ctx.fill();
      } else {
        ln(ctx, endB[0], endB[1], endA[0], endA[1], 0.04, p.c("#2a2a2a"));
        for (const e of [endA, endB]) {
          ctx.save();
          ctx.translate(e[0], e[1]);
          ctx.rotate(psi + (e === endB ? Math.PI : 0));
          ctx.fillStyle = p.c("#f0c020");
          ctx.beginPath();
          ctx.ellipse(0.2, 0, 0.3, 0.085, 0, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.3)";
          ctx.lineWidth = 0.014;
          ctx.stroke();
          ctx.restore();
        }
        if (helm) {
          const low = psi > 0 ? endA : endB;
          if (low[1] > -0.1) {
            ctx.strokeStyle = "rgba(255,255,255,0.7)";
            ctx.lineWidth = 0.022;
            ctx.beginPath();
            ctx.ellipse(low[0], 0.03, 0.26, 0.05, 0, 0, TAU);
            ctx.stroke();
            if (Math.random() < p.dt * 12) r.emit("spray", low[0], 0.04, 0.04);
          }
        }
      }
      break;
    }

    case "dinghy": {
      const px = X(0.413);
      const feet = Y(0.48);
      const wheel: P = [X(0.464), Y(0.243)];
      if (fish) {
        tip = fisherS(r, who(r, ps, { x: X(0.7), y: Y(0.413) }, { coat: "#1f3a52", hat: r.rainy ? "sou" : "cap", hatColor: r.rainy ? "#e8b820" : "#c83a2a", vest: "#f08a20" }));
      } else {
        clipAboveY(r, Y(0.462));
        const out = drawPerson(
          p,
          who(r, ps, { x: px, y: feet, lean: helm ? 0.16 + r.speed * 0.1 : 0.06, hands: helm ? [[wheel[0] + Math.sin(r.t * 0.7) * 0.02, wheel[1] + 0.08], [wheel[0], wheel[1] - 0.1]] : undefined }, { coat: "#1f3a52", hat: "cap", hatColor: "#c83a2a", vest: "#f08a20" })
        );
        ctx.restore();
        pipeSmoke(r, out);
      }
      if (helm && r.speed > 0.4 && Math.random() < p.dt * 20) r.emit("spray", X(0.02), Y(0.78), 0.06);
      break;
    }

    case "barkas": {
      const tiller: P = [X(0.167), Y(0.618)];
      const hx = X(0.134);
      const hy = Y(0.705);
      clipAboveY(r, Y(0.708));
      const out = drawPerson(p, who(r, ps, { x: hx, y: hy, lean: 0.1 + Math.sin(r.t * 1.2) * 0.02, hands: [tiller, [tiller[0] - 0.05, tiller[1] + 0.03]] }));
      ctx.restore();
      pipeSmoke(r, out);
      const fx = X(0.71), fy = Y(0.745);
      if (fish) tip = fisherS(r, who(r, ps, { x: fx, y: fy }), 0.2);
      else crewman(r, ps, fx, fy, 1.7, helm, { coat: "#8a3a2a", hat: "beanie", hatColor: "#2a2a30", pipe: false, beard: undefined });
      break;
    }

    case "cutter": {
      const ax = X(0.204), ay = Y(0.642);
      const fx = X(0.823), fy = Y(0.54);
      crewman(r, ps, ax, ay, 0, helm || !fish, { coat: "#e8601a", hat: "sou", hatColor: "#e8601a" });
      if (fish) tip = fisherS(r, who(r, ps, { x: fx, y: fy }), 0.15);
      else crewman(r, ps, fx, fy, 2.3, false);
      break;
    }

    case "yacht": {
      const hx = X(0.09), hy = Y(0.821);
      const hand: P = [X(0.146), Y(0.784)];
      const yl = { coat: "#c83a30", hat: "cap" as const, hatColor: "#f4f4f4" };
      if (fish) {
        tip = fisherS(r, who(r, ps, { x: X(0.197), y: Y(0.821) }, yl));
        drawPerson(p, who(r, ps, { x: hx, y: hy, lean: 0.08, hands: [hand, [hand[0] - 0.03, hand[1] + 0.06]] }, { coat: "#2f5f8a", hat: "cap", hatColor: "#3a3a40" }));
      } else {
        const out = drawPerson(p, who(r, ps, { x: hx, y: hy, lean: 0.08, hands: helm ? [[hand[0] + Math.sin(r.t * 0.6) * 0.02, hand[1]], [hand[0] - 0.03, hand[1] + 0.06]] : undefined }, yl));
        pipeSmoke(r, out);
      }
      break;
    }

    case "seiner":
    case "trawler":
    case "research": {
      const pos =
        style === "seiner"
          ? { fish: [0.923, 0.483], crew: [0.477, 0.596] }
          : style === "trawler"
            ? { fish: [0.723, 0.577], crew: [0.137, 0.62] }
            : { fish: [0.9, 0.57], crew: [0.11, 0.72] };
      const coat = style === "seiner" ? "#e8601a" : style === "trawler" ? "#e86a20" : "#f0a020";
      const hat = style === "seiner" ? ("sou" as const) : ("helmet" as const);
      crewman(r, ps, X(pos.crew[0]), Y(pos.crew[1]), 0.4, helm || !fish, { coat, hat, hatColor: coat, pipe: false, beard: undefined });
      const fx = X(pos.fish[0]), fy = Y(pos.fish[1]);
      if (fish) tip = fisherS(r, who(r, ps, { x: fx, y: fy }), 0.3);
      else {
        const out = crewman(r, ps, fx, fy, 2.2, false);
        pipeSmoke(r, out);
      }
      break;
    }
  }
  return tip;
}
