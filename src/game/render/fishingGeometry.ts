import { JUMP_TIME, type Hooked } from "../engine";
import { fishScreenLen } from "../fishDraw";
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export interface FightProjection {
  boatX: number; castX: number; scale: number;
  waveY: (x: number) => number; depthPx: (m: number) => number;
}
/** One projection for the body, the mouth/line attachment and the entire jump. */
export function projectFightFish(h: Hooked, o: FightProjection) {
  const m = h.motion, dir: 1 | -1 = m.facing >= 0 ? 1 : -1;
  const len = fishScreenLen(h.fish, h.weight, o.scale);
  const k = clamp(h.line / h.startLine, 0, 1.65);
  const anchor = o.boatX + (o.castX < o.boatX ? -1 : 1) * 60 * o.scale;
  const sideRoom = Math.min(75 * o.scale, 80 * o.scale * k);
  const x = anchor + (o.castX - anchor) * k + h.sway * sideRoom;
  const turn = Math.abs(m.facing);
  let y = o.waveY(x) + o.depthPx(m.depth) + 6 * o.scale;
  let angle = clamp(Math.atan2(m.depthVelocity * 8, Math.abs(m.velocity) * 8 + Math.abs(m.sideVelocity) * 40 + 6), -0.5, 0.5) * m.facing;
  if (h.jump > 0) {
    const p = clamp(1 - h.jump / JUMP_TIME, 0, 1);
    const height = (48 + Math.min(105, len * 0.75)) * o.scale;
    y = o.waveY(x) + o.depthPx(m.jumpDepth) * (1 - p) + o.depthPx(0.12) * p + 6 * o.scale - 4 * p * (1 - p) * height;
    const edge = Math.min(1, p / 0.12, (1 - p) / 0.12);
    const blend = edge * edge * (3 - 2 * edge);
    angle += (-Math.cos(p * Math.PI) * 0.8 * m.facing - angle) * blend;
  }
  const nose = dir * len * 0.4 * turn;
  return { x, y, dir, len, turn, angle,
    mouth: [x + Math.cos(angle) * nose, y + Math.sin(angle) * nose] as [number, number] };
}
