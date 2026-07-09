import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonHeader, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  bookOutline,
  carOutline,
  mapOutline,
  swapHorizontalOutline,
  trophyOutline,
} from 'ionicons/icons';

import { GameStateStore } from '../services/game-state.store';

@Component({
  selector: 'app-goals',
  templateUrl: './goals.component.html',
  styleUrls: ['./goals.component.scss'],
  standalone: true,
  imports: [CommonModule, IonHeader, IonContent, IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoalsComponent implements OnInit {
  private readonly gameStateStore = inject(GameStateStore);

  readonly goals = this.gameStateStore.goalProgress;
  readonly challenges = this.gameStateStore.rotatingChallenges;
  readonly souvenirFlags = this.gameStateStore.goalsSouvenirFlags;
  readonly summary = this.gameStateStore.goalsSummary;

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
