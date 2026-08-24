import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ModalController, ToastController } from '@ionic/angular/standalone';

import { LocationPrecision } from '../models/location.model';
import { QuizDifficulty, QuizDismissResult, QuizSession } from '../models/quiz.model';
import { StateCardViewModel } from '../models/game-view.model';
import { OnboardingModalComponent } from '../shared/onboarding-modal/onboarding-modal.component';
import { QuizModalComponent } from '../shared/quiz-modal/quiz-modal.component';
import { GameStateStore, RecordFoundStateResult } from './game-state.store';
import { LocationErrorCode } from './location.service';
import { NativeUiService } from './platform/native-ui.service';
import { QuizSessionRepository } from './quiz-session.repository';

@Injectable({ providedIn: 'root' })
export class HomeWorkflowService {
  private readonly store = inject(GameStateStore);
  private readonly modalController = inject(ModalController);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);
  private readonly router = inject(Router);
  private readonly quizSessions = inject(QuizSessionRepository);
  private readonly nativeUi = inject(NativeUiService);

  async initialize(): Promise<void> {
    try {
      await this.store.hydrate();
    } catch {
      return;
    }

    if (!this.store.hasSeenOnboarding()) await this.openOnboarding();
    await this.checkAndResumeQuiz();
  }

  async toggleGameMode(): Promise<void> {
    try {
      await this.store.setGameMode(this.store.gameMode() === 'trivia' ? 'classic' : 'trivia');
    } catch {
      // The store's error signal drives the recovery panel.
    }
  }

  async changeDifficulty(difficulty: QuizDifficulty): Promise<void> {
    try {
      await this.store.setDifficulty(difficulty);
    } catch {
      // The store's error signal drives the recovery panel.
    }
  }

  async changeLocationPrecision(precision: LocationPrecision): Promise<void> {
    try {
      await this.store.setLocationPrecision(precision);
    } catch {
      // The store's error signal drives the recovery panel.
    }
  }

  async confirmReset(): Promise<void> {
    if (this.store.homeViewModel().isBusy) return;
    const alert = await this.alertController.create({
      header: 'Start a New Trip?',
      message: 'This clears the road log and puts every plate back in the glovebox. Ready to set out again?',
      buttons: [
        { text: 'Keep this trip', role: 'cancel' },
        { text: 'Start new trip', role: 'confirm' },
      ],
      cssClass: 'ephemera-alert',
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role !== 'confirm') return;
    try {
      await this.store.resetProgress();
    } catch {
      return;
    }
    await this.showToast('Road log cleared. Fresh trip, first mile.');
  }

  async recordState(state: StateCardViewModel): Promise<void> {
    if (this.store.homeViewModel().isBusy) return;
    if (state.isFound) {
      await this.confirmUnspot(state);
      return;
    }

    // Read the mode once, before any await. Toggling it while a dialog is open
    // used to desync the stored mode from the quiz that ran (audit F-15).
    const mode = this.store.gameMode();

    // Confirm in both modes. Trivia mode used to commit the plate and open a
    // quiz off a single stray tap, with no way back (audit F-05).
    if (!(await this.confirmPlate(state.name))) {
      this.restoreStateFocus(state.id);
      return;
    }

    let result: RecordFoundStateResult | null;
    try {
      result = await this.store.recordFoundState(state.id);
    } catch {
      this.restoreStateFocus(state.id);
      return;
    }
    if (!result) {
      this.restoreStateFocus(state.id);
      return;
    }

    // The plate is logged and the UI is already interactive; the range bonus
    // reports whenever the fix resolves (audit F-06).
    void result.distanceBonus.then((locationError) => this.showLocationFeedback(locationError));

    if (result.quizSession && mode === 'trivia') await this.runQuizSession(result.quizSession);
    this.restoreStateFocus(state.id);

    const snapshot = this.store.snapshot();
    if (snapshot.foundCount >= snapshot.states.length) await this.router.navigate(['/summary']);
  }

  /**
   * Tapping an already-spotted plate offers to take it back (audit F-04).
   * Putting it here rather than behind a new control keeps the affordance where
   * the mistake happens, and the confirm stops a second stray tap undoing work.
   */
  private async confirmUnspot(state: StateCardViewModel): Promise<void> {
    const alert = await this.alertController.create({
      header: `Remove ${state.name}?`,
      message: `This takes ${state.name} back out of the road log, along with any points it earned.`,
      buttons: [
        { text: 'Keep it', role: 'cancel' },
        { text: 'Remove it', role: 'confirm' },
      ],
      cssClass: 'ephemera-alert',
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role !== 'confirm') {
      this.restoreStateFocus(state.id);
      return;
    }

    try {
      await this.store.unspotState(state.id);
    } catch {
      this.restoreStateFocus(state.id);
      return;
    }

    // A saved quiz for a state that is no longer spotted would score points
    // against an unspotted plate on resume — the same class of bug as
    // pm-0001-stale-quiz-session, which is why this is checked here.
    const saved = await this.quizSessions.load();
    if (saved?.stateId === state.id) await this.quizSessions.clear();

    this.restoreStateFocus(state.id);
    await this.showToast(`${state.name} removed from the road log.`);
  }

  async recordStateById(stateId: number): Promise<void> {
    const state = this.store.homeViewModel().states.find((candidate) => candidate.id === stateId);
    if (state) await this.recordState(state);
  }

  openDashboard(): Promise<boolean> {
    return this.router.navigate(['/dashboard']);
  }

  async openOnboarding(): Promise<void> {
    const modal = await this.modalController.create({
      component: OnboardingModalComponent,
      cssClass: 'ephemera-modal handbook-modal',
    });
    await modal.present();
    await modal.onDidDismiss();
    await this.store.markOnboardingComplete();
  }

  async retryLoad(): Promise<void> {
    try {
      await this.store.retryHydrate();
      await this.checkAndResumeQuiz();
    } catch {
      // The store exposes the actionable failure to the template.
    }
  }

  dismissError(): void {
    this.store.clearError();
  }

  private async confirmPlate(stateName: string): Promise<boolean> {
    const alert = await this.alertController.create({
      header: `Spot ${stateName}?`,
      message: `Did we spot the ${stateName} license plate?`,
      buttons: [
        { text: 'Not yet', role: 'cancel' },
        { text: 'Yes, log it', role: 'confirm' },
      ],
      cssClass: 'ephemera-alert',
    });
    await alert.present();
    return (await alert.onDidDismiss()).role === 'confirm';
  }

  /**
   * A stored session is only resumable if the state it belongs to is still
   * spotted in the save that just hydrated.
   *
   * pm-0001 fixed the one *producer* of a mismatch it knew about (trip reset
   * leaving the sidecar behind) and left the resume path trusting whatever it
   * loaded. That is the wrong place for the invariant, because the session and
   * the save are separate writes and anything that lands between them
   * reproduces the hazard: Android Auto Backup restoring the pair mid-reset
   * (pm-0002), the two un-batched commits in `resetProgress` itself, or a save
   * edited by hand. The consumer can check the pairing directly and does not
   * have to know which of those happened.
   */
  private async checkAndResumeQuiz(): Promise<void> {
    const saved = await this.quizSessions.load();
    if (!saved) return;

    if (!this.isSpottedInCurrentSave(saved.stateId)) {
      // Silent on purpose, but the reason is narrower than it first looks.
      // It holds for a reset caught mid-window and for an un-spotted state:
      // there the player has no memory of spotting it, so a prompt would be
      // about nothing they did.
      //
      // It does NOT hold when the save itself failed to load. StateService
      // rebuilds an all-unspotted seed save from a blob it could not read and
      // resolves normally, so every state reads as unspotted and a quiz the
      // player genuinely left behind is dropped here too. Discarding is still
      // the better of the two options — keeping it offers a resume that
      // completeQuiz will refuse to score — but the loss is real and the
      // player is told nothing about it, because nothing tells them the trip
      // was lost either. That silence is the actual defect and it is upstream.
      await this.quizSessions.clear();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Finish the Quiz?',
      message: `We left the ${saved.stateName} quiz unfinished last time out. Want to pick it back up?`,
      buttons: [
        { text: 'Discard it', role: 'cancel' },
        { text: 'Pick it up', role: 'confirm' },
      ],
      cssClass: 'ephemera-alert',
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'confirm') {
      await this.runQuizSession(saved, saved.currentIndex, saved.totalCorrect);
    } else if (role === 'cancel') {
      await this.quizSessions.clear();
    }
  }

  private async showLocationFeedback(locationError: LocationErrorCode | null): Promise<void> {
    if (!locationError) return;
    if (locationError === 'PERMISSION_DENIED') {
      const alert = await this.alertController.create({
        header: 'Spotting Range Bonus',
        message: 'Turn on location so we can work out how far you are from each state you spot. The trip works fine without it — there just won\'t be a range bonus.',
        buttons: [
          { text: 'Play without it', role: 'cancel' },
          { text: 'Open settings', role: 'settings' },
        ],
        cssClass: 'ephemera-alert',
      });
      await alert.present();
      if ((await alert.onDidDismiss()).role === 'settings') {
        const opened = await this.nativeUi.openAppSettings();
        if (!opened) await this.showToast('Open your device settings and allow location for Tag Spotter.');
      }
      return;
    }

    const messages: Record<Exclude<LocationErrorCode, 'PERMISSION_DENIED'>, string> = {
      UNAVAILABLE: 'Signal is thin out here. Plate is logged, but no range bonus this time.',
      TIMEOUT: 'Location took too long to answer. Plate is logged, but no range bonus.',
      UNKNOWN: 'No range bonus available right now — the plate is safely in the road log.',
    };
    await this.showToast(messages[locationError], 3500);
  }

  private async runQuizSession(quizSession: QuizSession, startFromIndex = 0, initialCorrect = 0): Promise<void> {
    let totalCorrect = initialCorrect;
    for (let index = startFromIndex; index < quizSession.questions.length; index += 1) {
      await this.quizSessions.save(quizSession, index, totalCorrect);
      const modal = await this.modalController.create({
        component: QuizModalComponent,
        componentProps: {
          question: quizSession.questions[index],
          stateCode: quizSession.stateCode,
          stateName: quizSession.stateName,
          imageSrc: quizSession.imageSrc,
          questionIndex: index,
          questionCount: quizSession.questions.length,
        },
        cssClass: 'ephemera-modal quiz-modal',
      });
      await modal.present();
      const result = await modal.onWillDismiss();

      if (!this.isAnsweredResult(result.data)) {
        if (await this.confirmQuitQuiz()) break;
        index -= 1;
        continue;
      }
      totalCorrect += result.data.score;
    }

    await this.quizSessions.clear();
    await this.store.completeQuiz(quizSession.stateId, totalCorrect);
  }

  private isSpottedInCurrentSave(stateId: number): boolean {
    return this.store.snapshot().states.some(
      (state) => state.ID === stateId && state.fnd.stateFound,
    );
  }

  private async confirmQuitQuiz(): Promise<boolean> {
    const alert = await this.alertController.create({
      header: 'Leave the Quiz?',
      message: 'Leaving now forfeits the remaining bonus points for this state. Sure you want to move on?',
      buttons: [
        { text: 'Keep going', role: 'cancel' },
        { text: 'Yes, move on', role: 'confirm' },
      ],
      cssClass: 'ephemera-alert',
    });
    await alert.present();
    return (await alert.onDidDismiss()).role === 'confirm';
  }

  private isAnsweredResult(result: QuizDismissResult | undefined): result is Extract<QuizDismissResult, { kind: 'answered' }> {
    return result?.kind === 'answered';
  }

  private restoreStateFocus(stateId: number): void {
    document.getElementById(`state-btn-${stateId}`)?.focus();
  }

  private async showToast(message: string, duration = 3000): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration,
      position: 'bottom',
      cssClass: 'teletype-toast',
    });
    await toast.present();
  }
}
