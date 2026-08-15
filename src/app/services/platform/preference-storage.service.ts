import { Injectable, InjectionToken, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

/** Exactly the surface this app uses — see the note on the token below. */
export interface PreferencesApi {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}

/**
 * The Capacitor plugin, behind a token.
 *
 * Two reasons this is a narrow hand-written interface rather than
 * `typeof Preferences`:
 *
 * 1. Capacitor exposes plugins as proxy objects whose methods cannot be replaced
 *    by a spy, and a spec that quietly falls through to the real web
 *    implementation is worse than no spec — it reads green while asserting
 *    nothing. Every byte of a player's trip crosses this seam.
 * 2. **The proxy must not be handed to DI directly.** It answers *any* property
 *    access with a callable, including `ngOnDestroy`, so Angular calls it while
 *    tearing down an injector and the native bridge throws UNIMPLEMENTED. Under
 *    zone.js that surfaced as a swallowed rejection; zoneless it killed the test
 *    runner outright. Delegating through a plain object keeps DI away from it.
 */
export const PREFERENCES_PLUGIN = new InjectionToken<PreferencesApi>('PREFERENCES_PLUGIN', {
  providedIn: 'root',
  factory: (): PreferencesApi => ({
    get: (options) => Preferences.get(options),
    set: (options) => Preferences.set(options),
    remove: (options) => Preferences.remove(options),
  }),
});

@Injectable({ providedIn: 'root' })
export class PreferenceStorageService {
  private readonly preferences = inject(PREFERENCES_PLUGIN);

  async get(key: string): Promise<string | null> {
    return (await this.preferences.get({ key })).value;
  }

  async set(key: string, value: string): Promise<void> {
    await this.preferences.set({ key, value });
  }

  async remove(key: string): Promise<void> {
    await this.preferences.remove({ key });
  }
}
