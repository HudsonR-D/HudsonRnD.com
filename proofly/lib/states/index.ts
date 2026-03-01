import { CO } from './CO';
import { TX } from './TX';
import { NY } from './NY';
import { FL } from './FL';
import { CA } from './CA';
import { StateConfig } from './schema';

// To add a new state: create lib/states/XX.ts and add it here. That's it.
const STATES: Record<string, StateConfig> = {
  CO,
  TX,
  NY,
  FL,
  CA,
};

export function getState(code: string): StateConfig {
  const s = STATES[code];
  if (!s) throw new Error(`State "${code}" is not configured`);
  return s;
}

export function getLiveStates(): StateConfig[] {
  return Object.values(STATES).filter(s => s.status === 'live');
}

export function getAllStates(): StateConfig[] {
  return Object.values(STATES);
}
