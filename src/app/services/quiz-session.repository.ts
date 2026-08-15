import { Injectable, inject } from '@angular/core';

import { QuizSession, StoredQuizSession, TEMP_QUIZ_SESSION_KEY } from '../models/quiz.model';
import { PreferenceStorageService } from './platform/preference-storage.service';

@Injectable({ providedIn: 'root' })
export class QuizSessionRepository {
  private readonly preferences = inject(PreferenceStorageService);

  async load(): Promise<StoredQuizSession | null> {
    const value = await this.preferences.get(TEMP_QUIZ_SESSION_KEY);
    if (!value) return null;

    try {
      const parsed: unknown = JSON.parse(value);
      if (!this.isStoredSession(parsed)) {
        await this.clear();
        return null;
      }
      return parsed;
    } catch {
      await this.clear();
      return null;
    }
  }

  async save(session: QuizSession, currentIndex: number, totalCorrect: number): Promise<void> {
    const stored: StoredQuizSession = { ...session, currentIndex, totalCorrect };
    await this.preferences.set(TEMP_QUIZ_SESSION_KEY, JSON.stringify(stored));
  }

  clear(): Promise<void> {
    return this.preferences.remove(TEMP_QUIZ_SESSION_KEY);
  }

  private isStoredSession(value: unknown): value is StoredQuizSession {
    if (!value || typeof value !== 'object') return false;
    const session = value as Partial<StoredQuizSession>;
    return Number.isInteger(session.stateId)
      && typeof session.stateCode === 'string'
      && typeof session.stateName === 'string'
      && typeof session.imageSrc === 'string'
      && Array.isArray(session.questions)
      && session.questions.every((question) => Boolean(question)
        && typeof question.prompt === 'string'
        && typeof question.correctAnswer === 'string'
        && Array.isArray(question.options))
      && Number.isInteger(session.currentIndex)
      && Number.isFinite(session.totalCorrect);
  }
}
