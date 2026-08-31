import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { StoredStateRecord, getCorrectAnswersCount } from '../../models/game-state.model';
import { GameStateStore } from '../../services/game-state.store';

type Position = [number, number];
type PolygonCoordinates = Position[][];
type MultiPolygonCoordinates = PolygonCoordinates[];

interface GeoJsonFeature {
  properties?: { name?: string };
  geometry?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: PolygonCoordinates | MultiPolygonCoordinates;
  };
}

interface StateAtlasGeoJson {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

interface AtlasFeature {
  id: number;
  name: string;
  code: string;
  path: string;
  labelX: number;
  labelY: number;
}

/**
 * Geometry as it comes out of the GeoJSON: projected, but not yet tied to a
 * state record. Keeping this separate from AtlasFeature is what lets the
 * drawing survive arriving before the save does (pm-0005).
 */
interface AtlasShape {
  name: string;
  path: string;
  labelX: number;
  labelY: number;
}

@Component({
  selector: 'app-road-atlas',
  templateUrl: './road-atlas.component.html',
  styleUrls: ['./road-atlas.component.scss'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoadAtlasComponent implements OnInit {
  private readonly store = inject(GameStateStore);
  private readonly http = inject(HttpClient);

  readonly spotRequested = output<number>();

  /**
   * The selection holds an ID and derives the record (audit F-17). It used to
   * hold the record itself, which meant an `effect` had to re-look-it-up on
   * every snapshot change to keep the open detail panel from going stale. A
   * `computed` cannot drift, so the effect is gone.
   */
  private readonly selectedStateId = signal<number | null>(null);
  readonly selectedState = computed<StoredStateRecord | null>(() => {
    const id = this.selectedStateId();
    if (id === null) return null;
    return this.store.snapshot().states.find((state) => state.ID === id) ?? null;
  });
  /**
   * The two halves of the map arrive independently: the geometry over HTTP,
   * the state records from storage. Joining them in a `computed` rather than
   * once inside the fetch is what keeps the order from mattering — whichever
   * lands second, the map redraws (pm-0005). Doing the join eagerly meant that
   * on a device, where hydration crosses the native bridge and the GeoJSON
   * comes off the local bundle, the fetch won and every shape was discarded as
   * unmatched: 51 paths silently reduced to none, with no error to show for it.
   */
  private readonly shapes = signal<AtlasShape[]>([]);
  readonly features = computed<AtlasFeature[]>(() => {
    const statesByName = new Map(
      this.store.snapshot().states.map((state) => [state.Name.toLowerCase(), state]),
    );

    return this.shapes().reduce<AtlasFeature[]>((result, shape) => {
      const state = statesByName.get(shape.name.toLowerCase());
      if (!state) return result;
      result.push({
        id: state.ID,
        name: shape.name,
        code: state.Abbrv,
        path: shape.path,
        labelX: shape.labelX,
        labelY: shape.labelY,
      });
      return result;
    }, []);
  });

  private readonly isFetching = signal(true);
  /** Still drawing until BOTH halves are in — otherwise the empty window
      between them renders as a blank card with nothing to explain it. */
  readonly isLoading = computed(() => this.isFetching() || !this.store.isLoaded());
  readonly loadError = signal<string | null>(null);
  readonly foundIds = computed(() => new Set(
    this.store.snapshot().states.filter((state) => state.fnd.stateFound).map((state) => state.ID),
  ));
  readonly foundCount = computed(() => this.foundIds().size);

  /**
   * The map is a single image to assistive tech, so its label has to carry the
   * information the 51 individual paths used to (audit F-32). The per-state
   * detail lives in the plate grid below, which is a real list of buttons.
   */
  readonly atlasSummary = computed(() => {
    const total = this.features().length || this.store.snapshot().states.length;
    const found = this.foundCount();
    return found === 0
      ? `Map of the United States. No plates spotted yet, ${total} to find.`
      : `Map of the United States. ${found} of ${total} plates spotted.`;
  });

  ngOnInit(): void {
    void this.loadAtlas();
  }

  async retryLoad(): Promise<void> {
    await this.loadAtlas();
  }

  selectStateById(stateId: number): void {
    this.selectedStateId.set(stateId);
  }

  closeStateDetail(): void {
    this.selectedStateId.set(null);
  }

  requestSpot(stateId: number): void {
    this.spotRequested.emit(stateId);
    this.selectedStateId.set(null);
  }

  isFound(stateId: number): boolean {
    return this.foundIds().has(stateId);
  }

  getCorrectAnswers(state: StoredStateRecord): number {
    return state.fnd.mode === 'trivia'
      ? getCorrectAnswersCount(state.fnd.questionsCorrect, state.fnd.difficulty)
      : 0;
  }

  private async loadAtlas(): Promise<void> {
    this.isFetching.set(true);
    this.loadError.set(null);
    try {
      const data = await firstValueFrom(this.http.get<StateAtlasGeoJson>('assets/us-states.json'));
      this.shapes.set(data.features.reduce<AtlasShape[]>((result, feature) => {
        const name = feature.properties?.name ?? '';
        if (!name || !feature.geometry) return result;
        result.push({ name, ...this.toProjectedFeature(feature.geometry, name) });
        return result;
      }, []));
    } catch {
      this.loadError.set('The road atlas could not be loaded.');
    } finally {
      this.isFetching.set(false);
    }
  }

  private toProjectedFeature(
    geometry: NonNullable<GeoJsonFeature['geometry']>,
    name: string,
  ): Pick<AtlasFeature, 'path' | 'labelX' | 'labelY'> {
    const polygons = geometry.type === 'Polygon'
      ? [geometry.coordinates as PolygonCoordinates]
      : geometry.coordinates as MultiPolygonCoordinates;
    const allPoints: Array<{ x: number; y: number }> = [];
    const path = polygons.map((polygon) => polygon.map((ring) => {
      const projected = ring.map(([lng, lat]) => this.project(lng, lat, name));
      allPoints.push(...projected);
      return projected.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ') + ' Z';
    }).join(' ')).join(' ');

    const xs = allPoints.map((point) => point.x);
    const ys = allPoints.map((point) => point.y);
    return {
      path,
      labelX: (Math.min(...xs) + Math.max(...xs)) / 2,
      labelY: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
  }

  private project(lng: number, lat: number, name: string): { x: number; y: number } {
    if (name === 'Alaska') {
      return { x: 18 + (lng + 180) * 2.35, y: 292 + (72 - lat) * 3.1 };
    }
    if (name === 'Hawaii') {
      return { x: 150 + (lng + 161) * 8.5, y: 348 + (23 - lat) * 11 };
    }
    return { x: 18 + (lng + 125) * 9.6, y: 16 + (50 - lat) * 15.2 };
  }
}
