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
export class AquatoryStream {
  private cache = new ChunkWindow<TerrainChunk>();
  private visible: number[] = [];
  get residentIds() {
    return [...this.cache.chunks.keys()];
  }
  private frame(f: Frame, index: number): Frame {
    const offset = index * REGION_WIDTH;
    return {
      ...f,
      W: REGION_WIDTH,
      worldWidth: f.W,
      chunkOffset: offset,
      spot: waterRegions(f.loc.id)[index],
      viewLeft: Math.max(0, (f.viewLeft ?? 0) - offset),
      sunX: f.sunX - offset,
      moonX: f.moonX - offset,
      waveY: (x) => f.waveY(x + offset),
      bedDepth: (x) => waterBedAt(f.loc.id, x + offset),
    };
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
      const tr = f.ctx.getTransform(),
        snap = (x: number) => (Math.round(x * tr.a + tr.e) - tr.e) / tr.a;
      const left = snap(offset),
        right = snap(offset + REGION_WIDTH);
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
