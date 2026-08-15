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

  it('lets a storage failure propagate so callers can report it', async () => {
    // GameStateStore turns this into the "Couldn't save …" banner (audit F-19);
    // swallowing it here would make a failed save look like a successful one.
    plugin.set.and.rejectWith(new Error('quota exceeded'));

    await expectAsync(service.set('key', 'value')).toBeRejected();
  });
});
