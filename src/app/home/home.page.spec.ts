import { Component, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular/standalone';

import { HomeViewModel, QuizDismissResult, QuizQuestion, QuizSession, QuizDifficulty } from '../models/game-state.model';
import { GameStateStore } from '../services/game-state.store';
import { LocationErrorCode } from '../services/location.service';
import { LocationPrecision } from '../models/location.model';
import { HomePage } from './home.page';
import { RoadAtlasComponent } from '../shared/road-atlas/road-atlas.component';
import { AlertController, ToastController } from '@ionic/angular/standalone';

@Component({
  selector: 'app-road-atlas',
  template: '<div>Mock Road Atlas</div>',
  standalone: true
})
class MockRoadAtlasComponent {}

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let gameStateStore: jasmine.SpyObj<GameStateStore> & { 
    homeViewModel: WritableSignal<HomeViewModel>,
    locationError: WritableSignal<LocationErrorCode | null>,
    difficulty: WritableSignal<QuizDifficulty>,
    gameMode: WritableSignal<'classic' | 'trivia'>,
    hasSeenOnboarding: WritableSignal<boolean>,
    locationPrecision: WritableSignal<LocationPrecision>,
    error: WritableSignal<string | null>
  };
  let modalController: jasmine.SpyObj<ModalController>;
  let alertController: jasmine.SpyObj<AlertController>;
  let toastController: jasmine.SpyObj<ToastController>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    gameStateStore = Object.assign(
      jasmine.createSpyObj<GameStateStore>('GameStateStore', [
        'hydrate',
        'resetProgress',
        'recordFoundState',
        'completeQuiz',
        'setDifficulty',
        'setGameMode',
        'setLocationPrecision',
        'markOnboardingComplete',
        'unspotState'
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
          error: null,
        }),
        locationError: signal<LocationErrorCode | null>(null),
        difficulty: signal<QuizDifficulty>('easy'),
        gameMode: signal<'classic' | 'trivia'>('trivia'),
        hasSeenOnboarding: signal(true),
        locationPrecision: signal<LocationPrecision>('coarse'),
        snapshot: signal({
          states: [
            {
              ID: 1,
              Name: 'Alabama',
              Abbrv: 'AL',
              Lat: 32.806671,
              Lng: -86.79113,
              Capital: 'Montgomery',
              Bird: 'Yellowhammer',
              Flower: 'Camellia',
              Nickname: 'Yellowhammer State',
              flagURL: '/assets/stateflags/Alabama.svg',
              fnd: {
                distance: 0,
                stateFound: false,
                questionsCorrect: 0,
              },
            },
          ],
          points: { state: 0, question: 0, distance: 0 },
          foundCount: 0,
          totalCorrect: 0,
          totalDistanceMiles: 0,
        }),
        error: signal<string | null>(null),
      },
    );
    gameStateStore.hydrate.and.resolveTo();
    gameStateStore.resetProgress.and.resolveTo();
    gameStateStore.completeQuiz.and.resolveTo();
    gameStateStore.setGameMode.and.resolveTo();
    gameStateStore.setDifficulty.and.resolveTo();
    gameStateStore.markOnboardingComplete.and.resolveTo();
    gameStateStore.unspotState.and.resolveTo();

    modalController = jasmine.createSpyObj<ModalController>('ModalController', ['create']);
    alertController = jasmine.createSpyObj<AlertController>('AlertController', ['create']);
    toastController = jasmine.createSpyObj<ToastController>('ToastController', ['create']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    alertController.create.and.resolveTo({
      present: async () => undefined,
      onDidDismiss: async () => ({ role: 'confirm' } as any)
    } as any);

    toastController.create.and.resolveTo({
      present: async () => undefined
    } as any);

    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        { provide: GameStateStore, useValue: gameStateStore },
        { provide: ModalController, useValue: modalController },
        { provide: AlertController, useValue: alertController },
        { provide: ToastController, useValue: toastController },
        { provide: Router, useValue: router },
      ],
    })
    .overrideComponent(HomePage, {
      remove: { imports: [RoadAtlasComponent] },
      add: { imports: [MockRoadAtlasComponent] }
    })
    .compileComponents();

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

    expect(compiled.querySelector('.points-badge')?.textContent).toContain('4');
    expect(compiled.querySelector('.postcard-stats-ledger')?.textContent).toContain('2');
    expect(compiled.querySelector('.postcard-stats-ledger')?.textContent).toContain('732');
    expect(compiled.querySelectorAll('.plate-wrapper').length).toBe(1);
    expect(compiled.querySelector('.plate-tag-text')?.textContent?.trim()).toBe('AL');
  });

  it('renders the game mode control as an accessible switch', async () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const switchButton = compiled.querySelector<HTMLButtonElement>('.brass-switch-wrapper');

    expect(switchButton?.tagName).toBe('BUTTON');
    expect(switchButton?.getAttribute('role')).toBe('switch');
    expect(switchButton?.getAttribute('aria-checked')).toBe('true');

    switchButton?.click();
    await fixture.whenStable();

    expect(gameStateStore.setGameMode).toHaveBeenCalledWith('classic');
  });

  it('records a state and completes the quiz session through the store', async () => {
    const questions: QuizQuestion[] = [
      {
        topic: 'Bird',
        prompt: 'Question 1',
        correctAnswer: 'A',
        options: ['A', 'B', 'C', 'D'],
      },
      {
        topic: 'Capital',
        prompt: 'Question 2',
        correctAnswer: 'A',
        options: ['A', 'B', 'C', 'D'],
      },
      {
        topic: 'Flower',
        prompt: 'Question 3',
        correctAnswer: 'A',
        options: ['A', 'B', 'C', 'D'],
      },
    ];
    const session: QuizSession = {
      stateId: 1,
      stateCode: 'AL',
      stateName: 'Alabama',
      imageSrc: '/assets/stateflags/Alabama.svg',
      questions,
    };

    gameStateStore.recordFoundState.and.resolveTo({ quizSession: session, distanceBonus: Promise.resolve(null) });
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
      },
      {
        topic: 'Capital',
        prompt: 'Question 2',
        correctAnswer: 'A',
        options: ['A', 'B', 'C', 'D'],
      },
      {
        topic: 'Flower',
        prompt: 'Question 3',
        correctAnswer: 'A',
        options: ['A', 'B', 'C', 'D'],
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

    gameStateStore.recordFoundState.and.resolveTo({ quizSession: session, distanceBonus: Promise.resolve(null) });
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

  it('does not record a classic plate when the confirmation is dismissed by the backdrop', async () => {
    gameStateStore.gameMode.set('classic');
    alertController.create.and.resolveTo({
      present: async () => undefined,
      onDidDismiss: async () => ({ role: 'backdrop' }),
    } as any);

    await component.onRecord(gameStateStore.homeViewModel().states[0]);

    expect(gameStateStore.recordFoundState).not.toHaveBeenCalled();
  });

  it('renders an assertive recovery panel when game state loading fails', () => {
    gameStateStore.homeViewModel.set({
      ...gameStateStore.homeViewModel(),
      isLoaded: false,
      error: 'Storage is unavailable.',
    });
    fixture.detectChanges();

    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Storage is unavailable');
    expect(alert?.querySelector('button')?.textContent).toContain('Retry');
  });

  it('shows confirmation feedback after resetting progress', async () => {
    await component.onRefresh();

    expect(gameStateStore.resetProgress).toHaveBeenCalled();
    expect(toastController.create).toHaveBeenCalledWith(jasmine.objectContaining({
      message: jasmine.stringMatching(/Road log cleared/),
      duration: 3000,
    }));
  });

  it('shows a toast when the range bonus fails without a permission denial', async () => {
    // The bonus reports through the returned promise now, not a signal read
    // straight after the call (audit F-06).
    gameStateStore.recordFoundState.and.resolveTo({
      quizSession: null,
      distanceBonus: Promise.resolve<LocationErrorCode | null>('UNAVAILABLE'),
    });

    await component.onRecord(gameStateStore.homeViewModel().states[0]);
    await fixture.whenStable();

    expect(toastController.create).toHaveBeenCalledWith(jasmine.objectContaining({
      message: jasmine.stringMatching(/no range bonus/),
      duration: 3500,
    }));
  });

  it('does not wait for the range bonus before returning', async () => {
    let releaseBonus: (value: LocationErrorCode | null) => void = () => undefined;
    const pending = new Promise<LocationErrorCode | null>((resolve) => { releaseBonus = resolve; });
    gameStateStore.recordFoundState.and.resolveTo({ quizSession: null, distanceBonus: pending });

    // Resolves while the location fix is still outstanding — this is the whole
    // point of F-06: a tap must not hold the UI for the GPS timeout.
    await component.onRecord(gameStateStore.homeViewModel().states[0]);

    expect(gameStateStore.recordFoundState).toHaveBeenCalledWith(1);
    releaseBonus(null);
  });

  it('confirms before removing an already-spotted plate', async () => {
    const spotted = { ...gameStateStore.homeViewModel().states[0], isFound: true };

    await component.onRecord(spotted);

    expect(alertController.create).toHaveBeenCalledWith(jasmine.objectContaining({
      header: jasmine.stringMatching(/Remove Alabama/),
    }));
    expect(gameStateStore.unspotState).toHaveBeenCalledWith(1);
  });
});
