import type { PortId } from '../../types';
import type { PortKit } from '../portFrame';
import { homeKit } from './home';
import { nordhavnKit } from './nordhavn';
import { miradorKit } from './mirador';
import { coralKit } from './coral';
import { southcrossKit } from './southcross';

export const KITS: Record<PortId, PortKit> = {
  home: homeKit,
  nordhavn: nordhavnKit,
  mirador: miradorKit,
  coral: coralKit,
  southcross: southcrossKit,
};
