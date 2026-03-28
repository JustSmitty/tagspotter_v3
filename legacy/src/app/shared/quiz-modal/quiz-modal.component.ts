import { Component, Input, OnInit, Renderer2, AfterViewInit, OnDestroy } from '@angular/core';
import { NavParams, ModalController } from '@ionic/angular';

@Component({
  selector: 'app-quiz-modal',
  templateUrl: './quiz-modal.component.html',
  styleUrls: ['./quiz-modal.component.scss'],
})
export class QuizModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() oder = [];
  @Input() topic: string;
  @Input() answer: string;
  @Input() otherAnswers: string[];
  @Input() answerPosition: number;
  @Input() foundStateName: string;
  @Input() imageSrc: string;
  @Input() ratio: number;
  buttonA: string;
  buttonB: string;
  buttonC: string;
  buttonD: string;

  constructor(private navParams: NavParams, private modalCtrl: ModalController, private renderer: Renderer2) {
    this.answer = navParams.get('answer');
    this.answerPosition = navParams.get('answerPosition');
    this.otherAnswers = navParams.get('otherAnswers');

    if (this.answerPosition == 1) {
      this.buttonA = this.answer;
      this.buttonB = this.otherAnswers[0];
      this.buttonC = this.otherAnswers[1];
      this.buttonD = this.otherAnswers[2];
    } else if (this.answerPosition == 2) {
      this.buttonA = this.otherAnswers[0];
      this.buttonB = this.answer;
      this.buttonC = this.otherAnswers[1];
      this.buttonD = this.otherAnswers[2];
    } else if (this.answerPosition == 3) {
      this.buttonA = this.otherAnswers[0];
      this.buttonC = this.answer;
      this.buttonB = this.otherAnswers[1];
      this.buttonD = this.otherAnswers[2];
    } else if (this.answerPosition == 4) {
      this.buttonA = this.otherAnswers[0];
      this.buttonB = this.otherAnswers[1];
      this.buttonC = this.otherAnswers[2];
      this.buttonD = this.answer;
    }
  }

  onAClick() {
    if (this.answerPosition == 1) {
      this.modalCtrl.dismiss(1);
    } else {
      this.modalCtrl.dismiss(0);
    }
  }

  onBClick() {
    if (this.answerPosition == 2) {
      this.modalCtrl.dismiss(1);
    } else {
      this.modalCtrl.dismiss(0);
    }
  }

  onCClick() {
    if (this.answerPosition == 3) {
      this.modalCtrl.dismiss(1);
    } else {
      this.modalCtrl.dismiss(0);
    }
  }

  onDClick() {
    if (this.answerPosition == 4) {
      this.modalCtrl.dismiss(1);
    } else {
      this.modalCtrl.dismiss(0);
    }
  }

  ngOnInit() { }

  ngAfterViewInit(): void {
  }
  ngOnDestroy(): void {
  }
}
