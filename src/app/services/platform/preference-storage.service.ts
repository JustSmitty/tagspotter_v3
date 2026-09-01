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

/**
 * Values injected by the store-screenshot build, keyed exactly as they would be
 * in Preferences. See `SCREENSHOT_SEED_GLOBAL` below.
 */
type ScreenshotSeed = Record<string, string>;

/**
 * The global the screenshot build defines, and nothing else ever does.
 *
 * Reading a seed here rather than writing one into the simulator's Preferences
 * is the third approach tried, and the first that does not depend on guessing how
 * iOS stores UserDefaults. Two earlier ones wrote to a plist path the app turned
 * out not to read, and both "verified" themselves green while every screenshot
 * came out of an empty save. This seam is the app's own storage boundary, so a
 * value returned from here is indistinguishable from a stored one — migration,
 * normalization and hydration all run exactly as they do for a real player.
 *
 * It is deliberately a `window` global rather than a bundled asset: the seed then
 * ships in no production build at all. The screenshot workflow injects a script
 * defining it into the built web assets, the same way it injects the route
 * helper, and `guardrail:screenshot-hooks-in-src` fails the build if either ever
 * appears in `src/index.html`. In a real build the global is undefined and the
 * branch below is dead.
 */
const SCREENSHOT_SEED_GLOBAL = '__TAGSPOTTER_SCREENSHOT_SEED__';

function readScreenshotSeed(key: string): string | null {
  // `window` is absent under SSR-style test harnesses; guard rather than assume.
  if (typeof window === 'undefined') return null;
  const seed = (window as unknown as Record<string, unknown>)[SCREENSHOT_SEED_GLOBAL];
  if (!seed || typeof seed !== 'object') return null;
  const value = (seed as ScreenshotSeed)[key];
  return typeof value === 'string' ? value : null;
}

@Injectable({ providedIn: 'root' })
export class PreferenceStorageService {
  private readonly preferences = inject(PREFERENCES_PLUGIN);

  async get(key: string): Promise<string | null> {
    // Screenshot builds only; undefined everywhere else. Checked before the
    // plugin call so a seeded key never depends on what the device happens to
    // hold, and only for keys the seed actually carries — an unseeded key still
    // falls through to real storage and still returns null when unwritten, which
    // is the distinction `state.service.ts` branches on.
    const seeded = readScreenshotSeed(key);
    if (seeded !== null) return seeded;

    return (await this.preferences.get({ key })).value;
  }

  async set(key: string, value: string): Promise<void> {
    await this.preferences.set({ key, value });
  }

  async remove(key: string): Promise<void> {
    await this.preferences.remove({ key });
  }
}
