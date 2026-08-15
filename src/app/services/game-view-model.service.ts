import { Injectable } from '@angular/core';

import { getStateRegion } from '../constants/us-states';
import {
  AchievementViewModel,
  DashboardViewModel,
  DISTRICT_OF_COLUMBIA_ID,
  GameSnapshot,
  getCorrectAnswersCount,
  GoalsSummaryViewModel,
  GoalProgressViewModel,
  HomeViewModel,
  PointsSummary,
  QUIZ_QUESTION_COUNT,
  SouvenirFlagViewModel,
  StateCardViewModel,
  StoredStateRecord,
  SummaryDistribution,
  SummaryViewModel,
  TriviaTopicCard,
  TriviaViewModel,
  TripComparisonViewModel,
  TripHistoryEntry,
} from '../models/game-state.model';

@Injectable({
  providedIn: 'root'
})
export class GameViewModelService {
  buildHomeViewModel(
    snapshot: GameSnapshot,
    states: StateCardViewModel[],
    isLoaded: boolean,
    isBusy: boolean,
    error: string | null,
  ): HomeViewModel {
    return {
      points: this.toPointsSummary(snapshot),
      states,
      isLoaded,
      isBusy,
      error,
    };
  }

  buildDashboardViewModel(
    snapshot: GameSnapshot,
    states: StateCardViewModel[],
    achievements: AchievementViewModel[],
    tripHistory: TripHistoryEntry[],
  ): DashboardViewModel {
    return {
      points: this.toPointsSummary(snapshot),
      foundCount: snapshot.foundCount,
      totalStates: snapshot.states.length,
      totalCorrect: snapshot.totalCorrect,
      totalDistanceMiles: snapshot.totalDistanceMiles,
      states,
      achievements,
      tripHistory,
      // Ranked by distance (longest haul first) so the "#N" index is meaningful
      // and consistent with the mileage shown on each entry.
      travelLog: states
        .filter((state) => state.isFound)
        .sort((left, right) => right.distanceFound - left.distanceFound),
    };
  }

  /**
   * Compares the trip in progress with the archive (audit F-14).
   *
   * Deliberately compares against the *current* score rather than a finished
   * one: the useful question mid-trip is "am I ahead of last time", and waiting
   * until completion would make this visible only on a screen most players
   * never reach.
   */
  buildTripComparison(snapshot: GameSnapshot, tripHistory: TripHistoryEntry[]): TripComparisonViewModel {
    const currentScore = this.toPointsSummary(snapshot).total;

    if (!tripHistory.length) {
      return {
        hasHistory: false,
        bestScore: null,
        bestFoundCount: null,
        previousScore: null,
        scoreDelta: null,
        isPersonalBest: false,
        pointsToBeat: null,
        tripsCompleted: 0,
      };
    }

    // History is stored newest-first (GameStateStore prepends on archive).
    const previous = tripHistory[0];
    const best = tripHistory.reduce((leader, trip) => (trip.finalScore > leader.finalScore ? trip : leader));
    const isPersonalBest = currentScore > best.finalScore;

    return {
      hasHistory: true,
      bestScore: best.finalScore,
      bestFoundCount: best.foundCount,
      previousScore: previous.finalScore,
      scoreDelta: currentScore - previous.finalScore,
      isPersonalBest,
      pointsToBeat: isPersonalBest ? null : best.finalScore - currentScore + 1,
      tripsCompleted: tripHistory.length,
    };
  }

  buildGoalsSummary(goals: GoalProgressViewModel[]): GoalsSummaryViewModel {
    return {
      total: goals.length,
      unlocked: goals.filter((goal) => goal.unlocked).length,
      inProgress: goals.filter((goal) => !goal.unlocked && goal.currentValue > 0).length,
      nextGoal: goals.find((goal) => !goal.unlocked) ?? null,
    };
  }

