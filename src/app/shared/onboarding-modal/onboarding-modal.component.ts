import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonFooter,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  chevronForwardOutline, 
  chevronBackOutline, 
  checkmarkCircleOutline,
  bookOutline,
  mapOutline,
  trophyOutline,
  speedometerOutline,
  flagOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-onboarding-modal',
  templateUrl: './onboarding-modal.component.html',
  styleUrls: ['./onboarding-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonButtons,
    IonIcon,
    IonFooter
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingModalComponent {
  private readonly modalCtrl = inject(ModalController);
  
  readonly currentPage = signal(0);
  readonly totalPages = 5;

  constructor() {
    addIcons({ 
      chevronForwardOutline, 
      chevronBackOutline, 
      checkmarkCircleOutline,
      bookOutline,
      mapOutline,
      trophyOutline,
      speedometerOutline,
      flagOutline
    });
  }

  next() {
    if (this.currentPage() < this.totalPages - 1) {
      this.currentPage.update(p => p + 1);
    } else {
      this.finish();
    }
  }

  prev() {
    if (this.currentPage() > 0) {
      this.currentPage.update(p => p - 1);
    }
  }

  finish() {
    void this.modalCtrl.dismiss(true);
  }
}
