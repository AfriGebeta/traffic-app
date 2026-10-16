const { withMainActivity } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const TAG = 'gebeta-safe-activity-result';

// Low-memory phones (e.g. Galaxy A12) kill the app while the camera/gallery is open.
// Android then recreates MainActivity and delivers the picker result before React has
// started, and ReactActivityDelegate.onActivityResult crashes on requireNonNull(mReactDelegate).
// Swallow only that case: the app starts normally and the photo from that attempt is lost.
const OVERRIDE_BLOCK = `  override fun onActivityResult(requestCode: Int, resultCode: Int, data: android.content.Intent?) {
    try {
      super.onActivityResult(requestCode, resultCode, data)
    } catch (e: NullPointerException) {
      android.util.Log.w("MainActivity", "activity result arrived before React was ready (process was killed); dropped", e)
    }
  }
`;

module.exports = function withSafeActivityResult(config) {
  return withMainActivity(config, (config) => {
    if (config.modResults.language !== 'kt') {
      console.warn(`[${TAG}] MainActivity is not Kotlin; skipping`);
      return config;
    }
    try {
      config.modResults.contents = mergeContents({
        src: config.modResults.contents,
        newSrc: OVERRIDE_BLOCK,
        tag: TAG,
        // insert as a class member, right before getMainComponentName's doc comment
        anchor: /^\s*override fun getMainComponentName\(/,
        offset: -4,
        comment: '//',
      }).contents;
    } catch (error) {
      console.warn(`[${TAG}] could not patch MainActivity: ${error.message}`);
    }
    return config;
  });
};
