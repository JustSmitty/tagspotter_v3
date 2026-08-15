import { TestBed } from '@angular/core/testing';

import { ClockService } from './clock.service';

describe('ClockService', () => {
  it('publishes a new day only when the calendar date changes', () => {
    const service = TestBed.configureTestingModule({}).inject(ClockService);
    service.refresh(new Date(2030, 0, 1, 10));
    const first = service.today();

    service.refresh(new Date(2030, 0, 1, 23));
    expect(service.today()).toBe(first);

    service.refresh(new Date(2030, 0, 2, 0, 1));
    expect(service.today().getTime()).not.toBe(first.getTime());
  });
});
