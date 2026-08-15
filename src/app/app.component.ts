import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, effect, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { IonApp, IonRouterOutlet, ToastController } from '@ionic/angular/standalone';
import { Router, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ImpactStyle } from '@capacitor/haptics';
import { NativeUiService } from './services/platform/native-ui.service';
import { ClockService } from './services/clock.service';
import { GameStateStore } from './services/game-state.store';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonApp, IonRouterOutlet, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  readonly currentUrl = signal('');
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly nativeUi = inject(NativeUiService);
  private readonly clock = inject(ClockService);
  private readonly store = inject(GameStateStore);
  private readonly toastController = inject(ToastController);

  /**
   * Achievement unlocks are announced from the shell rather than any one page,
   * because an unlock can be triggered from Home, the quiz, or a reset — and
   * before this it was announced nowhere at all (audit F-12).
   */
  private readonly unlockAnnouncer = effect(() => {
    const unlocked = this.store.justUnlocked();
    if (unlocked) void this.announceUnlock(unlocked.title);
  });

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((event) => {
      this.currentUrl.set(event.urlAfterRedirects);
    });
  }

  private async announceUnlock(title: string): Promise<void> {
    this.store.acknowledgeUnlock();
    await this.nativeUi.impact(ImpactStyle.Medium);
    const toast = await this.toastController.create({
      message: `Souvenir earned — ${title}`,
      duration: 3600,
      position: 'top',
      cssClass: 'teletype-toast achievement-toast',
    });
    await toast.present();
  }
  async ngOnInit(): Promise<void> {
    try {
      await this.nativeUi.configureStatusBar();
    } catch {
      // The app remains usable if a native status-bar implementation is absent.
    }
    this.clock.refresh();
  }

  /**
   * Matches whole path segments, not substrings (audit F-16). `includes()` was
   * fine for today's four routes but silently marks two tabs active the moment
   * one route name contains another — `/goal` and `/goals`, say.
   */
  isRouteActive(route: string): boolean {
    const path = this.currentUrl().split(/[?#]/)[0];
    const current = path === '' || path === '/' ? '/home' : path;
    return current === route || current.startsWith(`${route}/`);
  }

  navigateTo(route: string): void {
    void this.router.navigate([route]);
  }
}
