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

export const GEOMETRY_TILE_WIDTH = 128;

/** Inclusive range of fixed geometry cells intersecting a local viewport interval. */
export function geometryTileRange(left: number, right: number, worldWidth = REGION_WIDTH, tileWidth = GEOMETRY_TILE_WIDTH) {
  const lo = Math.max(0, Math.min(worldWidth, left));
  const hi = Math.max(lo, Math.min(worldWidth, right));
  if (hi <= lo) return null;
  return {
    first: Math.floor(lo / tileWidth),
    last: Math.floor(Math.max(lo, hi - 1e-6) / tileWidth),
  };
}
interface TerrainTile {
  index: number;
  left: number;
  right: number;
  land: LandRenderer;
  bed: SeabedRenderer;
}
interface TerrainChunk {
  tiles: Map<number, TerrainTile>;
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

/**
 * Builds immutable terrain microtiles only when they enter the camera window.
 * Off-screen prefetch regions keep definitions only, never land/seabed geometry.
 */
export class AquatoryStream {
  private cache = new ChunkWindow<TerrainChunk>();
  private visible: number[] = [];
  private frames = new Map<number, CachedFrame>();
  private clipFrame: Frame | null = null;
  private clipTransformA = 0;
  private clipTransformE = 0;
  private readonly clips = new Map<string, { left: number; right: number }>();
  private readonly activeWindows = new Map<string, { id: number; tileIndex: number; worldLeft: number; width: number }>();
  private readonly buildEvents: { location: string; id: number; tileIndex: number; worldLeft: number; width: number; landMs: number; seabedMs: number; totalMs: number }[] = [];

  get buildTrace() { return this.buildEvents.slice(); }
  get builtWindows() { return [...this.activeWindows.values()]; }
  get residentIds() { return [...this.cache.chunks.keys()]; }

  private frame(f: Frame, index: number, tileLeft: number, tileRight: number): Frame {
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

    const cameraLeft = f.viewLeft ?? 0;
    const cameraRight = cameraLeft + (f.viewWidth ?? f.W);
    const visibleLeft = Math.max(tileLeft, cameraLeft - offset);
    const visibleRight = Math.min(tileRight, cameraRight - offset);
    local.viewLeft = visibleLeft;
    local.viewWidth = Math.max(0, visibleRight - visibleLeft);
    local.buildLeft = tileLeft;
    local.buildRight = tileRight;
    local.sunX = f.sunX - offset;
    local.moonX = f.moonX - offset;
    return local;
  }

  private buildTile(f: Frame, id: number, tile: TerrainTile) {
    const local = this.frame(f, id, tile.left, tile.right);
    const key = `${id}:${tile.index}`;
    if (process.env.NODE_ENV !== "production" && typeof performance !== "undefined") {
      const start = performance.now();
      const landBuilt = tile.land.build(local);
      const afterLand = performance.now();
      const seabedBuilt = tile.bed.build(local);
      const end = performance.now();
      if (landBuilt || seabedBuilt) {
        this.buildEvents.push({
          location: f.loc.id,
          id,
          tileIndex: tile.index,
          worldLeft: id * REGION_WIDTH + tile.left,
          width: tile.right - tile.left,
          landMs: afterLand - start,
          seabedMs: end - afterLand,
          totalMs: end - start,
        });
        if (this.buildEvents.length > 256) this.buildEvents.shift();
      }
    } else {
      tile.land.build(local);
      tile.bed.build(local);
    }
    this.activeWindows.set(key, {
      id,
      tileIndex: tile.index,
      worldLeft: id * REGION_WIDTH + tile.left,
      width: tile.right - tile.left,
    });
  }

