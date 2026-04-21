import { Injectable } from '@angular/core';
import { AchievementViewModel, GameSnapshot, GoalProgressViewModel } from '../models/game-state.model';

export type Achievement = AchievementViewModel;

interface AchievementDef extends Omit<AchievementViewModel, 'unlocked'> {
  predicate: (snapshot: GameSnapshot) => boolean;
  getProgress: (snapshot: GameSnapshot) => { currentValue: number; targetValue: number; label: string; statusText?: string };
}

@Injectable({
  providedIn: 'root'
})
export class AchievementService {
  private readonly eastCoastStateCodes = new Set(['CT', 'DE', 'FL', 'GA', 'MA', 'MD', 'ME', 'NC', 'NH', 'NJ', 'NY', 'RI', 'SC', 'VA']);
  private readonly westCoastStateCodes = new Set(['AK', 'CA', 'HI', 'OR', 'WA']);

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
      description: 'Travel over 5,000 cumulative miles.',
      icon: 'car-outline',
      color: 'success',
      predicate: (s) => s.totalDistanceMiles >= 5000,
      getProgress: (s) => ({
        currentValue: s.totalDistanceMiles,
        targetValue: 5000,
        label: `${s.totalDistanceMiles.toLocaleString()} / 5,000 miles`,
        statusText: s.totalDistanceMiles >= 5000 
          ? 'Stamped and collected.' 
          : `${(5000 - s.totalDistanceMiles).toLocaleString()} miles left on the odometer.`
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
}
