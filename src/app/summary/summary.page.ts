import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertController, IonContent, IonButton, IonIcon, ToastController } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { GameStateStore } from '../services/game-state.store';
import { addIcons } from 'ionicons';
import { refreshOutline, mapOutline, shareSocialOutline } from 'ionicons/icons';
import { ShareService } from '../services/platform/share.service';

@Component({
  selector: 'app-summary',
  templateUrl: './summary.page.html',
  styleUrls: ['./summary.page.scss'],
  standalone: true,
  imports: [IonContent, IonButton, IonIcon, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryPage implements OnInit {
  readonly gameStateStore = inject(GameStateStore);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly alertController = inject(AlertController);
  private readonly shareService = inject(ShareService);
  readonly summary = this.gameStateStore.summaryViewModel;

  constructor() {
    addIcons({ refreshOutline, mapOutline, shareSocialOutline });
  }

  async ngOnInit(): Promise<void> {
    await this.gameStateStore.hydrate();
  }

  async playAgain(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Start a New Trip?',
      message: 'Your current road log will be archived and a fresh trip will begin.',
      buttons: [
        { text: 'Keep This Trip', role: 'cancel' },
        { text: 'Start New Trip', role: 'confirm' },
      ],
      cssClass: 'ephemera-alert',
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role !== 'confirm') return;
    // Navigate even if the reset rejected. Without this, a failed reset left
    // the player on the summary page with no navigation, no message and no
    // retry — this page renders no error surface — so the button simply did
    // nothing. The store records the error for the home page to surface.
    try {
      await this.gameStateStore.resetProgress();
    } finally {
      await this.router.navigate(['/home']);
    }
  }

  async openRoadLog(): Promise<void> {
    await this.router.navigate(['/dashboard']);
  }

  async shareSummary(): Promise<void> {
    const text = this.buildShareText();

    const outcome = await this.shareService.share('Tag Spotter Road Log', text);
    if (outcome === 'copied') await this.showShareToast('Road log copied for sharing.');
    if (outcome === 'unavailable') await this.showShareToast('Sharing is unavailable on this device.');
    if (outcome === 'failed') await this.showShareToast('Sharing failed. Please try again.');
  }

  private buildShareText(): string {
    const summary = this.summary();

    return [
      'Tag Spotter Road Log',
      `${summary.foundCount}/${summary.totalStates} plates found`,
      `${summary.finalScore} final points`,
      `${Math.round(summary.miles).toLocaleString()} miles of spotting range`,
    ].join(' · ');
  }

  private async showShareToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      cssClass: 'teletype-toast',
    });
    await toast.present();
  }
}
