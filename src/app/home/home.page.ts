import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe, UpperCasePipe } from '@angular/common';
import { IonContent, IonHeader, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeCircle, helpCircleOutline, refreshOutline, ribbonOutline, searchOutline } from 'ionicons/icons';

import { QuizDifficulty } from '../models/quiz.model';
import { StateCardViewModel, StateRegion } from '../models/game-view.model';
import { LocationPrecision } from '../models/location.model';
import { GameStateStore } from '../services/game-state.store';
import { HomeWorkflowService } from '../services/home-workflow.service';
import { RoadAtlasComponent } from '../shared/road-atlas/road-atlas.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonHeader, IonContent, IonIcon, RoadAtlasComponent, UpperCasePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnInit {
  private readonly store = inject(GameStateStore);
  private readonly workflow = inject(HomeWorkflowService);

  readonly viewModel = this.store.homeViewModel;
  readonly difficulty = this.store.difficulty;
  readonly gameMode = this.store.gameMode;
  readonly hasSeenOnboarding = this.store.hasSeenOnboarding;
  readonly locationPrecision = this.store.locationPrecision;
  readonly searchQuery = signal('');
  readonly selectedRegion = signal<StateRegion | 'all'>('all');
  readonly filteredStates = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const region = this.selectedRegion();
    return this.viewModel().states.filter((state) => {
      const matchesQuery = !query || state.name.toLowerCase().includes(query) || state.code.toLowerCase().includes(query);
      return matchesQuery && (region === 'all' || state.region === region);
    });
  });

  constructor() {
    addIcons({ closeCircle, helpCircleOutline, refreshOutline, ribbonOutline, searchOutline });
  }

  ngOnInit(): Promise<void> { return this.workflow.initialize(); }
  onToggleGameMode(): Promise<void> { return this.workflow.toggleGameMode(); }
  onDifficultyChange(value: QuizDifficulty): Promise<void> { return this.workflow.changeDifficulty(value); }
  onSetLocationPrecision(value: LocationPrecision): Promise<void> { return this.workflow.changeLocationPrecision(value); }
  onRefresh(): Promise<void> { return this.workflow.confirmReset(); }
  onMapSpot(stateId: number): Promise<void> { return this.workflow.recordStateById(stateId); }
  onRecord(state: StateCardViewModel): Promise<void> { return this.workflow.recordState(state); }
  openDashboard(): void { void this.workflow.openDashboard(); }
  openOnboarding(): Promise<void> { return this.workflow.openOnboarding(); }
  retryLoad(): Promise<void> { return this.workflow.retryLoad(); }
  dismissError(): void { this.workflow.dismissError(); }

  onSearchInput(event: Event): void { this.searchQuery.set((event.target as HTMLInputElement).value); }
  onSelectRegion(region: StateRegion | 'all'): void { this.selectedRegion.set(region); }
  clearSearch(): void { this.searchQuery.set(''); }
  clearFilters(): void { this.searchQuery.set(''); this.selectedRegion.set('all'); }
}
