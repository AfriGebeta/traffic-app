package expo.modules.layoutprefs

import android.content.Context
import android.util.DisplayMetrics
import android.view.Surface
import android.view.WindowManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LayoutPrefsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LayoutPrefs")

    Function("setLayoutEnabled") { enabled: Boolean ->
      val context = appContext.reactContext ?: return@Function
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putBoolean(KEY_LAYOUT_ENABLED, enabled)
        .apply()
    }

    // true when the display is landscape at rotation 0 (car head units, most tablets);
    // phones are portrait-first. False if it can't be determined.
    Function("isLandscapeNativeDisplay") {
      try {
        val context = appContext.reactContext ?: return@Function false
        val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
          ?: return@Function false
        @Suppress("DEPRECATION")
        val display = windowManager.defaultDisplay
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        display.getRealMetrics(metrics)
        @Suppress("DEPRECATION")
        val rotation = display.rotation
        val sideways = rotation == Surface.ROTATION_90 || rotation == Surface.ROTATION_270
        val naturalWidth = if (sideways) metrics.heightPixels else metrics.widthPixels
        val naturalHeight = if (sideways) metrics.widthPixels else metrics.heightPixels
        naturalWidth > naturalHeight
      } catch (e: Exception) {
        false
      }
    }
  }

  companion object {
    const val PREFS_NAME = "gebeta_layout_prefs"
    const val KEY_LAYOUT_ENABLED = "responsive_layout_enabled"
  }
}
