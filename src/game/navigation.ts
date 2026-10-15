import type { BoatDef } from './types';

/** Canonical horizontal world. A phone is a viewport, never a narrower location. */
export const SPOT_WORLD_WIDTH = 2400;
export const NAV_LEFT = .1;
export const NAV_RIGHT = .9;
export const DEFAULT_NAV_X = .3;
export interface LocalPosition { spot: string; x: number; heading: 1 | -1 }
export function normalizeLocalPosition(value: unknown, spot: string): LocalPosition {
  const a = value && typeof value === 'object' ? value as Partial<LocalPosition> : {};
  return { spot, x: a.spot === spot && typeof a.x === 'number' && Number.isFinite(a.x) ? Math.max(NAV_LEFT, Math.min(NAV_RIGHT, a.x)) : DEFAULT_NAV_X, heading: a.spot === spot && a.heading === -1 ? -1 : 1 };
}
export function navigationSpeed(boat: Pick<BoatDef, 'fuel' | 'tier' | 'style'>) {
  return boat.fuel > 0 ? 72 + Math.min(4, boat.tier) * 12 : boat.style === 'kayak' ? 42 : 34;
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export class LocalNavigation {
  x: number;
  velocity = 0;
  acceleration = 0;
  target: number | null = null;
  heading: 1 | -1;
  /** 0 = facing right, PI = facing left. Both renderers animate the same turn. */
  yaw: number;
  manual: -1 | 0 | 1 = 0;
  readonly left: number;
  readonly right: number;
  constructor(position: Pick<LocalPosition,'x'|'heading'> & {spot?:string}, readonly worldWidth=SPOT_WORLD_WIDTH) { this.left=240/worldWidth;this.right=1-this.left;this.x = position.x * worldWidth; this.heading = position.heading; this.yaw = this.heading === 1 ? 0 : Math.PI; }
  get nx() { return this.x / this.worldWidth; }
  get turning() { return Math.abs(this.yaw - (this.heading === 1 ? 0 : Math.PI)) > .002; }
  get moving() { return this.target !== null || Math.abs(this.velocity) > .05 || this.turning; }
  get state() { return this.turning ? 'turning' : this.target === null && Math.abs(this.velocity) > .05 ? 'braking' : this.moving ? 'cruising' : 'stopped'; }
  go(nx: number) { if (!Number.isFinite(nx)) return false; this.manual=0; this.target = clamp(nx, this.left, this.right) * this.worldWidth; if (Math.abs(this.target - this.x) < .5 && Math.abs(this.velocity) < .2) this.target = null; return true; }
  steer(dir: -1 | 0 | 1) {
    this.manual=dir; this.target=dir===0?null:(dir<0?this.left:this.right)*this.worldWidth;
  }
  stop() { this.manual=0; this.target = null; }
  step(dt: number, boat: Pick<BoatDef,'fuel'|'tier'|'style'|'stability'>, waves = 1) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const total = Math.min(dt, .1), count = Math.ceil(total * 120), h = total / count;
    const max = navigationSpeed(boat) * (1 - clamp(waves - 1, 0, 2) * .1);
    const accel = boat.fuel ? 22 : 14, brake = boat.tier > 2 ? 25 : 32;
    for (let i = 0; i < count; i++) {
      const distance = this.target === null ? 0 : this.target - this.x;
      const desiredHeading = distance < 0 ? -1 : 1;
      if (this.target !== null && Math.abs(distance) > .3 && Math.abs(this.velocity) < .5) this.heading = desiredHeading;
      const angle = this.heading === 1 ? 0 : Math.PI;
      this.yaw += clamp(angle - this.yaw, -Math.PI * h / .85, Math.PI * h / .85);
      const canDrive = this.target !== null && !this.turning && desiredHeading === this.heading;
      const desired = canDrive ? desiredHeading * Math.min(max, Math.sqrt(2 * brake * .65 * Math.abs(distance)), Math.abs(distance) * 1.8) : 0;
      const rate = Math.abs(desired) > Math.abs(this.velocity) && desired * this.velocity >= 0 ? accel : brake;
      const old = this.velocity;
      this.velocity += clamp(desired - this.velocity, -rate * h, rate * h);
      this.acceleration += ((this.velocity - old) / h - this.acceleration) * -Math.expm1(-h * 6);
      this.x += (old + this.velocity) * .5 * h;
      const bounded = clamp(this.x, this.left * this.worldWidth, this.right * this.worldWidth);
      if (bounded !== this.x) { this.x = bounded; this.velocity = 0; this.target = null; this.manual=0; }
      if (this.target !== null && Math.abs(this.target - this.x) < .4 && Math.abs(this.velocity) < .8) { this.x = this.target; this.target = null; this.manual=0; this.velocity = 0; }
      if (this.target === null && Math.abs(this.velocity) < .05) this.velocity = 0;
    }
  }
}
export function horizontalView(worldWidth: number, screenWidth: number, scale: number, focus: number) {
  const width = Math.min(worldWidth, screenWidth / Math.max(.01, scale));
  return { width, x: clamp(focus - width * .5, 0, Math.max(0, worldWidth - width)) };
}
export function worldNX(screenX: number, viewX: number, scale: number, worldWidth=SPOT_WORLD_WIDTH) {
  return clamp((viewX + screenX / Math.max(.01, scale)) / worldWidth, 0, 1);
}
