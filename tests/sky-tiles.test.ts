import "./path2d-polyfill";
import assert from "node:assert/strict";
import test from "node:test";
import { SkyRenderer } from "../src/game/render/sky";
import type { Frame } from "../src/game/render/frame";

interface FakeCanvas { width: number; height: number; getContext(type: string): CanvasRenderingContext2D }

function canvasContext(canvas: { width: number; height: number }, sources?: number[]) {
  const state: Record<string, unknown> = { filter: "none", globalAlpha: 1 };
  const ctx = new Proxy({ canvas }, {
    get(target, key: string) {
      if (key in target) return target[key as keyof typeof target];
      if (key === "createLinearGradient" || key === "createRadialGradient") return () => ({ addColorStop() {} });
      if (key === "drawImage") return (image: { width?: number }, ..._args: unknown[]) => {
        if (typeof image?.width === "number") sources?.push(image.width);
      };
      if (key in state) return state[key];
      return (..._args: unknown[]) => {};
    },
    set(_target, key: string, value: unknown) { state[key] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return ctx;
}

function frame(ctx: CanvasRenderingContext2D, left: number): Frame {
  return {
    ctx, W: 7200, H: 720, hY: 263, sY: 331, t: 1.2, dt: 1 / 60, sc: 1,
    viewLeft: left, viewWidth: 1280, cam: 0, quality: 2, night: 0.35,
    golden: 0, cover: 0.95, fogK: 0, sunElev: 25, sunX: 3200, sunY: 110,
    sunVis: 0.8, moonX: 3400, moonY: 100, moonUp: false, moonVis: 0,
    atmo: {
      kind: "snow", starVis: 0.4, cover: 0.95, dark: 0.2, precip: 0.6,
      fog: 0, daylight: 0.5, night: 0.35, rainbow: 0, moonPhase: 0.3,
      moonIllum: 0.2, palette: { cloud: [156, 168, 184], sun: [255, 226, 176], glow: [203, 232, 255], fog: [187, 197, 205] },
    },
    top: [31, 98, 186], mid: [90, 158, 228], hor: [190, 220, 240],
    e: { isNight: false, s: { minutes: 780 } },
    loc: { land: "cliffs" }, spot: { feature: null },
    activeEvents: [], activeEventIds: new Set<string>(),
  } as unknown as Frame;
}

test("Milky Way and cloud deck allocate and draw only cached 600px tiles under the player view", () => {
  const created: FakeCanvas[] = [], drawnWidths: number[] = [];
  (globalThis as unknown as { __makeCanvas?: (w: number, h: number) => FakeCanvas }).__makeCanvas = (w, h) => {
    const c = { width: w, height: h, getContext: (_type: string) => canvasContext(c, drawnWidths) } as FakeCanvas;
    created.push(c);
    return c;
  };

  const screen = { width: 1280, height: 720 };
  const sky = new SkyRenderer();
  sky.draw(frame(canvasContext(screen, drawnWidths), 2400));
  const firstPass = created.length;
  assert.ok(firstPass > 14, "cloud sprites plus visible background tiles were created");
  assert.ok(created.every((c) => c.width <= 620), "no 7200px world-wide sky canvas is allocated");
  assert.ok(drawnWidths.every((width) => width <= 620), "only small tiles/sprites are blitted");

  sky.draw(frame(canvasContext(screen, drawnWidths), 2400));
  assert.equal(created.length, firstPass, "the same visible tiles are reused on subsequent frames");

  sky.draw(frame(canvasContext(screen, drawnWidths), 3600));
  assert.ok(created.length > firstPass, "entering new 600px cells builds only the newly visible tiles");
  assert.ok(created.every((c) => c.width <= 620));
});
