import type { VesselSpec } from './hull3';
import type { VesselModel } from './kit';
import { buildBarkas, buildDinghy, buildKayak, buildRow } from './small';
import { buildCutter, buildYacht } from './mid';
import { buildResearch, buildSeiner, buildTrawler } from './big';

/** Собирает 3D-модель судна по его стилю. cbx — положение центра тяжести (из VesselBody) */
export function buildVessel(spec: VesselSpec, cbx: number): VesselModel {
  switch (spec.style) {
    case 'row':
      return buildRow(spec, cbx);
    case 'kayak':
      return buildKayak(spec, cbx);
    case 'dinghy':
      return buildDinghy(spec, cbx);
    case 'barkas':
      return buildBarkas(spec, cbx);
    case 'cutter':
      return buildCutter(spec, cbx);
    case 'yacht':
      return buildYacht(spec, cbx);
    case 'seiner':
      return buildSeiner(spec, cbx);
    case 'trawler':
      return buildTrawler(spec, cbx);
    default:
      return buildResearch(spec, cbx);
  }
}

export type { VesselModel } from './kit';
