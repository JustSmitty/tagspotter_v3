export interface Coordinates {
	lat: number;
	lng: number;
}

/**
 * User-selectable location accuracy.
 * - 'coarse': approximate (network) location — privacy/battery friendly.
 * - 'fine': precise (GPS) location — exact mileage.
 */
export type LocationPrecision = 'coarse' | 'fine';

export const DEFAULT_LOCATION_PRECISION: LocationPrecision = 'coarse';