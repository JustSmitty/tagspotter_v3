import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { App } from '@capacitor/app';

import packageJson from '../../../../package.json';

/** Exactly the surface this app uses — see the note on the token below. */
export interface AppInfoApi {
  getInfo: typeof App.getInfo;
}

/**
 * The Capacitor plugin, behind a token.
 *
 * Same two reasons as PREFERENCES_PLUGIN: the proxy's methods cannot be
 * replaced by a spy, and the proxy itself must never be handed to DI — it
 * answers *any* property access with a callable, `ngOnDestroy` included, so
 * Angular would call into the native bridge during injector teardown.
 */
export const APP_INFO_PLUGIN = new InjectionToken<AppInfoApi>('APP_INFO_PLUGIN', {
  providedIn: 'root',
  factory: (): AppInfoApi => ({
    getInfo: (...args) => App.getInfo(...args),
  }),
});

@Injectable({ providedIn: 'root' })
export class AppInfoService {
  private readonly appInfoPlugin = inject(APP_INFO_PLUGIN);

  /*
   * The web fallback imports the version straight from package.json — the same
   * field guardrail:version-parity treats as the source of truth — so there is
   * no second copy for scripts/bump-version.mjs to move. A default import
   * rather than `import { version }`: the Karma pipeline's webpack build
   * refuses named imports from JSON modules.
   */
  private readonly label = signal(`${packageJson.version} (web)`);

  /**
   * "versionName (versionCode)" once the device has answered — e.g. "1.2.0 (5)"
   * — and "package.json version (web)" before then and everywhere getInfo has
   * no implementation. Two store builds can share a versionName, so the build
   * number is the only part a bug report can be pinned to.
   */
  readonly versionLabel = this.label.asReadonly();

  /** Settles when the native answer (or the web fallback) is final. */
  readonly loaded: Promise<void>;

  constructor() {
    this.loaded = this.load();
  }

  private async load(): Promise<void> {
    try {
      const info = await this.appInfoPlugin.getInfo();
      this.label.set(`${info.version} (${info.build})`);
    } catch {
      // getInfo rejects on the web ("Not implemented on web."), where the
      // signal already carries the packaged version — nothing to repair.
    }
  }
}
