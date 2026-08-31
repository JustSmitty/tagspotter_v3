import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';

import { APP_INFO_PLUGIN, AppInfoService } from '../../services/platform/app-info.service';
import { OnboardingModalComponent } from './onboarding-modal.component';

describe('OnboardingModalComponent', () => {
  let fixture: ComponentFixture<OnboardingModalComponent>;
  let modalController: jasmine.SpyObj<ModalController>;

  beforeEach(async () => {
    modalController = jasmine.createSpyObj<ModalController>('ModalController', ['dismiss']);

    await TestBed.configureTestingModule({
      imports: [OnboardingModalComponent],
      providers: [
        { provide: ModalController, useValue: modalController },
        {
          provide: APP_INFO_PLUGIN,
          useValue: {
            getInfo: () =>
              Promise.resolve({ name: 'Tag Spotter', id: 'io.tagspotter.app', version: '1.2.0', build: '5' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingModalComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('prints the edition line in the handbook footer', async () => {
    await TestBed.inject(AppInfoService).loaded;
    fixture.detectChanges();

    const line = (fixture.nativeElement as HTMLElement).querySelector('.edition-line');
    expect(line?.textContent).toContain('Edition 1.2.0 (5)');
  });
});
