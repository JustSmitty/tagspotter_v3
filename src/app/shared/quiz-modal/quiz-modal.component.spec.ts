import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';

import { QuizModalComponent } from './quiz-modal.component';

describe('QuizModalComponent', () => {
  let component: QuizModalComponent;
  let fixture: ComponentFixture<QuizModalComponent>;
  let modalController: jasmine.SpyObj<ModalController>;

  beforeEach(async () => {
    modalController = jasmine.createSpyObj<ModalController>('ModalController', ['dismiss']);

    await TestBed.configureTestingModule({
      imports: [QuizModalComponent],
      providers: [{ provide: ModalController, useValue: modalController }],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QuizModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('question', {
      topic: 'Capital',
      prompt: 'What is Alabama\'s capital?',
      correctAnswer: 'Montgomery',
      options: ['Montgomery', 'Juneau', 'Phoenix', 'Austin'],
      correctIndex: 0,
    });
    fixture.componentRef.setInput('stateCode', 'AL');
    fixture.componentRef.setInput('stateName', 'Alabama');
    fixture.componentRef.setInput('imageSrc', '/assets/stateflags/Alabama.svg');
    fixture.componentRef.setInput('questionIndex', 1);
    fixture.componentRef.setInput('questionCount', 3);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('builds the progress dots from the question count', () => {
    expect(component.progressDots.length).toBe(3);
  });

  it('derives the visual region from the state code', () => {
    fixture.componentRef.setInput('stateCode', 'CA');
    fixture.detectChanges();

    expect(component.stateRegion).toBe('west');
    expect((fixture.nativeElement as HTMLElement).querySelector('.quiz-pass')?.getAttribute('data-region')).toBe('west');
  });

  it('dismisses with a score when the correct option is selected', () => {
    component.onSelect('Montgomery');

    expect(modalController.dismiss).toHaveBeenCalledWith({
      kind: 'answered',
      score: 1,
    });
  });

  it('dismisses with a cancel result when closed', () => {
    component.onClose();

    expect(modalController.dismiss).toHaveBeenCalledWith({
      kind: 'cancelled',
    });
  });
});
