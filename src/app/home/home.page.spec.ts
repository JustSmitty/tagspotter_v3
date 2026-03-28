import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular/standalone';

import { HomeViewModel, QuizDismissResult, QuizQuestion, QuizSession } from '../models/game-state.model';
import { GameStateStore } from '../services/game-state.store';
import { HomePage } from './home.page';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let gameStateStore: jasmine.SpyObj<GameStateStore> & { homeViewModel: WritableSignal<HomeViewModel> };
  let modalController: jasmine.SpyObj<ModalController>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    gameStateStore = Object.assign(
      jasmine.createSpyObj<GameStateStore>('GameStateStore', [
        'hydrate',
        'resetProgress',
        'recordFoundState',
        'completeQuiz',
      ]),
      {
        homeViewModel: signal<HomeViewModel>({
          points: {
            state: 2,
            question: 1,
            distance: 1,
            states: 2,
            quiz: 1,
            total: 4,
            miles: 732,
          },
          states: [
            {
              id: 1,
              code: 'AL',
              name: 'Alabama',
              isFound: false,
              distanceFound: 0,
              questionsCorrect: 0,
              flagUrl: '/assets/stateflags/Alabama.svg',
              region: 'south',
            },
          ],
          isLoaded: true,
          isBusy: false,
        }),
      },
    );
    gameStateStore.hydrate.and.resolveTo();
    gameStateStore.resetProgress.and.resolveTo();
    gameStateStore.completeQuiz.and.resolveTo();

    modalController = jasmine.createSpyObj<ModalController>('ModalController', ['create']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        { provide: GameStateStore, useValue: gameStateStore },
        { provide: ModalController, useValue: modalController },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders state cards from the shared view model', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.motel-marquee')?.textContent).toContain('4');
    expect(compiled.querySelector('.stats-ribbon')?.textContent).toContain('2');
    expect(compiled.querySelector('.stats-ribbon')?.textContent).toContain('732');
    expect(compiled.querySelectorAll('.plate-wrapper').length).toBe(1);
    expect(compiled.querySelector('.plate-tag-text')?.textContent?.trim()).toBe('AL');
  });

  it('records a state and completes the quiz session through the store', async () => {
    const questions: QuizQuestion[] = [
      {
        topic: 'Bird',
        prompt: 'Question 1',
        correctAnswer: 'A',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
      },
      {
        topic: 'Capital',
        prompt: 'Question 2',
        correctAnswer: 'A',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
      },
      {
        topic: 'Flower',
        prompt: 'Question 3',
        correctAnswer: 'A',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
      },
    ];
    const session: QuizSession = {
      stateId: 1,
      stateCode: 'AL',
      stateName: 'Alabama',
      imageSrc: '/assets/stateflags/Alabama.svg',
      questions,
    };

    gameStateStore.recordFoundState.and.resolveTo(session);
    modalController.create.and.callFake(async () => ({
      present: async () => undefined,
      onWillDismiss: async () => ({
        data: {
          kind: 'answered',
          score: 1,
        } as QuizDismissResult,
        role: 'dismiss',
      }),
    } as never));

    await component.onRecord(gameStateStore.homeViewModel().states[0]);

    expect(gameStateStore.recordFoundState).toHaveBeenCalledWith(1);
    expect(modalController.create).toHaveBeenCalledTimes(3);
    expect(gameStateStore.completeQuiz).toHaveBeenCalledWith(1, 3);
  });

  it('stops the quiz loop on cancel and preserves earlier answers', async () => {
    const questions: QuizQuestion[] = [
      {
        topic: 'Bird',
        prompt: 'Question 1',
        correctAnswer: 'A',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
      },
      {
        topic: 'Capital',
        prompt: 'Question 2',
        correctAnswer: 'A',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
      },
      {
        topic: 'Flower',
        prompt: 'Question 3',
        correctAnswer: 'A',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
      },
    ];
    const session: QuizSession = {
      stateId: 1,
      stateCode: 'AL',
      stateName: 'Alabama',
      imageSrc: '/assets/stateflags/Alabama.svg',
      questions,
    };
    const dismissals: QuizDismissResult[] = [
      { kind: 'answered', score: 1 },
      { kind: 'cancelled' },
    ];

    gameStateStore.recordFoundState.and.resolveTo(session);
    modalController.create.and.callFake(async () => ({
      present: async () => undefined,
      onWillDismiss: async () => ({
        data: dismissals.shift(),
        role: 'dismiss',
      }),
    } as never));

    await component.onRecord(gameStateStore.homeViewModel().states[0]);

    expect(modalController.create).toHaveBeenCalledTimes(2);
    expect(gameStateStore.completeQuiz).toHaveBeenCalledWith(1, 1);
  });

  it('does not re-enter store actions while busy or when a state is already found', async () => {
    gameStateStore.homeViewModel.set({
      ...gameStateStore.homeViewModel(),
      isBusy: true,
      states: [
        {
          ...gameStateStore.homeViewModel().states[0],
          isFound: false,
        },
      ],
    });

    await component.onRecord(gameStateStore.homeViewModel().states[0]);
    await component.onRefresh();

    expect(gameStateStore.recordFoundState).not.toHaveBeenCalled();
    expect(gameStateStore.resetProgress).not.toHaveBeenCalled();

    gameStateStore.homeViewModel.set({
      ...gameStateStore.homeViewModel(),
      isBusy: false,
      states: [
        {
          ...gameStateStore.homeViewModel().states[0],
          isFound: true,
        },
      ],
    });

    await component.onRecord(gameStateStore.homeViewModel().states[0]);

    expect(gameStateStore.recordFoundState).not.toHaveBeenCalled();
  });
});
