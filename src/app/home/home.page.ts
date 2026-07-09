import { ChangeDetectionStrategy, Component, inject, OnInit, signal, computed } from '@angular/core';
import { DecimalPipe, UpperCasePipe } from '@angular/common';
import {
  IonHeader,
  IonContent,
  IonIcon,
  ModalController,
  AlertController,
  ToastController
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { closeCircle, helpCircleOutline, refreshOutline, ribbonOutline, searchOutline } from 'ionicons/icons';

import { QuizDismissResult, QuizSession, StateCardViewModel, QuizDifficulty, StateRegion } from '../models/game-state.model';
import { LocationPrecision } from '../models/location.model';
import { GameStateStore } from '../services/game-state.store';
import type { LocationErrorCode } from '../services/location.service';
import { QuizModalComponent } from '../shared/quiz-modal/quiz-modal.component';
import { OnboardingModalComponent } from '../shared/onboarding-modal/onboarding-modal.component';
import { RoadAtlasComponent } from '../shared/road-atlas/road-atlas.component';
import { Preferences } from '@capacitor/preferences';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    IonHeader,
    IonContent,
    IonIcon,
    RoadAtlasComponent,
    UpperCasePipe,
    DecimalPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnInit {
  private readonly gameStateStore = inject(GameStateStore);
  private readonly modalController = inject(ModalController);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);
  private readonly router = inject(Router);

  readonly viewModel = this.gameStateStore.homeViewModel;
  readonly difficulty = this.gameStateStore.difficulty;
  readonly gameMode = this.gameStateStore.gameMode;
  readonly hasSeenOnboarding = this.gameStateStore.hasSeenOnboarding;
  readonly locationPrecision = this.gameStateStore.locationPrecision;

  readonly searchQuery = signal('');
  readonly selectedRegion = signal<StateRegion | 'all'>('all');

  readonly filteredStates = computed(() => {
    const states = this.viewModel().states;
    const query = this.searchQuery().toLowerCase().trim();
    const region = this.selectedRegion();

    return states.filter((state) => {
      const matchesQuery = !query || state.name.toLowerCase().includes(query) || state.code.toLowerCase().includes(query);
      const matchesRegion = region === 'all' || state.region === region;
      return matchesQuery && matchesRegion;
    });
  });

  constructor() {
    addIcons({ closeCircle, helpCircleOutline, refreshOutline, ribbonOutline, searchOutline });
  }

  async onToggleGameMode(): Promise<void> {
    const nextMode = this.gameMode() === 'trivia' ? 'classic' : 'trivia';
    await this.gameStateStore.setGameMode(nextMode);
  }

  async onDifficultyChange(difficulty: QuizDifficulty): Promise<void> {
    await this.gameStateStore.setDifficulty(difficulty);
  }

  async ngOnInit(): Promise<void> {
    await this.gameStateStore.hydrate();
    
    if (!this.hasSeenOnboarding()) {
      await this.openOnboarding();
    }

    this.preloadFlags();
    await this.checkAndResumeQuiz();
  }

  private preloadFlags(): void {
    const states = this.viewModel().states;
    if (!states || !states.length) {
      return;
    }

    states.forEach((state) => {
      if (state.flagUrl) {
        const img = new Image();
        img.src = state.flagUrl;
      }
    });
  }

  private async checkAndResumeQuiz(): Promise<void> {
    const { value } = await Preferences.get({ key: 'temp_quiz_session' });
    if (!value) {
      return;
    }

    try {
      const saved = JSON.parse(value);
      const alert = await this.alertController.create({
        header: 'Resume Quiz?',
        message: `We found an unfinished trivia quiz for ${saved.stateName} from your last session. Would you like to resume it?`,
        buttons: [
          {
            text: 'Discard',
            role: 'cancel',
            handler: () => {
              void this.clearTempQuizSession();
            }
          },
          {
            text: 'Resume',
            role: 'confirm',
            handler: () => {
              const quizSession: QuizSession = {
                stateId: saved.stateId,
                stateCode: saved.stateCode,
                stateName: saved.stateName,
                imageSrc: saved.imageSrc,
                questions: saved.questions
              };
              void this.runQuizSession(quizSession, saved.currentIndex, saved.totalCorrect);
            }
          }
        ],
        cssClass: 'ephemera-alert'
      });
      await alert.present();
    } catch {
      void this.clearTempQuizSession();
    }
  }

  private async saveTempQuizSession(session: QuizSession, currentIndex: number, totalCorrect: number): Promise<void> {
    const data = {
      stateId: session.stateId,
      stateCode: session.stateCode,
      stateName: session.stateName,
      imageSrc: session.imageSrc,
      questions: session.questions,
      currentIndex,
      totalCorrect
    };
    await Preferences.set({
      key: 'temp_quiz_session',
      value: JSON.stringify(data)
    });
  }

  private async clearTempQuizSession(): Promise<void> {
    await Preferences.remove({ key: 'temp_quiz_session' });
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  onSelectRegion(region: StateRegion | 'all'): void {
    this.selectedRegion.set(region);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedRegion.set('all');
  }

  async onSetLocationPrecision(precision: LocationPrecision): Promise<void> {
    if (this.locationPrecision() === precision) {
      return;
    }

    await this.gameStateStore.setLocationPrecision(precision);
  }

  async onRefresh(): Promise<void> {
    if (this.viewModel().isBusy) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Reset Trip?',
      message: 'This will clear all your progress. This action cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Reset Everything', role: 'confirm', handler: () => this.resetProgressWithFeedback() }
      ],
      cssClass: 'ephemera-alert'
    });
    await alert.present();
  }


  async onMapSpot(stateId: number): Promise<void> {
    const state = this.viewModel().states.find((candidate) => candidate.id === stateId);

    if (state) {
      await this.onRecord(state);
    }
  }

  async onRecord(state: StateCardViewModel): Promise<void> {
    if (this.viewModel().isBusy) {
      return;
    }

    if (state.isFound) {
      await this.showAlreadyFoundToast(state.name);
      return;
    }

    let shouldProceed = true;

    if (this.gameMode() === 'classic') {
      const alert = await this.alertController.create({
        header: `Spotted ${state.name}?`,
        message: `Did you spot the ${state.name} license plate?`,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => { shouldProceed = false; }
          },
          {
            text: 'Yes, Spotted It!',
            role: 'confirm'
          }
        ],
        cssClass: 'ephemera-alert'
      });
      await alert.present();
      await alert.onDidDismiss();
    }

    if (!shouldProceed) {
      document.getElementById('state-btn-' + state.id)?.focus();
      return;
    }

    const quizSession = await this.gameStateStore.recordFoundState(state.id);

    await this.showLocationFeedback(this.gameStateStore.locationError());

    if (quizSession && this.gameMode() === 'trivia') {
      await this.runQuizSession(quizSession);
    }

    // Restore focus to the state card button
    document.getElementById('state-btn-' + state.id)?.focus();

    // Check for end of game after state is recorded
    if (this.gameStateStore.snapshot().foundCount >= this.gameStateStore.snapshot().states.length) {
      this.openSummary();
    }
  }

  openDashboard(): void {
    void this.router.navigate(['/dashboard']);
  }

  openSummary(): void {
    void this.router.navigate(['/summary']);
  }


  async openOnboarding(): Promise<void> {
    const modal = await this.modalController.create({
      component: OnboardingModalComponent,
      cssClass: 'ephemera-modal handbook-modal'
    });

    await modal.present();
    await modal.onDidDismiss();
    await this.gameStateStore.markOnboardingComplete();
  }

  private async showAlreadyFoundToast(stateName: string): Promise<void> {
    const toast = await this.toastController.create({
      message: `You've already collected the ${stateName} lucky plate!`,
      duration: 3000,
      position: 'bottom',
      cssClass: 'teletype-toast'
    });
    await toast.present();
  }

  private async resetProgressWithFeedback(): Promise<void> {
    await this.gameStateStore.resetProgress();

    const toast = await this.toastController.create({
      message: 'Trip reset. Your road log is ready for a fresh start.',
      duration: 3000,
      position: 'bottom',
      cssClass: 'teletype-toast'
    });
    await toast.present();
  }

  private async showLocationSettingsAlert(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Location Bonus',
      message: 'To collect distance bonuses, please enable location permissions for Tag Spotter in your device settings.',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ],
      cssClass: 'ephemera-alert'
    });
    await alert.present();
  }

  private async showLocationFeedback(locationError: LocationErrorCode | null): Promise<void> {
    if (!locationError) {
      return;
    }

    if (locationError === 'PERMISSION_DENIED') {
      await this.showLocationSettingsAlert();
      return;
    }

    const messages: Record<Exclude<LocationErrorCode, 'PERMISSION_DENIED'>, string> = {
      UNAVAILABLE: 'Location services are unavailable, so this plate was collected without a distance bonus.',
      TIMEOUT: 'Location lookup timed out, so this plate was collected without a distance bonus.',
      UNKNOWN: 'Distance bonus is unavailable right now, but your plate was still collected.',
    };

    const toast = await this.toastController.create({
      message: messages[locationError],
      duration: 3500,
      position: 'bottom',
      cssClass: 'teletype-toast'
    });
    await toast.present();
  }

  private async runQuizSession(quizSession: QuizSession, startFromIndex = 0, initialCorrect = 0): Promise<void> {
    let totalCorrect = initialCorrect;

    for (let index = startFromIndex; index < quizSession.questions.length; index += 1) {
      await this.saveTempQuizSession(quizSession, index, totalCorrect);

      const question = quizSession.questions[index];
      const modal = await this.modalController.create({
        component: QuizModalComponent,
        componentProps: {
          question,
          stateCode: quizSession.stateCode,
          stateName: quizSession.stateName,
          imageSrc: quizSession.imageSrc,
          questionIndex: index,
          questionCount: quizSession.questions.length,
        },
        cssClass: 'ephemera-modal quiz-modal'
      });

      await modal.present();
      const result = await modal.onWillDismiss();

      if (!this.isAnsweredResult(result.data)) {
        // User tried to cancel/close the quiz halfway
        const confirmCancel = await this.alertController.create({
          header: 'Quit Quiz?',
          message: 'If you leave now, you will lose the chance to earn trivia points for this state. Are you sure?',
          buttons: [
            {
              text: 'Stay',
              role: 'cancel'
            },
            {
              text: 'Yes, Quit',
              role: 'confirm'
            }
          ],
          cssClass: 'ephemera-alert'
        });

        await confirmCancel.present();
        const { role } = await confirmCancel.onDidDismiss();

        if (role === 'confirm') {
          break; // Stop the quiz loop and finalize current score
        } else {
          // Stay in the current question by decrementing the loop index
          index -= 1;
          continue;
        }
      }

      totalCorrect += result.data.score;
    }

    await this.clearTempQuizSession();
    await this.gameStateStore.completeQuiz(quizSession.stateId, totalCorrect);
  }

  private isAnsweredResult(result: QuizDismissResult | undefined): result is Extract<QuizDismissResult, { kind: 'answered' }> {
    return result?.kind === 'answered';
  }
}
