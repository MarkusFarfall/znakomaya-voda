import { createRequire } from "node:module";
import { Engine } from "../src/game/engine";
import type { SaveData } from "../src/game/types";
const require = createRequire("/opt/playwright/node_modules/playwright/package.json");
const { chromium }: any = require("playwright");

async function main() {
const base = process.env.PROFILE_URL || "http://127.0.0.1:3000";
const pid = "perf-test-00000001";
const user = { id: pid, username: "PerfTest", createdAt: new Date(0).toISOString() };
  const save = new Engine().s;
  save.minutes = Number(process.env.PROFILE_TIME ?? 120);
  if (process.env.PROFILE_WEATHER) save.weather = process.env.PROFILE_WEATHER as typeof save.weather;
const browser = await chromium.launch({ headless: true, args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const pageErrors: string[] = [];
page.on("pageerror", (e: Error) => pageErrors.push(e.message));
await page.route("**/api/**", async (route: any) => {
  const url = new URL(route.request().url());
  if (url.pathname === "/api/auth/me") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "profile harness offline" }) });
  return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "profile harness offline" }) });
});
await page.addInitScript(({ pid, user, save }: { pid: string; user: { id: string; username: string; createdAt: string }; save: SaveData }) => {
  localStorage.setItem("zv_settings", JSON.stringify({ sound: false, music: false, quality: 1, model3d: false, gfx: { refl: false, shafts: false, caustics: false, foam: false, precip: false } }));
  localStorage.setItem("zv_last_account:v1", JSON.stringify({ playerId: pid, user }));
  localStorage.setItem(`zv_save:${pid}`, JSON.stringify(save));
  const perf = { frameMs: [] as number[], intervals: [] as number[], last: 0, surfaces: [] as { ref: WeakRef<HTMLCanvasElement>; width: number; height: number }[] };
  (window as any).__perf = perf;
  (window as any).__makeCanvas = (w: number, h: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, w | 0); canvas.height = Math.max(1, h | 0);
    perf.surfaces.push({ ref: new WeakRef(canvas), width: canvas.width, height: canvas.height });
    return canvas;
  };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => {
    const p = (window as any).__perf;
    const start = performance.now();
    if (p.last) p.intervals.push(ts - p.last);
    p.last = ts;
    cb(ts);
    p.frameMs.push(performance.now() - start);
  });
}, { pid, user, save });
await page.goto(base, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
let text = await page.locator("body").innerText();
if (text.includes("Не удалось продолжить запуск")) {
  console.error(text.slice(0, 900));
  throw new Error("Harness local save was rejected during startup");
}
// Start sailing from the title screen.
const continueButton = page.getByRole("button", { name: /Продолжить/ }).first();
if (await continueButton.count()) await continueButton.click();
await page.waitForTimeout(1800);
text = await page.locator("body").innerText();
await page.evaluate(() => { const p = (window as any).__perf; p.frameMs.length = 0; p.intervals.length = 0; p.last = 0; });
await page.waitForTimeout(10000);
const result = await page.evaluate(() => {
  const p = (window as any).__perf;
  const canvases = [...document.querySelectorAll("canvas")].map(c => ({ width: c.width, height: c.height, pixels: c.width * c.height, attached: true }));
  const offscreen = p.surfaces.map((s: any) => ({ width: s.width, height: s.height, pixels: s.width * s.height, alive: !!s.ref.deref() }));
  const aliveOffscreen = offscreen.filter((c: any) => c.alive);
  const frames = [...p.frameMs].sort((x, y) => x - y), intervals = [...p.intervals].sort((x, y) => x - y);
  return {
    url: location.href, title: document.title, canvases, offscreen,
    allocatedSurfaceCount: offscreen.length, allocatedPixels: offscreen.reduce((n: number, c: any) => n + c.pixels, 0),
    aliveTrackedSurfaceCount: aliveOffscreen.length, aliveTrackedPixels: aliveOffscreen.reduce((n: number, c: any) => n + c.pixels, 0),
    rafWorkMs: { n: frames.length, p50: frames[Math.floor((frames.length - 1) * .5)], p95: frames[Math.floor((frames.length - 1) * .95)], max: frames.at(-1) },
    rafIntervalMs: { n: intervals.length, p50: intervals[Math.floor((intervals.length - 1) * .5)], p95: intervals[Math.floor((intervals.length - 1) * .95)], max: intervals.at(-1) },
    pageText: document.body.innerText.slice(0, 500)
  };
});
console.log(JSON.stringify({ result, pageErrors }, null, 2));
await browser.close();
if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join("; ")}`);
}

void main();
