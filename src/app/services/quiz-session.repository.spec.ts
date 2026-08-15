import { TestBed } from '@angular/core/testing';

import { PreferenceStorageService } from './platform/preference-storage.service';
import { QuizSessionRepository } from './quiz-session.repository';

describe('QuizSessionRepository', () => {
  it('discards malformed stored sessions instead of resuming them', async () => {
    const preferences = jasmine.createSpyObj<PreferenceStorageService>('PreferenceStorageService', ['get', 'set', 'remove']);
    preferences.get.and.resolveTo('{"stateId":1}');
    preferences.remove.and.resolveTo();
    TestBed.configureTestingModule({ providers: [{ provide: PreferenceStorageService, useValue: preferences }] });
    const repository = TestBed.inject(QuizSessionRepository);

    expect(await repository.load()).toBeNull();
    expect(preferences.remove).toHaveBeenCalled();
  });
});
