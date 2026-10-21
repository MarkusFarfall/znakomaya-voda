import type { RGB } from "../atmosphere/types";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export interface PrecipitationView {
  x0: number; x1: number; top: number; bottom: number;
  floor: (x: number) => number;
  /** Distant sea plane. Omit for the foreground port view. */
  horizon?: number;
  /** Hard gate for dry weather / disabled graphics, including dt=0. */
  active?: boolean;
  intensity: number; wind: number; s: number; q: 0 | 1 | 2; color: RGB;
}
interface Drop {
  x: number; y: number; vx: number; vy: number;
  near: boolean; depth: number; size: number; phase: number;
}
interface Impact { x: number; depth: number; age: number; size: number }
export interface PrecipitationSnapshot {
  drops: ReadonlyArray<Readonly<Drop>>;
  impacts: ReadonlyArray<Readonly<Impact>>;
}

/**
 * Per-scene, bounded particle pool, in WORLD coordinates. Camera translation and
 * zoom belong to the canvas transform, not the simulation. Wind changes velocity,
 * never x = time * wind. Rain impacts belong to actual drops, not a second RNG.
 */
export class PrecipitationField {
  private drops: Drop[] = [];
  private impacts: Impact[] = [];
  private seed = 8147;
  private key = "";
  private bounds: { x0: number; x1: number; top: number; bottom: number; s: number } | null = null;
  private amount = 0;
  private wind = 0;
  private elapsed = 0;
  constructor(readonly kind: "rain" | "snow") {}
  private random() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private ground(o: PrecipitationView, x: number, depth: number) {
    const y = o.floor(x);
    return o.horizon === undefined ? y : o.horizon + (y - o.horizon) * depth;
  }
  private spawn(o: PrecipitationView, prefill: boolean): Drop {
    const near = this.random() < 0.28;
    const depth = near ? 1 : 0.08 + this.random() * 0.86;
    const size = (near ? 0.9 : 0.4) + this.random() * (near ? 0.5 : 0.35);
    const padding = Math.min(450, Math.abs(this.wind) * 0.65 + 40);
    const width = o.x1 - o.x0;
    const x = o.x0 - padding + this.random() * (width + padding * 2);
    const bottom = this.ground(o, x, depth);
    const y = prefill ? o.top + this.random() * Math.max(1, bottom - o.top) : o.top - this.random() * 28;
    const speed = this.kind === "rain" ? 470 + size * 430 : 28 + size * 45;
    return { x, y, vx: this.wind * size * 0.7, vy: speed * o.s, near, depth, size, phase: this.random() * Math.PI * 2 };
  }
  /** Separate stepping makes the effect testable without DOM or a GPU. */
  step(o: PrecipitationView, dt: number) {
    dt = Number.isFinite(dt) ? clamp(dt, 0, 0.1) : 0;
    if (o.active === false) { this.drops.length = 0; this.impacts.length = 0; this.amount = 0; return; }
    const key = `${o.x0}:${o.x1}:${o.top}:${o.bottom}:${o.s}`;
    if (key !== this.key) {
      const prev = this.bounds;
      this.key = key;
      // Камера сдвинула окно — переносим уже живущие капли, а не сбрасываем поле:
      // иначе дождь «мигает» при каждом пикселе движения.
      const sameShape = prev && prev.top === o.top && prev.bottom === o.bottom && prev.s === o.s;
      if (sameShape) {
        const dx = o.x0 - prev.x0;
        for (const p of this.drops) p.x += dx;
        for (const p of this.impacts) p.x += dx;
      } else {
        this.drops.length = 0;
        this.impacts.length = 0;
      }
      this.bounds = { x0: o.x0, x1: o.x1, top: o.top, bottom: o.bottom, s: o.s };
    }
    this.elapsed += dt;
    this.amount += (clamp(o.intensity, 0, 1.5) - this.amount) * -Math.expm1(-dt * 2.5);
    this.wind += (clamp(o.wind, -900, 900) - this.wind) * -Math.expm1(-dt * 2);
    const padding = Math.min(450, Math.abs(this.wind) * 0.65 + 40);
    const area = Math.max(0.1, (o.x1 - o.x0 + padding * 2) / 1100 * (o.bottom - o.top) / 520);
    const count = Math.min(o.q === 0 ? 130 : o.q === 1 ? 280 : 480,
      Math.round((this.kind === "rain" ? 230 : 180) * area * this.amount * [0.45, 0.7, 1][o.q]));
    if (this.drops.length > count) this.drops.length = count;
    while (this.drops.length < count) this.drops.push(this.spawn(o, true));
    const steps = Math.max(1, Math.ceil(dt * 120));
    const h = dt / steps;
    for (let n = 0; n < steps; n++) {
      for (let i = 0; i < this.drops.length; i++) {
        const p = this.drops[i];
        const swirl = this.kind === "snow" ? Math.sin(this.elapsed * 1.3 + p.phase) * 15 * o.s : 0;
        p.vx += (this.wind * p.size * 0.7 + swirl - p.vx) * -Math.expm1(-h * 4);
        p.x += p.vx * h;
        p.y += p.vy * h;
        const floor = this.ground(o, p.x, p.depth);
        if (p.y >= floor) {
          if (this.kind === "rain" && p.x >= o.x0 && p.x <= o.x1 && this.impacts.length < (o.q === 0 ? 22 : 64)) {
            this.impacts.push({ x: p.x, depth: p.depth, age: 0, size: p.size });
          }
          this.drops[i] = this.spawn(o, false);
        } else if (p.x < o.x0 - 520 || p.x > o.x1 + 520) this.drops[i] = this.spawn(o, false);
      }
    }
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      this.impacts[i].age += dt;
      if (this.impacts[i].age > 0.48) this.impacts.splice(i, 1);
    }
  }
  draw(c: CanvasRenderingContext2D, o: PrecipitationView) {
    if (o.active === false || (!this.drops.length && !this.impacts.length)) return;
    c.save();
    // Clip to the real wavy cutaway, not a horizontal screen-space rectangle.
    c.beginPath();
    c.moveTo(o.x0, o.top - 50); c.lineTo(o.x1, o.top - 50);
    for (let x = o.x1; x >= o.x0; x -= 8) c.lineTo(x, o.floor(x));
    c.lineTo(o.x0, o.floor(o.x0)); c.closePath(); c.clip();
    c.lineCap = "round";
    const tint = o.color.map(v => Math.round(v * 0.35 + 245 * 0.65)).join(",");
    for (const near of [false, true]) {
      c.beginPath();
      for (const p of this.drops) {
        if (p.near !== near) continue;
        if (this.kind === "snow") {
          const r = p.size * 1.8 * o.s;
          c.moveTo(p.x + r, p.y); c.arc(p.x, p.y, r, 0, Math.PI * 2);
        } else {
          const exposure = (near ? 0.019 : 0.012) * p.size;
          c.moveTo(p.x - p.vx * exposure, p.y - p.vy * exposure);
          c.lineTo(p.x, p.y);
        }
      }
      const alpha = this.kind === "snow" ? (near ? 0.85 : 0.5) : (near ? 0.48 : 0.22);
      c.strokeStyle = c.fillStyle = `rgba(${tint},${alpha * Math.min(1, this.amount * 1.8)})`;
      c.lineWidth = (near ? 1.1 : 0.65) * Math.max(0.75, o.s);
      if (this.kind === "snow") c.fill(); else c.stroke();
    }
    c.restore();
    if (this.kind !== "rain") return;
    c.save();
    c.strokeStyle = `rgb(${tint})`;
    c.lineWidth = 0.75 * Math.max(0.8, o.s);
    for (const p of this.impacts) {
      const age = p.age / 0.48, perspective = 0.25 + p.depth * 0.75;
      const x = p.x, y = this.ground(o, x, p.depth);
      const r = (1 + age * 7) * perspective * o.s;
      c.save(); c.globalAlpha *= (1 - age) * 0.42;
      c.beginPath(); c.ellipse(x, y, r, Math.max(0.2, r * 0.24), 0, 0, Math.PI * 2);
      if (age < 0.28 && p.depth > 0.7) {
        const height = Math.sin(age / 0.28 * Math.PI) * 4 * p.size * o.s;
        c.moveTo(x - r * 0.3, y); c.lineTo(x - r * 0.6, y - height);
        c.moveTo(x + r * 0.3, y); c.lineTo(x + r * 0.6, y - height * 0.7);
      }
      c.stroke(); c.restore();
    }
    c.restore();
  }
  snapshot(): PrecipitationSnapshot {
    return { drops: this.drops.map(p => ({ ...p })), impacts: this.impacts.map(p => ({ ...p })) };
  }
}
