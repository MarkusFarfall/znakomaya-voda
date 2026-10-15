import type { Frame } from './frame';
import { BOAT_SPECS } from './boat';

interface Crest { x: number; age: number; strength: number; dir: number; oar: boolean }
/** Water retains world-space impulses: turning the vessel never flips its old wake. */
export class LocalWake {
  private crests: Crest[] = [];
  private clock = 0;
  reset() { this.crests = []; this.clock = 0; }
  update(f: Pick<Frame, 'e' | 'dt' | 'sc'>) {
    const { e, sc } = f, dt = Math.max(0, Math.min(.1, f.dt));
    if (e.paused) return;
    for (const q of this.crests) q.age += dt;
    this.crests = this.crests.filter(q => q.age < 5);
    const speed = Math.abs(e.navigation.velocity), dir = e.navigation.heading;
    this.clock += dt;
    const oar = e.boat.style === 'row' || e.boat.style === 'kayak';
    const interval = oar ? .38 : .09;
    if (speed > 1 && this.clock > interval) {
      this.clock = 0;
      const half = (BOAT_SPECS[e.boat.style] ?? BOAT_SPECS.row).half * 28 * sc;
      this.crests.push({ x: e.navigation.x - dir * half * (oar ? .78 : .88), age: 0, strength: Math.min(1, speed / (oar ? 28 : 80)), dir, oar });
      if (this.crests.length > 64) this.crests.shift();
    }
  }
  heightAt(x: number) {
    let y = 0;
    for (let i = Math.max(0, this.crests.length - 12); i < this.crests.length; i++) {
      const q = this.crests[i], dx = Math.abs(x - q.x), radius = q.age * 23;
      const envelope = Math.exp(-Math.pow((dx - radius) / 15, 2));
      y += Math.sin((dx - radius) * .14) * envelope * q.strength * Math.exp(-q.age * .9) * .55;
    }
    return y;
  }
  draw(f: Frame) {
    const { ctx, sc, night } = f;
    ctx.save();
    ctx.lineWidth = .9 * sc;
    for (const q of this.crests) {
      const a = Math.pow(1 - q.age / 5, 2) * q.strength;
      const spread = (5 + q.age * (q.oar ? 18 : 25)) * sc;
      const y = f.waveY(q.x);
      ctx.strokeStyle = `rgba(209,239,231,${a * (.65 - night * .18)})`;
      ctx.beginPath();
      ctx.ellipse(q.x, y + 1.5 * sc, spread, (1.2 + q.age * 1.5) * sc, 0, .1, Math.PI - .1);
      ctx.stroke();
      if (!q.oar) {
        ctx.strokeStyle = `rgba(249,247,218,${a * .48})`;
        ctx.beginPath(); ctx.moveTo(q.x - spread * .5, y - sc);
        ctx.quadraticCurveTo(q.x, y - 2.5 * sc, q.x + spread * .5, y); ctx.stroke();
        for (let j = 0; j < 3; j++) {
          const x = q.x + Math.sin(q.x * .19 + j * 2) * spread * .6;
          ctx.fillStyle = `rgba(232,251,243,${a * .6})`; ctx.beginPath();
          ctx.ellipse(x, f.waveY(x) + 2 * sc, (1 + q.age) * sc, .65 * sc, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    const n = f.e.navigation, speed = Math.min(1, Math.abs(n.velocity) / 65);
    if (speed > .01) {
      const half = (BOAT_SPECS[f.e.boat.style] ?? BOAT_SPECS.row).half * 28 * sc;
      const x = n.x + n.heading * half * .82, y = f.waveY(x);
      ctx.strokeStyle = `rgba(238,248,232,${.65 * speed})`; ctx.lineWidth = 1.5 * sc;
      ctx.beginPath(); ctx.moveTo(x - n.heading * 22 * sc, y + 2 * sc);
      ctx.quadraticCurveTo(x, y - (2 + speed * 5) * sc, x + n.heading * 14 * sc, y + sc); ctx.stroke();
    }
    ctx.restore();
  }
}
