import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';

import { SummaryViewModel } from '../models/game-state.model';
import { GameStateStore } from '../services/game-state.store';
import { SummaryPage } from './summary.page';

describe('SummaryPage', () => {
  let component: SummaryPage;
  let fixture: ComponentFixture<SummaryPage>;
  let gameStateStore: jasmine.SpyObj<GameStateStore> & {
    summaryViewModel: WritableSignal<SummaryViewModel>;
  };
  let router: jasmine.SpyObj<Router>;
  let toastController: jasmine.SpyObj<ToastController>;
  let originalShare: unknown;
  let originalClipboard: unknown;

  beforeEach(async () => {
    originalShare = navigator.share;
    originalClipboard = navigator.clipboard;
    gameStateStore = Object.assign(
      jasmine.createSpyObj<GameStateStore>('GameStateStore', ['hydrate', 'resetProgress']),
      {
        summaryViewModel: signal<SummaryViewModel>({
          foundCount: 12,
          totalStates: 51,
          finalScore: 42,
          miles: 1234,
          distribution: {
            classicStates: 3,
            easyStates: 4,
            medStates: 3,
            hardStates: 2,
            total: 12,
          },
        }),
      },
    );
    gameStateStore.hydrate.and.resolveTo();
    gameStateStore.resetProgress.and.resolveTo();
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    toastController = jasmine.createSpyObj<ToastController>('ToastController', ['create']);
    toastController.create.and.resolveTo({
      present: async () => undefined,
    } as any);

    await TestBed.configureTestingModule({
      imports: [SummaryPage],
      providers: [
        { provide: GameStateStore, useValue: gameStateStore },
        { provide: Router, useValue: router },
        { provide: ToastController, useValue: toastController },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SummaryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'share', {
      value: originalShare,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });
  });

  it('uses native sharing when available', async () => {
    const share = jasmine.createSpy('share').and.resolveTo();
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
    });

    await component.shareSummary();

    expect(share).toHaveBeenCalledWith(jasmine.objectContaining({
      title: 'Tag Spotter Road Log',
      text: jasmine.stringMatching(/12\/51 plates found/),
    }));
    expect(toastController.create).not.toHaveBeenCalled();
  });

  it('copies the share card when native sharing is unavailable', async () => {
    const writeText = jasmine.createSpy('writeText').and.resolveTo();
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    await component.shareSummary();

    expect(writeText).toHaveBeenCalledWith(jasmine.stringMatching(/42 final points/));
    expect(toastController.create).toHaveBeenCalledWith(jasmine.objectContaining({
      message: 'Road log copied for sharing.',
    }));
  });
});
