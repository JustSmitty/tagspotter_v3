# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ---------------------------------------------------------------------------
# Capacitor bridge (audit F-34)
#
# R8 is enabled on release builds. Capacitor resolves plugins and their methods
# reflectively from the JS side: MainActivity references AppSettingsPlugin
# directly so the class survives, but `open()` is only ever called by name
# through the bridge. Without these rules R8 sees no caller, strips the method,
# and the "Open settings" button in the location-permission alert silently does
# nothing in release while working perfectly in debug.
# ---------------------------------------------------------------------------
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.PluginMethod public <methods>;
}
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public <methods>;
}

# Plugin config and JS-facing models are read reflectively via JSObject.
-keepclassmembers class * extends com.getcapacitor.Plugin {
    public <init>(...);
}

# Keep annotations themselves, or the rules above have nothing to match on.
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
