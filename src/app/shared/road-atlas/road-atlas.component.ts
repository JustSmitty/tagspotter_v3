import {
  Component,
  inject,
  OnDestroy,
  effect,
  computed,
  AfterViewInit,
  ViewEncapsulation,
  NgZone
} from '@angular/core';
import { take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as maplibregl from 'maplibre-gl';

import { StoredStateRecord } from '../../models/game-state.model';
import { GameStateStore } from '../../services/game-state.store';

let statesGeoJsonPromise: Promise<any> | null = null;

@Component({
  selector: 'app-road-atlas',
  templateUrl: './road-atlas.component.html',
  styleUrls: ['./road-atlas.component.scss'],
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None
})
export class RoadAtlasComponent implements AfterViewInit, OnDestroy {
  private readonly gameStateStore = inject(GameStateStore);
  private readonly http = inject(HttpClient);
  private readonly ngZone = inject(NgZone);
  
  private map: maplibregl.Map | null = null;
  private statesData: any = null;
  private previousFoundIds = new Set<number>();

  readonly snapshot = this.gameStateStore.snapshot;
  readonly foundCount = computed(() => this.snapshot().foundCount);
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
  };

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
    this.ngZone.runOutsideAngular(() => {
      this.map = new maplibregl.Map({
        container: 'road-atlas-map',
        style: this.VINTAGE_STYLE as any,
        center: [-98.5795, 39.8283],
        zoom: 3.5,
        pitch: 0,
        bearing: 0,
        interactive: false // Disable pan and zoom
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
      this.statesData = JSON.parse(JSON.stringify(data));
      this.injectFeatureIds();
      this.setupMapLayers();
    } catch (error) {
      console.error('Failed to load atlas GeoJSON:', error);
    }
  }

  private async getStatesGeoJson(): Promise<any> {
    if (!statesGeoJsonPromise) {
      statesGeoJsonPromise = firstValueFrom(this.http.get('assets/us-states.json'));
    }

    return statesGeoJsonPromise;
  }

  private injectFeatureIds(): void {
    if (!this.statesData || !this.statesData.features) return;

    const stateNameToId = this.stateNameToId();
    this.statesData.features.forEach((feature: any) => {
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
      data: this.statesData,
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
