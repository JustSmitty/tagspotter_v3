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
  ): HomeViewModel {
    return {
      points: this.toPointsSummary(snapshot),
      states,
      isLoaded,
      isBusy,
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
