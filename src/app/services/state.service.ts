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
  TripHistoryEntry,
  TEMP_QUIZ_SESSION_KEY,
} from '../models/game-state.model';
import { DEFAULT_LOCATION_PRECISION, LocationPrecision } from '../models/location.model';
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
  // The onboarding flag is stored on its own, outside the encrypted+signed save
  // blob, so that losing or corrupting the save (which triggers a fresh reset)
  // does not make the handbook pop up again for a returning player. Users can
  // still re-open the handbook manually via the header help pin.
  private readonly onboardingSeenKey = 'tagspotter_v1_onboarding_seen';
  // Location accuracy is a device/privacy preference, stored on its own (outside
  // the game save) so it persists across trip resets and save corruption.
  private readonly locationPrecisionKey = 'tagspotter_v1_location_precision';
  private readonly ownedStorageKeys = [
    this.statesStorageKey,
    this.pointsStorageKey,
    this.onboardingStorageKey,
    this.gameModeStorageKey,
    this.difficultyStorageKey,
    this.unifiedStorageKey,
    this.onboardingSeenKey,
    this.locationPrecisionKey,
    TEMP_QUIZ_SESSION_KEY
  ];

  private get checksumSuffix(): string {
    return '_sig';
  }

  private async setStorageItem<T>(key: string, value: T): Promise<void> {
    const dataString = JSON.stringify(value);
    const encryptedData = await this.encrypt(dataString);
    const checksum = await this.checksumService.generateChecksum(dataString);
    
    await Promise.all([
      this.setPreference(key, encryptedData),
      this.setPreference(key + this.checksumSuffix, checksum)
    ]);
  }

  private async getStorageItem<T>(key: string): Promise<T | null> {
    const [value, checksum] = await Promise.all([
      this.getPreference(key),
      this.getPreference(key + this.checksumSuffix)
    ]);

    if (!value) return null;

    try {
      let decrypted = '';
      if (value.startsWith('{') || value.startsWith('[')) {
        decrypted = value;
        await this.setStorageItem(key, JSON.parse(decrypted));
      } else {
        decrypted = await this.decrypt(value);
      }

      // Integrity Check: Protect against manual tampering
      const isValid = checksum && await this.checksumService.verify(decrypted, checksum);
      if (!isValid) {
        console.warn(`Data integrity failure for key: ${key}. Data may have been tampered with.`);
        return null;
      }

      return JSON.parse(decrypted) as T;
    } catch (err) {
      console.warn(`Failed to decrypt or parse storage item for key: ${key}:`, err);
      return null;
    }
  }

  private async getEncryptionKey(): Promise<CryptoKey> {
    const password = 'TagSpotter_1950_Americana_Secret_Encryption_Key';
    const salt = new TextEncoder().encode('TagSpotter_Salt_1950');
    const passwordBuffer = new TextEncoder().encode(password);
    
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 1000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async encrypt(text: string): Promise<string> {
    const key = await this.getEncryptionKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );
    
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    
    return this.arrayBufferToBase64(combined);
  }

  private async decrypt(encryptedBase64: string): Promise<string> {
    const key = await this.getEncryptionKey();
    const combined = this.base64ToArrayBuffer(encryptedBase64);
    
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    
    return new TextDecoder().decode(decrypted);
  }

  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const len = buffer.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return window.btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private async removeStorageItem(key: string): Promise<void> {
    await Promise.all([
      this.removePreference(key),
      this.removePreference(key + this.checksumSuffix)
    ]);
  }

  protected async setPreference(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }

  protected async getPreference(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  }

  protected async removePreference(key: string): Promise<void> {
    await Preferences.remove({ key });
  }

  async clearStorage(): Promise<void> {
    await Promise.all(this.ownedStorageKeys.map((key) => this.removeStorageItem(key)));
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
    await Promise.all([
      this.setStorageItem(this.unifiedStorageKey, normalized),
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
    await this.removePreference(TEMP_QUIZ_SESSION_KEY);
  }

  async resetSnapshot(tripHistory: TripHistoryEntry[] = [], hasSeenOnboarding = false): Promise<PersistedGameSnapshot> {
    const snapshot: PersistedGameSnapshot = {
      states: this.createSeedStates(),
      points: createEmptyPoints(),
      hasSeenOnboarding,
      gameMode: this.defaultGameMode,
      difficulty: this.defaultDifficulty,
      tripHistory,
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