  buildSummaryViewModel(snapshot: GameSnapshot, distribution: SummaryDistribution): SummaryViewModel {
    return {
      foundCount: snapshot.foundCount,
      totalStates: snapshot.states.length,
      finalScore: this.toPointsSummary(snapshot).total,
      miles: snapshot.totalDistanceMiles,
      distribution,
    };
  }

  buildTriviaViewModel(
    snapshot: GameSnapshot,
    rankedFoundStates: StateCardViewModel[],
    topics: TriviaTopicCard[],
  ): TriviaViewModel {
    const triviaStates = rankedFoundStates.filter((state) => state.isFound && state.mode === 'trivia' && state.id !== DISTRICT_OF_COLUMBIA_ID);
    const totalPossibleAnswers = triviaStates.length * QUIZ_QUESTION_COUNT;
    const correctAnswers = triviaStates.reduce((total, state) => total + state.questionsCorrect, 0);
    const accuracy = totalPossibleAnswers === 0
      ? 0
      : Math.round((correctAnswers / totalPossibleAnswers) * 100);

    return {
      accuracy,
      correctAnswers,
      foundStates: triviaStates.length,
      perfectPasses: triviaStates.filter((state) => state.questionsCorrect === QUIZ_QUESTION_COUNT).length,
      totalPossibleAnswers,
      topStates: triviaStates.slice(0, 6),
      featuredStates: triviaStates.slice(0, 3),
      topics,
    };
  }

  buildSummaryDistribution(snapshot: GameSnapshot): SummaryDistribution {
    const foundStates = snapshot.states.filter((state) => state.fnd.stateFound);

    return {
      classicStates: foundStates.filter((state) => state.fnd.mode === 'classic').length,
      easyStates: foundStates.filter((state) => state.fnd.mode === 'trivia' && state.fnd.difficulty === 'easy').length,
      medStates: foundStates.filter((state) => state.fnd.mode === 'trivia' && state.fnd.difficulty === 'medium').length,
      hardStates: foundStates.filter((state) => state.fnd.mode === 'trivia' && state.fnd.difficulty === 'hard').length,
      total: foundStates.length,
    };
  }

  toStateCards(states: StoredStateRecord[]): StateCardViewModel[] {
    return states.map((state) => this.toStateCard(state));
  }

  rankFoundStates(states: StateCardViewModel[]): StateCardViewModel[] {
    return [...states]
      .filter((state) => state.isFound)
      .sort((left, right) => right.questionsCorrect - left.questionsCorrect
        || right.distanceFound - left.distanceFound
        || left.name.localeCompare(right.name));
  }

  toSouvenirFlags(states: StateCardViewModel[], limit: number): SouvenirFlagViewModel[] {
    return states
      .slice(0, limit)
      .map((state) => ({
        code: state.code,
        name: state.name,
        flagUrl: state.flagUrl,
      }));
  }

  private toPointsSummary(snapshot: GameSnapshot): PointsSummary {
    return {
      ...snapshot.points,
      states: snapshot.points.state,
      quiz: snapshot.points.question,
      total: snapshot.points.state + snapshot.points.question + snapshot.points.distance,
      miles: snapshot.totalDistanceMiles,
    };
  }

  private toStateCard(state: StoredStateRecord): StateCardViewModel {
    const isFound = state.fnd.stateFound;
    const questionsCorrect = state.fnd.questionsCorrect;
    const isTrivia = state.fnd.mode === 'trivia' || (state.fnd.mode !== 'classic' && questionsCorrect > 0);
    const correctCount = isFound && isTrivia ? getCorrectAnswersCount(questionsCorrect, state.fnd.difficulty) : 0;
    const triviaPoints = isFound && isTrivia ? questionsCorrect : 0;

    return {
      id: state.ID,
      code: state.Abbrv,
      name: state.Name,
      isFound,
      distanceFound: state.fnd.distance,
      questionsCorrect: correctCount,
      triviaPoints,
      flagUrl: state.flagURL,
      region: getStateRegion(state.Abbrv),
      mode: state.fnd.mode,
      difficulty: state.fnd.difficulty,
    };
  }
}
