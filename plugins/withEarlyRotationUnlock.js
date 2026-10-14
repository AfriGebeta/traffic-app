const { withMainActivity } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');


const TAG = 'gebeta-early-rotation-unlock';

const UNLOCK_BLOCK = `    try {
      // physical display size in the current rotation, measured like Dimensions.get('screen') in JS
      val displayWidthPx: Int
      val displayHeightPx: Int
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
        val bounds = windowManager.maximumWindowMetrics.bounds
        displayWidthPx = bounds.width()
        displayHeightPx = bounds.height()
      } else {
        val realMetrics = android.util.DisplayMetrics()
        @Suppress("DEPRECATION")
        windowManager.defaultDisplay.getRealMetrics(realMetrics)
        displayWidthPx = realMetrics.widthPixels
        displayHeightPx = realMetrics.heightPixels
      }
      // natural orientation = the display's shape at rotation 0. Phones are built portrait-first;
      // a landscape-first display is a car head unit or tablet, where a portrait lock would
      // letterbox the app, so it always rotates (even with the kill switch off), whatever its density
      @Suppress("DEPRECATION")
      val rotation = windowManager.defaultDisplay.rotation
      val sideways = rotation == android.view.Surface.ROTATION_90 || rotation == android.view.Surface.ROTATION_270
      val naturalWidthPx = if (sideways) displayHeightPx else displayWidthPx
      val naturalHeightPx = if (sideways) displayWidthPx else displayHeightPx
      val landscapeNative = naturalWidthPx > naturalHeightPx

      val density = resources.displayMetrics.density
      val longDp = Math.round(maxOf(displayWidthPx, displayHeightPx) / density)
      val shortDp = Math.round(minOf(displayWidthPx, displayHeightPx) / density)
      val bigBySize = shortDp >= 600 || (longDp >= 840 && shortDp >= 500)
      // nothing stored yet (first launch) = enabled, matching the Remote Config default
      val layoutEnabled = getSharedPreferences("gebeta_layout_prefs", android.content.Context.MODE_PRIVATE)
        .getBoolean("responsive_layout_enabled", true)

      if (landscapeNative || (layoutEnabled && bigBySize)) {
        requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
      }
    } catch (e: Exception) {
      // keep the manifest's portrait lock; the JS policy still runs after launch
    }`;

module.exports = function withEarlyRotationUnlock(config) {
  return withMainActivity(config, (config) => {
    if (config.modResults.language !== 'kt') {
      console.warn(`[${TAG}] MainActivity is not Kotlin; skipping early rotation unlock`);
      return config;
    }
    try {
      config.modResults.contents = mergeContents({
        src: config.modResults.contents,
        newSrc: UNLOCK_BLOCK,
        tag: TAG,
        // insert right before super.onCreate(...) inside MainActivity.onCreate
        anchor: /^\s*super\.onCreate\(/,
        offset: 0,
        comment: '//',
      }).contents;
    } catch (error) {
      console.warn(`[${TAG}] could not patch MainActivity, skipping (app keeps the JS unlock): ${error.message}`);
    }
    return config;
  });
};
