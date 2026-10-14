import type { EngineView } from "./frame";

/** Shared pose for the two 2D fishermen and the rod overlaid on a 3D boat. */
export function fishingRodPose(e: Pick<EngineView, "phase" | "power" | "castT" | "hooked">, t: number) {
  let angle = -0.85, bend = 0;
  switch (e.phase) {
    case "charging": angle -= e.power * 1.3; break;
    case "casting": angle = -2.1 + Math.min(1, e.castT * 3) * 1.6; break;
    case "sinking": case "waiting": angle = -0.55 + Math.sin(t * 1.3) * 0.03; break;
    case "bite": angle = -0.45 + Math.sin(t * 30) * 0.04; bend = 0.25; break;
    case "fight": {
      const m = e.hooked?.motion;
      angle = -0.95 - (m?.reelInput ?? 0) * 0.18 + (m?.rodSide ?? 0) * 0.22;
      bend = m?.rodBend ?? 0;
      break;
    }
    case "caught": angle = -1.1; break;
  }
  return { angle, bend };
}
