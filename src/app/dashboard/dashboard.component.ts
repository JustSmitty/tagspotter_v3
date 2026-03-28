import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonButtons,
  IonBackButton
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import {
  bookOutline,
  carOutline,
  mapOutline,
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
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonButtons,
    IonBackButton
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly gameStateStore = inject(GameStateStore);

  readonly viewModel = this.gameStateStore.dashboardViewModel;

  constructor() {
    addIcons({
      mapOutline,
      carOutline,
      bookOutline,
      trophyOutline,
      swapHorizontalOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    await this.gameStateStore.hydrate();
  }
}
