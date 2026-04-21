import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TriviaViewModel } from '../models/game-state.model';
import { GameStateStore } from '../services/game-state.store';
import { TriviaComponent } from './trivia.component';

describe('TriviaComponent', () => {
  let component: TriviaComponent;
  let fixture: ComponentFixture<TriviaComponent>;
  let gameStateStore: jasmine.SpyObj<GameStateStore> & { triviaViewModel: WritableSignal<TriviaViewModel> };

  beforeEach(async () => {
    gameStateStore = Object.assign(
      jasmine.createSpyObj<GameStateStore>('GameStateStore', ['hydrate']),
      {
        triviaViewModel: signal<TriviaViewModel>({
          accuracy: 67,
          correctAnswers: 6,
          foundStates: 3,
          perfectPasses: 1,
          totalPossibleAnswers: 9,
          topStates: [
            {
              id: 1,
              code: 'CA',
              name: 'California',
              isFound: true,
              distanceFound: 220,
              questionsCorrect: 3,
              flagUrl: '/assets/stateflags/California.svg',
              region: 'west',
            },
            {
              id: 2,
              code: 'AL',
              name: 'Alabama',
              isFound: true,
              distanceFound: 180,
              questionsCorrect: 2,
              flagUrl: '/assets/stateflags/Alabama.svg',
              region: 'south',
            },
            {
              id: 3,
              code: 'ME',
              name: 'Maine',
              isFound: true,
              distanceFound: 410,
              questionsCorrect: 1,
              flagUrl: '/assets/stateflags/Maine.svg',
              region: 'northeast',
            },
          ],
          featuredStates: [
            {
              id: 1,
              code: 'CA',
              name: 'California',
              isFound: true,
              distanceFound: 220,
              questionsCorrect: 3,
              flagUrl: '/assets/stateflags/California.svg',
              region: 'west',
            },
          ],
          topics: [
            { title: 'Capital', subtitle: 'Match the plate to its capital city.' },
          ],
        }),
      },
    );
    gameStateStore.hydrate.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [TriviaComponent],
      providers: [{ provide: GameStateStore, useValue: gameStateStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(TriviaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders accuracy and top passes from the store', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.stamp-value')?.textContent).toContain('67');
    expect(compiled.querySelectorAll('.leader-card').length).toBe(3);
    expect(compiled.querySelector('.leader-card')?.textContent).toContain('California');
  });
});
