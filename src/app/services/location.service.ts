import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import type { PermissionState } from '@capacitor/core';

import { Coordinates } from '../models/location.model';

interface CachedCoordinates {
  coordinates: Coordinates;
  expiresAt: number;
}

export type LocationAccessResult =
  | {
      status: 'granted';
      coordinates: Coordinates;
    }
  | {
      status: 'denied' | 'unavailable' | 'error';
      message: string;
    };

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly cacheTtlMs = 60_000;
  private cachedCoordinates: CachedCoordinates | null = null;

  async getCurrentLocationAccess(): Promise<LocationAccessResult> {
    const now = Date.now();

    if (this.cachedCoordinates && this.cachedCoordinates.expiresAt > now) {
      return {
        status: 'granted',
        coordinates: this.cachedCoordinates.coordinates,
      };
    }

    const permissionState = await this.resolvePermissionState();

    if (permissionState === 'denied') {
      return {
        status: 'denied',
        message: 'Location permission was denied.',
      };
    }

    try {
      const position = await this.readCurrentPosition();
      const coordinates = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      this.cachedCoordinates = {
        coordinates,
        expiresAt: now + this.cacheTtlMs,
      };

      return {
        status: 'granted',
        coordinates,
      };
    } catch (error) {
      return this.classifyLocationError(error);
    }
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

  private async resolvePermissionState(): Promise<PermissionState | 'unknown'> {
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
      const requested = await this.requestPermissionStatus();

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
      };
    }

    if (normalizedMessage.includes('disabled') || normalizedMessage.includes('unavailable')) {
      return {
        status: 'unavailable',
        message: 'Location services are unavailable.',
      };
    }

    return {
      status: 'error',
      message: 'Distance bonus is unavailable right now.',
    };
  }

  private async checkPermissionStatus(): Promise<Awaited<ReturnType<typeof Geolocation.checkPermissions>>> {
    return Geolocation.checkPermissions();
  }

  private async requestPermissionStatus(): Promise<Awaited<ReturnType<typeof Geolocation.requestPermissions>>> {
    return Geolocation.requestPermissions({
      permissions: ['coarseLocation'],
    });
  }

  private async readCurrentPosition(): Promise<Awaited<ReturnType<typeof Geolocation.getCurrentPosition>>> {
    return Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      maximumAge: this.cacheTtlMs,
      timeout: 10_000,
    });
  }
}
