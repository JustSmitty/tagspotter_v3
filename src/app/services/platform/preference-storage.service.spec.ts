import { TestBed } from '@angular/core/testing';

import { PREFERENCES_PLUGIN, PreferenceStorageService } from './preference-storage.service';

/**
 * The single seam between the app and device storage. Everything the player owns
 * passes through here, so this pins the contract the rest of the code relies on:
 * `get` returns null for a missing key, never undefined — `state.service.ts`
 * branches on exactly that to tell "never written" from "written as empty".
 */
describe('PreferenceStorageService', () => {
  let service: PreferenceStorageService;
  let plugin: { get: jasmine.Spy; set: jasmine.Spy; remove: jasmine.Spy };

  beforeEach(() => {
    plugin = {
      get: jasmine.createSpy('get').and.resolveTo({ value: null }),
      set: jasmine.createSpy('set').and.resolveTo(),
      remove: jasmine.createSpy('remove').and.resolveTo(),
    };

    TestBed.configureTestingModule({
      providers: [
        PreferenceStorageService,
        { provide: PREFERENCES_PLUGIN, useValue: plugin },
      ],
    });
    service = TestBed.inject(PreferenceStorageService);
  });

  it('unwraps the value from a get', async () => {
    plugin.get.and.resolveTo({ value: 'stored' });

    expect(await service.get('key')).toBe('stored');
    expect(plugin.get).toHaveBeenCalledWith({ key: 'key' });
  });

  it('returns null for a key that was never written', async () => {
    expect(await service.get('missing')).toBeNull();
  });

  it('passes key and value straight through on set', async () => {
    await service.set('key', 'value');

    expect(plugin.set).toHaveBeenCalledWith({ key: 'key', value: 'value' });
  });

  it('removes by key', async () => {
    await service.remove('key');

    expect(plugin.remove).toHaveBeenCalledWith({ key: 'key' });
  });

  describe('the store-screenshot seed', () => {
    const GLOBAL = '__TAGSPOTTER_SCREENSHOT_SEED__';
    const win = window as unknown as Record<string, unknown>;

    afterEach(() => {
      delete win[GLOBAL];
    });

    it('returns a seeded value without touching the device', async () => {
      win[GLOBAL] = { save: 'seeded-save' };

      expect(await service.get('save')).toBe('seeded-save');
      // The point of seeding at this seam is that the device is not consulted at
      // all — the simulator's own storage is exactly what could not be relied on.
      expect(plugin.get).not.toHaveBeenCalled();
    });

    it('falls through to real storage for a key the seed does not carry', async () => {
      win[GLOBAL] = { save: 'seeded-save' };
      plugin.get.and.resolveTo({ value: 'from-device' });

      expect(await service.get('other')).toBe('from-device');
      expect(plugin.get).toHaveBeenCalledWith({ key: 'other' });
    });

    it('still reports an unseeded, unwritten key as null', async () => {
      // state.service.ts tells "never written" from "written empty" on exactly
      // this, so the seed must not turn a missing key into something else.
      win[GLOBAL] = { save: 'seeded-save' };

      expect(await service.get('never-written')).toBeNull();
    });

    it('ignores a malformed global rather than throwing', async () => {
      // A shipped build has no global at all; this covers the injected script
      // being wrong rather than absent, which must not take the app down.
      win[GLOBAL] = 'not-an-object';
      plugin.get.and.resolveTo({ value: 'from-device' });

      expect(await service.get('save')).toBe('from-device');
    });

    it('reads the device normally when no seed is defined', async () => {
      // The production path: the global is undefined and this is a plain
      // passthrough.
      plugin.get.and.resolveTo({ value: 'from-device' });

      expect(await service.get('save')).toBe('from-device');
    });
  });

  it('lets a storage failure propagate so callers can report it', async () => {
    // GameStateStore turns this into the "Couldn't save …" banner (audit F-19);
    // swallowing it here would make a failed save look like a successful one.
    plugin.set.and.rejectWith(new Error('quota exceeded'));

    await expectAsync(service.set('key', 'value')).toBeRejected();
  });
});
