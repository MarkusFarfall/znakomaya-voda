import { createRequire } from "node:module";
import { rng } from "../src/game/render/util";
import { DeckBlob, MilkyHole, MilkyPoint, renderDeckRegion, renderMilkyRegion, SKY_TILE_WIDTH } from "../src/game/render/sky";

// Uses the same exported paint functions that SkyRenderer calls; only the
// reference composition differs (one full canvas versus the production tiles).
const require = createRequire("/opt/playwright/node_modules/playwright/package.json");
const { chromium }: any = require("playwright");

async function main() {
  const worldWidth = 7200, milkyHeight = 280, deckHeight = 273;
  const r = rng(11);
  const points: MilkyPoint[] = Array.from({ length: 2600 }, () => ({
    x: (r() - 0.5) * worldWidth * 1.8,
    y: (r() + r() + r() - 1.5) * milkyHeight * 0.12,
    alpha: 0.15 + r() * 0.5,
    size: r() * 1.1 + 0.3,
  }));
  // Explicit seam cases ensure the test exercises details that straddle tile cuts.
  for (const seam of [2400, 4800]) {
    points.push({ x: seam - 0.4, y: 2, alpha: 0.8, size: 1.3 }, { x: seam + 0.4, y: -1, alpha: 0.7, size: 1.1 });
  }
  const holes: MilkyHole[] = Array.from({ length: 60 }, () => {
    const x = (r() - 0.5) * worldWidth * 1.8;
    return { x, gradientY: (r() - 0.5) * 8, radius: 18 + r() * 30, ellipseY: (r() - 0.5) * 8, width: 40 + r() * 40, height: 6 + r() * 6 };
  });
  const cloudRandom = rng(77);
  const blobs: DeckBlob[] = Array.from({ length: 220 }, () => {
    const x = cloudRandom() * worldWidth * 1.2 - worldWidth * 0.1;
    const y = Math.pow(cloudRandom(), 0.8) * deckHeight * 0.95;
    const radius = (40 + cloudRandom() * 110) * (0.6 + (y / deckHeight) * 0.6);
    const color = cloudRandom() < 0.5 ? "#4a6076" : "#a9b6c4";
    return { x, y, radius, color };
  });
  for (const seam of [2400, 4800]) blobs.push({ x: seam + 3, y: 132, radius: 45, color: "#90a0b0" });

  const browser = await chromium.launch({ headless: true, args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><canvas></canvas>");
    const result = await page.evaluate(({ milkySource, deckSource, worldWidth, milkyHeight, deckHeight, skyTileWidth, points, holes, blobs }: { milkySource: string; deckSource: string; worldWidth: number; milkyHeight: number; deckHeight: number; skyTileWidth: number; points: MilkyPoint[]; holes: MilkyHole[]; blobs: DeckBlob[] }) => {
      const paintMilky = new Function(`return (${milkySource})`)();
      const paintDeck = new Function(`return (${deckSource})`)();
      const checks = [];
      for (const tileWidth of [skyTileWidth]) {
        for (const mode of ["milky", "deck"]) {
          const height = mode === "milky" ? milkyHeight : deckHeight;
          const paint = mode === "milky" ? paintMilky : paintDeck;
          const reference = document.createElement("canvas");
          reference.width = worldWidth; reference.height = height;
          const ref = reference.getContext("2d")!;
          if (mode === "milky") paint(ref, worldWidth, height, 0, points, holes);
          else paint(ref, 0, worldWidth, blobs, (hex: string, alpha: number) => {
            const value = hex.replace("#", "");
            const channels = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16));
            const bounded = Math.max(0, Math.min(1, alpha));
            return `rgba(${channels[0]},${channels[1]},${channels[2]},${bounded.toFixed(3)})`;
          });
          const tiled = document.createElement("canvas");
          tiled.width = worldWidth; tiled.height = height;
          const out = tiled.getContext("2d")!;
          for (let left = 0; left < worldWidth; left += tileWidth) {
            const width = Math.min(tileWidth, worldWidth - left);
            const tile = document.createElement("canvas"); tile.width = width; tile.height = height;
            const ctx = tile.getContext("2d")!;
            if (mode === "milky") paint(ctx, worldWidth, height, left, points, holes);
            else paint(ctx, left, width, blobs, (hex: string, alpha: number) => {
              const value = hex.replace("#", "");
              const channels = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16));
              const bounded = Math.max(0, Math.min(1, alpha));
              return `rgba(${channels[0]},${channels[1]},${channels[2]},${bounded.toFixed(3)})`;
            });
            out.drawImage(tile, left, 0);
          }
          const refFinal = document.createElement("canvas"); refFinal.width = worldWidth; refFinal.height = height;
          const refFinalCtx = refFinal.getContext("2d")!; refFinalCtx.fillStyle = "#101a2a"; refFinalCtx.fillRect(0, 0, worldWidth, height); refFinalCtx.globalAlpha = mode === "milky" ? 0.9 : 1; refFinalCtx.drawImage(reference, 0, 0);
          const tiledFinal = document.createElement("canvas"); tiledFinal.width = worldWidth; tiledFinal.height = height;
          const tiledFinalCtx = tiledFinal.getContext("2d")!; tiledFinalCtx.fillStyle = "#101a2a"; tiledFinalCtx.fillRect(0, 0, worldWidth, height); tiledFinalCtx.globalAlpha = mode === "milky" ? 0.9 : 1; tiledFinalCtx.drawImage(tiled, 0, 0);
          const a = refFinalCtx.getImageData(0, 0, worldWidth, height).data;
          const b = tiledFinalCtx.getImageData(0, 0, worldWidth, height).data;
          let changedChannels = 0, changedPixels = 0, significantPixels = 0, maxChannelDelta = 0, maxPixelDelta = 0, first = -1;
          const samples = [];
          for (let pixel = 0; pixel < worldWidth * height; pixel++) {
            let pixelDelta = 0;
            for (let channel = 0; channel < 4; channel++) {
              const i = pixel * 4 + channel, delta = Math.abs(a[i] - b[i]);
              if (delta) { changedChannels++; if (first < 0) first = pixel; if (delta > maxChannelDelta) maxChannelDelta = delta; }
              if (delta > pixelDelta) pixelDelta = delta;
            }
            if (pixelDelta) { changedPixels++; if (pixelDelta > 2) significantPixels++; if (pixelDelta > maxPixelDelta) maxPixelDelta = pixelDelta; if (samples.length < 12) samples.push({ x: pixel % worldWidth, y: Math.floor(pixel / worldWidth), delta: pixelDelta }); }
          }
          checks.push({ mode, tileWidth, referencePixels: worldWidth * height, changedPixels, significantPixels, changedChannels, maxChannelDelta, maxPixelDelta, firstDifferencePixel: first < 0 ? null : first, samples });
        }
      }
      return checks;
    }, { milkySource: renderMilkyRegion.toString(), deckSource: renderDeckRegion.toString(), worldWidth, milkyHeight, deckHeight, skyTileWidth: SKY_TILE_WIDTH, points, holes, blobs });
    console.log(JSON.stringify(result.map(({ mode, tileWidth, referencePixels, changedPixels, significantPixels, maxPixelDelta }: any) => ({ mode, tileWidth, referencePixels, changedPixels, changedPercent: +(100 * changedPixels / referencePixels).toFixed(4), significantPixels, maxPixelDelta })), null, 2));
    const failures = result.filter((x: any) => x.changedPixels / x.referencePixels > 0.003 || x.maxPixelDelta > 8);
    if (failures.length) throw new Error(`Pixel regression exceeds tolerance: ${JSON.stringify(failures)}`);
    console.log("PASS: full-canvas and 256px microtile renderings match within antialias/compositing tolerance (≤8/255, <0.3% pixels).");
  } finally {
    await browser.close();
  }
}

void main();
