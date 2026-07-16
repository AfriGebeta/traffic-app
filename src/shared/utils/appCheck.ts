import { initializeAppCheck, getToken } from '@react-native-firebase/app-check';
import type { AppCheck } from '@react-native-firebase/app-check';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ReactNativeFirebaseAppCheckProvider = require('@react-native-firebase/app-check/dist/module/ReactNativeFirebaseAppCheckProvider.js').default;

let appCheckInstance: AppCheck | null = null;
let initPromise: Promise<void> | null = null;
let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let tokenFetchPromise: Promise<string | null> | null = null;

export function initializeAppCheckSingleton(): void {
  if (appCheckInstance || initPromise) return;

  initPromise = (async () => {
    const provider = new ReactNativeFirebaseAppCheckProvider();
    provider.configure({
      android: {
        provider: __DEV__ ? 'debug' : 'playIntegrity',
        debugToken: __DEV__ ? process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN : undefined,
      },
      apple: {
        provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
        debugToken: __DEV__ ? process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN : undefined,
      },
      isTokenAutoRefreshEnabled: true,
    });
    appCheckInstance = await initializeAppCheck(undefined, {
      provider,
      isTokenAutoRefreshEnabled: true,
    });
  })().catch(console.error);
}

export async function getAppCheckToken(): Promise<string | null> {
  // Wait for initialization if it's still in progress
  if (!appCheckInstance && initPromise) await initPromise;
  if (!appCheckInstance) return null;

  // Return cached token if still valid (with 5-minute buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  // Deduplicate concurrent requests — all callers wait for the same fetch
  if (tokenFetchPromise) return tokenFetchPromise;

  tokenFetchPromise = (async () => {
    try {
      const { token } = await getToken(appCheckInstance!);
      // console.log('AppCheck token:', token); 
      cachedToken = token;
      tokenExpiresAt = Date.now() + 55 * 60 * 1000;
      return token;
    } catch (error) {
      console.error('Failed to get App Check token:', error);
      return null;
    } finally {
      tokenFetchPromise = null;
    }
  })();

  return tokenFetchPromise;
}
