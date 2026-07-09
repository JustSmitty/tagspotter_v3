import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';

import { PersistedGameSnapshot, createEmptyPoints, StoredStateRecord } from '../models/game-state.model';
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

    // The standalone onboarding flag is read/written via the raw preference
    // helpers; back them with an isolated in-memory store so tests stay
    // deterministic and independent of the browser's localStorage.
    const preferenceStore = new Map<string, string>();
    spyOn<any>(service, 'getPreference').and.callFake(async (key: string) => preferenceStore.get(key) ?? null);
    spyOn<any>(service, 'setPreference').and.callFake(async (key: string, value: string) => {
      preferenceStore.set(key, value);
    });
  });

  it('loads cloned seed states on first hydrate', async () => {
    const snapshot = await service.loadSnapshot();
    const states = snapshot.states;

    expect(states.length).toBe((statesFile as StoredStateRecord[]).length);
    expect(states[0]).not.toBe((statesFile as StoredStateRecord[])[0]);
    expect(snapshot.gameMode).toBe('classic');
    expect(snapshot.difficulty).toBe('easy');

    states[0].fnd.stateFound = true;

    expect((statesFile as StoredStateRecord[])[0].fnd.stateFound).toBeFalse();
  });

  it('loads stored progress that still contains legacy coordinates', async () => {
    (service as unknown as { getStorageItem: jasmine.Spy }).getStorageItem.and.callFake((key: string) => {
      if (key === 'states') {
        return Promise.resolve([
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
      }
      return Promise.resolve(null);
    });

    const snapshot = await service.loadSnapshot();
    const states = snapshot.states;

    expect(states[0].fnd).toEqual(jasmine.objectContaining({
      distance: 120,
      stateFound: true,
      questionsCorrect: 2,
    }));
    expect(states[0].FamousLandmark).toBe((statesFile as StoredStateRecord[])[0].FamousLandmark);
    expect(states.length).toBe((statesFile as StoredStateRecord[]).length);
  });

  it('drops legacy coordinates but preserves mode and difficulty on save', async () => {
    await service.saveSnapshot({
      states: [
        {
          ...(statesFile as StoredStateRecord[])[0],
          fnd: {
            ...(statesFile as StoredStateRecord[])[0].fnd,
            lat: 44,
            lng: -71,
            distance: 120,
            stateFound: true,
            questionsCorrect: 2,
            mode: 'trivia',
            difficulty: 'hard',
          } as StoredStateRecord['fnd'],
        },
      ],
      points: createEmptyPoints(),
      hasSeenOnboarding: true,
      gameMode: 'trivia',
      difficulty: 'hard',
      tripHistory: [],
    });

    expect((service as any).setStorageItem).toHaveBeenCalledWith('tagspotter_v1_save_data', jasmine.objectContaining({
      states: jasmine.arrayContaining([
        jasmine.objectContaining({
          ID: (statesFile as StoredStateRecord[])[0].ID,
          fnd: {
            distance: 120,
            stateFound: true,
            questionsCorrect: 2,
            mode: 'trivia',
            difficulty: 'hard',
          },
        }),
      ]),
      hasSeenOnboarding: true,
      gameMode: 'trivia',
      difficulty: 'hard',
    }));

    // Seed metadata must not be persisted; it is re-merged from states.json on load.
    const savedSnapshot = (service as any).setStorageItem.calls.mostRecent().args[1];
    expect(Object.keys(savedSnapshot.states[0]).sort()).toEqual(['ID', 'fnd']);
  });

  it('round-trips progress through a slim persisted snapshot', async () => {
    // Simulate loading the slim shape that saveSnapshot now writes.
    (service as unknown as { getStorageItem: jasmine.Spy }).getStorageItem.and.callFake((key: string) => {
      if (key === 'tagspotter_v1_save_data') {
        return Promise.resolve({
          states: [
            { ID: 1, fnd: { distance: 210, stateFound: true, questionsCorrect: 2, mode: 'trivia', difficulty: 'medium' } },
          ],
          points: { state: 1, question: 2, distance: 1 },
          hasSeenOnboarding: true,
          gameMode: 'trivia',
          difficulty: 'medium',
          tripHistory: [],
        });
      }
      return Promise.resolve(null);
    });

    const snapshot = await service.loadSnapshot();
    const alabama = snapshot.states.find((state) => state.ID === 1);

    expect(alabama?.fnd).toEqual(jasmine.objectContaining({ distance: 210, stateFound: true, questionsCorrect: 2 }));
    // Seed metadata is restored from states.json even though it was not persisted.
    expect(alabama?.Name).toBe((statesFile as StoredStateRecord[])[0].Name);
    expect(alabama?.FamousLandmark).toBe((statesFile as StoredStateRecord[])[0].FamousLandmark);
    expect(snapshot.states.length).toBe((statesFile as StoredStateRecord[]).length);
  });

  it('round-trips a canonical snapshot without dropping metadata', async () => {
    const storedSnapshot: PersistedGameSnapshot = {
      states: [
        {
          ...(statesFile as StoredStateRecord[])[0],
          fnd: {
            distance: 500,
            stateFound: true,
            questionsCorrect: 3,
            mode: 'trivia',
            difficulty: 'medium',
          },
        },
      ],
      points: { state: 1, question: 3, distance: 2 },
      hasSeenOnboarding: true,
      gameMode: 'trivia',
      difficulty: 'medium',
      tripHistory: [
        {
          id: 'trip-1',
          completedAt: '2026-07-05T12:00:00.000Z',
          foundCount: 12,
          totalStates: 51,
          finalScore: 30,
          miles: 1200,
          triviaCorrect: 18,
        },
      ],
    };
    (service as unknown as { getStorageItem: jasmine.Spy }).getStorageItem.and.callFake((key: string) => {
      if (key === 'tagspotter_v1_save_data') {
        return Promise.resolve(storedSnapshot);
      }
      return Promise.resolve(null);
    });

    const loaded = await service.loadSnapshot();

    expect(loaded.points).toEqual(storedSnapshot.points);
    expect(loaded.hasSeenOnboarding).toBeTrue();
    expect(loaded.gameMode).toBe('trivia');
    expect(loaded.difficulty).toBe('medium');
    expect(loaded.states[0].fnd.mode).toBe('trivia');
    expect(loaded.states[0].fnd.difficulty).toBe('medium');
    expect(loaded.tripHistory[0]).toEqual(storedSnapshot.tripHistory[0]);
  });

  it('resets progress back to a clean canonical snapshot with a single save', async () => {
    const resetSnapshot = await service.resetSnapshot();

    expect(resetSnapshot.points).toEqual(createEmptyPoints());
    expect(resetSnapshot.states.every((state) => !state.fnd.stateFound)).toBeTrue();
    expect(resetSnapshot.states.every((state) => state.fnd.distance === 0)).toBeTrue();
    expect(resetSnapshot.hasSeenOnboarding).toBeFalse();
    expect(resetSnapshot.gameMode).toBe('classic');
    expect(resetSnapshot.difficulty).toBe('easy');
    expect(resetSnapshot.tripHistory).toEqual([]);
    expect((service as any).setStorageItem).toHaveBeenCalledTimes(1);
  });

  it('falls back to defaults when canonical metadata is partial or invalid', async () => {
    (service as unknown as { getStorageItem: jasmine.Spy }).getStorageItem.and.callFake((key: string) => {
      if (key === 'tagspotter_v1_save_data') {
        return Promise.resolve({
          states: [
            {
              ...(statesFile as StoredStateRecord[])[0],
              fnd: {
                distance: 99,
                stateFound: true,
                questionsCorrect: 1,
                difficulty: 'legendary',
              },
            },
          ],
          points: { state: 1, question: 1, distance: 0 },
          hasSeenOnboarding: 'yes',
          gameMode: 'arcade',
          difficulty: 'legendary',
          tripHistory: 'old trips',
        });
      }
      return Promise.resolve(null);
    });

    const snapshot = await service.loadSnapshot();

    expect(snapshot.hasSeenOnboarding).toBeTrue();
    expect(snapshot.gameMode).toBe('classic');
    expect(snapshot.difficulty).toBe('easy');
    expect(snapshot.states[0].fnd.difficulty).toBeUndefined();
    expect(snapshot.tripHistory).toEqual([]);
  });

  it('clears only app-owned keys', async () => {
    const removeStorageItemSpy = service as unknown as { removeStorageItem: jasmine.Spy };

    await service.clearStorage();

    expect((service as any).removeStorageItem).toHaveBeenCalledTimes(9);
    expect((service as any).removeStorageItem).toHaveBeenCalledWith('states');
    expect((service as any).removeStorageItem).toHaveBeenCalledWith('points');
    expect((service as any).removeStorageItem).toHaveBeenCalledWith('hasSeenOnboarding');
    expect((service as any).removeStorageItem).toHaveBeenCalledWith('gameMode');
    expect((service as any).removeStorageItem).toHaveBeenCalledWith('difficulty');
    expect((service as any).removeStorageItem).toHaveBeenCalledWith('tagspotter_v1_save_data');
    expect((service as any).removeStorageItem).toHaveBeenCalledWith('tagspotter_v1_onboarding_seen');
    expect((service as any).removeStorageItem).toHaveBeenCalledWith('tagspotter_v1_location_precision');
  });

  it('defaults location precision to coarse and round-trips a saved value', async () => {
    expect(await service.getLocationPrecision()).toBe('coarse');

    await service.setLocationPrecision('fine');
    expect(await service.getLocationPrecision()).toBe('fine');

    await service.setLocationPrecision('coarse');
    expect(await service.getLocationPrecision()).toBe('coarse');
  });

  it('encrypts and decrypts storage values correctly preserving integrity', async () => {
    const realService = TestBed.runInInjectionContext(() => new StateService());
    
    const mockStorage = new Map<string, string>();
    spyOn<any>(realService, 'setPreference').and.callFake(async (key: string, value: string) => {
      mockStorage.set(key, value);
    });
    spyOn<any>(realService, 'getPreference').and.callFake(async (key: string) => {
      return mockStorage.get(key) || null;
    });

    const testData = { foo: 'bar', count: 42 };
    await (realService as any).setStorageItem('test_key', testData);
    
    const rawStored = mockStorage.get('test_key');
    expect(rawStored).toBeTruthy();
    expect(rawStored?.startsWith('{')).toBeFalse();

    const loadedData = await (realService as any).getStorageItem('test_key');
    expect(loadedData).toEqual(testData);
  });
});
