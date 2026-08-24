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
      // Bounded, not merely integral. An index at or past the end makes the
      // resume loop run zero times and fall straight through to completeQuiz,
      // which REPLACES the banked score rather than adding to it — so a
      // restored or hand-edited session could erase the trivia points a state
      // had already earned. The consumer gate added for pm-0002 admits only
      // sessions whose state the save has spotted, i.e. exactly the states
      // that can have points to lose, so bounding here is what keeps that
      // gate from being an amplifier.
      && typeof session.currentIndex === 'number'
      && Number.isInteger(session.currentIndex)
      && session.currentIndex >= 0
      && session.currentIndex < session.questions.length
      && typeof session.totalCorrect === 'number'
      && Number.isFinite(session.totalCorrect)
      && session.totalCorrect >= 0
      && session.totalCorrect <= session.questions.length;
  }
}
