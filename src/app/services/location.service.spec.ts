import { TestBed } from '@angular/core/testing';

import { LocationService } from './location.service';

describe('LocationService', () => {
  let service: LocationService;
  const testBed = TestBed as unknown as { inject<T>(token: unknown): T };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LocationService],
    });

    service = testBed.inject(LocationService);

    spyOn<any>(service, 'checkPermissionStatus').and.resolveTo({
      location: 'granted',
      coarseLocation: 'granted',
    });
    spyOn<any>(service, 'requestPermissionStatus').and.resolveTo({
      location: 'granted',
      coarseLocation: 'granted',
    });
    spyOn<any>(service, 'readCurrentPosition').and.resolveTo({
      coords: {
        latitude: 33,
        longitude: -86,
        accuracy: 10,
        altitudeAccuracy: null,
        altitude: null,
        speed: null,
        heading: null,
      },
      timestamp: Date.now(),
    });
  });

  it('returns coordinates when permission is granted', async () => {
    const result = await service.getCurrentLocationAccess();

    expect(result).toEqual({
      status: 'granted',
      coordinates: { lat: 33, lng: -86 },
    });
  });

  it('returns denied when permission has already been refused', async () => {
    (service as unknown as { checkPermissionStatus: jasmine.Spy }).checkPermissionStatus.and.resolveTo({
      location: 'denied',
      coarseLocation: 'denied',
    });

    const result = await service.getCurrentLocationAccess();

    expect(result).toEqual({
      status: 'denied',
      message: 'Location permission was denied.',
      errorCode: 'PERMISSION_DENIED'
    });
    expect((service as unknown as { readCurrentPosition: jasmine.Spy }).readCurrentPosition).not.toHaveBeenCalled();
  });

  it('falls back to a sanitized unavailable result when services are disabled', async () => {
    (service as unknown as { readCurrentPosition: jasmine.Spy }).readCurrentPosition.and.rejectWith(
      new Error('Location services are disabled'),
    );

    const result = await service.getCurrentLocationAccess();

    expect(result).toEqual({
      status: 'unavailable',
      message: 'Location services are unavailable.',
      errorCode: 'UNAVAILABLE'
    });
  });

  it('reuses cached coordinates during the cache window', async () => {
    await service.getCurrentLocationAccess();
    await service.getCurrentLocationAccess();

    expect((service as unknown as { readCurrentPosition: jasmine.Spy }).readCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('passes the requested precision through to the position read', async () => {
    const readSpy = service as unknown as { readCurrentPosition: jasmine.Spy };

    await service.getCurrentLocationAccess('fine');

    expect(readSpy.readCurrentPosition).toHaveBeenCalledWith('fine');
  });

  it('does not reuse a coarse cache for a precise request', async () => {
    const readSpy = (service as unknown as { readCurrentPosition: jasmine.Spy }).readCurrentPosition;

    await service.getCurrentLocationAccess('coarse');
    await service.getCurrentLocationAccess('fine');

    expect(readSpy).toHaveBeenCalledTimes(2);
  });

  it('reuses a precise cache to satisfy a coarse request', async () => {
    const readSpy = (service as unknown as { readCurrentPosition: jasmine.Spy }).readCurrentPosition;

    await service.getCurrentLocationAccess('fine');
    await service.getCurrentLocationAccess('coarse');

    expect(readSpy).toHaveBeenCalledTimes(1);
  });
});
