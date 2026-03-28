import { TestBed } from '@angular/core/testing';

import { createEmptyPoints, StoredStateRecord } from '../models/game-state.model';
import statesFile from '../../data/states.json';
import { StateService } from './state.service';

describe('StateService', () => {
  let service: StateService;
  const testBed = TestBed as unknown as { inject<T>(token: unknown): T };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [StateService],
    });

    service = testBed.inject(StateService);
    spyOn<any>(service, 'getStorageItem').and.resolveTo(null);
    spyOn<any>(service, 'setStorageItem').and.resolveTo();
    spyOn<any>(service, 'removeStorageItem').and.resolveTo();
  });

  it('loads cloned seed states on first hydrate', async () => {
    const states = await service.loadStates();

    expect(states.length).toBe((statesFile as StoredStateRecord[]).length);
    expect(states[0]).not.toBe((statesFile as StoredStateRecord[])[0]);

    states[0].fnd.stateFound = true;

    expect((statesFile as StoredStateRecord[])[0].fnd.stateFound).toBeFalse();
  });

  it('loads stored progress that still contains legacy coordinates', async () => {
    (service as unknown as { getStorageItem: jasmine.Spy }).getStorageItem.and.resolveTo([
      {
        ...(statesFile as StoredStateRecord[])[0],
        fnd: {
          lat: 44,
          lng: -71,
          distance: 120,
          stateFound: true,
          questionsCorrect: 2,
        },
      },
    ]);

    const states = await service.loadStates();

    expect(states[0].fnd).toEqual({
      distance: 120,
      stateFound: true,
      questionsCorrect: 2,
    });
  });

  it('drops legacy coordinates the next time states are saved', async () => {
    const setStorageItemSpy = service as unknown as { setStorageItem: jasmine.Spy };

    await service.saveStates([
      {
        ...(statesFile as StoredStateRecord[])[0],
        fnd: {
          ...(statesFile as StoredStateRecord[])[0].fnd,
          lat: 44,
          lng: -71,
          distance: 120,
          stateFound: true,
          questionsCorrect: 2,
        } as StoredStateRecord['fnd'],
      },
    ]);

    expect(setStorageItemSpy.setStorageItem).toHaveBeenCalledWith('states', [
      {
        ...(statesFile as StoredStateRecord[])[0],
        fnd: {
          distance: 120,
          stateFound: true,
          questionsCorrect: 2,
        },
      },
    ]);
  });

  it('resets progress back to a clean snapshot', async () => {
    const resetSnapshot = await service.resetProgress();

    expect(resetSnapshot.points).toEqual(createEmptyPoints());
    expect(resetSnapshot.states.every((state) => !state.fnd.stateFound)).toBeTrue();
    expect(resetSnapshot.states.every((state) => state.fnd.distance === 0)).toBeTrue();
  });

  it('clears only app-owned keys', async () => {
    const removeStorageItemSpy = service as unknown as { removeStorageItem: jasmine.Spy };

    await service.clearStorage();

    expect(removeStorageItemSpy.removeStorageItem).toHaveBeenCalledTimes(2);
    expect(removeStorageItemSpy.removeStorageItem).toHaveBeenCalledWith('states');
    expect(removeStorageItemSpy.removeStorageItem).toHaveBeenCalledWith('points');
  });
});
