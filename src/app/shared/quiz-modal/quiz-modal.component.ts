import { ChangeDetectionStrategy, Component, computed, inject, Input, signal } from '@angular/core';
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
import { ImpactStyle } from '@capacitor/haptics';

import { getStateRegion } from '../../constants/us-states';
import { QuizDismissResult, QuizQuestion, StateRegion } from '../../models/game-state.model';
import { NativeUiService } from '../../services/platform/native-ui.service';

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
  readonly answerMarkers = ['A', 'B', 'C', 'D'];

  private readonly modalCtrl = inject(ModalController);
  private readonly nativeUi = inject(NativeUiService);
  readonly selectedOption = signal<string | null>(null);
  readonly answered = computed(() => this.selectedOption() !== null);
  readonly selectedIsCorrect = computed(() => this.selectedOption() === this.question?.correctAnswer);

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

  get stateRegion(): StateRegion {
    return getStateRegion(this.stateCode?.toUpperCase() ?? '');
  }

  onClose(): void {
    if (this.answered()) {
      this.onContinue();
    } else {
      this.dismiss({ kind: 'cancelled' });
    }
  }

  onSelect(option: string): void {
    if (this.answered()) return;
    const isCorrect = option === this.question.correctAnswer;
    this.selectedOption.set(option);
    if (isCorrect) void this.nativeUi.impact(ImpactStyle.Light);
  }

  onContinue(): void {
    if (!this.answered()) return;
    this.dismiss({
      kind: 'answered',
      score: this.selectedIsCorrect() ? (this.question.points ?? 1) : 0,
    });
  }

  stateNameFromUrl(url: string): string {
    if (!url) return 'State flag';
    const parts = url.split('/');
    const filename = parts[parts.length - 1] ?? '';
    const name = filename.replace('.svg', '');
    return name ? `Flag of ${name}` : 'State flag';
  }

  private dismiss(result: QuizDismissResult): void {
    void this.modalCtrl.dismiss(result);
  }
}
