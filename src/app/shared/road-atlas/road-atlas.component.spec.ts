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
  let isLoaded: ReturnType<typeof signal<boolean>>;

  beforeEach(async () => {
    isLoaded = signal(true);
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
        { provide: GameStateStore, useValue: { snapshot, isLoaded } },
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

  /**
   * pm-0005 — on a device the save crosses the native bridge while the GeoJSON
   * comes off the local bundle, so the geometry routinely wins. The old code
   * joined the two inside the fetch, which meant an empty store at that instant
   * discarded all 51 shapes permanently: a blank card, no error, no retry.
   */
  it('draws the map when the save arrives after the geometry', async () => {
    isLoaded.set(false);
    snapshot.set({ ...snapshot(), states: [], foundCount: 0 });

    const late = TestBed.createComponent(RoadAtlasComponent);
    late.detectChanges();
    await late.whenStable();
    late.detectChanges();

    const host = late.nativeElement as HTMLElement;
    // Nothing to draw yet, and the card says so rather than sitting blank.
    expect(host.querySelectorAll('.atlas-state').length).toBe(0);
    expect(host.querySelector('.atlas-status')?.textContent).toContain('Drawing');

    snapshot.set({
      ...snapshot(),
      states: [buildState(1, 'Alabama', false), buildState(2, 'Alaska', true)],
      foundCount: 1,
    });
    isLoaded.set(true);
    late.detectChanges();

    expect(host.querySelectorAll('.atlas-state').length).toBe(2);
    expect(host.querySelector('.atlas-status')).toBeNull();
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

/**
 * F-051 — the shipped GeoJSON is already an inset map: Alaska and Hawaii are
 * stored pre-translated into the lower-left of the continental frame. The
 * projection used to special-case them for their REAL-WORLD coordinates, which
 * threw both off the 600x400 canvas (Alaska to y 426..447, Hawaii to x
 * 586..628) — they drew every frame, just outside the window.
 *
 * The bounds below are the actual extremes of src/assets/us-states.json, and
 * the path data is parsed rather than measured, so this holds without SVG
 * layout.
 */
describe('RoadAtlasComponent projection (F-051)', () => {
  const VIEWBOX_W = 600;
  const VIEWBOX_H = 400;

  // [name, lngMin, lngMax, latMin, latMax] straight from the shipped atlas.
  const EXTREMES: Array<[string, number, number, number, number]> = [
    ['Alaska', -130.62, -110.0, 22.01, 28.92],
    ['Hawaii', -109.76, -104.81, 23.95, 27.23],
    ['Washington', -124.71, -116.92, 45.54, 49.38],
    ['Maine', -71.08, -66.98, 43.06, 47.46],
    ['Florida', -87.6, -80.03, 25.12, 31.0],
  ];

  let fixture: ComponentFixture<RoadAtlasComponent>;

  function boxOf(name: string, path: string) {
    const nums = (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    return { name, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }

  beforeEach(async () => {
    const http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get']);
    http.get.and.returnValue(of({
      type: 'FeatureCollection',
      features: EXTREMES.map(([name, lngMin, lngMax, latMin, latMax]) =>
        buildFeature(name, [[[lngMin, latMax], [lngMax, latMax], [lngMax, latMin], [lngMin, latMin], [lngMin, latMax]]])),
    }));

    const snap = signal<GameSnapshot>({
      states: EXTREMES.map(([name], i) => buildState(i + 1, name, false)),
      points: createEmptyPoints(),
      foundCount: 0,
      totalCorrect: 0,
      totalDistanceMiles: 0,
    });

    await TestBed.configureTestingModule({
      imports: [RoadAtlasComponent],
      providers: [
        { provide: GameStateStore, useValue: { snapshot: snap, isLoaded: signal(true) } },
        { provide: HttpClient, useValue: http },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RoadAtlasComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('keeps every state inside the viewBox, Alaska and Hawaii included', () => {
    const boxes = fixture.componentInstance.features().map((f) => boxOf(f.name, f.path));
    expect(boxes.length).toBe(EXTREMES.length);

    const escaped = boxes.filter(
      (b) => b.minX < 0 || b.maxX > VIEWBOX_W || b.minY < 0 || b.maxY > VIEWBOX_H,
    );
    expect(escaped.map((b) => `${b.name}: x ${b.minX}..${b.maxX} y ${b.minY}..${b.maxY}`)).toEqual([]);
  });

  it('places the two insets in the lower-left, where an inset map puts them', () => {
    const boxes = fixture.componentInstance.features().map((f) => boxOf(f.name, f.path));
    for (const name of ['Alaska', 'Hawaii']) {
      const box = boxes.find((b) => b.name === name);
      expect(box).withContext(name).toBeDefined();
      expect(box!.maxX).withContext(`${name} x`).toBeLessThan(VIEWBOX_W / 2);
      expect(box!.minY).withContext(`${name} y`).toBeGreaterThan(VIEWBOX_H / 2);
    }
  });
});
