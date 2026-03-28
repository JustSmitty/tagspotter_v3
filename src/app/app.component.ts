import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  async ngOnInit(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      // Prevent the WebView from drawing behind the status bar and nav bar.
      // This is the authoritative fix — the native XML styles are a fallback.
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: '#BA4A00' }); // Dark Dusty Orange
    }
  }
}
