import { Injectable } from '@angular/core';

import {
  DISTRICT_OF_COLUMBIA_ID,
  QUIZ_QUESTION_COUNT,
  QuizQuestion,
  QuizSession,
  QuizTopic,
  QuizDifficulty,
  TriviaTopicCard,
  StoredStateRecord,
} from '../models/game-state.model';

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private readonly TOPIC_TIERS: Record<QuizDifficulty, QuizTopic[]> = {
    easy: ['Capital', 'Abbreviation', 'Region', 'Landmark'],
    medium: ['Nickname', 'Bird', 'AdmissionYear'],
    hard: ['Flower', 'Tree', 'LargestCity', 'Flag', 'Movie', 'Sports'],
  };

  private readonly TOPIC_SUBTITLES: Record<QuizTopic, string> = {
    Bird: 'Identify each state bird from the road atlas.',
    Capital: 'Match the plate to its capital city.',
    Flower: 'Remember the bloom on each state seal.',
    Nickname: 'Decode the nickname painted on the roadside sign.',
    Abbreviation: 'Recognize the two-letter postal code.',
    Region: 'Pinpoint the geographical region of the state.',
    AdmissionYear: 'Know when the state joined the union.',
    LargestCity: 'Find the most populous city in the state.',
    Tree: 'Identify the official state tree.',
    Flag: 'Pick the correct state flag.',
    Landmark: 'Recall the landmark travelers seek out.',
    Movie: 'Match the state to a memorable movie setting.',
    Sports: 'Connect the state to its familiar sports team.',
  };

  private readonly POINTS_MAP: Record<QuizDifficulty, number> = {
    easy: 1,
    medium: 2,
    hard: 3,
  };

  getTriviaTopics(): TriviaTopicCard[] {
    const tierTopics: QuizTopic[] = ([] as QuizTopic[]).concat(...Object.values(this.TOPIC_TIERS));

    return tierTopics.map((title) => ({
        title,
        subtitle: this.TOPIC_SUBTITLES[title],
      }));
  }

  createQuizSession(foundState: StoredStateRecord, allStates: StoredStateRecord[], difficulty: QuizDifficulty): QuizSession {
    const candidateStates = allStates.filter(
      (state) => state.ID !== foundState.ID && state.ID !== DISTRICT_OF_COLUMBIA_ID,
    );
    const points = this.POINTS_MAP[difficulty];
    const chosenTopics = this.selectTopics(foundState, difficulty);
    const questions = chosenTopics.map((topic) => this.createQuestion(foundState, candidateStates, topic, points));

    return {
      stateId: foundState.ID,
      stateCode: foundState.Abbrv,
      stateName: foundState.Name,
      imageSrc: foundState.flagURL,
      questions,
    };
  }

  /**
   * Always returns exactly QUIZ_QUESTION_COUNT topics (audit F-18).
   *
   * The tier is the preference, not a hard limit. `medium` has exactly three
   * topics, so a single missing field in the dataset used to yield a
   * two-question quiz — while accuracy elsewhere still divided by three,
   * silently understating the player's score. Rather than track how many
   * questions each session happened to ask, the invariant is made true here:
   * short tiers top up from the other tiers, preferring topics this state
   * actually has data for.
   */
  private selectTopics(foundState: StoredStateRecord, difficulty: QuizDifficulty): QuizTopic[] {
    const hasValue = (topic: QuizTopic) => this.getTopicValue(foundState, topic) !== '';
    const preferred = this.shuffle(this.TOPIC_TIERS[difficulty].filter(hasValue));

    if (preferred.length >= QUIZ_QUESTION_COUNT) {
      return preferred.slice(0, QUIZ_QUESTION_COUNT);
    }

    const fallback = this.shuffle(
      (Object.keys(this.TOPIC_TIERS) as QuizDifficulty[])
        .filter((tier) => tier !== difficulty)
        .flatMap((tier) => this.TOPIC_TIERS[tier])
        .filter((topic) => hasValue(topic) && !preferred.includes(topic)),
    );

    return [...preferred, ...fallback].slice(0, QUIZ_QUESTION_COUNT);
  }

  private createQuestion(
    foundState: StoredStateRecord,
    candidateStates: StoredStateRecord[],
    topic: QuizTopic,
    points: number
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

    const options = [...distractors];
    options.splice(this.randomInt(0, options.length), 0, correctAnswer);

    let prompt = `What is ${foundState.Name}'s ${this.getTopicLabel(topic)}?`;
    let optionType: 'text' | 'image' = 'text';

    if (topic === 'Flag') {
      prompt = `Which of the following is the state flag of ${foundState.Name}?`;
      optionType = 'image';
    }

    return {
      topic,
      prompt,
      correctAnswer,
      options,
      optionType,
      points,
    };
  }

  private getTopicValue(state: StoredStateRecord, topic: QuizTopic): string {
    switch (topic) {
      case 'Bird': return state.Bird;
      case 'Capital': return state.Capital;
      case 'Flower': return state.Flower;
      case 'Nickname': return state.Nickname;
      case 'Abbreviation': return state.Abbrv;
      case 'Region': return state.Region ?? '';
      case 'AdmissionYear': return state.AdmissionYear?.toString() ?? '';
      case 'LargestCity': return state.LargestCity ?? '';
      case 'Tree': return state.Tree ?? '';
      case 'Flag': return state.flagURL;
      case 'Landmark': return state.FamousLandmark ?? '';
      case 'Movie': return state.MovieSetting ?? '';
      case 'Sports': return state.SportsTeam ?? '';
      default: return '';
    }
  }

  private getTopicLabel(topic: QuizTopic): string {
    switch (topic) {
      case 'Bird': return 'state bird';
      case 'Capital': return 'capital';
      case 'Flower': return 'state flower';
      case 'Nickname': return 'nickname';
      case 'Abbreviation': return 'abbreviation';
      case 'Region': return 'region';
      case 'AdmissionYear': return 'admission year';
      case 'LargestCity': return 'largest city';
      case 'Tree': return 'state tree';
      case 'Flag': return 'state flag';
      case 'Landmark': return 'famous landmark';
      case 'Movie': return 'famous movie setting';
      case 'Sports': return 'famous sports team';
      default: return '';
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
