import { Injectable } from '@angular/core';

import {
  DISTRICT_OF_COLUMBIA_ID,
  QUIZ_QUESTION_COUNT,
  QUIZ_TOPICS,
  QuizQuestion,
  QuizSession,
  QuizTopic,
  StoredStateRecord,
} from '../models/game-state.model';

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  createQuizSession(foundState: StoredStateRecord, allStates: StoredStateRecord[]): QuizSession {
    const candidateStates = allStates.filter(
      (state) => state.ID !== foundState.ID && state.ID !== DISTRICT_OF_COLUMBIA_ID,
    );
    const chosenTopics = this.shuffle([...QUIZ_TOPICS]).slice(0, QUIZ_QUESTION_COUNT);
    const questions = chosenTopics.map((topic) => this.createQuestion(foundState, candidateStates, topic));

    return {
      stateId: foundState.ID,
      stateCode: foundState.Abbrv,
      stateName: foundState.Name,
      imageSrc: foundState.flagURL,
      questions,
    };
  }

  private createQuestion(
    foundState: StoredStateRecord,
    candidateStates: StoredStateRecord[],
    topic: QuizTopic,
  ): QuizQuestion {
    const correctAnswer = this.getTopicValue(foundState, topic);
    const distractors = this.shuffle(
      Array.from(
        new Set(
          candidateStates
            .map((state) => this.getTopicValue(state, topic))
            .filter((value) => value !== correctAnswer),
        ),
      ),
    ).slice(0, 3);

    if (distractors.length < 3) {
      throw new Error(`Unable to build quiz question for topic ${topic}.`);
    }

    const correctIndex = this.randomInt(0, 3);
    const options = [...distractors];
    options.splice(correctIndex, 0, correctAnswer);

    return {
      topic,
      prompt: `What is ${foundState.Name}'s ${this.getTopicLabel(topic)}?`,
      correctAnswer,
      options,
      correctIndex,
    };
  }

  private getTopicValue(state: StoredStateRecord, topic: QuizTopic): string {
    switch (topic) {
      case 'Bird':
        return state.Bird;
      case 'Capital':
        return state.Capital;
      case 'Flower':
        return state.Flower;
      case 'Nickname':
        return state.Nickname;
    }
  }

  private getTopicLabel(topic: QuizTopic): string {
    switch (topic) {
      case 'Bird':
        return 'state bird';
      case 'Capital':
        return 'capital';
      case 'Flower':
        return 'state flower';
      case 'Nickname':
        return 'nickname';
    }
  }

  private shuffle<T>(items: T[]): T[] {
    const copy = [...items];

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = this.randomInt(0, index);
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }

    return copy;
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
