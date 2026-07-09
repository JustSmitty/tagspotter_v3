import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';

import { GameSnapshot, createEmptyPoints } from '../../models/game-state.model';
import { GameStateStore } from '../../services/game-state.store';
import { RoadAtlasComponent } from './road-atlas.component';

describe('RoadAtlasComponent', () => {
  let component: RoadAtlasComponent;
  let fixture: ComponentFixture<RoadAtlasComponent>;

  beforeEach(async () => {
    const gameStateStore = {
      snapshot: signal<GameSnapshot>({
        states: [
          buildState(1, 'Alabama', false),
          buildState(2, 'Alaska', false),
          buildState(3, 'Arizona', false),
        ],
        points: createEmptyPoints(),
        foundCount: 0,
        totalCorrect: 0,
        totalDistanceMiles: 0,
      }),
    } as unknown as GameStateStore;

    await TestBed.configureTestingModule({
      imports: [RoadAtlasComponent],
      providers: [
        { provide: GameStateStore, useValue: gameStateStore },
        { provide: HttpClient, useValue: jasmine.createSpyObj<HttpClient>('HttpClient', ['get']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RoadAtlasComponent);
    component = fixture.componentInstance;
    spyOn<any>(component, 'initializeMap').and.stub();
    fixture.detectChanges();
  });

  it('applies initial highlights for all newly found states', () => {
    const setFeatureState = jasmine.createSpy('setFeatureState');
    (component as any).map = {
      getSource: () => ({ id: 'states' }),
      setFeatureState,
    };

    (component as any).updateStateHighlights([
      buildState(1, 'Alabama', true),
      buildState(2, 'Alaska', false),
      buildState(3, 'Arizona', true),
    ]);

    expect(setFeatureState).toHaveBeenCalledTimes(2);
    expect(setFeatureState).toHaveBeenCalledWith({ source: 'states', id: 1 }, { found: true });
    expect(setFeatureState).toHaveBeenCalledWith({ source: 'states', id: 3 }, { found: true });
  });

  it('updates only changed ids when found-state membership changes', () => {
    const setFeatureState = jasmine.createSpy('setFeatureState');
    (component as any).map = {
      getSource: () => ({ id: 'states' }),
      setFeatureState,
    };
    (component as any).previousFoundIds = new Set([1, 2]);

    (component as any).updateStateHighlights([
      buildState(1, 'Alabama', true),
      buildState(2, 'Alaska', false),
      buildState(3, 'Arizona', true),
    ]);

    expect(setFeatureState).toHaveBeenCalledTimes(2);
    expect(setFeatureState).toHaveBeenCalledWith({ source: 'states', id: 2 }, { found: false });
    expect(setFeatureState).toHaveBeenCalledWith({ source: 'states', id: 3 }, { found: true });
  });

  it('does nothing when unrelated snapshot changes leave found ids untouched', () => {
    const setFeatureState = jasmine.createSpy('setFeatureState');
    (component as any).map = {
      getSource: () => ({ id: 'states' }),
      setFeatureState,
    };
    (component as any).previousFoundIds = new Set([1, 3]);

    (component as any).updateStateHighlights([
      buildState(1, 'Alabama', true, 120),
      buildState(2, 'Alaska', false),
      buildState(3, 'Arizona', true, 400),
    ]);

    expect(setFeatureState).not.toHaveBeenCalled();
  });

  it('selects and closes state details from map feature ids', () => {
    (component as any).selectStateById(1);
    fixture.detectChanges();

    expect(component.selectedState()?.Name).toBe('Alabama');
    expect((fixture.nativeElement as HTMLElement).querySelector('.atlas-detail')?.textContent).toContain('Alabama');

    component.closeStateDetail();
    fixture.detectChanges();

    expect(component.selectedState()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.atlas-detail')).toBeNull();
  });
});

function buildState(id: number, name: string, stateFound: boolean, distance = 0) {
  return {
    ID: id,
    Name: name,
    Abbrv: name.slice(0, 2).toUpperCase(),
    Lat: 0,
    Lng: 0,
    Capital: `${name} City`,
    Bird: `${name} Bird`,
    Flower: `${name} Flower`,
    Nickname: `${name} Nickname`,
    flagURL: `/assets/stateflags/${name}.svg`,
    fnd: {
      distance,
      stateFound,
      questionsCorrect: 0,
    },
  };
}
