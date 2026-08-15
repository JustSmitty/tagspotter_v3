import { Injectable } from '@angular/core';
import { getStateRegion, EAST_COAST_STATE_CODES, WEST_COAST_STATE_CODES } from '../constants/us-states';
import { AchievementViewModel, GameSnapshot, GoalProgressViewModel, RotatingChallengeViewModel } from '../models/game-state.model';

export type Achievement = AchievementViewModel;

interface AchievementDef extends Omit<AchievementViewModel, 'unlocked'> {
  predicate: (snapshot: GameSnapshot) => boolean;
  getProgress: (snapshot: GameSnapshot) => { currentValue: number; targetValue: number; label: string; statusText?: string };
}

interface ChallengeDef {
  id: string;
  title: string;
  description: string;
  getProgress: (snapshot: GameSnapshot) => { currentValue: number; targetValue: number; label: string };
}

@Injectable({
  providedIn: 'root'
})
export class AchievementService {
  private readonly eastCoastStateCodes = EAST_COAST_STATE_CODES;
  private readonly westCoastStateCodes = WEST_COAST_STATE_CODES;

  private readonly ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [
    {
      id: 'pioneer',
      title: 'The Pioneer',
      description: 'Find your first state license plate.',
      icon: 'map-outline',
      color: 'primary',
      predicate: (s) => s.foundCount >= 1,
      getProgress: (s) => ({
        currentValue: s.foundCount,
        targetValue: 1,
        label: `${Math.min(s.foundCount, 1)} / 1 states`,
        statusText: s.foundCount >= 1 ? 'Stamped and collected.' : 'Spot your first license plate to unlock it.'
      })
    },
    {
      id: 'road-warrior',
      title: 'Road Warrior',
      description: 'Build up 5,000 miles of total spotting range.',
      icon: 'car-outline',
      color: 'success',
      predicate: (s) => s.totalDistanceMiles >= 5000,
      getProgress: (s) => ({
        currentValue: s.totalDistanceMiles,
        targetValue: 5000,
        label: `${s.totalDistanceMiles.toLocaleString()} / 5,000 miles`,
        statusText: s.totalDistanceMiles >= 5000 
          ? 'Stamped and collected.' 
          : `${(5000 - s.totalDistanceMiles).toLocaleString()} more miles of range to go.`
      })
    },
    {
      id: 'scholar',
      title: 'The Scholar',
      description: 'Answer 50 state facts correctly.',
      icon: 'book-outline',
      color: 'warning',
      predicate: (s) => s.totalCorrect >= 50,
      getProgress: (s) => ({
        currentValue: s.totalCorrect,
        targetValue: 50,
        label: `${s.totalCorrect} / 50 correct`,
        statusText: s.totalCorrect >= 50 
          ? 'Stamped and collected.' 
          : `${50 - s.totalCorrect} more right answers to go.`
      })
    },
    {
      id: 'collector',
      title: 'Master Collector',
      description: 'Find 25 different state plates.',
      icon: 'trophy-outline',
      color: 'danger',
      predicate: (s) => s.foundCount >= 25,
      getProgress: (s) => ({
        currentValue: s.foundCount,
        targetValue: 25,
        label: `${s.foundCount} / 25 plates found`,
        statusText: s.foundCount >= 25 
          ? 'Stamped and collected.' 
          : `${25 - s.foundCount} more plates to collect.`
      })
    },
    {
      id: 'coast-to-coast',
      title: 'Coast to Coast',
      description: 'Find plates from both the East and West coasts.',
      icon: 'swap-horizontal-outline',
      color: 'secondary',
      predicate: (s) => this.hasBothCoasts(s),
      getProgress: (s) => {
        const east = s.states.some(st => st.fnd.stateFound && this.eastCoastStateCodes.has(st.Abbrv));
        const west = s.states.some(st => st.fnd.stateFound && this.westCoastStateCodes.has(st.Abbrv));
        const count = (east ? 1 : 0) + (west ? 1 : 0);
        return {
          currentValue: count,
          targetValue: 2,
          label: `${count} / 2 coasts`,
          statusText: count === 2 
            ? 'Stamped and collected.' 
            : this.getCoastStatusText(east, west)
        }
      }
    }
  ];

