import { inject, Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { ChecksumService } from './checksum.service';
import {
  cloneStoredPoints,
  PersistedGameSnapshot,
  cloneStoredStates,
  createEmptyPoints,
  StoredPoints,
  StoredStateRecord,
  QuizDifficulty,
} from '../models/game-state.model';
import statesFile from '../../data/states.json';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private readonly checksumService = inject(ChecksumService);
  private readonly defaultGameMode: PersistedGameSnapshot['gameMode'] = 'classic';
  private readonly defaultDifficulty: QuizDifficulty = 'easy';

  private readonly pointsStorageKey = 'points';
  private readonly statesStorageKey = 'states';
  private readonly onboardingStorageKey = 'hasSeenOnboarding';
  private readonly gameModeStorageKey = 'gameMode';
  private readonly difficultyStorageKey = 'difficulty';
  private readonly unifiedStorageKey = 'tagspotter_v1_save_data';
  private readonly ownedStorageKeys = [
    this.statesStorageKey, 
    this.pointsStorageKey, 
    this.onboardingStorageKey,
    this.gameModeStorageKey,
    this.difficultyStorageKey,
    this.unifiedStorageKey
  ];

  private get checksumSuffix(): string {
    return '_sig';
  }

  private async setStorageItem<T>(key: string, value: T): Promise<void> {
    const dataString = JSON.stringify(value);
    const checksum = this.checksumService.generateChecksum(dataString);
    
    await Promise.all([
      Preferences.set({
        key,
        value: dataString
      }),
      Preferences.set({
        key: key + this.checksumSuffix,
        value: checksum
      })
    ]);
  }

  private async getStorageItem<T>(key: string): Promise<T | null> {
    const [{ value }, { value: checksum }] = await Promise.all([
      Preferences.get({ key }),
      Preferences.get({ key: key + this.checksumSuffix })
    ]);

    if (!value) return null;

    // Integrity Check: Protect against manual tampering
    if (!checksum || !this.checksumService.verify(value, checksum)) {
      console.warn(`Data integrity failure for key: ${key}. Data may have been tampered with.`);
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  private async removeStorageItem(key: string): Promise<void> {
    await Promise.all([
      Preferences.remove({ key }),
      Preferences.remove({ key: key + this.checksumSuffix })
    ]);
  }

  async clearStorage(): Promise<void> {
    await Promise.all(this.ownedStorageKeys.map((key) => this.removeStorageItem(key)));
  }

  async loadSnapshot(): Promise<PersistedGameSnapshot> {
    const unified = await this.getStorageItem<PersistedGameSnapshot>(this.unifiedStorageKey);

    if (unified) {
      return this.normalizeSnapshot(unified);
    }

    const snapshot = await this.loadLegacySnapshot();
    await this.saveSnapshot(snapshot);
    return snapshot;
  }

  async saveSnapshot(snapshot: PersistedGameSnapshot): Promise<void> {
    await this.setStorageItem(this.unifiedStorageKey, this.normalizeSnapshot(snapshot));
  }

  async resetSnapshot(): Promise<PersistedGameSnapshot> {
    const snapshot: PersistedGameSnapshot = {
      states: this.createSeedStates(),
      points: createEmptyPoints(),
      hasSeenOnboarding: false,
      gameMode: this.defaultGameMode,
      difficulty: this.defaultDifficulty,
    };

    await this.saveSnapshot(snapshot);
    return snapshot;
  }

  private createSeedStates(): StoredStateRecord[] {
    return cloneStoredStates(statesFile as StoredStateRecord[]);
  }

  private async loadLegacySnapshot(): Promise<PersistedGameSnapshot> {
    const [states, points, hasSeenOnboarding, gameMode, difficulty] = await Promise.all([
      this.getStorageItem<StoredStateRecord[]>(this.statesStorageKey),
      this.getStorageItem<StoredPoints>(this.pointsStorageKey),
      this.getStorageItem<boolean>(this.onboardingStorageKey),
      this.getStorageItem<string>(this.gameModeStorageKey),
      this.getStorageItem<string>(this.difficultyStorageKey),
    ]);

    return this.normalizeSnapshot({
      states: Array.isArray(states) ? states : this.createSeedStates(),
      points: points && typeof points === 'object' ? points : createEmptyPoints(),
      hasSeenOnboarding: Boolean(hasSeenOnboarding),
      gameMode: gameMode === 'trivia' ? 'trivia' : this.defaultGameMode,
      difficulty: difficulty === 'medium' || difficulty === 'hard' || difficulty === 'easy'
        ? difficulty
        : this.defaultDifficulty,
    });
  }

  private normalizeSnapshot(snapshot: PersistedGameSnapshot): PersistedGameSnapshot {
    const points = snapshot.points && typeof snapshot.points === 'object'
      ? snapshot.points
      : createEmptyPoints();

    return {
      states: cloneStoredStates(snapshot.states),
      points: cloneStoredPoints(points),
      hasSeenOnboarding: Boolean(snapshot.hasSeenOnboarding),
      gameMode: snapshot.gameMode === 'trivia' ? 'trivia' : this.defaultGameMode,
      difficulty: snapshot.difficulty === 'medium' || snapshot.difficulty === 'hard' || snapshot.difficulty === 'easy'
        ? snapshot.difficulty
        : this.defaultDifficulty,
    };
  }
}
