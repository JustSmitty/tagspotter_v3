import { StoredPoints, StoredStateRecord } from './game-persistence.model';

export interface GameSnapshot {
  states: StoredStateRecord[];
  points: StoredPoints;
  foundCount: number;
  totalCorrect: number;
  totalDistanceMiles: number;
}

// Compatibility barrel while callers migrate to the narrower model modules.
export * from './game-persistence.model';
export * from './game-view.model';
export * from './quiz.model';
