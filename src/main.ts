import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    // Zoneless (audit F-26). Every component is OnPush and all state is signals
    // with no manual markForCheck anywhere, so zone.js was patching the entire
    // browser API surface to discover changes the framework was already being
    // told about. Dropping it removes ~35 kB and the monkey-patching overhead.
    provideZonelessChangeDetection(),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    // No preloading strategy: every route is lazy, and eagerly fetching all of
    // them right after boot cancelled out the code splitting (audit F-27). In a
    // Capacitor shell each chunk is a local file read, so on-demand is cheap.
    provideRouter(routes),
    provideHttpClient(),
  ],
});