  update(f: Frame, left: number, width: number, direction: number) {
    const plan = streamPlan(f.loc.id, left, width, direction);
    this.visible = plan.visible;
    this.cache.sync(f.loc.id, plan.resident, () => ({ tiles: new Map() }));

    const residentKeys = new Set<string>();
    const cameraRight = left + width;
    for (const id of plan.resident) {
      const chunk = this.cache.chunks.get(id)!;
      const worldLeft = id * REGION_WIDTH;
      const localLeft = Math.max(0, left - worldLeft);
      const localRight = Math.min(REGION_WIDTH, cameraRight - worldLeft);
      if (localRight <= localLeft) {
        // Keep the approaching region's lightweight container, not generated geometry.
        chunk.tiles.clear();
        continue;
      }

      const tileRange = geometryTileRange(localLeft, localRight);
      if (!tileRange) continue;
      const first = tileRange.first;
      const last = Math.min(Math.ceil(REGION_WIDTH / GEOMETRY_TILE_WIDTH) - 1, tileRange.last);
      const desired = new Set<number>();
      for (let tileIndex = first; tileIndex <= last; tileIndex++) {
        desired.add(tileIndex);
        const tileLeft = tileIndex * GEOMETRY_TILE_WIDTH;
        const tileRight = Math.min(REGION_WIDTH, tileLeft + GEOMETRY_TILE_WIDTH);
        const key = `${id}:${tileIndex}`;
        residentKeys.add(key);
        let tile = chunk.tiles.get(tileIndex);
        if (!tile) {
          tile = { index: tileIndex, left: tileLeft, right: tileRight, land: new LandRenderer(), bed: new SeabedRenderer() };
          chunk.tiles.set(tileIndex, tile);
          this.buildTile(f, id, tile);
        }
      }
      for (const tileIndex of chunk.tiles.keys()) if (!desired.has(tileIndex)) chunk.tiles.delete(tileIndex);
    }
    for (const key of this.activeWindows.keys()) if (!residentKeys.has(key)) this.activeWindows.delete(key);
  }

  draw(f: Frame, draw: (chunk: TerrainTile, local: Frame) => void) {
    const cameraLeft = f.viewLeft ?? 0;
    const cameraRight = cameraLeft + (f.viewWidth ?? f.W);
    for (const id of this.visible) {
      const chunk = this.cache.chunks.get(id);
      if (!chunk) continue;
      const offset = id * REGION_WIDTH;
      for (const tile of chunk.tiles.values()) {
        const worldTileLeft = offset + tile.left;
        const worldTileRight = offset + tile.right;
        if (worldTileRight <= cameraLeft || worldTileLeft >= cameraRight) continue;
        const local = this.frame(f, id, tile.left, tile.right);
        f.ctx.save();
        if (this.clipFrame !== f) {
          const transform = f.ctx.getTransform();
          this.clipFrame = f;
          this.clipTransformA = transform.a;
          this.clipTransformE = transform.e;
          this.clips.clear();
        }
        const clipKey = `${id}:${tile.index}`;
        let clip = this.clips.get(clipKey);
        if (!clip) {
          clip = pixelAlignedChunkClip(worldTileLeft, tile.right - tile.left, this.clipTransformA, this.clipTransformE);
          this.clips.set(clipKey, clip);
        }
        f.ctx.beginPath();
        f.ctx.rect(clip.left, -f.H * 8, clip.right - clip.left, f.H * 24);
        f.ctx.clip();
        f.ctx.translate(offset, 0);
        draw(tile, local);
        f.ctx.restore();
      }
    }
  }

  rocks(out: [number, number][] = []): [number, number][] {
    let write = 0;
    for (const id of this.visible) {
      const chunk = this.cache.chunks.get(id);
      if (!chunk) continue;
      let added = 0;
      for (const tile of chunk.tiles.values()) {
        for (const rock of tile.land.seaRocks) {
          if (added >= 4) break;
          const point = out[write] ?? [0, 0];
          point[0] = rock.x + id * REGION_WIDTH;
          point[1] = rock.y - rock.h;
          out[write++] = point;
          added++;
        }
        if (added >= 4) break;
      }
    }
    out.length = write;
    return out;
  }
}
