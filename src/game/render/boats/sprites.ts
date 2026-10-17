/**
 * Рисунки судов.
 *
 * 1) Загрузка. Если у картинки уже есть прозрачность (PNG) — берём как есть. Если фон пурпурный (#FF00FF) —
 *    вырезаем его с очисткой краёв: цвет краевого пикселя освобождается от примеси фона и от пурпурного ореола.
 * 2) Масштаб. Рисунок ~1500 px, на экране судно 200–400 px. Прямое сжатие в 4–7 раз даёт «лесенку» и мерцание,
 *    поэтому для каждого судна строится цепочка копий (в 2, 4, 8… раз меньше), и рисуется та, что не меньше
 *    экранного размера: итоговое сжатие всегда меньше чем в 2 раза.
 * 3) Подкраска (ночь, закат, подводная часть) делается на том же уровне цепочки и кэшируется.
 */
import type { BoatStyle } from "../../types";
import { ctx2d, makeCanvas } from "../util";
import { BOAT_IMAGES } from "./images";

export interface Sprite {
  /** уровни цепочки: [0] — полный размер, каждый следующий вдвое меньше */
  mips: HTMLCanvasElement[];
  w: number;
  h: number;
}

const sprites = new Map<BoatStyle, Sprite>();
const loading = new Map<BoatStyle, Promise<Sprite | null>>();
const failed = new Set<BoatStyle>();
const tints = new Map<string, HTMLCanvasElement>();

function process(img: HTMLImageElement): Sprite {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const src = makeCanvas(w, h);
  const g = ctx2d(src);
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h);
  const p = d.data;

  // есть ли уже прозрачность (настоящий PNG)?
  let hasAlpha = false;
  for (const [cx, cy] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w >> 1, 0], [w >> 1, h - 1]]) {
    if (p[(cy * w + cx) * 4 + 3] < 200) hasAlpha = true;
  }

  const rows = new Uint16Array(h);
  const cols = new Uint16Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (hasAlpha) {
        if (p[o + 3] > 128) {
          rows[y]++;
          cols[x]++;
        }
        continue;
      }
      const r = p[o], gg = p[o + 1], b = p[o + 2];
      const m = Math.min(r, b) - gg; // «пурпурность»: у фона ≈ 255, у корпуса ≈ 0
      if (m <= 34) {
        p[o + 3] = 255;
        rows[y]++;
        cols[x]++;
        continue;
      }
      if (m >= 215) {
        p[o + 3] = 0;
        continue;
      }
      // доля судна в пикселе; чуть сжимаем кромку, чтобы не оставалось розового ореола JPEG
      let a = 1 - (m - 34) / 181;
      a = Math.max(0, Math.min(1, (a - 0.12) / 0.88));
      if (a <= 0.004) {
        p[o + 3] = 0;
        continue;
      }
      // краевой пиксель = a·цвет + (1−a)·пурпур → вычитаем пурпур
      let rr = (r - (1 - a) * 255) / a;
      let bb = (b - (1 - a) * 255) / a;
      const ggn = gg / a;
      // остаточный пурпурный оттенок на кромке гасим
      const t = Math.min(rr, bb) - ggn;
      if (t > 0) {
        rr -= t * 0.75;
        bb -= t * 0.75;
      }
      p[o] = Math.max(0, Math.min(255, rr));
      p[o + 1] = Math.max(0, Math.min(255, ggn));
      p[o + 2] = Math.max(0, Math.min(255, bb));
      p[o + 3] = Math.round(a * 255);
      if (a > 0.5) {
        rows[y]++;
        cols[x]++;
      }
    }
  }
  g.putImageData(d, 0, 0);
  let y0 = 0, y1 = h - 1, x0 = 0, x1 = w - 1;
  while (y0 < h - 1 && rows[y0] < 3) y0++;
  while (y1 > y0 && rows[y1] < 3) y1--;
  while (x0 < w - 1 && cols[x0] < 3) x0++;
  while (x1 > x0 && cols[x1] < 3) x1--;
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const out = makeCanvas(bw, bh);
  ctx2d(out).drawImage(src, x0, y0, bw, bh, 0, 0, bw, bh);
  return { mips: [out], w: bw, h: bh };
}

