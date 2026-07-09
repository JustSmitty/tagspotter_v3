import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  const testBed = TestBed as unknown as { inject<T>(token: unknown): T };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideIonicAngular(), provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('detects active routes and delegates navigation', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const router = testBed.inject<Router>(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    app.currentUrl = '/dashboard';

    expect(app.isRouteActive('/dashboard')).toBeTrue();
    expect(app.isRouteActive('/home')).toBeFalse();

    app.navigateTo('/trivia');

    expect(router.navigate).toHaveBeenCalledWith(['/trivia']);
  });
});
