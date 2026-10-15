import type { Frame } from "./frame";
import { clamp, hash1, hexA, mix, rng } from "./util";

export interface BedFormation {
  x: number;
  width: number;
  height: number;
  seed: number;
}
export type BedSurface = (x: number) => number;
export const sedimentBed = (kind: string) =>
  ["sand", "silt", "mud", "roots"].includes(kind);

/** Visual-only composition. No gameplay RNG, depth or collision changes. */
export function bedFormations(
  width: number,
  scale: number,
  seed: number,
): BedFormation[] {
  const random = rng(seed * 173 + 73);
  const count = Math.max(3, Math.min(8, Math.round(width / 230)));
  return Array.from({ length: count }, (_, i) => ({
    x: width * ((i + 0.2 + random() * 0.6) / count),
    width: (95 + random() * 130) * scale,
    height: (36 + random() * 95) * scale,
    seed: seed + i * 17.3,
  }));
}

export function bedContact(bed: BedSurface, x: number, halfWidth: number) {
  let low = -Infinity,
    high = Infinity;
  for (let i = 0; i <= 12; i++) {
    const y = bed(x - halfWidth + (halfWidth * i) / 6);
    low = Math.max(low, y);
    high = Math.min(high, y);
  }
  return { foot: low, relief: low - high };
}

/** Shared environmental art, distinct material/vegetation for every habitat. */
export class SeabedLandscape {
  private key = "";
  private formations: BedFormation[] = [];
  private grains: { x: number; offset: number; r: number; shade: number }[] =
    [];

  private prepare(f: Frame) {
    const key = `${f.spot.id}|${f.W}|${f.H}|${f.sc}`;
    if (key === this.key) return;
    this.key = key;
    this.formations = bedFormations(f.W, f.sc, f.spot.seed);
    const random = rng(f.spot.seed * 43 + 19);
    this.grains = Array.from(
      { length: Math.min(950, Math.round(f.W * 0.7)) },
      () => ({
        x: random() * f.W,
        offset: Math.pow(random(), 2.3) * f.H * 0.5,
        r: 0.45 + random() * 1.7,
        shade: random(),
      }),
    );
  }

