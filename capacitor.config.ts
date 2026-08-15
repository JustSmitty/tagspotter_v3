import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.tagspotter.app',
  appName: 'Tag Spotter',
  webDir: 'www',
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK'
    },
    // Explicitly define the keyboard resize mode. Without it, Ionic's startup
    // probe of Keyboard.getResizeMode() hits an undefined native mode and logs a
    // spurious UNIMPLEMENTED plugin error on Android.
    Keyboard: {
      resize: KeyboardResize.Native
    }
  }
};

export default config;
