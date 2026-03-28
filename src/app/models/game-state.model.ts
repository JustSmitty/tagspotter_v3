export interface FoundProgress {
  distance: number;
  stateFound: boolean;
  questionsCorrect: number;
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
  fnd: FoundProgress;
}

export interface StoredPoints {
  state: number;
  question: number;
  distance: number;
}

export interface PointsSummary extends StoredPoints {
  states: number;
  quiz: number;
  total: number;
  miles: number;
}

export type StateRegion = 'northeast' | 'south' | 'west' | 'midwest';

export interface StateCardViewModel {
  id: number;
  code: string;
  name: string;
  isFound: boolean;
  distanceFound: number;
  questionsCorrect: number;
  flagUrl: string;
  region: StateRegion;
}

export interface AchievementViewModel {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  unlocked: boolean;
}

export interface GameSnapshot {
  states: StoredStateRecord[];
  points: StoredPoints;
  foundCount: number;
  totalCorrect: number;
  totalDistanceMiles: number;
}

export type QuizTopic = 'Bird' | 'Capital' | 'Flower' | 'Nickname';

export interface QuizQuestion {
  topic: QuizTopic;
  prompt: string;
  correctAnswer: string;
  options: string[];
  correctIndex: number;
}

export interface QuizSession {
  stateId: number;
  stateCode: string;
  stateName: string;
  imageSrc: string;
  questions: QuizQuestion[];
}

export type QuizDismissResult =
  | {
      kind: 'answered';
      score: 0 | 1;
    }
  | {
      kind: 'cancelled';
    };

export interface HomeViewModel {
  points: PointsSummary;
  states: StateCardViewModel[];
  isLoaded: boolean;
  isBusy: boolean;
}

export interface DashboardViewModel {
  points: PointsSummary;
  foundCount: number;
  totalStates: number;
  totalCorrect: number;
  totalDistanceMiles: number;
  states: StateCardViewModel[];
  achievements: AchievementViewModel[];
}

export const DISTRICT_OF_COLUMBIA_ID = 9;
export const QUIZ_QUESTION_COUNT = 3;
export const QUIZ_TOPICS: QuizTopic[] = ['Bird', 'Capital', 'Flower', 'Nickname'];

export function createEmptyPoints(): StoredPoints {
  return {
    state: 0,
    question: 0,
    distance: 0,
  };
}

export function cloneStoredPoints(points: StoredPoints): StoredPoints {
  return {
    state: points.state,
    question: points.question,
    distance: points.distance,
  };
}

export function cloneStoredStates(states: StoredStateRecord[]): StoredStateRecord[] {
  return states.map((state) => normalizeStoredState(state));
}

function normalizeStoredState(state: StoredStateRecord | LegacyStoredStateRecord): StoredStateRecord {
  return {
    ...state,
    fnd: {
      distance: Number(state.fnd?.distance ?? 0),
      stateFound: Boolean(state.fnd?.stateFound),
      questionsCorrect: Number(state.fnd?.questionsCorrect ?? 0),
    },
  };
}
