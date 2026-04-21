import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonButton, IonIcon } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { GameStateStore } from '../services/game-state.store';
import { addIcons } from 'ionicons';
import { refreshOutline, mapOutline } from 'ionicons/icons';

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
  readonly summary = this.gameStateStore.summaryViewModel;

  constructor() {
    addIcons({ refreshOutline, mapOutline });
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
}
