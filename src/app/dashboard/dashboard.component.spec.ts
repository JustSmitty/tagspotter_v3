import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardViewModel } from '../models/game-state.model';
import { GameStateStore } from '../services/game-state.store';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let gameStateStore: jasmine.SpyObj<GameStateStore> & { dashboardViewModel: WritableSignal<DashboardViewModel> };

  beforeEach(async () => {
    gameStateStore = Object.assign(
      jasmine.createSpyObj<GameStateStore>('GameStateStore', ['hydrate']),
      {
        dashboardViewModel: signal<DashboardViewModel>({
          points: {
            state: 2,
            question: 3,
            distance: 1,
            states: 2,
            quiz: 3,
            total: 6,
            miles: 432,
          },
          foundCount: 2,
          totalStates: 50,
          totalCorrect: 3,
          totalDistanceMiles: 432,
          states: [
            {
              id: 1,
              code: 'AL',
              name: 'Alabama',
              isFound: true,
              distanceFound: 210,
              questionsCorrect: 2,
              flagUrl: '/assets/stateflags/Alabama.svg',
            },
            {
              id: 2,
              code: 'AK',
              name: 'Alaska',
              isFound: false,
              distanceFound: 0,
              questionsCorrect: 0,
              flagUrl: '/assets/stateflags/Alaska.svg',
            },
          ],
          achievements: [
            {
              id: 'pioneer',
              title: 'The Pioneer',
              description: 'Find your first state license plate.',
              icon: 'map-outline',
              color: 'primary',
              unlocked: true,
            },
          ],
        }),
      },
    );
    gameStateStore.hydrate.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [{ provide: GameStateStore, useValue: gameStateStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders stamps and achievements from the store view model', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('.state-stamp').length).toBe(2);
    expect(compiled.querySelector('.state-stamp.filled')?.textContent?.trim()).toBe('AL');
    expect(compiled.querySelector('.badge-name')?.textContent).toContain('THE PIONEER');
  });
});
