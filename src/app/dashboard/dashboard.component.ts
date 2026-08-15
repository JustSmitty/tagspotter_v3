import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import {
  IonHeader,
  IonContent,
  IonIcon,
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  bookOutline,
  carOutline,
  mapOutline,
  ribbonOutline,
  swapHorizontalOutline,
  trophyOutline
} from 'ionicons/icons';

import { GameStateStore } from '../services/game-state.store';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonContent,
    IonIcon,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly gameStateStore = inject(GameStateStore);

  readonly viewModel = this.gameStateStore.dashboardViewModel;
  readonly souvenirFlags = this.gameStateStore.dashboardSouvenirFlags;
  readonly comparison = this.gameStateStore.tripComparison;

  constructor() {
    addIcons({
      mapOutline,
      carOutline,
      bookOutline,
      ribbonOutline,
      trophyOutline,
      swapHorizontalOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    await this.gameStateStore.hydrate();
  }
}
