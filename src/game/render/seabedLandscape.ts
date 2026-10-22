import { horizontalRange, type Frame } from "./frame";
import { clamp, hash1, hexA, mix, rng, gradMemo } from "./util";

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
  /** Полосы-слои дна статичны внутри чанка: путь строится один раз. */
  private bandPaths: (Path2D | null | undefined)[] = [];
  /** Зёрна осадка тоже статичны: копим их в несколько путей по цвету и прозрачности. */
  private grainPaths: Map<string, Path2D> | null = null;
  /** Дальние гребни не зависят от камеры: путь строится один раз на чанк. */
  private ridgePaths: (Path2D | null)[] | null = null;
  private ridgeCam = NaN;
  private grainStride = 0;

  private prepare(f: Frame) {
    const key = `${f.spot.id}|${f.W}|${f.H}|${f.sc}`;
    if (key === this.key) return;
    this.key = key;
    this.bandPaths = [];
    this.grainPaths = null;
    this.ridgePaths = null;
    this.ridgeCam = NaN;
    this.grainStride = 0;
    this.formations = bedFormations(f.W, f.sc, f.spot.seed).filter(o=>f.chunkOffset===undefined || (o.x-o.width*.6>4 && o.x+o.width*.6<f.W-4));
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
    const view = horizontalRange(f, 10);
    const gridStart = -10;
    ctx.save();
    ctx.beginPath();
    ctx.rect(view.left, f.sY + 1, Math.max(0, view.right - view.left), Math.max(1, f.cam + H - f.sY));
    ctx.clip();
    // Дальние гребни не зависят от камеры по геометрии: контур строится один раз
    // на чанк (по-прежнему с шагом 10 по мировой сетке), а в кадре только заливается.
    if (!this.ridgePaths || this.ridgeCam !== f.cam) {
      // Низ контура привязан к камере (в кадре он за пределами экрана), поэтому
      // при погружении контур пересобирается — иначе заливка оборвалась бы.
      this.ridgeCam = f.cam;
      const build = (layer: number) => {
        if (typeof Path2D === "undefined") return null;
        const p = new Path2D();
        p.moveTo(gridStart, f.cam + H + 10);
        for (let x = gridStart; x <= W + 10; x += 10) {
          const q = clamp(x / W, 0, 1),
            remap = q * 0.72 + 0.1 + layer * 0.06;
          const ridge =
            (f.bedDepth ? f.sY + f.depthPx(f.bedDepth(x)) : bed(remap * W)) -
            (50 + (1 - layer) * 65 + Math.sin(f.chunkOffset !== undefined ? (x + f.chunkOffset) * 0.0033 + layer : q * 8 + f.spot.seed + layer) * 25) * sc;
          p.lineTo(x, Math.max(f.sY + 20 * sc, ridge));
        }
        p.lineTo(W + 10, f.cam + H + 10);
        p.closePath();
        return p;
      };
      this.ridgePaths = [build(0), build(1)];
    }
    // Two distant ridgelines fade into the habitat's water; they never replace the real floor.
    for (const layer of [0, 1]) {
      const col = mix(f.loc.bed, f.loc.water.mid, layer === 0 ? 0.83 : 0.68);
      const g = ctx.createLinearGradient(0, f.cam, 0, f.cam + H);
      g.addColorStop(0, hexA(col, 0.12));
      g.addColorStop(0.45, hexA(col, 0.48));
      g.addColorStop(1, hexA(col, 0.15));
      ctx.fillStyle = g;
      const path = this.ridgePaths[layer];
      if (path) ctx.fill(path);
      else {
        const x0 = Math.max(gridStart, gridStart + Math.floor((view.left - gridStart) / 10) * 10);
        const x1 = Math.min(W + 10, view.right + 10);
        ctx.beginPath();
        ctx.moveTo(x0, f.cam + H + 10);
        for (let x = x0; x <= x1; x += 10) {
          const q = clamp(x / W, 0, 1),
            remap = q * 0.72 + 0.1 + layer * 0.06;
          const ridge =
            (f.bedDepth ? f.sY + f.depthPx(f.bedDepth(x)) : bed(remap * W)) -
            (50 + (1 - layer) * 65 + Math.sin(f.chunkOffset !== undefined ? (x + f.chunkOffset) * 0.0033 + layer : q * 8 + f.spot.seed + layer) * 25) * sc;
          ctx.lineTo(x, Math.max(f.sY + 20 * sc, ridge));
        }
        ctx.lineTo(x1, f.cam + H + 10);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** Runs inside the existing bed clip: strata and grains cannot spill into water. */
  texture(f: Frame, bed: BedSurface) {
    this.prepare(f);
    const { ctx, W, H, sc } = f,
      soft = sedimentBed(f.loc.seabed) || f.loc.seabed === "coral";
    const view = horizontalRange(f, 30 * sc);
    const material = mix(
      f.loc.bed,
      "#82938b",
      f.loc.maxDepth > 100 ? 0.28 : 0.08,
    );
    const bands = f.quality === 0 ? 3 : 7, start = f.chunkOffset !== undefined ? -8 : 0;
    const xStart = start + Math.max(0, Math.floor((view.left - start) / 8)) * 8;
    const xEnd = Math.min(W + 8, start + Math.ceil((view.right + 8 - start) / 8) * 8);
    for (let k = 0; k < bands; k++) {
      // Слои дна не зависят от камеры: строим один раз на чанк и только заливаем.
      let path = this.bandPaths[k];
      if (path === undefined) {
        if (typeof Path2D === "undefined") path = null;
        else {
          const p = new Path2D();
          const offset = (10 + k * k * 7) * sc;
          const fullFrom = start, fullTo = W + 8;
          let first = true;
          for (let x = fullFrom; x <= fullTo; x += 8) {
            const y = bed(x) + offset + Math.sin((x + (f.chunkOffset ?? 0)) * 0.012 + k * 2 + (f.chunkOffset !== undefined ? 1 : f.spot.seed)) * (4 + k * 2) * sc;
            if (first) { p.moveTo(x, y); first = false; } else p.lineTo(x, y);
          }
          for (let x = fullTo; x >= fullFrom; x -= 8)
            p.lineTo(x, bed(x) + offset + (12 + k * 4) * sc + Math.sin((x + (f.chunkOffset ?? 0)) * 0.014 + k) * 5 * sc);
          p.closePath();
          path = p;
        }
        this.bandPaths[k] = path;
      }
      ctx.fillStyle = hexA(
        mix(material, k % 2 ? "#152a2e" : "#d6c6a1", k % 2 ? 0.3 : 0.23),
        soft ? 0.1 : 0.2,
      );
      if (path) ctx.fill(path);
      else {
        ctx.beginPath();
        const offset = (10 + k * k * 7) * sc;
        let first = true;
        for (let x = xStart; x <= xEnd; x += 8) {
          const y =
            bed(x) +
            offset +
            Math.sin((x + (f.chunkOffset ?? 0)) * 0.012 + k * 2 + (f.chunkOffset !== undefined ? 1 : f.spot.seed)) * (4 + k * 2) * sc;
          if (first) { ctx.moveTo(x, y); first = false; }
          else ctx.lineTo(x, y);
        }
        for (let x = xEnd; x >= xStart; x -= 8)
          ctx.lineTo(
            x,
            bed(x) +
              offset +
              (12 + k * 4) * sc +
              Math.sin((x+(f.chunkOffset??0)) * 0.014 + k) * 5 * sc,
          );
        ctx.closePath();
        ctx.fill();
      }
    }
    // Pockets, compacted sediment and fractured mineral seams in the cutaway.
    for (const o of this.formations) {
      if (o.x + o.width * 0.6 < view.left || o.x - o.width * 0.6 > view.right) continue;
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
      // Зёрна не двигаются: собираем их в пути по цвету и квантованной прозрачности
      // и заливаем пачкой. Одна заливка на десятки крупинок вместо крупинки на кадр.
      // Шаг квантования 0.01 по альфе — на глаз то же зерно, но в 15 раз меньше вызовов.
      const stride = f.quality === 1 ? 3 : 1;
      const canPath = typeof Path2D !== "undefined";
      const cache = canPath ? (this.grainPaths ?? (this.grainPaths = new Map())) : null;
      if (cache && this.grainStride !== stride) {
        // Другой уровень качества — другая выборка, пути пересобираются.
        this.grainStride = stride;
        cache.clear();
        for (let i = 0; i < this.grains.length; i += stride) {
          const p = this.grains[i];
          const y = bed(p.x) + p.offset;
          const alpha = (0.06 + p.shade * 0.15) * (1 - p.offset / (H * 0.65));
          const col = p.shade > 0.5 ? "#d8cead" : "#12272c";
          const k = `${col}|${Math.round(alpha * 100)}`;
          let path = cache.get(k);
          if (!path) { path = new Path2D(); cache.set(k, path); }
          const rx = p.r * sc * (soft ? 1.8 : 1),
            ry = p.r * sc * 0.55,
            rot = soft ? -0.08 : p.shade;
          // Без moveTo эллипсы в одном пути соединяются линиями.
          path.moveTo(p.x + rx * Math.cos(rot), y + rx * Math.sin(rot));
          path.ellipse(p.x, y, rx, ry, rot, 0, Math.PI * 2);
        }
      }
      if (cache && cache.size) {
        for (const [k, path] of cache) {
          const sep = k.lastIndexOf("|");
          ctx.fillStyle = hexA(k.slice(0, sep), Number(k.slice(sep + 1)) / 100);
          ctx.fill(path);
        }
      } else {
        for (let i = 0; i < this.grains.length; i += stride) {
          const p = this.grains[i];
          if (p.x < view.left || p.x > view.right) continue;
          const y = bed(p.x) + p.offset;
          if (y < f.cam - 5 || y > f.cam + H + 5) continue;
          ctx.fillStyle = hexA(
            p.shade > 0.5 ? "#d8cead" : "#12272c",
            (0.06 + p.shade * 0.15) * (1 - p.offset / (H * 0.65)),
          );
          ctx.beginPath();
          ctx.ellipse(p.x, y, p.r * sc * (soft ? 1.8 : 1), p.r * sc * 0.55, soft ? -0.08 : p.shade, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    if (soft) {
      ctx.lineWidth = 0.8 * sc;
      for (let i = 0; i < (f.quality === 0 ? 12 : 34); i++) {
        const x = hash1(i + f.spot.seed) * W;
        if (x + 26 * sc < view.left || x - 20 * sc > view.right) continue;
        const y = bed(x) + (4 + hash1(i + 35) * 50) * sc;
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
    const view = horizontalRange(f, 30 * sc);
    for (const [i, o] of this.formations.entries()) {
      if (f.quality === 0 && i % 2) continue;
      if (o.x + o.width * 0.6 < view.left || o.x - o.width * 0.6 > view.right) continue;
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
      // Контактная тень. Была плоской тёмной «тарелкой» под объектом — на светлом
      // песке читалась как отдельный предмет. Теперь это мягкое пятно в тон
      // грунта: широкий рассеянный слой + узкое ядро у самой кромки, оба плавно
      // сходят в ноль (два радиальных градиента, без резкого эллипса).
      const shadeCol = mix(f.loc.bed, "#0a1a20", 0.72);
      // Градиент тени зависит только от радиуса и цвета грунта: кешируем,
      // иначе на каждый объект каждый кадр создавались два новых градиента.
      const halfKey = Math.round(half * 2) / 2;
      const softShade = gradMemo(ctx, `soft|${shadeCol}|${halfKey}`, () => {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, halfKey * 1.55);
        g.addColorStop(0, hexA(shadeCol, 0.34));
        g.addColorStop(0.45, hexA(shadeCol, 0.2));
        g.addColorStop(1, hexA(shadeCol, 0));
        return g;
      });
      ctx.fillStyle = softShade;
      ctx.beginPath();
      ctx.ellipse(0, 0, half * 1.55, Math.max(3, 10 * sc), 0, 0, Math.PI * 2);
      ctx.fill();
      const core = gradMemo(ctx, `core|${shadeCol}|${halfKey}`, () => {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, halfKey * 0.72);
        g.addColorStop(0, hexA(shadeCol, 0.42));
        g.addColorStop(1, hexA(shadeCol, 0));
        return g;
      });
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.ellipse(0, 0, half * 0.72, Math.max(1.6, 4 * sc), 0, 0, Math.PI * 2);
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
        // Камень зависит только от размеров и цвета — градиент кешируется.
        const rockKey = `bed|${Math.round(rockW)}|${Math.round(rockH)}|${base}`;
        ctx.fillStyle = gradMemo(ctx, rockKey, () => {
          const g = ctx.createLinearGradient(-rockW, -rockH, rockW, 5 * sc);
          g.addColorStop(0, mix(base, "#c3d0be", 0.2));
          g.addColorStop(0.44, base);
          g.addColorStop(1, mix(base, "#183541", 0.7));
          return g;
        });
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
        const x = W * ((i + 0.4) / n);
        if (x < view.left - 40 * sc || x > view.right + 40 * sc) continue;
        const y = bed(x);
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
    // Песчаный «апрон» у подножия: раньше риф читался тёмной плитой с ровным
    // нижним срезом. Теперь основание растворяется в грунте, как осадок.
    const apron = ctx.createRadialGradient(0, 2 * sc, 0, 0, 2 * sc, w * 1.3);
    apron.addColorStop(0, hexA(f.loc.bed, 0.7));
    apron.addColorStop(0.5, hexA(f.loc.bed, 0.3));
    apron.addColorStop(1, hexA(f.loc.bed, 0));
    ctx.fillStyle = apron;
    ctx.beginPath();
    ctx.ellipse(0, 2 * sc, w * 1.3, Math.max(5 * sc, h * 0.26), 0, 0, Math.PI * 2);
    ctx.fill();
    // Тело рифа: светлее кверху, у самой кромки — в тон песку, без «отреза».
    const g = ctx.createLinearGradient(0, -h * 0.72, 0, 6 * sc);
    g.addColorStop(0, "#aab6a5");
    g.addColorStop(0.42, "#819686");
    g.addColorStop(0.8, mix("#5f7a72", f.loc.bed, 0.4));
    g.addColorStop(1, mix(f.loc.bed, "#5f7a72", 0.42));
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
    // Волнистая подошва вместо прямой линии.
    ctx.bezierCurveTo(w * 0.7, 7.5 * sc, w * 0.28, 1.5 * sc, -w * 0.1, 5 * sc);
    ctx.bezierCurveTo(-w * 0.45, 8 * sc, -w * 0.76, 1.2 * sc, -w, 4 * sc);
    ctx.closePath();
    ctx.fill();
    // Камешки-обломки у подошвы: связывают массу с грунтом, чтобы мягкий торец
    // не выглядел просто размытым пятном.
    const rubble = f.quality === 0 ? 3 : 6;
    for (let i = 0; i < rubble; i++) {
      const x = (hash1(seed + i * 7.7) * 2 - 1) * w * 1.02,
        r = (1.4 + hash1(seed + i * 3.1 + 5) * 2.6) * sc,
        y = 4 * sc - r * 0.5 - hash1(seed + i + 41) * 2 * sc;
      ctx.fillStyle = mix(f.loc.bed, "#3d5560", 0.45);
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.5, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hexA("#c9d3bb", 0.28);
      ctx.beginPath();
      ctx.ellipse(x - r * 0.3, y - r * 0.35, r * 0.6, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }
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

  /**
   * Веер-горгонария.
   *
   * Раньше каждый луч и каждая веточка рисовались отдельным `beginPath/stroke` —
   * до 36 обводок на куст. При десятках вееров на дне это была самая дорогая
   * часть кадра (по счётчику canvas — четверть всех вызовов). Теперь геометрия
   * собирается в три пути на веер: лучи, центральный (толще) и веточки.
   */
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
    const mid = Math.floor(rays / 2);
    ctx.beginPath();
    for (let k = 0; k < rays; k++) {
      const a = (k / (rays - 1) - 0.5) * 1.7,
        tx = Math.sin(a) * height * 0.55 + bend,
        ty = -Math.cos(a) * height;
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(tx * 0.3, -height * 0.5, tx, ty);
    }
    ctx.lineWidth = 0.9 * sc;
    ctx.stroke();
    if (f.quality > 0) {
      // центральный луч толще остальных — отдельная короткая обводка
      const a0 = (mid / (rays - 1) - 0.5) * 1.7;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.sin(a0) * height * 0.165 + bend, -height * 0.5, Math.sin(a0) * height * 0.55 + bend, -Math.cos(a0) * height);
      ctx.lineWidth = 1.6 * sc;
      ctx.stroke();
      // веточки всех лучей — один путь
      ctx.beginPath();
      for (let k = 0; k < rays; k++) {
        const a = (k / (rays - 1) - 0.5) * 1.7,
          tx = Math.sin(a) * height * 0.55 + bend,
          ty = -Math.cos(a) * height;
        const side = k < rays / 2 ? -1 : 1;
        for (let j = 1; j < 4; j++) {
          const q = j / 4;
          ctx.moveTo(tx * q * q, ty * q);
          ctx.lineTo(tx * q * q + side * height * 0.13, ty * q - height * 0.12);
        }
      }
      ctx.lineWidth = 0.65 * sc;
      ctx.stroke();
    }
    ctx.restore();
  }
}
