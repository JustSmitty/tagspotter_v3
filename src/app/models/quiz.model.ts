export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export type QuizTopic =
  | 'Bird'
  | 'Capital'
  | 'Flower'
  | 'Nickname'
  | 'Abbreviation'
  | 'Region'
  | 'AdmissionYear'
  | 'LargestCity'
  | 'Tree'
  | 'Flag'
  | 'Landmark'
  | 'Movie'
  | 'Sports';

export interface QuizQuestion {
  topic: QuizTopic;
  prompt: string;
  correctAnswer: string;
  options: string[];
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

export interface StoredQuizSession extends QuizSession {
  currentIndex: number;
  totalCorrect: number;
}

export type QuizDismissResult =
  | { kind: 'answered'; score: number }
  | { kind: 'cancelled' };

export const QUIZ_QUESTION_COUNT = 3;
export const TEMP_QUIZ_SESSION_KEY = 'temp_quiz_session';

export function getDifficultyMultiplier(difficulty?: QuizDifficulty): number {
  if (difficulty === 'hard') return 3;
  if (difficulty === 'medium') return 2;
  return 1;
}

export function getCorrectAnswersCount(questionsCorrectPoints: number, difficulty?: QuizDifficulty): number {
  return Math.round(questionsCorrectPoints / getDifficultyMultiplier(difficulty));
}
