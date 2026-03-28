import { Injectable } from '@angular/core';
import { AchievementViewModel, GameSnapshot } from '../models/game-state.model';

export type Achievement = AchievementViewModel;

@Injectable({
  providedIn: 'root'
})
export class AchievementService {
  private readonly eastCoastStateCodes = new Set(['CT', 'DE', 'FL', 'GA', 'MA', 'MD', 'ME', 'NC', 'NH', 'NJ', 'NY', 'RI', 'SC', 'VA']);
  private readonly westCoastStateCodes = new Set(['AK', 'CA', 'HI', 'OR', 'WA']);
  private readonly achievements: Omit<Achievement, 'unlocked'>[] = [
    {
      id: 'pioneer',
      title: 'The Pioneer',
      description: 'Find your first state license plate.',
      icon: 'map-outline',
      color: 'primary'
    },
    {
      id: 'road-warrior',
      title: 'Road Warrior',
      description: 'Travel over 5,000 cumulative miles.',
      icon: 'car-outline',
      color: 'success'
    },
    {
      id: 'scholar',
      title: 'The Scholar',
      description: 'Answer 50 state facts correctly.',
      icon: 'book-outline',
      color: 'warning'
    },
    {
      id: 'collector',
      title: 'Master Collector',
      description: 'Find 25 different state plates.',
      icon: 'trophy-outline',
      color: 'danger'
    },
    {
      id: 'coast-to-coast',
      title: 'Coast to Coast',
      description: 'Find plates from both the East and West coasts.',
      icon: 'swap-horizontal-outline',
      color: 'secondary'
    }
  ];

  getAchievements(snapshot: GameSnapshot): Achievement[] {
    const foundStates = snapshot.states.filter((state) => state.fnd.stateFound);

    return this.achievements.map((achievement) => {
      let unlocked = false;
      switch (achievement.id) {
        case 'pioneer':
          unlocked = foundStates.length >= 1;
          break;
        case 'road-warrior':
          unlocked = snapshot.totalDistanceMiles >= 5000;
          break;
        case 'scholar':
          unlocked = snapshot.totalCorrect >= 50;
          break;
        case 'collector':
          unlocked = foundStates.length >= 25;
          break;
        case 'coast-to-coast':
          const eastCoast = foundStates.some((state) => this.eastCoastStateCodes.has(state.Abbrv));
          const westCoast = foundStates.some((state) => this.westCoastStateCodes.has(state.Abbrv));
          unlocked = eastCoast && westCoast;
          break;
      }

      return {
        ...achievement,
        unlocked,
      };
    });
  }
}