function load(style: BoatStyle): Promise<Sprite | null> {
  const ready = sprites.get(style);
  if (ready) return Promise.resolve(ready);
  const pending = loading.get(style);
  if (pending) return pending;
  if (failed.has(style) || typeof window === "undefined") return Promise.resolve(null);

  const promise = new Promise<Sprite | null>((resolve) => {
    const img = new Image();
    const finish = (sprite: Sprite | null) => {
      loading.delete(style);
      resolve(sprite);
    };
    img.onload = () => {
      try {
        const sprite = process(img);
        sprites.set(style, sprite);
        finish(sprite);
      } catch (err) {
        failed.add(style);
        console.warn("Не удалось обработать рисунок судна", style, err);
        finish(null);
      }
    };
    img.onerror = () => {
      failed.add(style);
      console.warn("Не загрузился рисунок судна", style);
      finish(null);
    };
    img.src = BOAT_IMAGES[style];
  });
  loading.set(style, promise);
  return promise;
}

/** Спрайт судна или null, пока рисунок ещё грузится; загрузка запускается по первому запросу. */
export function getSprite(style: BoatStyle): Sprite | null {
  const sprite = sprites.get(style);
  if (sprite) return sprite;
  if (typeof window !== "undefined" && !loading.has(style) && !failed.has(style)) void load(style);
  return null;
}

/** Дождаться декодирования и обработки одного рисунка, не подготавливая остальные стили. */
export function ensureSprite(style: BoatStyle): Promise<Sprite | null> {
  return load(style);
}

/** Явный прогрев всех изображений — используется только инструментом экспорта. */
export function preloadBoats() {
  for (const style of Object.keys(BOAT_IMAGES) as BoatStyle[]) void load(style);
}

export interface Level {
  c: HTMLCanvasElement;
  level: number;
}

/**
 * Копия рисунка, подходящая под ширину devW (в пикселях экрана): самая маленькая, но не меньше devW.
 * Каждый уровень строится из предыдущего с высоким качеством сглаживания.
 */
export function levelFor(sp: Sprite, devW: number): Level {
  let lv = 0;
  while (lv < 7 && sp.w / Math.pow(2, lv + 1) >= devW) lv++;
  while (sp.mips.length <= lv) {
    const prev = sp.mips[sp.mips.length - 1];
    const c = makeCanvas(Math.max(1, Math.round(prev.width / 2)), Math.max(1, Math.round(prev.height / 2)));
    const g = ctx2d(c);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(prev, 0, 0, c.width, c.height);
    sp.mips.push(c);
  }
  return { c: sp.mips[lv], level: lv };
}

/** Копия уровня, залитая цветом по силуэту судна (ночь, закат, подводная часть) */
export function tinted(style: BoatStyle, color: string, level: number): HTMLCanvasElement | null {
  const s = sprites.get(style);
  if (!s || level >= s.mips.length) return null;
  const key = `${style}|${level}|${color}`;
  let c = tints.get(key);
  if (!c) {
    const base = s.mips[level];
    c = makeCanvas(base.width, base.height);
    const g = ctx2d(c);
    g.drawImage(base, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    tints.set(key, c);
  }
  return c;
}

/** Сохранить все вырезанные суда как PNG с прозрачностью (их можно положить в public/boats/) */
export async function exportSprites(): Promise<number> {
  const styles = Object.keys(BOAT_IMAGES) as BoatStyle[];
  await Promise.all(styles.map((style) => ensureSprite(style)));
  let n = 0;
  for (const st of styles) {
    const sp = sprites.get(st);
    if (!sp) continue;
    await new Promise<void>((res) => {
      sp.mips[0].toBlob((b) => {
        if (b) {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(b);
          a.download = `${st}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
          n++;
        }
        res();
      }, "image/png");
    });
    await new Promise((r) => setTimeout(r, 350));
  }
  return n;
}
