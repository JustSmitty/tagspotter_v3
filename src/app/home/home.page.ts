import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { DecimalPipe, NgIf, NgFor, UpperCasePipe } from '@angular/common';
import {
  IonHeader,
  IonContent,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  ModalController,
  IonToggle,
  IonSegment,
  IonSegmentButton,
  AlertController,
  ToastController
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { helpCircleOutline, refreshOutline, ribbonOutline, logOutOutline } from 'ionicons/icons';

import { QuizDismissResult, QuizSession, StateCardViewModel, QuizDifficulty } from '../models/game-state.model';
import { GameStateStore } from '../services/game-state.store';
import { QuizModalComponent } from '../shared/quiz-modal/quiz-modal.component';
import { OnboardingModalComponent } from '../shared/onboarding-modal/onboarding-modal.component';
import { RoadAtlasComponent } from '../shared/road-atlas/road-atlas.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    NgIf,
    NgFor,
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

  constructor() {
    addIcons({ helpCircleOutline, refreshOutline, ribbonOutline, logOutOutline });
  }

  async onToggleGameMode(event?: any): Promise<void> {
    const nextMode = this.gameMode() === 'trivia' ? 'classic' : 'trivia';
    await this.gameStateStore.setGameMode(nextMode);
  }

  async onDifficultyChange(event: any): Promise<void> {
    await this.gameStateStore.setDifficulty(event.detail.value as QuizDifficulty);
  }

  async ngOnInit(): Promise<void> {
    await this.gameStateStore.hydrate();
    
    if (!this.hasSeenOnboarding()) {
      await this.openOnboarding();
    }
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
        { text: 'Reset Everything', role: 'confirm', handler: () => this.gameStateStore.resetProgress() }
      ],
      cssClass: 'ephemera-alert'
    });
    await alert.present();
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
      return;
    }

    const quizSession = await this.gameStateStore.recordFoundState(state.id);

    // Check for location errors via the new structured signal
    const locationError = this.gameStateStore.locationError();
    if (locationError === 'PERMISSION_DENIED') {
      await this.showLocationSettingsAlert();
    }

    if (quizSession && this.gameMode() === 'trivia') {
      await this.runQuizSession(quizSession);
    }

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

  trackByStateId(_: number, state: StateCardViewModel): number {
    return state.id;
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

  private async runQuizSession(quizSession: QuizSession): Promise<void> {
    let totalCorrect = 0;

    for (let index = 0; index < quizSession.questions.length; index += 1) {
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

    await this.gameStateStore.completeQuiz(quizSession.stateId, totalCorrect);
  }

  private isAnsweredResult(result: QuizDismissResult | undefined): result is Extract<QuizDismissResult, { kind: 'answered' }> {
    return result?.kind === 'answered';
  }
}
