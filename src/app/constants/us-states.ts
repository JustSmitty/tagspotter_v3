import { StateRegion } from '../models/game-state.model';

export const US_REGIONS: Record<StateRegion, string[]> = {
  northeast: ['CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA'],
  south: ['AL', 'AR', 'DE', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV', 'DC'],
  midwest: ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'],
  west: ['AK', 'AZ', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'NM', 'OR', 'UT', 'WA', 'WY']
};

export function getStateRegion(code: string): StateRegion {
  if (US_REGIONS.northeast.includes(code)) return 'northeast';
  if (US_REGIONS.south.includes(code)) return 'south';
  if (US_REGIONS.midwest.includes(code)) return 'midwest';
  return 'west';
}
