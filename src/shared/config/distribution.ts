import { Platform } from 'react-native';

/**
 * True only for the sideloaded APK build (`npm run build:apk`). The Play Store
 * build never sets EXPO_PUBLIC_DISTRIBUTION, so it keeps the Remote Config
 * banner / force-update modal and never runs the in-app APK updater.
 */
export const IS_APK_BUILD =
    Platform.OS === 'android' && process.env.EXPO_PUBLIC_DISTRIBUTION === 'apk';

export const APK_MANIFEST_URL =
    process.env.EXPO_PUBLIC_APK_MANIFEST_URL || 'https://gebeta.app/downloads/latest.json';
