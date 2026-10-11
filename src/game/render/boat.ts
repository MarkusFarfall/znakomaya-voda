/**
 * drawBoat — отрисовка судна в 2D (Canvas). ЗАМЕНЯЕТ projects/water-import/src/game/render/boat.ts.
 *
 * Сигнатура: drawBoat(f, x, pose, speed?, flow?) → кончик удилища в экранных px.
 *   speed — 0..1, судно идёт (доля от предельной скорости); без него pose === "helm" = «полный ход».
 *   flow  — px/с: с какой скоростью вода уходит назад под судном (скорость прокрутки сцены).
 *           Без него считается от speed. По flow дрейфуют пенный след, дым, пузыри и брызги.
 *
 * Движение: разгон задирает нос, торможение клюёт; на ходу корпус вибрирует от двигателя, глиссер «дышит»;
 * у форштевня растёт бурун, за кормой остаётся пенный след, у глиссирующих — веер брызг и «петушиный хвост»,
 * у тяжёлых судов — кормовая волна; паруса плавно поднимаются и спускаются.
 */
import type { BoatStyle } from "../types";
import type { Frame } from "./frame";
import { clamp, hexA } from "./util";
import { M, makePen, type Pose, type R } from "./boats/kit";
import { drawArt } from "./boats/art";
import { preloadBoats } from "./boats/sprites";

// рисунки судов грузятся заранее: к первому кадру они уже готовы
preloadBoats();

export type { Pose };

type WakeKind = "oars" | "plane" | "disp" | "sail" | "heavy";

interface Spec {
  /** половина длины корпуса, м */
  half: number;
  /** дифферент на ходу, рад (минус — нос вверх) */
  trim: number;
  /** на сколько метров судно приподнимается на ходу (глиссирование) */
  lift: number;
  /** характер кильватера */
  wake: WakeKind;
  /** вибрация корпуса от двигателя, м */
  vib: number;
}

export const BOAT_SPECS: Record<BoatStyle, Spec> = {
  row: { half: 2.8, trim: -0.02, lift: 0, wake: "oars", vib: 0 },
  kayak: { half: 2.55, trim: -0.015, lift: 0, wake: "oars", vib: 0 },
  dinghy: { half: 3.4, trim: -0.1, lift: 0.22, wake: "plane", vib: 0.007 },
  barkas: { half: 3.95, trim: -0.015, lift: 0, wake: "disp", vib: 0.004 },
  cutter: { half: 4.3, trim: -0.035, lift: 0.06, wake: "disp", vib: 0.004 },
  yacht: { half: 4.65, trim: -0.01, lift: 0, wake: "sail", vib: 0 },
  seiner: { half: 5.7, trim: -0.02, lift: 0, wake: "heavy", vib: 0.004 },
  trawler: { half: 6.25, trim: -0.015, lift: 0, wake: "heavy", vib: 0.003 },
  research: { half: 6.8, trim: -0.02, lift: 0, wake: "heavy", vib: 0.003 },
};

const FOAM_RATE: Record<WakeKind, number> = { oars: 7, plane: 46, disp: 24, sail: 18, heavy: 30 };

interface Foam {
  x: number;
  t: number;
  life: number;
  w: number;
  h: number;
}
interface Particle {
  kind: "smoke" | "bubble" | "spray";
  x: number;
  y: number;
  t: number;
  vx: number;
  vy: number;
  s: number;
}

const foam: Foam[] = [];
const parts: Particle[] = [];
/** состояние движения (единственное судно в сцене) */
const mo = { id: "", last: 0, acc: 0, sail: 0, emitF: 0, emitB: 0, emitS: 0 };

