import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { Router, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonApp, IonRouterOutlet, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  currentUrl = '';
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((event) => {
      this.currentUrl = event.urlAfterRedirects;
    });
  }
  async ngOnInit(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Light }); // Black icons for cream background
      await StatusBar.setBackgroundColor({ color: '#fdfae9' }); // Match app cream
    }
  }

  isRouteActive(route: string): boolean {
    if (route === '/home' && (this.currentUrl === '/' || this.currentUrl === '')) {
      return true;
    }
    return this.currentUrl.includes(route);
  }

  navigateTo(route: string): void {
    void this.router.navigate([route]);
  }
}
