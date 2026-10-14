import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type LayoutPrefsNative = {
  setLayoutEnabled(enabled: boolean): void;
  isLandscapeNativeDisplay(): boolean;
};

// android only: lets MainActivity honour the big-screen kill switch from the very first frame
const native =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<LayoutPrefsNative>('LayoutPrefs')
    : null;

export function storeLayoutEnabled(enabled: boolean): void {
  if (!native) return;
  try {
    native.setLayoutEnabled(enabled);
  } catch (error) {
    console.warn('layout prefs: could not store kill switch', error);
  }
}

// display is landscape at rotation 0 (car head units, most tablets); phones are portrait-first.
// false when unknown (iOS, module missing, error), which keeps the size-based rules in charge.
export function isLandscapeNativeDisplay(): boolean {
  if (!native) return false;
  try {
    return native.isLandscapeNativeDisplay();
  } catch {
    return false;
  }
}