  backdrop(f: Frame, bed: BedSurface) {
    this.prepare(f);
    const { ctx, W, H, sc } = f;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, f.sY + 1, W, Math.max(1, f.cam + H - f.sY));
    ctx.clip();
    // Two distant ridgelines fade into the habitat's water; they never replace the real floor.
    for (const layer of [0, 1]) {
      const col = mix(f.loc.bed, f.loc.water.mid, layer === 0 ? 0.83 : 0.68);
      const g = ctx.createLinearGradient(0, f.cam, 0, f.cam + H);
      g.addColorStop(0, hexA(col, 0.12));
      g.addColorStop(0.45, hexA(col, 0.48));
      g.addColorStop(1, hexA(col, 0.15));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-10, f.cam + H + 10);
      for (let x = -10; x <= W + 10; x += 10) {
        const q = clamp(x / W, 0, 1),
          remap = q * 0.72 + 0.1 + layer * 0.06;
        const ridge =
          bed(remap * W) -
          (50 + (1 - layer) * 65 + Math.sin(q * 8 + f.spot.seed + layer) * 25) *
            sc;
        ctx.lineTo(x, Math.max(f.sY + 20 * sc, ridge));
      }
      ctx.lineTo(W + 10, f.cam + H + 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** Runs inside the existing bed clip: strata and grains cannot spill into water. */
  texture(f: Frame, bed: BedSurface) {
    this.prepare(f);
    const { ctx, W, H, sc } = f,
      soft = sedimentBed(f.loc.seabed) || f.loc.seabed === "coral";
    const material = mix(
      f.loc.bed,
      "#82938b",
      f.spot.maxDepth > 100 ? 0.28 : 0.08,
    );
    const bands = f.quality === 0 ? 3 : 7;
    for (let k = 0; k < bands; k++) {
      ctx.beginPath();
      const offset = (10 + k * k * 7) * sc;
      for (let x = 0; x <= W + 8; x += 8) {
        const y =
          bed(x) +
          offset +
          Math.sin(x * 0.012 + k * 2 + f.spot.seed) * (4 + k * 2) * sc;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let x = W + 8; x >= 0; x -= 8)
        ctx.lineTo(
          x,
          bed(x) +
            offset +
            (12 + k * 4) * sc +
            Math.sin(x * 0.014 + k) * 5 * sc,
        );
      ctx.closePath();
      ctx.fillStyle = hexA(
        mix(material, k % 2 ? "#152a2e" : "#d6c6a1", k % 2 ? 0.3 : 0.23),
        soft ? 0.1 : 0.2,
      );
      ctx.fill();
    }
    // Pockets, compacted sediment and fractured mineral seams in the cutaway.
    for (const o of this.formations) {
      const y = bed(o.x) + 30 * sc;
      if (y > f.cam + H + 20 || y + 200 * sc < f.cam) continue;
      if (!soft) {
        ctx.strokeStyle = hexA("#0d2029", 0.4);
        ctx.lineWidth = 1.5 * sc;
        ctx.beginPath();
        ctx.moveTo(o.x, y);
        ctx.lineTo(o.x - o.width * 0.12, y + 20 * sc);
        ctx.lineTo(o.x + o.width * 0.1, y + 43 * sc);
        ctx.lineTo(o.x - o.width * 0.22, y + 130 * sc);
        ctx.stroke();
        ctx.strokeStyle = hexA("#c2c9b1", 0.14);
        ctx.lineWidth = 0.7 * sc;
        ctx.beginPath();
        ctx.moveTo(o.x + 2 * sc, y + 2 * sc);
        ctx.lineTo(o.x - o.width * 0.12 + 2 * sc, y + 20 * sc);
        ctx.lineTo(o.x + o.width * 0.1 + 2 * sc, y + 43 * sc);
        ctx.stroke();
      }
      const r = o.width * 0.48,
        g = ctx.createRadialGradient(o.x, y + 35 * sc, 1, o.x, y + 35 * sc, r);
      g.addColorStop(0, hexA("#0c222a", soft ? 0.09 : 0.23));
      g.addColorStop(1, hexA("#0c222a", 0));
      ctx.fillStyle = g;
      ctx.fillRect(o.x - r, y + 35 * sc - r, r * 2, r * 2);
    }
    if (f.quality > 0) {
      const stride = f.quality === 1 ? 3 : 1;
      for (let i = 0; i < this.grains.length; i += stride) {
        const p = this.grains[i],
          y = bed(p.x) + p.offset;
        if (y < f.cam - 5 || y > f.cam + H + 5) continue;
        ctx.fillStyle = hexA(
          p.shade > 0.5 ? "#d8cead" : "#12272c",
          (0.06 + p.shade * 0.15) * (1 - p.offset / (H * 0.65)),
        );
        ctx.beginPath();
        ctx.ellipse(
          p.x,
          y,
          p.r * sc * (soft ? 1.8 : 1),
          p.r * sc * 0.55,
          soft ? -0.08 : p.shade,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    if (soft) {
      ctx.lineWidth = 0.8 * sc;
      for (let i = 0; i < (f.quality === 0 ? 12 : 34); i++) {
        const x = hash1(i + f.spot.seed) * W,
          y = bed(x) + (4 + hash1(i + 35) * 50) * sc;
        ctx.strokeStyle = hexA("#ded4ac", 0.12);
        ctx.beginPath();
        ctx.moveTo(x - 20 * sc, y + 2 * sc);
        ctx.bezierCurveTo(
          x - 8 * sc,
          y - 3 * sc,
          x + 10 * sc,
          y - 3 * sc,
          x + 26 * sc,
          y,
        );
        ctx.stroke();
      }
    }
    // No image buffers sized to physical depth (abyss can be >2000 m).
  }

  structures(f: Frame, bed: BedSurface) {
    this.prepare(f);
    const { ctx, sc, W, H } = f,
      kind = f.loc.seabed;
    for (const [i, o] of this.formations.entries()) {
      if (f.quality === 0 && i % 2) continue;
      const soft = sedimentBed(kind),
        half = o.width * (soft ? 0.25 : 0.45);
      const contact = bedContact(bed, o.x, half),
        center = bed(o.x);
      const h = Math.min(
        o.height * (kind === "coral" ? 1.2 : 1),
        Math.max(0, center - f.sY - 18 * sc),
      );
      if (
        h < 8 * sc ||
        contact.relief > h * 0.85 ||
        center - h > f.cam + H ||
        contact.foot < f.cam - 40
      )
        continue;
      const y = contact.foot + 2 * sc;
      ctx.save();
      ctx.translate(o.x, y);
      // Contact shadow is beneath the object, not an ellipse floating beside it.
      ctx.fillStyle = hexA("#071b24", 0.25);
      ctx.beginPath();
      ctx.ellipse(0, 0, half * 1.12, Math.max(2, 7 * sc), 0, 0, Math.PI * 2);
      ctx.fill();
      if (kind === "basalt" || kind === "vents") {
        const n = kind === "vents" ? 4 : 7;
        for (let k = 0; k < n; k++) {
          const x = (((k - (n - 1) / 2) * o.width) / n) * 0.7,
            w = (o.width / n) * 0.72;
          const hh = h * (0.35 + hash1(o.seed + k) * 0.85),
            foot = bed(o.x + x) - y + 4 * sc;
          const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
          g.addColorStop(0, "#2d3d43");
          g.addColorStop(0.5, "#596369");
          g.addColorStop(0.55, "#3e4d54");
          g.addColorStop(1, "#182a34");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x - w * 0.5, foot);
          ctx.lineTo(x - w * 0.55, -hh);
          ctx.lineTo(x, -hh - 4 * sc);
          ctx.lineTo(x + w * 0.5, -hh + 2 * sc);
          ctx.lineTo(x + w * 0.5, foot);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = hexA("#a6b8b6", 0.18);
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(x, -hh);
          ctx.lineTo(x, foot);
          ctx.stroke();
          if (kind === "vents" && k % 2 === 0) {
            ctx.fillStyle = "#16262d";
            ctx.beginPath();
            ctx.ellipse(x, -hh, w * 0.35, 2 * sc, 0, 0, Math.PI * 2);
            ctx.fill();
            if (f.quality > 0)
              for (let j = 0; j < 5; j++) {
                const p = (f.t * 0.13 + j / 5 + k * 0.12) % 1,
                  r = (4 + p * 15) * sc;
                const sx = x + Math.sin(p * 5 + o.seed) * p * 9 * sc,
                  sy = -hh - p * 110 * sc;
                const smoke = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
                smoke.addColorStop(0, hexA("#324e59", 0.2 * (1 - p)));
                smoke.addColorStop(1, hexA("#324e59", 0));
                ctx.fillStyle = smoke;
                ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
              }
          }
        }
      } else if (kind === "coral") {
        this.reefMass(f, o.width * 0.43, h, o.seed);
        for (let k = 0; k < 3; k++)
          this.fan(
            f,
            (k - 1) * o.width * 0.25,
            -h * (0.18 + hash1(k + o.seed) * 0.2),
            h * (0.5 + hash1(k + 33) * 0.3),
            ["#bd8586", "#aab18c", "#af8cab"][(i + k) % 3],
            o.seed + k,
          );
      } else {
        const rockH = soft ? h * 0.26 : kind === "polar" ? h * 0.7 : h;
        const rockW = soft ? half * 0.85 : half;
        const base = mix(
          f.loc.bed,
          kind === "polar" ? "#a9bdc0" : "#82958d",
          0.42,
        );
        const g = ctx.createLinearGradient(-rockW, -rockH, rockW, 5 * sc);
        g.addColorStop(0, mix(base, "#c3d0be", 0.2));
        g.addColorStop(0.44, base);
        g.addColorStop(1, mix(base, "#183541", 0.7));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-rockW, 3 * sc);
        ctx.lineTo(-rockW * 0.92, -rockH * 0.38);
        ctx.lineTo(-rockW * 0.44, -rockH * 0.9);
        ctx.lineTo(rockW * 0.1, -rockH);
        ctx.lineTo(rockW * 0.64, -rockH * 0.72);
        ctx.lineTo(rockW, -rockH * 0.28);
        ctx.lineTo(rockW, 4 * sc);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = hexA("#142e38", 0.2);
        ctx.beginPath();
        ctx.moveTo(rockW * 0.1, -rockH);
        ctx.lineTo(rockW * 0.22, -rockH * 0.45);
        ctx.lineTo(rockW * 0.05, 3 * sc);
        ctx.lineTo(rockW, 4 * sc);
        ctx.lineTo(rockW, -rockH * 0.28);
        ctx.lineTo(rockW * 0.64, -rockH * 0.72);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = hexA("#c6d2b7", 0.25);
        ctx.lineWidth = 1 * sc;
        ctx.beginPath();
        ctx.moveTo(-rockW * 0.9, -rockH * 0.39);
        ctx.lineTo(-rockW * 0.44, -rockH * 0.88);
        ctx.lineTo(rockW * 0.1, -rockH * 0.97);
        ctx.stroke();
        if (!soft && kind !== "polar")
          for (let k = 0; k < 4; k++) {
            const x = (k - 1.5) * rockW * 0.35;
            this.fan(
              f,
              x,
              -rockH * (0.35 + hash1(k + o.seed) * 0.25),
              rockH * 0.24,
              "#83967a",
              k + o.seed,
            );
          }
        if (kind === "polar")
          for (let k = 0; k < 3; k++)
            this.fan(
              f,
              (k - 1) * rockW * 0.6,
              -rockH * 0.1,
              rockH * 0.55,
              "#ccd5ca",
              k + o.seed,
            );
      }
      ctx.restore();
    }
    // Rich plant beds are grouped, with negative space for the hook and fish.
    if (["sand", "silt", "roots", "kelp", "kelpforest"].includes(kind)) {
      const n = f.quality === 0 ? 3 : 6;
      for (let i = 0; i < n; i++) {
        const x = W * ((i + 0.4) / n),
          y = bed(x);
        if (y - 150 * sc > f.cam + H || y < f.cam - 20) continue;
        const tall = kind === "kelp" || kind === "kelpforest";
        const height = Math.min(
          (tall ? 145 : 40) * sc,
          Math.max(0, y - f.sY - 10 * sc),
        );
        ctx.save();
        ctx.translate(x, y + 3 * sc);
        for (let k = 0; k < (f.quality === 0 ? 6 : 13); k++) {
          const dx = (k - 6) * 3 * sc,
            hh = height * (0.4 + hash1(k + i * 13) * 0.7),
            sway = Math.sin(f.t * 0.6 + i + k * 0.13) * hh * 0.13;
          ctx.fillStyle = hexA(
            mix(tall ? "#76845d" : "#6b9a78", f.loc.water.mid, 0.22),
            0.78,
          );
          ctx.beginPath();
          ctx.moveTo(dx, 0);
          ctx.bezierCurveTo(
            dx - 3 * sc,
            -hh * 0.3,
            dx + sway - 2 * sc,
            -hh * 0.8,
            dx + sway + hh * 0.13,
            -hh,
          );
          ctx.bezierCurveTo(
            dx + sway + 3 * sc,
            -hh * 0.65,
            dx + 3 * sc,
            -hh * 0.3,
            dx + 2 * sc,
            0,
          );
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  private reefMass(f: Frame, w: number, h: number, seed: number) {
    const { ctx, sc } = f;
    const g = ctx.createLinearGradient(0, -h * 0.65, 0, 5 * sc);
    g.addColorStop(0, "#a1afa0");
    g.addColorStop(0.4, "#7c9788");
    g.addColorStop(1, "#395b60");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-w, 4 * sc);
    ctx.bezierCurveTo(
      -w * 1.08,
      -h * 0.26,
      -w * 0.6,
      -h * 0.55,
      -w * 0.38,
      -h * 0.42,
    );
    ctx.bezierCurveTo(
      -w * 0.25,
      -h * 0.82,
      w * 0.35,
      -h * 0.75,
      w * 0.48,
      -h * 0.4,
    );
    ctx.bezierCurveTo(w * 0.8, -h * 0.58, w * 1.05, -h * 0.25, w, 4 * sc);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < (f.quality === 0 ? 10 : 32); i++) {
      const x = (hash1(seed + i) * 1.6 - 0.8) * w,
        y = -h * (0.12 + hash1(seed + i + 33) * 0.3),
        r = (2 + hash1(seed + i + 12) * 4) * sc;
      ctx.strokeStyle = hexA("#c3cbb2", 0.24);
      ctx.lineWidth = 0.8 * sc;
      ctx.beginPath();
      ctx.arc(x, y, r, 0.2, Math.PI * 1.7);
      ctx.stroke();
    }
  }

  private fan(
    f: Frame,
    x: number,
    y: number,
    height: number,
    color: string,
    seed: number,
  ) {
    const { ctx, sc } = f;
    if (height < 5 * sc) return;
    const bend = Math.sin(f.t * 0.5 + seed) * height * 0.045;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = hexA(color, 0.85);
    ctx.lineCap = "round";
    const rays = f.quality === 0 ? 5 : 9;
    for (let k = 0; k < rays; k++) {
      const a = (k / (rays - 1) - 0.5) * 1.7,
        tx = Math.sin(a) * height * 0.55 + bend,
        ty = -Math.cos(a) * height;
      ctx.lineWidth = (k === Math.floor(rays / 2) ? 1.6 : 0.9) * sc;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(tx * 0.3, -height * 0.5, tx, ty);
      ctx.stroke();
      if (f.quality > 0)
        for (let j = 1; j < 4; j++) {
          const q = j / 4;
          ctx.lineWidth = 0.65 * sc;
          ctx.beginPath();
          ctx.moveTo(tx * q * q, ty * q);
          ctx.lineTo(
            tx * q * q + (k < rays / 2 ? -1 : 1) * height * 0.13,
            ty * q - height * 0.12,
          );
          ctx.stroke();
        }
    }
    ctx.restore();
  }
}
