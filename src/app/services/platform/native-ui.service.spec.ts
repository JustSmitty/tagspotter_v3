import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { ImpactStyle } from '@capacitor/haptics';

import { NativeUiService } from './native-ui.service';

/**
 * Scope note: Capacitor exposes StatusBar and Haptics as proxy objects whose
 * methods cannot be replaced by a spy, so the on-device branches are not
 * reachable from a spec without injecting each plugin behind a token — churn
 * that would buy very little, since those branches are one plugin call each.
 *
 * What is worth pinning, and is pinned here, is the web branch: the app runs in
 * a browser during development and in every spec, and none of these cosmetic
 * calls may throw into the caller or reach a plugin that is not implemented.
 * GeolocationAdapterService does get the token treatment, because what it asks
 * the OS for is a privacy promise rather than a cosmetic detail.
 */
describe('NativeUiService', () => {
  let service: NativeUiService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [NativeUiService] });
    service = TestBed.inject(NativeUiService);
  });

  it('reports the platform it is running on', () => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);

    expect(service.isNative()).toBeFalse();
  });

  describe('on the web', () => {
    beforeEach(() => spyOn(Capacitor, 'isNativePlatform').and.returnValue(false));

    it('skips status bar configuration rather than calling an unimplemented plugin', async () => {
      await expectAsync(service.configureStatusBar()).toBeResolved();
    });

    it('skips haptics', async () => {
      await expectAsync(service.impact(ImpactStyle.Heavy)).toBeResolved();
    });

    it('reports that app settings cannot be opened', async () => {
      expect(await service.openAppSettings()).toBeFalse();
    });
  });
});
