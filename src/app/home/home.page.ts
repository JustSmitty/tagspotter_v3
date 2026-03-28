import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonButton,
  IonButtons,
  ModalController
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { refreshCircle, ribbonOutline, search } from 'ionicons/icons';
import { Router } from '@angular/router';

import { QuizDismissResult, QuizSession, StateCardViewModel } from '../models/game-state.model';
import { GameStateStore } from '../services/game-state.store';
import { QuizModalComponent } from '../shared/quiz-modal/quiz-modal.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonIcon,
    IonButton,
    IonButtons
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnInit {
  private readonly gameStateStore = inject(GameStateStore);
  private readonly modalController = inject(ModalController);
  private readonly router = inject(Router);

  readonly viewModel = this.gameStateStore.homeViewModel;

  constructor() {
    addIcons({ search, refreshCircle, ribbonOutline });
  }

  async ngOnInit(): Promise<void> {
    await this.gameStateStore.hydrate();
  }

  async onRefresh(): Promise<void> {
    if (this.viewModel().isBusy) {
      return;
    }

    await this.gameStateStore.resetProgress();
  }

  async onRecord(state: StateCardViewModel): Promise<void> {
    if (this.viewModel().isBusy || state.isFound) {
      return;
    }

    const quizSession = await this.gameStateStore.recordFoundState(state.id);

    if (!quizSession) {
      return;
    }

    await this.runQuizSession(quizSession);
  }

  openDashboard(): void {
    void this.router.navigate(['/dashboard']);
  }

  trackByStateId(_: number, state: StateCardViewModel): number {
    return state.id;
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
      });

      await modal.present();
      const result = await modal.onWillDismiss();

      if (!this.isAnsweredResult(result.data)) {
        break;
      }

      totalCorrect += result.data.score;
    }

    await this.gameStateStore.completeQuiz(quizSession.stateId, totalCorrect);
  }

  private isAnsweredResult(result: QuizDismissResult | undefined): result is Extract<QuizDismissResult, { kind: 'answered' }> {
    return result?.kind === 'answered';
  }
}
