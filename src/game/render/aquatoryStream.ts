import {
  ChunkWindow,
  REGION_WIDTH,
  streamPlan,
  waterBedAt,
  waterRegions,
} from "../aquatory";
import type { Frame } from "./frame";
import { LandRenderer } from "./land";
import { SeabedRenderer } from "./seabed";
interface TerrainChunk {
  land: LandRenderer;
  bed: SeabedRenderer;
}

/** Pixel-align a world-space region boundary for the current Canvas transform. */
export function pixelAlignedChunkClip(offset: number, width: number, a: number, e: number) {
  const left = (Math.round(offset * a + e) - e) / a;
  const right = (Math.round((offset + width) * a + e) - e) / a;
  return { left, right };
}
interface CachedFrame extends Frame {
  __source: Frame;
  __offset: number;
}
export class AquatoryStream {
  private cache = new ChunkWindow<TerrainChunk>();
  private visible: number[] = [];
  private frames = new Map<number, CachedFrame>();
  private clipFrame: Frame | null = null;
  private clipTransformA = 0;
  private clipTransformE = 0;
  private readonly clips = new Map<number, { left: number; right: number }>();
  private readonly activeWindows = new Map<number, { worldLeft: number; width: number }>();
  private readonly buildEvents: { location: string; id: number; worldLeft: number; width: number; landMs: number; seabedMs: number; totalMs: number }[] = [];
  get buildTrace() { return this.buildEvents.slice(); }
  get builtWindows() { return [...this.activeWindows.entries()].map(([id, range]) => ({ id, ...range })); }
  get residentIds() {
    return [...this.cache.chunks.keys()];
  }
  private frame(f: Frame, index: number): Frame {
    const offset = index * REGION_WIDTH;
    let local = this.frames.get(index);
    if (!local) {
      local = { ...f, __source: f, __offset: offset } as CachedFrame;
      local.waveY = (x) => local!.__source.waveY(x + local!.__offset);
      local.bedDepth = (x) => waterBedAt(local!.__source.loc.id, x + local!.__offset);
      this.frames.set(index, local);
    }
    const waveY = local.waveY, bedDepth = local.bedDepth;
    Object.assign(local, f);
    local.waveY = waveY;
    local.bedDepth = bedDepth;
    local.__source = f;
    local.__offset = offset;
    local.W = REGION_WIDTH;
    local.worldWidth = f.W;
    local.chunkOffset = offset;
    local.spot = waterRegions(f.loc.id)[index];
    local.viewLeft = Math.max(0, (f.viewLeft ?? 0) - offset);
    local.viewWidth = f.viewWidth ?? f.W;
    const cameraLeft = f.viewLeft ?? 0;
    const visibleLeft = Math.max(0, cameraLeft - offset);
    const visibleRight = Math.min(REGION_WIDTH, cameraLeft + local.viewWidth - offset);
    // Generate only fine 32px world cells intersecting the viewport. Quantized edges
    // avoid rebuilding on subpixel camera jitter while limiting edge overscan to <32px.
    const cell = 32;
    local.buildLeft = Math.max(0, Math.floor(visibleLeft / cell) * cell);
    local.buildRight = Math.min(REGION_WIDTH, Math.ceil(visibleRight / cell) * cell);
    local.sunX = f.sunX - offset;
    local.moonX = f.moonX - offset;
    return local;
  }
  update(f: Frame, left: number, width: number, direction: number) {
    const plan = streamPlan(f.loc.id, left, width, direction);
    this.visible = plan.visible;
    this.cache.sync(f.loc.id, plan.resident, () => ({
      land: new LandRenderer(),
      bed: new SeabedRenderer(),
    }));
    const resident = new Set(plan.resident);
    for (const id of this.activeWindows.keys()) if (!resident.has(id)) this.activeWindows.delete(id);
    for (const id of plan.resident) {
      const c = this.cache.chunks.get(id)!,
        local = this.frame(f, id);
      const worldLeft = id * REGION_WIDTH;
      const cameraLeft = left;
      const cameraRight = left + width;
      if (cameraRight <= worldLeft || cameraLeft >= worldLeft + REGION_WIDTH) {
        // Prefetch region definitions, not geometry: discard its previous viewport window.
        if (this.activeWindows.has(id)) {
          this.cache.chunks.set(id, { land: new LandRenderer(), bed: new SeabedRenderer() });
          this.activeWindows.delete(id);
        }
        continue;
      }
      if (process.env.NODE_ENV !== "production" && typeof performance !== "undefined") {
        const start = performance.now();
        const landBuilt = c.land.build(local);
        const afterLand = performance.now();
        const seabedBuilt = c.bed.build(local);
        const end = performance.now();
        if (landBuilt || seabedBuilt) {
          this.buildEvents.push({ location: f.loc.id, id, worldLeft: id * REGION_WIDTH + (local.buildLeft ?? 0), width: Math.max(0, (local.buildRight ?? REGION_WIDTH) - (local.buildLeft ?? 0)), landMs: afterLand - start, seabedMs: end - afterLand, totalMs: end - start });
          if (this.buildEvents.length > 64) this.buildEvents.shift();
        }
      } else {
        c.land.build(local);
        c.bed.build(local);
      }
      this.activeWindows.set(id, {
        worldLeft: id * REGION_WIDTH + (local.buildLeft ?? 0),
        width: Math.max(0, (local.buildRight ?? REGION_WIDTH) - (local.buildLeft ?? 0)),
      });
    }
  }
  draw(f: Frame, draw: (chunk: TerrainChunk, local: Frame) => void) {
    for (const id of this.visible) {
      const c = this.cache.chunks.get(id);
      if (!c) continue;
      const offset = id * REGION_WIDTH,
        local = this.frame(f, id);
      f.ctx.save();
      if (this.clipFrame !== f) {
        const transform = f.ctx.getTransform();
        this.clipFrame = f;
        this.clipTransformA = transform.a;
        this.clipTransformE = transform.e;
        this.clips.clear();
      }
      let clip = this.clips.get(id);
      if (!clip) {
        clip = pixelAlignedChunkClip(offset, REGION_WIDTH, this.clipTransformA, this.clipTransformE);
        this.clips.set(id, clip);
      }
      f.ctx.beginPath();
      f.ctx.rect(clip.left, -f.H * 8, clip.right - clip.left, f.H * 24);
      f.ctx.clip();
      f.ctx.translate(offset, 0);
      draw(c, local);
      f.ctx.restore();
    }
  }
  rocks(): [number, number][] {
    return this.visible.flatMap((id) =>
      (this.cache.chunks.get(id)?.land.seaRocks ?? [])
        .slice(0, 4)
        .map((r) => [r.x + id * REGION_WIDTH, r.y - r.h] as [number, number]),
    );
  }
}
