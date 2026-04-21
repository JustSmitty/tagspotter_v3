import { TestBed } from '@angular/core/testing';

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
    });

    expect((service as any).setStorageItem).toHaveBeenCalledWith('tagspotter_v1_save_data', jasmine.objectContaining({
      states: [
        jasmine.objectContaining({
          fnd: {
            distance: 120,
            stateFound: true,
            questionsCorrect: 2,
            mode: 'trivia',
            difficulty: 'hard',
          },
        }),
      ],
      hasSeenOnboarding: true,
      gameMode: 'trivia',
      difficulty: 'hard',
    }));
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
  });

  it('resets progress back to a clean canonical snapshot with a single save', async () => {
    const resetSnapshot = await service.resetSnapshot();

    expect(resetSnapshot.points).toEqual(createEmptyPoints());
    expect(resetSnapshot.states.every((state) => !state.fnd.stateFound)).toBeTrue();
    expect(resetSnapshot.states.every((state) => state.fnd.distance === 0)).toBeTrue();
    expect(resetSnapshot.hasSeenOnboarding).toBeFalse();
    expect(resetSnapshot.gameMode).toBe('classic');
    expect(resetSnapshot.difficulty).toBe('easy');
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
        });
      }
      return Promise.resolve(null);
    });

    const snapshot = await service.loadSnapshot();

    expect(snapshot.hasSeenOnboarding).toBeTrue();
    expect(snapshot.gameMode).toBe('classic');
    expect(snapshot.difficulty).toBe('easy');
    expect(snapshot.states[0].fnd.difficulty).toBeUndefined();
  });

  it('clears only app-owned keys', async () => {
    const removeStorageItemSpy = service as unknown as { removeStorageItem: jasmine.Spy };

    await service.clearStorage();

    expect((service as any).removeStorageItem).toHaveBeenCalledTimes(6);
    expect((service as any).removeStorageItem).toHaveBeenCalledWith('states');
    expect((service as any).removeStorageItem).toHaveBeenCalledWith('points');
    expect((service as any).removeStorageItem).toHaveBeenCalledWith('hasSeenOnboarding');
    expect((service as any).removeStorageItem).toHaveBeenCalledWith('gameMode');
    expect((service as any).removeStorageItem).toHaveBeenCalledWith('difficulty');
    expect((service as any).removeStorageItem).toHaveBeenCalledWith('tagspotter_v1_save_data');
  });
});
