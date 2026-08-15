import { TestBed } from '@angular/core/testing';

import { GEOLOCATION_PLUGIN, GeolocationAdapterService } from './geolocation-adapter.service';

/**
 * Thin, but it encodes the privacy posture from dec-0007-coarse-location-default:
 * coarse is the default and fine is only ever requested when the player picks
 * "Precise". A regression here asks for more location than the feature needs —
 * exactly the sort of thing that never arrives as a bug report.
 */
describe('GeolocationAdapterService', () => {
  let service: GeolocationAdapterService;
  let plugin: {
    checkPermissions: jasmine.Spy;
    requestPermissions: jasmine.Spy;
    getCurrentPosition: jasmine.Spy;
  };

  beforeEach(() => {
    plugin = {
      checkPermissions: jasmine.createSpy('checkPermissions').and.resolveTo({ location: 'prompt', coarseLocation: 'prompt' }),
      requestPermissions: jasmine.createSpy('requestPermissions').and.resolveTo({ location: 'granted', coarseLocation: 'granted' }),
      getCurrentPosition: jasmine.createSpy('getCurrentPosition').and.resolveTo({ coords: { latitude: 1, longitude: 2 } }),
    };

    TestBed.configureTestingModule({
      providers: [
        GeolocationAdapterService,
        { provide: GEOLOCATION_PLUGIN, useValue: plugin },
      ],
    });
    service = TestBed.inject(GeolocationAdapterService);
  });

  it('requests only the coarse permission by default', async () => {
    await service.requestPermissions('coarse');

    expect(plugin.requestPermissions).toHaveBeenCalledWith({ permissions: ['coarseLocation'] });
  });

  it('requests fine location only when precise is chosen', async () => {
    await service.requestPermissions('fine');

    expect(plugin.requestPermissions).toHaveBeenCalledWith({ permissions: ['location'] });
  });

  it('asks for high accuracy only in precise mode, with a bounded timeout', async () => {
    await service.getCurrentPosition('coarse');
    expect(plugin.getCurrentPosition).toHaveBeenCalledWith(
      jasmine.objectContaining({ enableHighAccuracy: false, timeout: 10_000 }),
    );

    await service.getCurrentPosition('fine');
    expect(plugin.getCurrentPosition).toHaveBeenCalledWith(
      jasmine.objectContaining({ enableHighAccuracy: true, timeout: 10_000 }),
    );
  });

  it('caps how stale a reused fix may be', async () => {
    await service.getCurrentPosition('coarse');

    expect(plugin.getCurrentPosition).toHaveBeenCalledWith(jasmine.objectContaining({ maximumAge: 60_000 }));
  });

  it('passes permission checks through untouched', async () => {
    expect(await service.checkPermissions()).toEqual({ location: 'prompt', coarseLocation: 'prompt' } as never);
  });
});
