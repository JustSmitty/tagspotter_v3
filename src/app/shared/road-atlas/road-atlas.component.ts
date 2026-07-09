import {
  Component,
  inject,
  OnDestroy,
  effect,
  computed,
  signal,
  output,
  AfterViewInit,
  ViewEncapsulation,
  NgZone,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy
} from '@angular/core';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as maplibregl from 'maplibre-gl';

import { StoredStateRecord, getCorrectAnswersCount } from '../../models/game-state.model';
import { GameStateStore } from '../../services/game-state.store';

interface StateAtlasFeature {
  id?: number;
  properties?: {
    name?: string;
  };
  [key: string]: unknown;
}

interface StateAtlasGeoJson {
  type: 'FeatureCollection';
  features: StateAtlasFeature[];
  [key: string]: unknown;
}

let statesGeoJsonPromise: Promise<StateAtlasGeoJson> | null = null;

@Component({
  selector: 'app-road-atlas',
  templateUrl: './road-atlas.component.html',
  styleUrls: ['./road-atlas.component.scss'],
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoadAtlasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('roadAtlasMap', { static: true }) private readonly mapContainer?: ElementRef<HTMLElement>;

  private readonly gameStateStore = inject(GameStateStore);
  private readonly http = inject(HttpClient);
  private readonly ngZone = inject(NgZone);
  
  private map: maplibregl.Map | null = null;
  private statesData: StateAtlasGeoJson | null = null;
  private previousFoundIds = new Set<number>();

  readonly snapshot = this.gameStateStore.snapshot;
  readonly foundCount = computed(() => this.snapshot().foundCount);
  readonly selectedState = signal<StoredStateRecord | null>(null);

  /** Emits the state ID when the user asks to spot a state from the map detail card. */
  readonly spotRequested = output<number>();
  readonly stateNameToId = computed(() => {
    return new Map(
      this.snapshot().states.map((state) => [state.Name.toLowerCase(), state.ID]),
    );
  });
  
  // Custom vintage 1950s map style (No OSM tiles, flat look)
  private readonly VINTAGE_STYLE = {
    version: 8,
    name: 'VintageRoadTrip',
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#f4e8d0' // Matches container parchment
        }
      }
    ]
  } as maplibregl.StyleSpecification;

  // Bounds for US-centric view (Contiguous US + padding)
  private readonly US_BOUNDS: maplibregl.LngLatBoundsLike = [
    [-126.0, 24.0], // Southwest
    [-66.0, 50.0]   // Northeast
  ];

  constructor() {
    effect(() => {
      if (this.map && this.map.isStyleLoaded()) {
        this.updateStateHighlights(this.snapshot().states);
      }
    });
  }

  ngAfterViewInit() {
    // Better: Wait for the zone to become stable so we are 100% sure the DOM is complete.
    // This replaces a fixed 50ms timeout.
    this.ngZone.onStable.pipe(take(1)).subscribe(() => {
      this.initializeMap();
    });
  }

  ngOnDestroy() {
    if (this.map && typeof this.map.remove === 'function') {
      this.map.remove();
    }
    this.map = null;
  }

  private initializeMap(): void {
    const mapContainer = this.mapContainer?.nativeElement;

    if (!mapContainer) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.map = new maplibregl.Map({
        container: mapContainer,
        style: this.VINTAGE_STYLE,
        center: [-98.5795, 39.8283],
        zoom: 3.5,
        minZoom: 3,
        maxZoom: 7,
        maxBounds: this.US_BOUNDS,
        pitch: 0,
        bearing: 0,
        // The atlas is a static, full-country composite. Every pan/zoom gesture
        // is disabled so a vertical swipe scrolls the page (to reach the plate
        // grid below) rather than being captured by the map canvas. Tap-to-
        // select a state still works via the 'click' handler wired up in
        // setupMapInteractions(); click events are independent of these handlers.
        interactive: true,
        dragPan: false,
        dragRotate: false,
        scrollZoom: false,
        boxZoom: false,
        doubleClickZoom: false,
        touchZoomRotate: false,
        touchPitch: false,
        keyboard: false,
        pitchWithRotate: false
      });

      this.map.on('load', () => {
        this.map?.resize();
        this.map?.fitBounds(this.US_BOUNDS, { padding: 10, animate: false });
        void this.loadStatesGeoJson();
      });
    });
  }

  private async loadStatesGeoJson(): Promise<void> {
    try {
      const data = await this.getStatesGeoJson();
      this.statesData = this.cloneStatesGeoJson(data);
      this.injectFeatureIds();
      this.setupMapLayers();
    } catch (error) {
      console.error('Failed to load atlas GeoJSON:', error);
    }
  }

  private async getStatesGeoJson(): Promise<StateAtlasGeoJson> {
    if (!statesGeoJsonPromise) {
      statesGeoJsonPromise = firstValueFrom(this.http.get<StateAtlasGeoJson>('assets/us-states.json'));
    }

    return statesGeoJsonPromise;
  }

  private cloneStatesGeoJson(data: StateAtlasGeoJson): StateAtlasGeoJson {
    return {
      ...data,
      features: data.features.map((feature) => ({
        ...feature,
        properties: feature.properties ? { ...feature.properties } : undefined,
      })),
    };
  }

  private injectFeatureIds(): void {
    if (!this.statesData || !this.statesData.features) return;

    const stateNameToId = this.stateNameToId();
    this.statesData.features.forEach((feature) => {
      const stateId = stateNameToId.get(String(feature.properties?.name ?? '').toLowerCase());
      if (stateId !== undefined) {
        feature.id = stateId;
      }
    });
  }

  private setupMapLayers(): void {
    if (!this.map || !this.statesData) return;

    this.map.addSource('states', {
      type: 'geojson',
      data: this.statesData as unknown as maplibregl.GeoJSONSourceSpecification['data'],
      generateId: false // Use our manually injected IDs
    });

    // Fill layer for states
    this.map.addLayer({
      id: 'states-fill',
      type: 'fill',
      source: 'states',
      paint: {
        'fill-color': [
          'case',
          ['boolean', ['feature-state', 'found'], false],
          '#eb4d4b', // Vintage Red for found
          'transparent' // Clear for not found
        ],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'found'], false],
          0.4,
          0
        ]
      }
    });

    // Outline for all states (Vintage Atlas look)
    this.map.addLayer({
      id: 'states-outline',
      type: 'line',
      source: 'states',
      paint: {
        'line-color': '#576574',
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'found'], false],
          2,
          0.5
        ],
        'line-opacity': 0.5
      }
    });

    // Labels for states
    this.map.addLayer({
      id: 'states-labels',
      type: 'symbol',
      source: 'states',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular'],
        'text-size': 11,
        'text-allow-overlap': false
      },
      paint: {
        'text-color': '#2f3542',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1,
        'text-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3, 0,
          4, 1
        ]
      }
    });

    this.updateStateHighlights(this.snapshot().states);
    this.setupMapInteractions();
  }

  closeStateDetail(): void {
    this.selectedState.set(null);
  }

  requestSpot(stateId: number): void {
    this.spotRequested.emit(stateId);
    this.selectedState.set(null);
  }

  getCorrectAnswersCount(state: StoredStateRecord): number {
    return state.fnd.mode === 'trivia' ? getCorrectAnswersCount(state.fnd.questionsCorrect, state.fnd.difficulty) : 0;
  }

  private setupMapInteractions(): void {
    if (!this.map) return;

    // Query a small box around the tap instead of the exact pixel so that
    // geographically tiny states (e.g. RI, DE) are still easy to select on the
    // compact atlas.
    const tapTolerancePx = 10;

    this.map.on('click', (event) => {
      if (!this.map) {
        return;
      }

      const { x, y } = event.point;
      const box: [maplibregl.PointLike, maplibregl.PointLike] = [
        [x - tapTolerancePx, y - tapTolerancePx],
        [x + tapTolerancePx, y + tapTolerancePx],
      ];
      const features = this.map.queryRenderedFeatures(box, { layers: ['states-fill'] });
      const stateId = Number(features?.[0]?.id);

      if (!Number.isFinite(stateId)) {
        return;
      }

      this.ngZone.run(() => this.selectStateById(stateId));
    });
  }

  private selectStateById(stateId: number): void {
    this.selectedState.set(this.snapshot().states.find((state) => state.ID === stateId) ?? null);
  }

  private updateStateHighlights(states: StoredStateRecord[]) {
    if (!this.map || !this.map.getSource('states')) return;

    const nextFoundIds = new Set(states.filter((state) => state.fnd.stateFound).map((state) => state.ID));
    const changedIds = new Set<number>([...nextFoundIds, ...this.previousFoundIds]);

    changedIds.forEach((stateId) => {
      const nextFound = nextFoundIds.has(stateId);
      const previousFound = this.previousFoundIds.has(stateId);

      if (nextFound === previousFound) {
        return;
      }

      this.map?.setFeatureState(
        { source: 'states', id: stateId },
        { found: nextFound }
      );
    });

    this.previousFoundIds = nextFoundIds;
  }
}
