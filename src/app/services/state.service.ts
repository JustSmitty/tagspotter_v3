import { inject, Injectable } from '@angular/core';
import {
  ChallengeStreak,
  cloneStoredPoints,
  PersistedGameSnapshot,
  cloneStoredStates,
  createEmptyPoints,
  createEmptyStreak,
  normalizeStreak,
  StoredPoints,
  StoredStateRecord,
  QuizDifficulty,
  TripHistoryEntry,
} from '../models/game-state.model';
import { DEFAULT_LOCATION_PRECISION, LocationPrecision } from '../models/location.model';
import statesFile from '../../data/states.json';
import { PreferenceStorageService } from './platform/preference-storage.service';
import { QuizSessionRepository } from './quiz-session.repository';
import { LegacySaveReaderService } from './legacy-save-reader.service';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private readonly preferences = inject(PreferenceStorageService);
  private readonly quizSessions = inject(QuizSessionRepository);
  private readonly legacySaves = inject(LegacySaveReaderService);
  private readonly defaultGameMode: PersistedGameSnapshot['gameMode'] = 'classic';
  private readonly defaultDifficulty: QuizDifficulty = 'easy';

  private readonly pointsStorageKey = 'points';
  private readonly statesStorageKey = 'states';
  private readonly onboardingStorageKey = 'hasSeenOnboarding';
  private readonly gameModeStorageKey = 'gameMode';
  private readonly difficultyStorageKey = 'difficulty';
  private readonly unifiedStorageKey = 'tagspotter_v1_save_data';
  // The onboarding flag is stored on its own, outside the main save
  // blob, so that losing or corrupting the save (which triggers a fresh reset)
  // does not make the handbook pop up again for a returning player. Users can
  // still re-open the handbook manually via the header help pin.
  private readonly onboardingSeenKey = 'tagspotter_v1_onboarding_seen';
  // Location accuracy is a device/privacy preference, stored on its own (outside
  // the game save) so it persists across trip resets and save corruption.
  private readonly locationPrecisionKey = 'tagspotter_v1_location_precision';
  private get checksumSuffix(): string {
    return '_sig';
  }

  /**
   * Saves are stored as plain JSON. The previous AES-GCM envelope used a key
   * derived from constants that shipped in the bundle, so it never protected
   * anything (audit F-20, dec-0009) — it only cost a key-derivation round-trip
   * on every write. Blobs written by older builds are still readable via
   * LegacySaveReaderService and are migrated forward on first load.
   */
  private async setStorageItem<T>(key: string, value: T): Promise<void> {
    await this.setPreference(key, JSON.stringify(value));
    // Drop the detached signature the pre-v2 format kept in a sibling key.
    try {
      await this.removePreference(key + this.checksumSuffix);
    } catch {
      // A stale legacy signature is harmless once the current value is stored.
    }
  }

  private async getStorageItem<T>(key: string): Promise<T | null> {
    const value = await this.getPreference(key);

    if (!value) return null;

    try {
      const result = await this.legacySaves.read<T>(value);

      if (result.kind === 'legacy') {
        // Rewrite in the current format so this device only pays the migration
        // cost once, and the legacy path stops being reachable for it.
        await this.setStorageItem(key, result.value);
      }

      return result.value;
    } catch (err) {
      console.warn(`Failed to read storage item for key: ${key}:`, err);
      return null;
    }
  }

  private async removeStorageItem(key: string): Promise<void> {
    await Promise.all([
      this.removePreference(key),
      this.removePreference(key + this.checksumSuffix)
    ]);
  }

  protected async setPreference(key: string, value: string): Promise<void> {
    await this.preferences.set(key, value);
  }

  protected async getPreference(key: string): Promise<string | null> {
    return this.preferences.get(key);
  }

  protected async removePreference(key: string): Promise<void> {
    await this.preferences.remove(key);
  }

  async loadSnapshot(): Promise<PersistedGameSnapshot> {
    const [unified, standaloneOnboarding] = await Promise.all([
      this.getStorageItem<PersistedGameSnapshot>(this.unifiedStorageKey),
      this.getOnboardingSeen(),
    ]);

    if (unified) {
      const normalized = this.normalizeSnapshot(unified);
      // The blob and the standalone flag are written together, so when the blob
      // is present it is authoritative. Keep the standalone mirror in sync,
      // which also migrates pre-existing saves that never wrote it.
      if (standaloneOnboarding !== normalized.hasSeenOnboarding) {
        await this.setOnboardingSeen(normalized.hasSeenOnboarding);
      }
      return normalized;
    }

    // No unified blob (first launch, or a corrupted/tampered save that failed
    // integrity checks). Preserve the standalone onboarding flag so returning
    // players are not re-shown the handbook after a data reset.
    const snapshot = await this.loadLegacySnapshot();
    const restored = { ...snapshot, hasSeenOnboarding: standaloneOnboarding ?? snapshot.hasSeenOnboarding };
    await this.saveSnapshot(restored);
    await this.clearLegacyKeys();
    return restored;
  }

  private async clearLegacyKeys(): Promise<void> {
    const legacyKeys = [
      this.statesStorageKey,
      this.pointsStorageKey,
      this.onboardingStorageKey,
      this.gameModeStorageKey,
      this.difficultyStorageKey,
    ];
    await Promise.all(legacyKeys.map((key) => this.removeStorageItem(key)));
  }

  async saveSnapshot(snapshot: PersistedGameSnapshot): Promise<void> {
    const normalized = this.normalizeSnapshot(snapshot);
    // Seed data (names, coordinates, trivia facts) ships in states.json and is
    // re-merged on load, so only per-state progress needs to be persisted.
    // This keeps the stored payload roughly 10x smaller per save. Loading
    // remains backward compatible: full legacy blobs also carry ID + fnd.
    const slimSnapshot = {
      ...normalized,
      states: normalized.states.map((state) => ({ ID: state.ID, fnd: state.fnd })),
    };
    await Promise.all([
      this.setStorageItem(this.unifiedStorageKey, slimSnapshot),
      this.setOnboardingSeen(normalized.hasSeenOnboarding),
    ]);
  }

  /**
   * Reads the standalone onboarding flag. Returns null when the key has never
   * been written, which lets callers fall back to (and migrate from) the value
   * embedded in the legacy save blob.
   */
  private async getOnboardingSeen(): Promise<boolean | null> {
    const value = await this.getPreference(this.onboardingSeenKey);
    if (value === null) {
      return null;
    }
    return value === 'true';
  }

  private async setOnboardingSeen(hasSeenOnboarding: boolean): Promise<void> {
    await this.setPreference(this.onboardingSeenKey, hasSeenOnboarding ? 'true' : 'false');
  }

  async getLocationPrecision(): Promise<LocationPrecision> {
    const value = await this.getPreference(this.locationPrecisionKey);
    return value === 'fine' ? 'fine' : DEFAULT_LOCATION_PRECISION;
  }

  async setLocationPrecision(precision: LocationPrecision): Promise<void> {
    await this.setPreference(this.locationPrecisionKey, precision);
  }

  /**
   * Drops any in-flight quiz session. Called on trip reset so a stale quiz for
   * a no-longer-found state cannot be resumed against the fresh save.
   */
  async clearTempQuizSession(): Promise<void> {
    await this.quizSessions.clear();
  }

  async resetSnapshot(
    tripHistory: TripHistoryEntry[] = [],
    hasSeenOnboarding = false,
    currentStreak?: ChallengeStreak,
  ): Promise<PersistedGameSnapshot> {
    const snapshot: PersistedGameSnapshot = {
      states: this.createSeedStates(),
      points: createEmptyPoints(),
      hasSeenOnboarding,
      gameMode: this.defaultGameMode,
      difficulty: this.defaultDifficulty,
      tripHistory,
      // The streak measures days the player showed up, not progress in any one
      // trip, so it deliberately survives a reset.
      challengeStreak: currentStreak ?? createEmptyStreak(),
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
      tripHistory: [],
    });
  }

  private normalizeSnapshot(snapshot: PersistedGameSnapshot): PersistedGameSnapshot {
    const points = snapshot.points && typeof snapshot.points === 'object'
      ? snapshot.points
      : createEmptyPoints();
    const storedStates = Array.isArray(snapshot.states)
      ? cloneStoredStates(snapshot.states)
      : [];

    return {
      states: this.mergeStoredProgressOntoSeedStates(storedStates),
      points: cloneStoredPoints(points),
      hasSeenOnboarding: Boolean(snapshot.hasSeenOnboarding),
      gameMode: snapshot.gameMode === 'trivia' ? 'trivia' : this.defaultGameMode,
      difficulty: snapshot.difficulty === 'medium' || snapshot.difficulty === 'hard' || snapshot.difficulty === 'easy'
        ? snapshot.difficulty
        : this.defaultDifficulty,
      tripHistory: this.normalizeTripHistory(snapshot.tripHistory),
      challengeStreak: normalizeStreak(snapshot.challengeStreak),
    };
  }

  private normalizeTripHistory(history: unknown): TripHistoryEntry[] {
    if (!Array.isArray(history)) {
      return [];
    }

    return history
      .filter((entry): entry is Partial<TripHistoryEntry> => entry !== null && typeof entry === 'object')
      .map((entry) => ({
        id: typeof entry.id === 'string' ? entry.id : String(entry.completedAt ?? Date.now()),
        completedAt: typeof entry.completedAt === 'string' ? entry.completedAt : new Date().toISOString(),
        foundCount: Number(entry.foundCount ?? 0),
        totalStates: Number(entry.totalStates ?? 0),
        finalScore: Number(entry.finalScore ?? 0),
        miles: Number(entry.miles ?? 0),
        triviaCorrect: Number(entry.triviaCorrect ?? 0),
      }));
  }

  private mergeStoredProgressOntoSeedStates(storedStates: StoredStateRecord[]): StoredStateRecord[] {
    const storedProgressById = new Map(storedStates.map((state) => [state.ID, state.fnd]));

    return this.createSeedStates().map((seedState) => {
      const storedProgress = storedProgressById.get(seedState.ID);

      if (!storedProgress) {
        return seedState;
      }

      return {
        ...seedState,
        fnd: {
          ...storedProgress,
        },
      };
    });
  }
}
