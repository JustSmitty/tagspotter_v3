import { Injectable, inject } from '@angular/core';

import { LocationPrecision } from '../models/location.model';
import { QuizDifficulty, QuizSession } from '../models/quiz.model';
import { cloneStoredPoints, cloneStoredStates, DISTRICT_OF_COLUMBIA_ID, StoredPoints, StoredStateRecord } from '../models/game-persistence.model';
import { Coordinates } from '../models/location.model';
import { LocationAccessResult, LocationService } from './location.service';
import { QuizService } from './quiz.service';
import { RewardService } from './reward.service';

export interface RecordStateResult {
  states: StoredStateRecord[];
  points: StoredPoints;
  quizSession: QuizSession | null;
}

export type MutationResult = { states: StoredStateRecord[]; points: StoredPoints } | null;

@Injectable({ providedIn: 'root' })
export class GameCommandService {
  private readonly locationService = inject(LocationService);
  private readonly quizService = inject(QuizService);
  private readonly rewardService = inject(RewardService);

  /**
   * Synchronous by design (audit F-06). This used to await geolocation, which
   * meant the store's busy flag — and therefore every control in the app — was
   * held for up to the 10s location timeout after a single tap. Spotting a
   * plate is now instant; `readLocation` + `applyDistance` add the range bonus
   * afterwards.
   */
  recordFoundState(
    currentStates: StoredStateRecord[],
    currentPoints: StoredPoints,
    stateId: number,
    mode: 'classic' | 'trivia',
    difficulty: QuizDifficulty,
  ): RecordStateResult | null {
    const states = cloneStoredStates(currentStates);
    const points = cloneStoredPoints(currentPoints);
    const foundState = states.find((state) => state.ID === stateId);
    if (!foundState || foundState.fnd.stateFound) return null;

    foundState.fnd = {
      stateFound: true,
      mode,
      difficulty,
      questionsCorrect: 0,
      distance: 0,
    };

    points.state += this.rewardService.getStateDiscoveryReward();
    const quizSession = foundState.ID === DISTRICT_OF_COLUMBIA_ID || mode === 'classic'
      ? null
      : this.quizService.createQuizSession(foundState, states, difficulty);

    return { states, points, quizSession };
  }

  /** The one slow call, deliberately kept outside any mutation. */
  readLocation(precision: LocationPrecision): Promise<LocationAccessResult> {
    return this.locationService.getCurrentLocationAccess(precision);
  }

  /**
   * Adds the range bonus to an already-spotted state. Idempotent: re-applying
   * replaces the previous distance and its reward rather than stacking, so a
   * retried or duplicated resolution cannot inflate the score.
   */
  applyDistance(
    currentStates: StoredStateRecord[],
    currentPoints: StoredPoints,
    stateId: number,
    coordinates: Coordinates,
  ): MutationResult {
    const states = cloneStoredStates(currentStates);
    const points = cloneStoredPoints(currentPoints);
    const foundState = states.find((state) => state.ID === stateId);
    if (!foundState?.fnd.stateFound) return null;

    const distance = Math.round(this.locationService.calculateDistanceMiles(
      { lat: foundState.Lat, lng: foundState.Lng },
      coordinates,
    ));

    // Both rewards scale with distance (audit F-13), and distance only arrives
    // after the spot is already committed (audit F-06) — so the discovery point
    // is topped up here too. Deltas are computed against the previous distance
    // so re-applying replaces rather than stacks.
    points.distance += this.rewardService.getDistanceReward(distance)
      - this.rewardService.getDistanceReward(foundState.fnd.distance);
    points.state += this.rewardService.getStateDiscoveryReward(distance)
      - this.rewardService.getStateDiscoveryReward(foundState.fnd.distance);
    foundState.fnd.distance = distance;

    return { states, points };
  }

  /**
   * Reverses a spot completely (audit F-04): the discovery point, the range
   * bonus earned for it, and any trivia points banked against it. Without this
   * a mis-tap was permanent and the only escape was wiping the whole trip.
   */
  unspotState(
    currentStates: StoredStateRecord[],
    currentPoints: StoredPoints,
    stateId: number,
  ): MutationResult {
    const states = cloneStoredStates(currentStates);
    const points = cloneStoredPoints(currentPoints);
    const foundState = states.find((state) => state.ID === stateId);
    if (!foundState?.fnd.stateFound) return null;

    // Reverse using the distance actually recorded, since both rewards scale
    // with it — otherwise a far-flung spot would refund less than it earned.
    points.state -= this.rewardService.getStateDiscoveryReward(foundState.fnd.distance);
    points.distance -= this.rewardService.getDistanceReward(foundState.fnd.distance);
    points.question -= foundState.fnd.questionsCorrect;

    foundState.fnd = {
      stateFound: false,
      questionsCorrect: 0,
      distance: 0,
      mode: undefined,
      difficulty: undefined,
    };

    // Points are per-state sums, so they can never legitimately go negative;
    // clamping keeps a corrupted or hand-edited save from showing a deficit.
    points.state = Math.max(points.state, 0);
    points.distance = Math.max(points.distance, 0);
    points.question = Math.max(points.question, 0);

    return { states, points };
  }

  completeQuiz(
    currentStates: StoredStateRecord[],
    currentPoints: StoredPoints,
    stateId: number,
    earnedPoints: number,
  ): { states: StoredStateRecord[]; points: StoredPoints } | null {
    const states = cloneStoredStates(currentStates);
    const points = cloneStoredPoints(currentPoints);
    const foundState = states.find((state) => state.ID === stateId);
    if (!foundState?.fnd.stateFound) return null;

    const normalizedPoints = Math.max(earnedPoints, 0);
    points.question += normalizedPoints - foundState.fnd.questionsCorrect;
    foundState.fnd.questionsCorrect = normalizedPoints;
    return { states, points };
  }
}
