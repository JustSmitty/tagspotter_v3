import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonButton, IonIcon, ToastController } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { GameStateStore } from '../services/game-state.store';
import { addIcons } from 'ionicons';
import { refreshOutline, mapOutline, shareSocialOutline } from 'ionicons/icons';

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
  readonly summary = this.gameStateStore.summaryViewModel;

  constructor() {
    addIcons({ refreshOutline, mapOutline, shareSocialOutline });
  }

  async ngOnInit(): Promise<void> {
    await this.gameStateStore.hydrate();
  }

  async playAgain(): Promise<void> {
    await this.gameStateStore.resetProgress();
    await this.router.navigate(['/home']);
  }

  async viewMap(): Promise<void> {
    await this.router.navigate(['/dashboard']);
  }

  async shareSummary(): Promise<void> {
    const text = this.buildShareText();

    if (navigator.share) {
      await navigator.share({
        title: 'Tag Spotter Road Log',
        text,
      });
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      await this.showShareToast('Road log copied for sharing.');
      return;
    }

    await this.showShareToast('Sharing is unavailable on this device.');
  }

  private buildShareText(): string {
    const summary = this.summary();

    return [
      'Tag Spotter Road Log',
      `${summary.foundCount}/${summary.totalStates} plates found`,
      `${summary.finalScore} final points`,
      `${Math.round(summary.miles).toLocaleString()} miles logged`,
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
