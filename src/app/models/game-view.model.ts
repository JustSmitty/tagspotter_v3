import { QuizDifficulty, QuizTopic } from './quiz.model';
import { StoredPoints, TripHistoryEntry } from './game-persistence.model';

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
  triviaPoints?: number;
  mode?: 'classic' | 'trivia';
  difficulty?: QuizDifficulty;
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

export interface RotatingChallengeViewModel {
  id: string;
  title: string;
  description: string;
  currentValue: number;
  targetValue: number;
  progressPercent: number;
  progressLabel: string;
  unlocked: boolean;
}

export interface HomeViewModel {
  points: PointsSummary;
  states: StateCardViewModel[];
  isLoaded: boolean;
  isBusy: boolean;
  error: string | null;
}

export interface DashboardViewModel {
  points: PointsSummary;
  foundCount: number;
  totalStates: number;
  totalCorrect: number;
  totalDistanceMiles: number;
  states: StateCardViewModel[];
  achievements: AchievementViewModel[];
  tripHistory: TripHistoryEntry[];
  travelLog: StateCardViewModel[];
}

/**
 * How the trip in progress compares with what came before (audit F-14).
 * Trip history was already being archived — up to ten trips — but only ever
 * rendered as a flat list, so none of it meant anything.
 */
export interface TripComparisonViewModel {
  hasHistory: boolean;
  /** Highest score across archived trips, or null when this is the first. */
  bestScore: number | null;
  bestFoundCount: number | null;
  previousScore: number | null;
  /** Current score minus the previous trip's; null when there is no previous. */
  scoreDelta: number | null;
  /** True once the current trip has passed every archived one. */
  isPersonalBest: boolean;
  /** Points still needed to beat the best, or null once ahead. */
  pointsToBeat: number | null;
  tripsCompleted: number;
}

export interface SouvenirFlagViewModel { code: string; name: string; flagUrl: string; }
export interface GoalsSummaryViewModel { total: number; unlocked: number; inProgress: number; nextGoal: GoalProgressViewModel | null; }
export interface SummaryDistribution { classicStates: number; easyStates: number; medStates: number; hardStates: number; total: number; }
export interface SummaryViewModel { foundCount: number; totalStates: number; finalScore: number; miles: number; distribution: SummaryDistribution; }
export interface TriviaTopicCard { title: QuizTopic; subtitle: string; }
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
