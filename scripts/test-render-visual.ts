import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { Engine } from "../src/game/engine";
import type { SaveData, WeatherId } from "../src/game/types";

const require = createRequire("/opt/playwright/node_modules/playwright/package.json");
const { chromium }: any = require("playwright");
const port = Number(process.env.RENDER_TEST_PORT ?? 3123);
const url = process.env.RENDER_TEST_URL ?? `http://127.0.0.1:${port}`;
const startServer = !process.env.RENDER_TEST_URL;
const pid = "visual-test-00000001";
const user = { id: pid, username: "VisualTest", createdAt: new Date(0).toISOString() };

async function main() {
  let server: ReturnType<typeof spawn> | undefined;
  let serverLog = "";
  if (startServer) {
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), detached: true, stdio: ["ignore", "pipe", "pipe"] });
    server.stdout?.on("data", d => { serverLog += String(d); });
    server.stderr?.on("data", d => { serverLog += String(d); });
    const deadline = Date.now() + 150_000;
    let ready = false;
    while (Date.now() < deadline && server.exitCode === null) {
      try { const response = await fetch(url); if (response.ok) { ready = true; break; } } catch { /* booting */ }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) { if (server.pid) process.kill(-server.pid, "SIGTERM"); throw new Error(`Next dev did not become ready. ${serverLog.slice(-2000)}`); }
  }

  const save = new Engine().s;
  save.minutes = 12 * 60;
  save.weather = "clear";
  const browser = await chromium.launch({ headless: true, args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const pageErrors: string[] = [];
  page.on("pageerror", (e: Error) => pageErrors.push(e.message));
  page.on("console", (m: any) => { if (m.type() === "error" && !m.text().includes("503")) pageErrors.push(m.text()); });
  await page.route("**/api/**", async (route: any) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "visual regression harness: offline API" }) }));
  await page.addInitScript(({ pid, user, save }: { pid: string; user: { id: string; username: string; createdAt: string }; save: SaveData }) => {
    localStorage.setItem("zv_settings", JSON.stringify({ sound: false, music: false, quality: 2, model3d: false, gfx: { refl: true, shafts: true, caustics: true, foam: true, precip: true } }));
    localStorage.setItem("zv_last_account:v1", JSON.stringify({ playerId: pid, user }));
    localStorage.setItem(`zv_save:${pid}`, JSON.stringify(save));
    (window as any).__frameWork = [];
    const originalRAF = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => originalRAF((time) => {
      const started = performance.now();
      callback(time);
      (window as any).__frameWork.push(performance.now() - started);
    });
  }, { pid, user, save });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1800);
    const continueButton = page.getByRole("button", { name: /Продолжить/ }).first();
    if (await continueButton.count()) await continueButton.click();
    await page.waitForTimeout(1800);
    const hasDebugEngine = await page.evaluate(() => !!(window as any).__zv);
    if (!hasDebugEngine) throw new Error("Dev-only Engine hook was not exposed; launch the app in development mode.");

    const artifactDir = process.env.RENDER_TEST_ARTIFACTS;
    if (artifactDir) await mkdir(artifactDir, { recursive: true });
    const streamTrace: any[] = [];
    for (const point of [
      { name: "west-start", x: 720, heading: 1, expected: [0] },
      { name: "approach-west-seam", x: 1700, heading: 1, expected: [0, 1] },
      { name: "west-seam-crossing", x: 2400, heading: 1, expected: [0, 1] },
      { name: "west-seam-crossing-reverse", x: 2400, heading: -1, expected: [0, 1] },
      { name: "middle", x: 3500, heading: 1, expected: [1] },
      { name: "prefetch-east-seam", x: 3800, heading: 1, expected: [1, 2] },
      { name: "east-end", x: 6200, heading: 1, expected: [2] },
      { name: "reverse-prefetch", x: 3200, heading: -1, expected: [1, 0] },
      { name: "westward", x: 1700, heading: -1, expected: [0] },
    ]) {
      await page.evaluate(() => { (window as any).__frameWork.length = 0; });
      const buildCountBefore = await page.evaluate(() => (window as any).__zvSound().streamBuildTrace.length as number);
      await page.evaluate(({ x, heading }: { x: number; heading: 1 | -1 }) => {
        const engine = (window as any).__zv;
        engine.navigation.x = x;
        engine.navigation.velocity = 0;
        engine.navigation.target = null;
        engine.navigation.heading = heading;
        engine.paused = false;
      }, point);
      await page.waitForTimeout(850);
      const frameProbe = await page.evaluate(() => {
        const sorted = [...(window as any).__frameWork].sort((a: number, b: number) => a - b);
        return { count: sorted.length, p95Ms: sorted.length ? +sorted[Math.floor((sorted.length - 1) * .95)].toFixed(2) : 0, maxMs: sorted.length ? +sorted[sorted.length - 1].toFixed(2) : 0 };
      });
      const devStats = await page.evaluate(({ buildCountBefore }: { buildCountBefore: number }) => {
        const stats = (window as any).__zvSound();
        return { residentIds: stats.streamedRegions as number[], newChunkBuilds: stats.streamBuildTrace.slice(buildCountBefore), builtWindows: stats.streamBuiltWindows as { id: number; worldLeft: number; width: number }[], view: stats.streamView as { left: number; width: number } };
      }, { buildCountBefore });
      const residentIds = devStats.residentIds as number[];
      const visibleCoverage = residentIds.reduce((sum: number, id: number) => sum + Math.max(0, Math.min((id + 1) * 2400, devStats.view.left + devStats.view.width) - Math.max(id * 2400, devStats.view.left)), 0);
      const builtWindows = devStats.builtWindows as { id: number; worldLeft: number; width: number }[];
      const builtWorldWidth = builtWindows.reduce((sum, window) => sum + window.width, 0);
      const visibleGeometry = builtWindows.reduce((sum, window) => sum + Math.max(0, Math.min(window.worldLeft + window.width, devStats.view.left + devStats.view.width) - Math.max(window.worldLeft, devStats.view.left)), 0);
      const builtOffscreenWidth = Math.max(0, builtWorldWidth - visibleGeometry);
      if (Math.abs(visibleGeometry - visibleCoverage) > 1) throw new Error(`Geometry window does not cover the actual viewport: ${JSON.stringify({ view: devStats.view, builtWindows, visibleGeometry, visibleCoverage })}`);
      streamTrace.push({ step: point.name, worldX: point.x, view: devStats.view, residentIds, builtWindows, builtWorldWidth, visibleCoverage, visibleGeometry, builtOffscreenWidth, newChunkBuilds: devStats.newChunkBuilds, frameProbe });
      if ([...residentIds].sort().join(",") !== [...point.expected].sort().join(",")) throw new Error(`Unexpected resident chunk set: ${JSON.stringify(streamTrace.at(-1))}; expected ${point.expected}`);
      if (residentIds.length > 2 || residentIds.join(",") === "0,1,2") throw new Error(`Unvisited terrain chunks are resident during travel: ${JSON.stringify(streamTrace.at(-1))}`);
      if ([...residentIds].sort((a, b) => a - b).some((id, i, list) => i > 0 && id !== list[i - 1] + 1)) throw new Error(`Stream cache contains a non-adjacent distant chunk: ${JSON.stringify(streamTrace.at(-1))}`);
    }

    const scenarios: { name: string; minutes: number; weather: WeatherId }[] = [
      { name: "clear-day", minutes: 12 * 60, weather: "clear" },
      { name: "clear-night", minutes: 2 * 60, weather: "clear" },
      { name: "fog", minutes: 2 * 60, weather: "fog" },
      { name: "rain", minutes: 10 * 60, weather: "rain" },
      { name: "storm", minutes: 2 * 60, weather: "storm" },
      { name: "overcast", minutes: 12 * 60, weather: "cloudy" },
    ];
    const results: any[] = [];
    await page.evaluate(() => { (window as any).__visualPrevious = null; });
    for (const scenario of scenarios) {
      await page.evaluate(({ minutes, weather }: { minutes: number; weather: WeatherId }) => {
        const engine = (window as any).__zv;
        const state = structuredClone(engine.s);
        state.minutes = minutes;
        state.weather = weather;
        state.weatherQueued = weather;
        state.weatherNext = minutes + 12 * 60;
        engine.s = state;
        engine.paused = false;
      }, scenario);
      await page.waitForTimeout(1800);
      const frame = await page.evaluate(() => {
        const canvas = document.querySelector("canvas");
        if (!canvas) throw new Error("Game canvas missing");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Game canvas is not a 2D context");
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const colors = new Set<string>();
        let opaque = 0, nonDark = 0, changedPixels = 0;
        for (let i = 0; i < pixels.length; i += 4 * 11) {
          if (pixels[i + 3] > 245) opaque++;
          if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 35) nonDark++;
          colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`);
        }
        const previous = (window as any).__visualPrevious as Uint8ClampedArray | null;
        if (previous) for (let i = 0; i < pixels.length; i += 4) {
          if (Math.abs(pixels[i] - previous[i]) + Math.abs(pixels[i + 1] - previous[i + 1]) + Math.abs(pixels[i + 2] - previous[i + 2]) > 18) changedPixels++;
        }
        (window as any).__visualPrevious = pixels.slice();
        return { width: canvas.width, height: canvas.height, sampledColors: colors.size, sampledOpaque: opaque, sampledNonDark: nonDark, changedPixels };
      });
      const changedPixels = frame.changedPixels;
      if (artifactDir) await page.locator("canvas").first().screenshot({ path: `${artifactDir}/${scenario.name}.png` });
      const status = await page.evaluate(() => ({ frameFails: (window as any).__zvSound?.().frameFails ?? null }));
      const totalPixels = frame.width * frame.height;
      const report = { scenario: scenario.name, dimensions: `${frame.width}x${frame.height}`, sampledColors: frame.sampledColors, sampledOpaque: frame.sampledOpaque, sampledNonDark: frame.sampledNonDark, changedPixelsFromPrevious: changedPixels, frameFails: status.frameFails };
      results.push(report);
      if (frame.width < 1000 || frame.height < 600 || frame.sampledColors < 120 || frame.sampledOpaque < 100 || frame.sampledNonDark < 100) throw new Error(`Canvas appears blank or incomplete: ${JSON.stringify(report)}`);
      if (results.length > 1 && changedPixels < totalPixels * 0.002) throw new Error(`Scenario did not visibly alter the rendered frame: ${JSON.stringify(report)}`);
      if (status.frameFails !== 0) throw new Error(`Renderer reported frame failures: ${JSON.stringify(report)}`);
    }
    if (pageErrors.length) throw new Error(`Browser errors: ${pageErrors.join("; ")}`);
    const maxBuiltOffscreenWidth = Math.max(...streamTrace.map(x => x.builtOffscreenWidth));
    const offscreenBudget = 32;
    console.log(JSON.stringify({
      viewportOnlyGeneration: { status: maxBuiltOffscreenWidth <= offscreenBudget + 1e-6 ? "PASS" : "NOT MET", maxBuiltOffscreenWidth, offscreenBudget, note: "Terrain is generated in 32px aligned windows covering the camera; only boundary-cell overscan is permitted." },
      streaming: streamTrace,
      weatherCanvas: results,
    }, null, 2));
    if (maxBuiltOffscreenWidth > offscreenBudget + 1e-6) process.exitCode = 1;
    console.log(maxBuiltOffscreenWidth <= offscreenBudget + 1e-6
      ? `PASS: terrain geometry is constrained to the camera window with <=${offscreenBudget}px of cell-edge overscan.`
      : `FAIL: terrain geometry exceeds the ${offscreenBudget}px camera-window overscan budget (${maxBuiltOffscreenWidth}px).`);
    console.log("PASS: actual game Canvas remains populated and responds to daylight/weather changes across six scenarios.");
  } finally {
    await browser.close();
    if (server?.pid && server.exitCode === null) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* already stopped */ } }
  }
}

void main();
