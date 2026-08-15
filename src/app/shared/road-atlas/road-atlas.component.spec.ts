import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { GameSnapshot, createEmptyPoints } from '../../models/game-state.model';
import { GameStateStore } from '../../services/game-state.store';
import { RoadAtlasComponent } from './road-atlas.component';

describe('RoadAtlasComponent', () => {
  let component: RoadAtlasComponent;
  let fixture: ComponentFixture<RoadAtlasComponent>;
  let http: jasmine.SpyObj<HttpClient>;
  let snapshot: ReturnType<typeof signal<GameSnapshot>>;

  beforeEach(async () => {
    snapshot = signal<GameSnapshot>({
      states: [buildState(1, 'Alabama', false), buildState(2, 'Alaska', true)],
      points: createEmptyPoints(),
      foundCount: 1,
      totalCorrect: 0,
      totalDistanceMiles: 0,
    });
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get']);
    http.get.and.returnValue(of({
      type: 'FeatureCollection',
      features: [
        buildFeature('Alabama', [[[-88, 35], [-85, 35], [-85, 30], [-88, 30], [-88, 35]]]),
        buildFeature('Alaska', [[[-170, 70], [-140, 70], [-140, 55], [-170, 55], [-170, 70]]]),
      ],
    }));

    await TestBed.configureTestingModule({
      imports: [RoadAtlasComponent],
      providers: [
        { provide: GameStateStore, useValue: { snapshot } },
        { provide: HttpClient, useValue: http },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RoadAtlasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the map as a single image with no focusable children', () => {
    const host = fixture.nativeElement as HTMLElement;
    const paths = host.querySelectorAll('.atlas-state');
    const svg = host.querySelector('.atlas-map');

    expect(paths.length).toBe(2);
    expect(paths[1].classList.contains('atlas-state--found')).toBeTrue();

    // Audit F-32: the plate grid below is the accessible interface. The map
    // must not put 51 tab stops in front of it or duplicate its labels.
    expect(host.querySelectorAll('.atlas-state[tabindex]').length).toBe(0);
    expect(host.querySelectorAll('.atlas-state[role="button"]').length).toBe(0);
    expect(paths[0].getAttribute('aria-hidden')).toBe('true');

    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toContain('1 of 2 plates spotted');
  });

  it('reacts when found-state membership changes', () => {
    snapshot.set({ ...snapshot(), states: [buildState(1, 'Alabama', true), buildState(2, 'Alaska', true)], foundCount: 2 });
    fixture.detectChanges();
    expect(component.foundCount()).toBe(2);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.atlas-state--found').length).toBe(2);
  });

  it('selects and closes state details', () => {
    component.selectStateById(1);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.atlas-detail')?.textContent).toContain('Alabama');
    component.closeStateDetail();
    fixture.detectChanges();
    expect(component.selectedState()).toBeNull();
  });

  it('clears a cached rejection and retries atlas loading', async () => {
    http.get.and.returnValue(throwError(() => new Error('offline')));
    await component.retryLoad();
    expect(component.loadError()).toContain('could not be loaded');

    http.get.and.returnValue(of({ type: 'FeatureCollection', features: [] }));
    await component.retryLoad();
    expect(component.loadError()).toBeNull();
    expect(http.get).toHaveBeenCalledTimes(3);
  });
});

function buildFeature(name: string, coordinates: number[][][]) {
  return { properties: { name }, geometry: { type: 'Polygon', coordinates } };
}

function buildState(id: number, name: string, stateFound: boolean) {
  return {
    ID: id,
    Name: name,
    Abbrv: name === 'Alaska' ? 'AK' : 'AL',
    Lat: 0,
    Lng: 0,
    Capital: `${name} City`,
    Bird: `${name} Bird`,
    Flower: `${name} Flower`,
    Nickname: `${name} Nickname`,
    flagURL: `/assets/stateflags/${name}.svg`,
    fnd: { distance: 0, stateFound, questionsCorrect: 0 },
  };
}