export function drawBoat(f: Frame, x: number, pose: Pose = "fish", speedIn?: number, flowIn?: number): [number, number] {
  const { ctx, e, t, night, sc: s } = f;
  const b = e.boat;
  const spec = BOAT_SPECS[b.style] ?? BOAT_SPECS.row;
  const dt = clamp(f.dt || 0.016, 0.001, 0.1);
  if (mo.id !== b.id) {
    mo.id = b.id;
    mo.last = 0;
    mo.acc = 0;
    mo.sail = 0;
    mo.emitF = 0;
    foam.length = 0;
    parts.length = 0;
  }
  const speed = clamp(speedIn ?? (pose === "helm" ? 1 : 0), 0, 1);
  const k = M * s;
  const flow = flowIn ?? speed * 95 * s;

  /* — динамика: ускорение клонит судно, паруса плавно идут вверх — */
  mo.acc += ((speed - mo.last) / dt - mo.acc) * Math.min(1, dt * 3.5);
  mo.last = speed;
  mo.sail += ((speed > 0.04 ? 1 : 0) - mo.sail) * Math.min(1, dt * 0.8);
  const squat = -clamp(mo.acc * 0.1, -0.05, 0.065);

  // дифферент по реальной волне под носом и кормой
  const reach = spec.half * 0.78 * k;
  const ang0 = Math.atan2(f.waveY(x + reach) - f.waveY(x - reach), reach * 2);
  const porp = spec.wake === "plane" ? Math.sin(t * 2.6) * 0.012 * speed : 0;
  const ang = ang0 * (0.98 - b.stability * 0.5) + spec.trim * speed + squat + porp;
  const jy = spec.vib > 0 ? (Math.sin(t * 47) * 0.5 + Math.sin(t * 31 + 1.3) * 0.5) * spec.vib * k * (0.25 + speed * 0.75) : 0;
  const y = f.waveY(x) + 0.05 * k - spec.lift * speed * k + jy;
  const ca = Math.cos(ang), sa = Math.sin(ang);

  const rainy = ["rain", "storm", "snow"].includes(f.weather);
  const cold = e.temperature < 5;
  const emit: R["emit"] = (kind, bx, by, size = 0.1) => {
    if (parts.length > 300) return;
    const sx = x + k * (bx * ca - by * sa);
    const sy = y + k * (bx * sa + by * ca);
    if (kind === "smoke") parts.push({ kind, x: sx, y: sy, t: 0, vx: (-flow * 0.55 + (f.wind * 26 + 4) * s) * (0.7 + Math.random() * 0.6), vy: -(14 + Math.random() * 6) * s, s: size * k });
    else if (kind === "bubble") parts.push({ kind, x: sx, y: sy, t: 0, vx: -flow * 0.9 + (Math.random() - 0.5) * 10 * s, vy: -(14 + Math.random() * 14) * s, s: size * k });
    else parts.push({ kind, x: sx, y: sy, t: 0, vx: (Math.random() - 0.35) * 70 * s - flow * 0.25, vy: -(70 + Math.random() * 90) * s, s: size * k });
  };

  const r: R = {
    p: makePen(f),
    ctx,
    b,
    e,
    t,
    night,
    wind: f.wind,
    weather: f.weather,
    pose,
    speed,
    sail: mo.sail,
    flow,
    rainy,
    cold,
    coat: rainy ? "#e8b820" : cold ? "#5a3a2a" : "#3e4e3e",
    swing: -ang * 0.7,
    emit,
  };

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(k, k);
  ctx.lineJoin = "round";
  const tip = drawArt(r, b.style);
  ctx.restore();

  const half = spec.half * k;
  const dim = 1 - night * 0.4;

  /* — пена у бортов (всегда) — */
  ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.15 * (1 - night)})`;
  for (let i = 0; i < 8; i++) {
    const px = x - half + (i / 7) * half * 2;
    const p = (Math.sin(t * 2 + i * 1.3) + 1) / 2;
    ctx.beginPath();
    ctx.ellipse(px, f.waveY(px) + 1, (6 + p * 8) * s * (1 + speed * 0.8), 1.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* — пенный след: рождается у кормы и уносится назад вместе с водой — */
  mo.emitF += dt * speed * FOAM_RATE[spec.wake];
  const heavyK = spec.wake === "heavy" ? 1.6 : 1.1;
  while (mo.emitF >= 1) {
    mo.emitF -= 1;
    if (foam.length < 240) foam.push({ x: x - half * 0.92 - Math.random() * 8 * s, t: 0, life: 5 + Math.random() * 4.5, w: (7 + Math.random() * 9) * s * (0.6 + speed * heavyK), h: (1.4 + speed * 1.2) * s });
  }
  for (let i = foam.length - 1; i >= 0; i--) {
    const q = foam[i];
    q.t += f.dt;
    q.x -= flow * f.dt;
    if (q.t > q.life || q.x < -120) {
      foam.splice(i, 1);
      continue;
    }
    const a = 0.5 * (1 - q.t / q.life) * dim;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.ellipse(q.x, f.waveY(q.x) + 1, q.w * (1 + q.t * 0.25), q.h, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* — носовая волна и кормовая — */
  if (speed > 0.04 && spec.wake !== "oars") {
    const big = spec.wake === "heavy" ? 1.3 : spec.wake === "plane" ? 0.8 : 1;
    const bx = x + half * 0.97;
    const wy = f.waveY(bx);
    const hgt = (3 + speed * 13 * big) * s;
    ctx.fillStyle = `rgba(255,255,255,${0.62 * dim})`;
    ctx.beginPath();
    ctx.moveTo(bx - 18 * s - speed * 18 * s, wy + 1);
    ctx.quadraticCurveTo(bx - 6 * s, wy - hgt * 0.55, bx + 4 * s, wy - hgt);
    ctx.quadraticCurveTo(bx + 16 * s * (0.6 + speed), wy - hgt * 0.55, bx + 34 * s * (0.5 + speed), wy + 1);
    ctx.closePath();
    ctx.fill();
    // второй, дальний гребень и пенный язык по борту
    ctx.fillStyle = `rgba(255,255,255,${0.3 * dim})`;
    ctx.beginPath();
    ctx.ellipse(bx + 46 * s * (0.5 + speed), f.waveY(bx + 46 * s) + 1, (10 + speed * 16) * s, (1.8 + speed * 1.6) * s, 0, 0, Math.PI * 2);
    ctx.fill();
    const mid = x + half * 0.3;
    ctx.fillStyle = `rgba(255,255,255,${0.4 * dim})`;
    ctx.beginPath();
    ctx.ellipse(mid, f.waveY(mid) + 1, half * 0.5, (1.4 + speed * 1.8) * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // стоячая кормовая волна у тяжёлых судов и под парусом
    if (spec.wake === "heavy" || spec.wake === "sail" || spec.wake === "disp") {
      const sx = x - half * 1.0;
      const sy = f.waveY(sx);
      const hh = (2 + speed * (spec.wake === "heavy" ? 9 : 6)) * s;
      ctx.fillStyle = `rgba(255,255,255,${0.42 * dim})`;
      ctx.beginPath();
      ctx.moveTo(sx + 10 * s, sy + 1);
      ctx.quadraticCurveTo(sx - 12 * s, sy - hh, sx - 56 * s * (0.6 + speed), sy + 1);
      ctx.closePath();
      ctx.fill();
    }
    // веер брызг у глиссирующего корпуса
    if (spec.wake === "plane" && speed > 0.25) {
      const sp = (speed - 0.25) / 0.75;
      const bx0 = x + half * 0.55;
      const wy0 = f.waveY(bx0);
      const g = ctx.createLinearGradient(bx0 - 70 * s, wy0, bx0 + 40 * s, wy0 - 26 * s);
      g.addColorStop(0, `rgba(255,255,255,${0.1 * sp})`);
      g.addColorStop(1, `rgba(255,255,255,${0.5 * sp * dim})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx0 - 70 * s * sp, wy0 + 1);
      ctx.quadraticCurveTo(bx0 - 20 * s, wy0 - 28 * s * sp, bx0 + 34 * s * sp, wy0 - 8 * s * sp);
      ctx.quadraticCurveTo(bx0 + 24 * s, wy0 - 2 * s, bx0 + 14 * s, wy0 + 1);
      ctx.closePath();
      ctx.fill();
    }
  }

  /* — брызги, пузыри под корпусом, «петушиный хвост» — */
  mo.emitB += dt * speed * (spec.wake === "plane" ? 70 : spec.wake === "oars" ? 0 : 18);
  while (mo.emitB >= 1) {
    mo.emitB -= 1;
    const bx = x + half * 0.9;
    parts.push({ kind: "spray", x: bx, y: f.waveY(bx) - 2, t: 0, vx: (Math.random() * 60 + 10) * s - flow * 0.2, vy: -(60 + Math.random() * 100 * speed) * s, s: 0.06 * k });
    if (spec.wake === "plane" && speed > 0.45 && parts.length < 300) {
      const sx = x - half * 0.98;
      parts.push({ kind: "spray", x: sx, y: f.waveY(sx) - 2, t: 0, vx: -(40 + Math.random() * 90) * s - flow * 0.3, vy: -(90 + Math.random() * 110) * s, s: 0.07 * k });
    }
  }
  mo.emitS += dt * speed * 16;
  while (mo.emitS >= 1) {
    mo.emitS -= 1;
    const bx = x + half * (0.3 + Math.random() * 0.5);
    parts.push({ kind: "bubble", x: bx, y: y + (0.5 + Math.random() * 0.5) * k, t: 0, vx: -flow * 0.9, vy: -(8 + Math.random() * 10) * s, s: (0.03 + Math.random() * 0.04) * k });
  }

  /* — частицы — */
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i];
    q.t += f.dt;
    q.x += q.vx * f.dt;
    q.y += q.vy * f.dt;
    if (q.kind === "spray") {
      q.vy += 320 * s * f.dt;
      q.vx *= 1 - 0.6 * f.dt;
    }
    const life = q.kind === "smoke" ? 3 : q.kind === "bubble" ? 1.7 : 0.9;
    const water = f.waveY(q.x);
    if (q.t > life || (q.kind === "bubble" && q.y < water) || (q.kind === "spray" && q.t > 0.12 && q.y > water)) {
      parts.splice(i, 1);
      continue;
    }
    if (q.kind === "smoke") {
      ctx.fillStyle = `rgba(${night > 0.5 ? "90,95,105" : "210,210,215"},${0.3 * (1 - q.t / 3)})`;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.s * 0.45 + 2 * s + q.t * 5.5 * s, 0, Math.PI * 2);
      ctx.fill();
    } else if (q.kind === "bubble") {
      ctx.strokeStyle = `rgba(225,245,255,${0.6 * (1 - q.t / 1.7)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(1, q.s * 0.6), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = hexA("#ffffff", 0.85 * (1 - q.t / 0.9));
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(0.9, q.s * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (tip) return [x + (tip[0] * ca - tip[1] * sa) * k, y + (tip[0] * sa + tip[1] * ca) * k];
  return [x + 0.6 * k, y - 1.5 * k];
}
