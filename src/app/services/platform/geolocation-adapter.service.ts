import { Injectable, InjectionToken, inject } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';

import { LocationPrecision } from '../../models/location.model';

/** Exactly the surface this app uses — see the note on the token below. */
export interface GeolocationApi {
  checkPermissions: typeof Geolocation.checkPermissions;
  requestPermissions: typeof Geolocation.requestPermissions;
  getCurrentPosition: typeof Geolocation.getCurrentPosition;
}

/**
 * The Capacitor plugin, behind a token.
 *
 * Injecting it is the only way to assert what this adapter actually asks the OS
 * for, and that assertion matters: dec-0007-coarse-location-default promises the
 * app requests coarse location unless the player opts into precise, and both the
 * Home footer and the store listing repeat that promise.
 *
 * The factory returns a plain delegating object rather than the plugin itself,
 * because the Capacitor proxy answers *any* property access with a callable —
 * including `ngOnDestroy`, which Angular then invokes while destroying an
 * injector, hitting the native bridge and throwing UNIMPLEMENTED.
 */
export const GEOLOCATION_PLUGIN = new InjectionToken<GeolocationApi>('GEOLOCATION_PLUGIN', {
  providedIn: 'root',
  factory: (): GeolocationApi => ({
    checkPermissions: (...args) => Geolocation.checkPermissions(...args),
    requestPermissions: (...args) => Geolocation.requestPermissions(...args),
    getCurrentPosition: (...args) => Geolocation.getCurrentPosition(...args),
  }),
});

@Injectable({ providedIn: 'root' })
export class GeolocationAdapterService {
  private readonly geolocation = inject(GEOLOCATION_PLUGIN);

  checkPermissions(): ReturnType<typeof Geolocation.checkPermissions> {
    return this.geolocation.checkPermissions();
  }

  requestPermissions(precision: LocationPrecision): ReturnType<typeof Geolocation.requestPermissions> {
    return this.geolocation.requestPermissions({
      permissions: precision === 'fine' ? ['location'] : ['coarseLocation'],
    });
  }

  getCurrentPosition(precision: LocationPrecision): ReturnType<typeof Geolocation.getCurrentPosition> {
    return this.geolocation.getCurrentPosition({
      enableHighAccuracy: precision === 'fine',
      maximumAge: 60_000,
      timeout: 10_000,
    });
  }
}
