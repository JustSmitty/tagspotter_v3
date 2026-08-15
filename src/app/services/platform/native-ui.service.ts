import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

interface AppSettingsPlugin {
  open(): Promise<void>;
}

const AppSettings = registerPlugin<AppSettingsPlugin>('AppSettings');

@Injectable({ providedIn: 'root' })
export class NativeUiService {
  isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  async configureStatusBar(): Promise<void> {
    if (!this.isNative()) return;
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#fdfae9' });
  }

  async impact(style: ImpactStyle): Promise<void> {
    if (!this.isNative()) return;
    try {
      await Haptics.impact({ style });
    } catch {
      // Haptics are best effort and must never interrupt play.
    }
  }

  async openAppSettings(): Promise<boolean> {
    if (!this.isNative()) return false;

    try {
      if (Capacitor.getPlatform() === 'ios') {
        window.location.href = 'app-settings:';
      } else {
        await AppSettings.open();
      }
      return true;
    } catch {
      return false;
    }
  }
}
