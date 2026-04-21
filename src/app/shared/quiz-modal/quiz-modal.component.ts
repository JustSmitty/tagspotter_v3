import { ChangeDetectionStrategy, Component, inject, Input } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonContent,
  IonButton,
  IonIcon,
  ModalController
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { closeCircle } from 'ionicons/icons';

import { QuizDismissResult, QuizQuestion } from '../../models/game-state.model';

@Component({
  selector: 'app-quiz-modal',
  templateUrl: './quiz-modal.component.html',
  styleUrls: ['./quiz-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonContent,
    IonButton,
    IonIcon
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizModalComponent {
  readonly answerMarkers = ['A', 'B', 'C', 'D', 'E', 'F'];

  private readonly modalCtrl = inject(ModalController);

  @Input() question!: QuizQuestion;
  @Input() stateCode!: string;
  @Input() stateName!: string;
  @Input() imageSrc!: string;
  @Input() questionIndex = 0;
  @Input() questionCount = 1;

  constructor() {
    addIcons({ closeCircle });
  }

  get questionOrdinal(): number {
    return this.questionIndex + 1;
  }

  get progressDots(): number[] {
    return Array.from({ length: this.questionCount }, (_, index) => index);
  }

  get stateRegion(): 'northeast' | 'south' | 'midwest' | 'west' {
    const stateCode = this.stateCode?.toUpperCase();

    if (['CT', 'DC', 'DE', 'MA', 'MD', 'ME', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'].includes(stateCode)) {
      return 'northeast';
    }

    if (['AL', 'AR', 'FL', 'GA', 'KY', 'LA', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV'].includes(stateCode)) {
      return 'south';
    }

    if (['IA', 'IL', 'IN', 'KS', 'MI', 'MN', 'MO', 'ND', 'NE', 'OH', 'SD', 'WI'].includes(stateCode)) {
      return 'midwest';
    }

    return 'west';
  }

  onClose(): void {
    this.dismiss({ kind: 'cancelled' });
  }

  onSelect(option: string): void {
    this.dismiss({
      kind: 'answered',
      score: option === this.question.correctAnswer ? (this.question.points ?? 1) : 0,
    });
  }

  private dismiss(result: QuizDismissResult): void {
    void this.modalCtrl.dismiss(result);
  }
}
