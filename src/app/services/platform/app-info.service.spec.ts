import { TestBed } from '@angular/core/testing';

import packageJson from '../../../../package.json';
import { APP_INFO_PLUGIN, AppInfoApi, AppInfoService } from './app-info.service';

describe('AppInfoService', () => {
  function setup(getInfo: AppInfoApi['getInfo']): AppInfoService {
    TestBed.configureTestingModule({
      providers: [{ provide: APP_INFO_PLUGIN, useValue: { getInfo } satisfies AppInfoApi }],
    });
    return TestBed.inject(AppInfoService);
  }

  it('prints a device build as "versionName (versionCode)"', async () => {
    const service = setup(() =>
      Promise.resolve({ name: 'Tag Spotter', id: 'io.tagspotter.app', version: '1.2.0', build: '5' }));

    await service.loaded;

    expect(service.versionLabel()).toBe('1.2.0 (5)');
  });

  it('falls back to the packaged version where getInfo has no implementation', async () => {
    const service = setup(() => Promise.reject(new Error('Not implemented on web.')));

    await service.loaded;

    expect(service.versionLabel()).toBe(`${packageJson.version} (web)`);
  });

  it('carries the fallback from the start, so the label is never blank while the device answers', () => {
    const service = setup(() => new Promise<never>(() => {
      // Never settles — the label must already be readable.
    }));

    expect(service.versionLabel()).toBe(`${packageJson.version} (web)`);
  });
});
