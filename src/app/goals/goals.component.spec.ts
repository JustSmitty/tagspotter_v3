import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GoalProgressViewModel, GoalsSummaryViewModel, RotatingChallengeViewModel, SouvenirFlagViewModel } from '../models/game-state.model';
import { GameStateStore } from '../services/game-state.store';
import { GoalsComponent } from './goals.component';

describe('GoalsComponent', () => {
  let component: GoalsComponent;
  let fixture: ComponentFixture<GoalsComponent>;
  let gameStateStore: jasmine.SpyObj<GameStateStore> & {
    goalProgress: WritableSignal<GoalProgressViewModel[]>;
    rotatingChallenges: WritableSignal<RotatingChallengeViewModel[]>;
    goalsSouvenirFlags: WritableSignal<SouvenirFlagViewModel[]>;
    goalsSummary: WritableSignal<GoalsSummaryViewModel>;
    challengeStreak: WritableSignal<{ current: number; best: number; lastCompletedDay: string | null }>;
    challengesCompletedToday: WritableSignal<boolean>;
  };

  beforeEach(async () => {
    gameStateStore = Object.assign(
      jasmine.createSpyObj<GameStateStore>('GameStateStore', ['hydrate']),
      {
        goalProgress: signal<GoalProgressViewModel[]>([
          {
            id: 'road-warrior',
            title: 'Road Warrior',
            description: 'Travel over 5,000 cumulative miles.',
            icon: 'car-outline',
            color: 'success',
            unlocked: false,
            currentValue: 2200,
            targetValue: 5000,
            progressPercent: 44,
            progressLabel: '2,200 / 5,000 miles',
            statusText: '2,800 miles left on the odometer.',
          },
        ]),
        goalsSouvenirFlags: signal<SouvenirFlagViewModel[]>([
          {
            code: 'CA',
            name: 'California',
            flagUrl: '/assets/stateflags/California.svg',
          },
        ]),
        rotatingChallenges: signal<RotatingChallengeViewModel[]>([
          {
            id: 'long-haul',
            title: 'Long Haul',
            description: 'Log 1,000 miles from your spotted plates.',
            currentValue: 2200,
            targetValue: 1000,
            progressPercent: 100,
            progressLabel: '1,000 / 1,000 miles',
            unlocked: true,
          },
        ]),
        challengeStreak: signal({ current: 2, best: 5, lastCompletedDay: '2026-08-15' }),
        challengesCompletedToday: signal(false),
        goalsSummary: signal<GoalsSummaryViewModel>({
          total: 5,
          unlocked: 1,
          inProgress: 1,
          nextGoal: {
            id: 'road-warrior',
            title: 'Road Warrior',
            description: 'Travel over 5,000 cumulative miles.',
            icon: 'car-outline',
            color: 'success',
            unlocked: false,
            currentValue: 2200,
            targetValue: 5000,
            progressPercent: 44,
            progressLabel: '2,200 / 5,000 miles',
            statusText: '2,800 miles left on the odometer.',
          },
        }),
      },
    );
    gameStateStore.hydrate.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [GoalsComponent],
      providers: [{ provide: GameStateStore, useValue: gameStateStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(GoalsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders goal progress from the achievement service', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const goalCards = Array.from(compiled.querySelectorAll('.goal-card')).map((card) => card.textContent ?? '');
    const progressLabels = Array.from(compiled.querySelectorAll('.goal-progress')).map((label) => label.textContent ?? '');

    expect(compiled.querySelector('.counter-value')?.textContent).toContain('1/5');
    expect(compiled.querySelector('.challenge-card')?.textContent).toContain('Long Haul');
    expect(goalCards.some((text) => text.includes('Road Warrior'))).toBeTrue();
    expect(progressLabels.some((text) => text.includes('2,200 / 5,000 miles'))).toBeTrue();
  });
});
