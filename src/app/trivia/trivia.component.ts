import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonHeader } from '@ionic/angular/standalone';

import { GameStateStore } from '../services/game-state.store';

@Component({
  selector: 'app-trivia',
  templateUrl: './trivia.component.html',
  styleUrls: ['./trivia.component.scss'],
  standalone: true,
  imports: [CommonModule, IonHeader, IonContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TriviaComponent implements OnInit {
  private readonly gameStateStore = inject(GameStateStore);

  readonly viewModel = this.gameStateStore.triviaViewModel;

  async ngOnInit(): Promise<void> {
    await this.gameStateStore.hydrate();
  }
}
