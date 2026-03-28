import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { QuizModalComponent } from './quiz-modal/quiz-modal.component';

@NgModule({
	declarations: [
		QuizModalComponent
	],
	imports: [CommonModule, IonicModule],
	exports: [QuizModalComponent],
	entryComponents: [QuizModalComponent]
})
export class SharedModule { }
