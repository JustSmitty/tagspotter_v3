import { ChangeDetectionStrategy, Component, inject, Input } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
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
    IonTitle,
    IonContent,
    IonButton,
    IonButtons,
    IonIcon
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizModalComponent {
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

  get progressDots(): number[] {
    return Array.from({ length: this.questionCount }, (_, index) => index);
  }

  onClose(): void {
    this.dismiss({ kind: 'cancelled' });
  }

  onSelect(option: string): void {
    this.dismiss({
      kind: 'answered',
      score: option === this.question.correctAnswer ? 1 : 0,
    });
  }

  private dismiss(result: QuizDismissResult): void {
    void this.modalCtrl.dismiss(result);
  }
}