  private readonly CHALLENGE_DEFINITIONS: ChallengeDef[] = [
    {
      id: 'midwest-run',
      title: 'Midwest Run',
      description: 'Spot three Midwest plates on this route.',
      getProgress: (s) => {
        const currentValue = s.states.filter((state) => state.fnd.stateFound && getStateRegion(state.Abbrv) === 'midwest').length;
        return {
          currentValue,
          targetValue: 3,
          label: `${Math.min(currentValue, 3)} / 3 Midwest plates`,
        };
      },
    },
    {
      id: 'trivia-tune-up',
      title: 'Trivia Tune-Up',
      description: 'Bank six correct trivia answers.',
      getProgress: (s) => ({
        currentValue: s.totalCorrect,
        targetValue: 6,
        label: `${Math.min(s.totalCorrect, 6)} / 6 answers`,
      }),
    },
    {
      id: 'long-haul',
      title: 'Long Haul',
      description: 'Reach 1,000 miles of spotting range.',
      getProgress: (s) => ({
        currentValue: s.totalDistanceMiles,
        targetValue: 1000,
        label: `${Math.min(s.totalDistanceMiles, 1000).toLocaleString()} / 1,000 miles`,
      }),
    },
    {
      id: 'coastal-color',
      title: 'Coastal Color',
      description: 'Collect one plate from either coast.',
      getProgress: (s) => {
        const currentValue = s.states.some((state) => state.fnd.stateFound
          && (this.eastCoastStateCodes.has(state.Abbrv) || this.westCoastStateCodes.has(state.Abbrv))) ? 1 : 0;
        return {
          currentValue,
          targetValue: 1,
          label: `${currentValue} / 1 coast plate`,
        };
      },
    },
  ];

  getAchievements(snapshot: GameSnapshot): Achievement[] {
    return this.ACHIEVEMENT_DEFINITIONS.map((def) => ({
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      color: def.color,
      unlocked: def.predicate(snapshot)
    }));
  }

  getGoalProgress(snapshot: GameSnapshot): GoalProgressViewModel[] {
    return this.ACHIEVEMENT_DEFINITIONS.map((def) => {
      const progress = def.getProgress(snapshot);
      return {
        id: def.id,
        title: def.title,
        description: def.description,
        icon: def.icon,
        color: def.color,
        unlocked: def.predicate(snapshot),
        currentValue: progress.currentValue,
        targetValue: progress.targetValue,
        progressPercent: Math.min(progress.currentValue / progress.targetValue, 1) * 100,
        progressLabel: progress.label,
        statusText: progress.statusText || ''
      };
    });
  }

  getRotatingChallenges(snapshot: GameSnapshot, today = new Date()): RotatingChallengeViewModel[] {
    const startIndex = this.getDayOfYear(today) % this.CHALLENGE_DEFINITIONS.length;
    const rotated = [
      ...this.CHALLENGE_DEFINITIONS.slice(startIndex),
      ...this.CHALLENGE_DEFINITIONS.slice(0, startIndex),
    ];

    return rotated.slice(0, 3).map((def) => {
      const progress = def.getProgress(snapshot);
      const cappedCurrent = Math.min(progress.currentValue, progress.targetValue);

      return {
        id: def.id,
        title: def.title,
        description: def.description,
        currentValue: progress.currentValue,
        targetValue: progress.targetValue,
        progressPercent: (cappedCurrent / progress.targetValue) * 100,
        progressLabel: progress.label,
        unlocked: progress.currentValue >= progress.targetValue,
      };
    });
  }

  private hasBothCoasts(s: GameSnapshot): boolean {
    const east = s.states.some(st => st.fnd.stateFound && this.eastCoastStateCodes.has(st.Abbrv));
    const west = s.states.some(st => st.fnd.stateFound && this.westCoastStateCodes.has(st.Abbrv));
    return east && west;
  }

  private getCoastStatusText(eastCoastFound: boolean, westCoastFound: boolean): string {
    if (!eastCoastFound && !westCoastFound) {
      return 'Find one East Coast and one West Coast plate.';
    }

    if (!eastCoastFound) {
      return 'One East Coast plate will finish this route.';
    }

    return 'One West Coast plate will finish this route.';
  }

  private getDayOfYear(date: Date): number {
    const start = Date.UTC(date.getUTCFullYear(), 0, 0);
    const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

    return Math.floor((current - start) / 86_400_000);
  }
}
