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

export interface GoalProgressViewModel extends AchievementViewModel {
  currentValue: number;
  targetValue: number;
  progressPercent: number;
  progressLabel: string;
  statusText: string;
}

export interface GameSnapshot {
  states: StoredStateRecord[];
  points: StoredPoints;
  foundCount: number;
  totalCorrect: number;
  totalDistanceMiles: number;
}

export interface PersistedGameSnapshot {
  states: StoredStateRecord[];
  points: StoredPoints;
  hasSeenOnboarding: boolean;
  gameMode: 'classic' | 'trivia';
  difficulty: QuizDifficulty;
}

export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export type QuizTopic = 'Bird' | 'Capital' | 'Flower' | 'Nickname' | 'Abbreviation' | 'Region' | 'AdmissionYear' | 'LargestCity' | 'Tree' | 'Flag' | 'Landmark' | 'Movie' | 'Sports';

export interface QuizQuestion {
  topic: QuizTopic;
  prompt: string;
  correctAnswer: string;
  options: string[];
  correctIndex: number;
  optionType?: 'text' | 'image';
  points?: number;
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
      score: number;
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

export interface SouvenirFlagViewModel {
  code: string;
  name: string;
  flagUrl: string;
}

export interface GoalsSummaryViewModel {
  total: number;
  unlocked: number;
  inProgress: number;
  nextGoal: GoalProgressViewModel | null;
}

export interface SummaryDistribution {
  classicStates: number;
  easyStates: number;
  medStates: number;
  hardStates: number;
  total: number;
}

export interface SummaryViewModel {
  foundCount: number;
  totalStates: number;
  finalScore: number;
  miles: number;
  distribution: SummaryDistribution;
}

export interface TriviaTopicCard {
  title: QuizTopic;
  subtitle: string;
}

export interface TriviaViewModel {
  accuracy: number;
  correctAnswers: number;
  foundStates: number;
  perfectPasses: number;
  totalPossibleAnswers: number;
  topStates: StateCardViewModel[];
  featuredStates: StateCardViewModel[];
  topics: TriviaTopicCard[];
}

export const DISTRICT_OF_COLUMBIA_ID = 9;
export const QUIZ_QUESTION_COUNT = 3;

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
  if (!states || !Array.isArray(states)) {
    return [];
  }
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
