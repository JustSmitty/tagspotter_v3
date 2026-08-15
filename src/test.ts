// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';

// Zoneless, matching the application (audit F-26). Running specs under zone.js
// while the app ships zoneless would be the worst of both: a component relying
// on zone-driven change detection would pass every test and fail on a device.
getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(),
);

// Applied globally rather than in each spec — configureTestingModule merges, so
// every spec's own call still works, and nobody has to remember this.
beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection()],
  });
});
