import type { Hooked } from "./engine";

export const FIGHT_STEP = 1 / 120;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const follow = (v: number, target: number, rate: number, dt: number) => v + (target - v) * -Math.expm1(-rate * dt);

/** Transient simulation state, never part of SaveData. Distances are game metres. */
export interface FightMotion {
  lineOut: number;
  velocity: number;
  reelInput: number;
  reelRate: number;
  payoutRate: number;
  rodSide: number;
  rodBend: number;
  bendVelocity: number;
  sideVelocity: number;
  depth: number;
  depthVelocity: number;
  facing: number;
  swimPhase: number;
  surge: number;
  jumpDepth: number;
}
export const lineCompliance = (length: number) => 0.75 + Math.min(2.5, length * 0.004);
export const fishInertia = (weight: number, strength: number) => clamp(0.85 + Math.log1p(Math.max(0, weight)) * 0.3 + strength * 0.035, 0.9, 3.5);
export function newFightMotion(line: number, depth: number): FightMotion {
  return {
    lineOut: Math.max(0.3, line - lineCompliance(line) * 0.3), velocity: 0,
    reelInput: 0, reelRate: 0, payoutRate: 0, rodSide: 0, rodBend: 0.3, bendVelocity: 0,
    sideVelocity: 0, depth, depthVelocity: 0, facing: 1, swimPhase: 0, surge: 0, jumpDepth: depth,
  };
}
export interface FightControls {
  reeling: boolean;
  direction: number;
  rodPower: number;
  reelSpeed: number;
  grip: number;
  ratio: number;
  hook: number;
  bed: number;
}

/**
 * Fish + compliant line + slipping spool. No random numbers or rendering here.
 * Called at 120 Hz: forces change velocity, not position; a line can pull but
 * cannot push. The automatic drag releases line when the reel is let go.
 * This is a damped game simulation, not a calibration in SI newtons/kilograms.
 */
export function stepFightMotion(h: Hooked, c: FightControls, dt: number) {
  const m = h.motion;
  const mass = fishInertia(h.weight, h.fish.strength);
  const jump = h.jump > 0;
  m.reelInput = follow(m.reelInput, c.reeling && !jump ? 1 : 0, 6, dt);
  m.rodSide = follow(m.rodSide, c.direction, 8, dt);
  m.surge *= Math.exp(-2.4 * dt);
  const side = h.running ? Math.sign(h.swayV) : 0;
  const alignment = side * m.rodSide;
  const steer = side === 0 ? 1 : alignment < 0 ? 1.1 + alignment * (0.35 + c.grip * 0.045) : 1.1 + alignment * 0.2;
  h.countering = side !== 0 && alignment < -0.35;
  const stamina = 0.35 + 0.65 * h.stamina / 100;
  const jumpLoad = jump ? (c.reeling ? 2.1 * (1 - c.hook * 0.12) : 0.25) : 1;
  const force = h.power / Math.max(1, c.rodPower) * (0.25 + 0.75 * h.intensity + m.surge * 0.4) * stamina * steer * jumpLoad;
  const compliance = lineCompliance(h.startLine);

  // Spool response is independent of fish position. The clutch is never an
  // instant halving of fish force; released line lets the spring unload.
  const dragThreshold = c.reeling ? 0.94 : 0.38;
  const dragSpeed = Math.min(18 + h.line * 0.055, Math.max(0, h.tension - dragThreshold) * (12 + h.line * 0.025));
  m.payoutRate = follow(m.payoutRate, dragSpeed, 12, dt);
  m.reelRate = c.reelSpeed * m.reelInput * (1 - clamp(h.tension, 0, 1.4) * (0.35 - c.ratio * 0.025));
  m.lineOut = Math.max(0.3, m.lineOut + (m.payoutRate - m.reelRate) * dt);
  const stretch = Math.max(0, h.line - m.lineOut);
  const relativeV = m.velocity - (m.payoutRate - m.reelRate);
  const spring = stretch > 0 ? Math.max(0, stretch / compliance + relativeV * 0.045) : 0;
  h.tension = follow(h.tension, Math.min(5, spring), 24, dt);
  const waterDrag = (0.65 + Math.abs(m.velocity) * 0.035) * m.velocity;
  const rodAcceleration = 11 * Math.pow(Math.max(1, c.rodPower) / 10, 0.7);
  const acceleration = (force - h.tension) * rodAcceleration / mass - waterDrag;
  const vmax = 18 + h.startLine * 0.07;
  m.velocity = clamp(m.velocity + acceleration * dt, -vmax, vmax);
  h.line = Math.max(0.3, h.line + m.velocity * dt);

  // Turns carry momentum. Bringing the rod across loads the side gradually.
  const sideTarget = h.swayV * (h.running ? 1 : 0.3) + m.rodSide * 0.12;
  m.sideVelocity += ((sideTarget - h.sway) * 10 / mass - m.sideVelocity * 3.4) * dt;
  h.sway += m.sideVelocity * dt;
  const look = Math.abs(m.sideVelocity) > 0.06 ? Math.sign(m.sideVelocity) : m.velocity < -0.4 ? -1 : Math.sign(h.swayV);
  m.facing = follow(m.facing, look, 4 / Math.sqrt(mass), dt);

  // A separate vertical degree of freedom: dives, recovery, then lifting.
  const baseDepth = h.startDepth * Math.min(1, h.line / h.startLine);
  const bottomFish = h.fish.shape === "flat" || h.fish.shape === "ray";
  const dive = h.running ? (bottomFish ? 1.1 : 0.45) * h.intensity * Math.min(4, h.startDepth * 0.3) : 0;
  const preparingJump = h.jumper && h.running && h.jumpCD < 1.5 && h.stamina > 15 && baseDepth < 14;
  const depthTarget = jump || preparingJump ? 0.12 : baseDepth + dive;
  const maxDepth = Math.max(0.12, Math.min(c.bed, h.line * 0.97));
  m.depthVelocity += ((clamp(depthTarget, 0.12, maxDepth) - m.depth) * 6 / mass - m.depthVelocity * 3.6) * dt;
  m.depth += m.depthVelocity * dt;
  if (m.depth > maxDepth) { m.depth = maxDepth; m.depthVelocity = Math.min(0, m.depthVelocity); }
  if (m.depth < 0.12) { m.depth = 0.12; m.depthVelocity = Math.max(0, m.depthVelocity); }

  // The visible blank is a damped spring, driven by actual line load.
  m.bendVelocity += ((clamp(h.tension, 0, 1.35) - m.rodBend) * 95 - m.bendVelocity * 14) * dt;
  m.rodBend = clamp(m.rodBend + m.bendVelocity * dt, 0, 1.45);
  // Integrating phase avoids the t * changingFrequency animation discontinuity.
  m.swimPhase += dt * (3 + h.intensity * 9 + Math.abs(m.velocity) * 0.7);
}
