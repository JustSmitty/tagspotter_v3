import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ModalController, ToastController } from '@ionic/angular/standalone';

import { HomeViewModel, QuizSession, StateCardViewModel, StoredQuizSession } from '../models/game-state.model';
import { GameStateStore } from './game-state.store';
import { HomeWorkflowService } from './home-workflow.service';
import { NativeUiService } from './platform/native-ui.service';
import { QuizSessionRepository } from './quiz-session.repository';

/**
 * The most complex file in the app and previously the only one with no spec at
 * all (audit F-37). Everything here is sequencing — dialogs, modals, and the
 * order they happen in — which is exactly the kind of logic that breaks
 * silently and is invisible to type checking.
 */
describe('HomeWorkflowService', () => {
  let workflow: HomeWorkflowService;
  let store: jasmine.SpyObj<GameStateStore> & {
    homeViewModel: ReturnType<typeof signal<HomeViewModel>>;
    gameMode: ReturnType<typeof signal<'classic' | 'trivia'>>;
    hasSeenOnboarding: ReturnType<typeof signal<boolean>>;
    snapshot: ReturnType<typeof signal<{ states: unknown[]; foundCount: number }>>;
  };
  let modalController: jasmine.SpyObj<ModalController>;
  let alertController: jasmine.SpyObj<AlertController>;
  let toastController: jasmine.SpyObj<ToastController>;
  let quizSessions: jasmine.SpyObj<QuizSessionRepository>;
  let nativeUi: jasmine.SpyObj<NativeUiService>;
  let router: jasmine.SpyObj<Router>;

  /** Roles the next alerts will dismiss with, in order. */
  let alertRoles: string[];
  /** Data the next quiz modals will dismiss with, in order. */
  let modalData: unknown[];

  const unspottedState: StateCardViewModel = {
    id: 1, code: 'AL', name: 'Alabama', isFound: false,
    distanceFound: 0, questionsCorrect: 0, flagUrl: '', region: 'south',
  };
  const spottedState: StateCardViewModel = { ...unspottedState, isFound: true };

  function buildSession(questionCount = 3): QuizSession {
    return {
      stateId: 1, stateCode: 'AL', stateName: 'Alabama', imageSrc: '',
      questions: Array.from({ length: questionCount }, (_, index) => ({
        topic: 'Bird' as const, prompt: `Q${index}`, correctAnswer: 'A', options: ['A', 'B'], points: 1,
      })),
    };
  }

  beforeEach(() => {
    alertRoles = [];
    modalData = [];

    store = Object.assign(
      jasmine.createSpyObj<GameStateStore>('GameStateStore', [
        'hydrate', 'recordFoundState', 'unspotState', 'completeQuiz', 'resetProgress',
        'markOnboardingComplete', 'setGameMode', 'setDifficulty', 'setLocationPrecision',
        'retryHydrate', 'clearError',
      ]),
      {
        homeViewModel: signal({ isBusy: false, states: [unspottedState] } as unknown as HomeViewModel),
        gameMode: signal<'classic' | 'trivia'>('classic'),
        hasSeenOnboarding: signal(true),
        snapshot: signal({ states: [{}, {}], foundCount: 0 }),
      },
    );
    store.hydrate.and.resolveTo();
    store.unspotState.and.resolveTo();
    store.completeQuiz.and.resolveTo();
    store.resetProgress.and.resolveTo();
    store.markOnboardingComplete.and.resolveTo();
    store.recordFoundState.and.resolveTo({ quizSession: null, distanceBonus: Promise.resolve(null) });

    modalController = jasmine.createSpyObj<ModalController>('ModalController', ['create']);
    alertController = jasmine.createSpyObj<AlertController>('AlertController', ['create']);
    toastController = jasmine.createSpyObj<ToastController>('ToastController', ['create']);
    quizSessions = jasmine.createSpyObj<QuizSessionRepository>('QuizSessionRepository', ['load', 'save', 'clear']);
    nativeUi = jasmine.createSpyObj<NativeUiService>('NativeUiService', ['openAppSettings', 'impact']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    quizSessions.load.and.resolveTo(null);
    quizSessions.save.and.resolveTo();
    quizSessions.clear.and.resolveTo();
    nativeUi.openAppSettings.and.resolveTo(true);
    router.navigate.and.resolveTo(true);

    alertController.create.and.callFake(async () => ({
      present: async () => undefined,
      onDidDismiss: async () => ({ role: alertRoles.shift() ?? 'confirm' }),
    }) as never);
    modalController.create.and.callFake(async () => ({
      present: async () => undefined,
      onDidDismiss: async () => ({ role: 'dismiss' }),
      onWillDismiss: async () => ({ data: modalData.shift(), role: 'dismiss' }),
    }) as never);
    toastController.create.and.resolveTo({ present: async () => undefined } as never);

    TestBed.configureTestingModule({
      providers: [
        HomeWorkflowService,
        { provide: GameStateStore, useValue: store },
        { provide: ModalController, useValue: modalController },
        { provide: AlertController, useValue: alertController },
        { provide: ToastController, useValue: toastController },
        { provide: QuizSessionRepository, useValue: quizSessions },
        { provide: NativeUiService, useValue: nativeUi },
        { provide: Router, useValue: router },
      ],
    });
    workflow = TestBed.inject(HomeWorkflowService);
  });

  describe('recordState', () => {
    it('confirms before spotting in classic mode', async () => {
      alertRoles = ['cancel'];

      await workflow.recordState(unspottedState);

      expect(alertController.create).toHaveBeenCalled();
      expect(store.recordFoundState).not.toHaveBeenCalled();
    });

    it('also confirms in trivia mode', async () => {
      // Audit F-05: trivia mode used to skip the confirm entirely, so a stray
      // tap committed the plate and opened a quiz with no way back.
      store.gameMode.set('trivia');
      alertRoles = ['cancel'];

      await workflow.recordState(unspottedState);

      expect(alertController.create).toHaveBeenCalled();
      expect(store.recordFoundState).not.toHaveBeenCalled();
    });

    it('returns without waiting for the range bonus', async () => {
      let release: (value: null) => void = () => undefined;
      const pending = new Promise<null>((resolve) => { release = resolve; });
      store.recordFoundState.and.resolveTo({ quizSession: null, distanceBonus: pending as never });

      await workflow.recordState(unspottedState);

      // Audit F-06: resolving here while the fix is still outstanding is the
      // whole point — the UI is interactive again.
      expect(store.recordFoundState).toHaveBeenCalledWith(1);
      release(null);
    });

    it('uses the mode captured at entry even if it changes mid-dialog', async () => {
      // Audit F-15: the mode used to be re-read after the await.
      store.gameMode.set('trivia');
      store.recordFoundState.and.callFake(async () => {
        store.gameMode.set('classic');
        return { quizSession: buildSession(1), distanceBonus: Promise.resolve(null) };
      });
      modalData = [{ kind: 'answered', score: 1 }];

      await workflow.recordState(unspottedState);

      expect(modalController.create).toHaveBeenCalledTimes(1);
      expect(store.completeQuiz).toHaveBeenCalledWith(1, 1);
    });

    it('navigates to the summary once every plate is spotted', async () => {
      store.snapshot.set({ states: [{}, {}], foundCount: 2 });

      await workflow.recordState(unspottedState);

      expect(router.navigate).toHaveBeenCalledWith(['/summary']);
    });
  });

  describe('un-spotting', () => {
    it('confirms, then removes the plate', async () => {
      alertRoles = ['confirm'];

      await workflow.recordState(spottedState);

      expect(alertController.create).toHaveBeenCalledWith(jasmine.objectContaining({
        header: 'Remove Alabama?',
      }));
      expect(store.unspotState).toHaveBeenCalledWith(1);
    });

    it('does nothing when the confirm is declined', async () => {
      alertRoles = ['cancel'];

      await workflow.recordState(spottedState);

      expect(store.unspotState).not.toHaveBeenCalled();
    });

    it('clears a saved quiz belonging to the removed state', async () => {
      // Same class as pm-0001-stale-quiz-session: a sidecar key outliving the
      // state it belongs to, ready to award points against an unspotted plate.
      alertRoles = ['confirm'];
      quizSessions.load.and.resolveTo({ ...buildSession(), currentIndex: 1, totalCorrect: 1 } as StoredQuizSession);

      await workflow.recordState(spottedState);

      expect(quizSessions.clear).toHaveBeenCalled();
    });

    it('leaves a saved quiz for a different state alone', async () => {
      alertRoles = ['confirm'];
      quizSessions.load.and.resolveTo({ ...buildSession(), stateId: 42, currentIndex: 0, totalCorrect: 0 } as StoredQuizSession);

      await workflow.recordState(spottedState);

      expect(quizSessions.clear).not.toHaveBeenCalled();
    });
  });

  describe('quiz sessions', () => {
    it('runs every question and banks the total', async () => {
      store.gameMode.set('trivia');
      store.recordFoundState.and.resolveTo({ quizSession: buildSession(3), distanceBonus: Promise.resolve(null) });
      modalData = [
        { kind: 'answered', score: 1 },
        { kind: 'answered', score: 0 },
        { kind: 'answered', score: 1 },
      ];

      await workflow.recordState(unspottedState);

      expect(modalController.create).toHaveBeenCalledTimes(3);
      expect(quizSessions.save).toHaveBeenCalledTimes(3);
      expect(store.completeQuiz).toHaveBeenCalledWith(1, 2);
      expect(quizSessions.clear).toHaveBeenCalled();
    });

    it('re-presents the same question when a quit is declined', async () => {
      store.gameMode.set('trivia');
      store.recordFoundState.and.resolveTo({ quizSession: buildSession(1), distanceBonus: Promise.resolve(null) });
      modalData = [undefined, { kind: 'answered', score: 1 }];
      alertRoles = ['confirm', 'cancel']; // spot confirm, then decline the quit

      await workflow.recordState(unspottedState);

      expect(modalController.create).toHaveBeenCalledTimes(2);
      expect(store.completeQuiz).toHaveBeenCalledWith(1, 1);
    });

    it('forfeits the rest of the quiz but keeps points already earned', async () => {
      store.gameMode.set('trivia');
      store.recordFoundState.and.resolveTo({ quizSession: buildSession(3), distanceBonus: Promise.resolve(null) });
      modalData = [{ kind: 'answered', score: 1 }, undefined];
      alertRoles = ['confirm', 'confirm']; // spot confirm, then confirm the quit

      await workflow.recordState(unspottedState);

      expect(store.completeQuiz).toHaveBeenCalledWith(1, 1);
    });

    it('offers to resume a saved session on start-up', async () => {
      quizSessions.load.and.resolveTo({ ...buildSession(2), currentIndex: 1, totalCorrect: 1 } as StoredQuizSession);
      alertRoles = ['confirm'];
      modalData = [{ kind: 'answered', score: 1 }];

      await workflow.initialize();

      // Resumes at index 1, so only the remaining question is presented, and
      // the score it was saved with is carried forward.
      expect(modalController.create).toHaveBeenCalledTimes(1);
      expect(store.completeQuiz).toHaveBeenCalledWith(1, 2);
    });

    it('discards a saved session when the player declines', async () => {
      quizSessions.load.and.resolveTo({ ...buildSession(2), currentIndex: 1, totalCorrect: 1 } as StoredQuizSession);
      alertRoles = ['cancel'];

      await workflow.initialize();

      expect(quizSessions.clear).toHaveBeenCalled();
      expect(modalController.create).not.toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('opens the handbook for a first-time player', async () => {
      store.hasSeenOnboarding.set(false);

      await workflow.initialize();

      expect(modalController.create).toHaveBeenCalled();
      expect(store.markOnboardingComplete).toHaveBeenCalled();
    });

    it('stops quietly when hydration fails', async () => {
      store.hydrate.and.rejectWith(new Error('storage gone'));

      await workflow.initialize();

      expect(modalController.create).not.toHaveBeenCalled();
      expect(quizSessions.load).not.toHaveBeenCalled();
    });
  });

  describe('location feedback', () => {
    it('offers to open settings when permission was denied', async () => {
      store.recordFoundState.and.resolveTo({
        quizSession: null,
        distanceBonus: Promise.resolve('PERMISSION_DENIED'),
      });
      alertRoles = ['confirm', 'settings'];

      await workflow.recordState(unspottedState);
      // The feedback is deliberately fire-and-forget so the tap is not blocked
      // (F-06), so the test has to let the detached chain finish. A macrotask
      // drains it; awaiting microtasks is not enough.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(nativeUi.openAppSettings).toHaveBeenCalled();
    });
  });

  describe('confirmReset', () => {
    it('resets and reports when confirmed', async () => {
      alertRoles = ['confirm'];

      await workflow.confirmReset();

      expect(store.resetProgress).toHaveBeenCalled();
      expect(toastController.create).toHaveBeenCalled();
    });

    it('leaves the trip alone when cancelled', async () => {
      alertRoles = ['cancel'];

      await workflow.confirmReset();

      expect(store.resetProgress).not.toHaveBeenCalled();
    });
  });
});
