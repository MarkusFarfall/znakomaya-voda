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
interface CachedFrame extends Frame {
  __source: Frame;
  __offset: number;
}
export class AquatoryStream {
  private cache = new ChunkWindow<TerrainChunk>();
  private visible: number[] = [];
  private frames = new Map<number, CachedFrame>();
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
    for (const id of plan.resident) {
      const c = this.cache.chunks.get(id)!,
        local = this.frame(f, id);
      c.land.build(local);
      c.bed.build(local);
    }
  }
  draw(f: Frame, draw: (chunk: TerrainChunk, local: Frame) => void) {
    for (const id of this.visible) {
      const c = this.cache.chunks.get(id);
      if (!c) continue;
      const offset = id * REGION_WIDTH,
        local = this.frame(f, id);
      f.ctx.save();
      const tr = f.ctx.getTransform();
      const left = (Math.round(offset * tr.a + tr.e) - tr.e) / tr.a;
      const right = (Math.round((offset + REGION_WIDTH) * tr.a + tr.e) - tr.e) / tr.a;
      f.ctx.beginPath();
      f.ctx.rect(left, -f.H * 8, right - left, f.H * 24);
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
