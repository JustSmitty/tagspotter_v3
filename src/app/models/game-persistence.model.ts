import { QuizDifficulty } from './quiz.model';

export interface FoundProgress {
  distance: number;
  stateFound: boolean;
  questionsCorrect: number;
  mode?: 'classic' | 'trivia';
  difficulty?: QuizDifficulty;
}

interface LegacyFoundProgress extends Partial<FoundProgress> {
  lat?: number;
  lng?: number;
}

interface LegacyStoredStateRecord extends Omit<StoredStateRecord, 'fnd'> {
  fnd: LegacyFoundProgress;
}

export interface StoredStateRecord {
  ID: number;
  Name: string;
  Abbrv: string;
  Lat: number;
  Lng: number;
  Capital: string;
  Bird: string;
  Flower: string;
  Nickname: string;
  flagURL: string;
  Region?: string;
  LargestCity?: string;
  AdmissionYear?: number;
  Tree?: string;
  FamousLandmark?: string;
  MovieSetting?: string;
  SportsTeam?: string;
  fnd: FoundProgress;
}

export interface StoredPoints {
  state: number;
  question: number;
  distance: number;
}

export interface TripHistoryEntry {
  id: string;
  completedAt: string;
  foundCount: number;
  totalStates: number;
  finalScore: number;
  miles: number;
  triviaCorrect: number;
}

/**
 * Daily challenge streak (audit F-11).
 *
 * `lastCompletedDay` is a local calendar day as YYYY-MM-DD rather than a
 * timestamp: the streak is about days the player showed up, and a timestamp
 * would make "today" depend on the hour they opened the app.
 */
export interface ChallengeStreak {
  current: number;
  best: number;
  lastCompletedDay: string | null;
}

export interface PersistedGameSnapshot {
  states: StoredStateRecord[];
  points: StoredPoints;
  hasSeenOnboarding: boolean;
  gameMode: 'classic' | 'trivia';
  difficulty: QuizDifficulty;
  tripHistory: TripHistoryEntry[];
  /** Optional: saves written before the streak existed simply do not have it. */
  challengeStreak?: ChallengeStreak;
}

export function createEmptyStreak(): ChallengeStreak {
  return { current: 0, best: 0, lastCompletedDay: null };
}

export function normalizeStreak(value: unknown): ChallengeStreak {
  if (!value || typeof value !== 'object') return createEmptyStreak();
  const streak = value as Partial<ChallengeStreak>;
  const current = Number.isFinite(streak.current) ? Math.max(Number(streak.current), 0) : 0;
  const best = Number.isFinite(streak.best) ? Math.max(Number(streak.best), 0) : 0;

  return {
    current,
    // A save can only ever have been at least as good as it is now.
    best: Math.max(best, current),
    lastCompletedDay: typeof streak.lastCompletedDay === 'string' ? streak.lastCompletedDay : null,
  };
}

export const DISTRICT_OF_COLUMBIA_ID = 9;

export function createEmptyPoints(): StoredPoints {
  return { state: 0, question: 0, distance: 0 };
}

export function cloneStoredPoints(points: StoredPoints): StoredPoints {
  return { state: points.state, question: points.question, distance: points.distance };
}

export function cloneStoredStates(states: StoredStateRecord[]): StoredStateRecord[] {
  if (!Array.isArray(states)) return [];
  return states.map((state) => normalizeStoredState(state));
}

function normalizeStoredState(state: StoredStateRecord | LegacyStoredStateRecord): StoredStateRecord {
  return {
    ...state,
    fnd: {
      distance: Number(state.fnd?.distance ?? 0),
      stateFound: Boolean(state.fnd?.stateFound),
      questionsCorrect: Number(state.fnd?.questionsCorrect ?? 0),
      mode: state.fnd?.mode === 'trivia' ? 'trivia' : state.fnd?.mode === 'classic' ? 'classic' : undefined,
      difficulty: state.fnd?.difficulty === 'medium' || state.fnd?.difficulty === 'hard' || state.fnd?.difficulty === 'easy'
        ? state.fnd.difficulty
        : undefined,
    },
  };
}
