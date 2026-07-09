import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import type { PermissionState } from '@capacitor/core';

import { Coordinates, DEFAULT_LOCATION_PRECISION, LocationPrecision } from '../models/location.model';

interface CachedCoordinates {
  coordinates: Coordinates;
  expiresAt: number;
  precision: LocationPrecision;
}

export type LocationErrorCode = 'PERMISSION_DENIED' | 'UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN';

export type LocationAccessResult =
  | {
      status: 'granted';
      coordinates: Coordinates;
    }
  | {
      status: 'denied' | 'unavailable' | 'error';
      message: string;
      isPermanent?: boolean;
      errorCode: LocationErrorCode;
    };

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly cacheTtlMs = 60_000;
  private cachedCoordinates: CachedCoordinates | null = null;

  async getCurrentLocationAccess(precision: LocationPrecision = DEFAULT_LOCATION_PRECISION): Promise<LocationAccessResult> {
    const now = Date.now();

    // A cached fix is reusable only if it was captured at the same (or higher)
    // accuracy: a precise fix can satisfy a coarse request, but not vice versa.
    if (this.cachedCoordinates && this.cachedCoordinates.expiresAt > now && this.isCacheReusable(this.cachedCoordinates.precision, precision)) {
      return {
        status: 'granted',
        coordinates: this.cachedCoordinates.coordinates,
      };
    }

    const permissionState = await this.resolvePermissionState(precision);

    if (permissionState === 'denied') {
      return {
        status: 'denied',
        message: 'Location permission was denied.',
        errorCode: 'PERMISSION_DENIED'
      };
    }

    try {
      const position = await this.readCurrentPosition(precision);
      const coordinates = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      this.cachedCoordinates = {
        coordinates,
        expiresAt: now + this.cacheTtlMs,
        precision,
      };

      return {
        status: 'granted',
        coordinates,
      };
    } catch (error) {
      return this.classifyLocationError(error);
    }
  }

  private isCacheReusable(cachedPrecision: LocationPrecision, requestedPrecision: LocationPrecision): boolean {
    return cachedPrecision === requestedPrecision || cachedPrecision === 'fine';
  }

  calculateDistanceMiles(origin: Coordinates, destination: Coordinates): number {
    const earthRadiusKm = 6371;
    const dLat = this.toRadians(destination.lat - origin.lat);
    const dLng = this.toRadians(destination.lng - origin.lng);
    const lat1 = this.toRadians(origin.lat);
    const lat2 = this.toRadians(destination.lat);
    const haversine =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

    return earthRadiusKm * arc * 0.621371;
  }

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }

  private async resolvePermissionState(precision: LocationPrecision): Promise<PermissionState | 'unknown'> {
    try {
      const current = await this.checkPermissionStatus();
      const currentState = this.getBestPermissionState(current.location, current.coarseLocation);

      if (currentState === 'granted' || currentState === 'denied') {
        return currentState;
      }
    } catch {
      return 'unknown';
    }

    try {
      const requested = await this.requestPermissionStatus(precision);

      return this.getBestPermissionState(requested.location, requested.coarseLocation);
    } catch {
      return 'unknown';
    }
  }

  private getBestPermissionState(location: PermissionState, coarseLocation: PermissionState): PermissionState {
    if (location === 'granted' || coarseLocation === 'granted') {
      return 'granted';
    }

    if (location === 'denied' || coarseLocation === 'denied') {
      return 'denied';
    }

    if (location === 'prompt-with-rationale' || coarseLocation === 'prompt-with-rationale') {
      return 'prompt-with-rationale';
    }

    return 'prompt';
  }

  private classifyLocationError(error: unknown): LocationAccessResult {
    const message = error instanceof Error ? error.message : String(error);
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes('permission') || normalizedMessage.includes('denied')) {
      return {
        status: 'denied',
        message: 'Location permission was denied.',
        isPermanent: normalizedMessage.includes('permanent') || normalizedMessage.includes('settings'),
        errorCode: 'PERMISSION_DENIED'
      };
    }

    if (normalizedMessage.includes('disabled') || normalizedMessage.includes('unavailable')) {
      return {
        status: 'unavailable',
        message: 'Location services are unavailable.',
        errorCode: 'UNAVAILABLE'
      };
    }

    if (normalizedMessage.includes('timeout')) {
      return {
        status: 'error',
        message: 'Location request timed out.',
        errorCode: 'TIMEOUT'
      };
    }

    return {
      status: 'error',
      message: 'Distance bonus is unavailable right now.',
      errorCode: 'UNKNOWN'
    };
  }

  private async checkPermissionStatus(): Promise<Awaited<ReturnType<typeof Geolocation.checkPermissions>>> {
    return Geolocation.checkPermissions();
  }

  private async requestPermissionStatus(
    precision: LocationPrecision,
  ): Promise<Awaited<ReturnType<typeof Geolocation.requestPermissions>>> {
    // Requesting 'location' surfaces the OS precise/approximate toggle; requesting
    // only 'coarseLocation' keeps the prompt to approximate accuracy.
    return Geolocation.requestPermissions({
      permissions: precision === 'fine' ? ['location'] : ['coarseLocation'],
    });
  }

  private async readCurrentPosition(
    precision: LocationPrecision,
  ): Promise<Awaited<ReturnType<typeof Geolocation.getCurrentPosition>>> {
    return Geolocation.getCurrentPosition({
      enableHighAccuracy: precision === 'fine',
      maximumAge: this.cacheTtlMs,
      timeout: 10_000,
    });
  }
}
