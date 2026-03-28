import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import {
  cloneStoredPoints,
  cloneStoredStates,
  createEmptyPoints,
  StoredPoints,
  StoredStateRecord,
} from '../models/game-state.model';
import statesFile from '../../data/states.json';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private readonly pointsStorageKey = 'points';
  private readonly statesStorageKey = 'states';
  private readonly ownedStorageKeys = [this.statesStorageKey, this.pointsStorageKey];

  private async setStorageItem<T>(key: string, value: T): Promise<void> {
    await Preferences.set({
      key,
      value: JSON.stringify(value)
    });
  }

  private async getStorageItem<T>(key: string): Promise<T | null> {
    const { value } = await Preferences.get({ key });
    return value ? JSON.parse(value) as T : null;
  }

  private async removeStorageItem(key: string): Promise<void> {
    await Preferences.remove({ key });
  }

  async clearStorage(): Promise<void> {
    await Promise.all(this.ownedStorageKeys.map((key) => this.removeStorageItem(key)));
  }

  async loadStates(): Promise<StoredStateRecord[]> {
    const storedStates = await this.getStorageItem<StoredStateRecord[]>(this.statesStorageKey);

    if (!storedStates) {
      const initialStates = this.createSeedStates();
      await this.saveStates(initialStates);
      return initialStates;
    }

    return cloneStoredStates(storedStates);
  }

  async loadPoints(): Promise<StoredPoints> {
    const storedPoints = await this.getStorageItem<StoredPoints>(this.pointsStorageKey);

    if (!storedPoints) {
      const initialPoints = createEmptyPoints();
      await this.savePoints(initialPoints);
      return initialPoints;
    }

    return cloneStoredPoints(storedPoints);
  }

  async savePoints(points: StoredPoints): Promise<void> {
    await this.setStorageItem(this.pointsStorageKey, cloneStoredPoints(points));
  }

  async saveStates(states: StoredStateRecord[]): Promise<void> {
    await this.setStorageItem(this.statesStorageKey, cloneStoredStates(states));
  }

  async resetProgress(): Promise<{ states: StoredStateRecord[]; points: StoredPoints }> {
    const states = this.createSeedStates();
    const points = createEmptyPoints();

    await Promise.all([
      this.saveStates(states),
      this.savePoints(points),
    ]);

    return { states, points };
  }

  private createSeedStates(): StoredStateRecord[] {
    return cloneStoredStates(statesFile as StoredStateRecord[]);
  }
}
