import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import SpInAppUpdates, {
  IAUInstallStatus,
  IAUUpdateKind,
  type AndroidInAppUpdateExtras,
  type StatusUpdateEvent,
} from 'sp-react-native-in-app-updates';
import { isNavigationPath } from '../utils/navigationPaths';
import { logBreadcrumb } from '../utils/crashlytics';

export const UPDATE_DISMISSED_KEY = '@traffic_app_update_banner_dismissed_version';
const ACCEPTED_CODE_KEY = '@traffic_app_iau_accepted_version_code';

export type InAppUpdateStatus = 'idle' | 'checking' | 'play' | 'fallback' | 'declined';

interface Params {
  updateRequired: boolean;
  updateAvailable: boolean;
  latestVersion: string;
  pathname: string;
}

let client: SpInAppUpdates | null = null;
const getClient = () => (client ??= new SpInAppUpdates(__DEV__));

const log = (message: string) => {
  console.log(`iau: ${message}`);
  logBreadcrumb(`iau: ${message}`);
};

export function useInAppUpdate({ updateRequired, updateAvailable, latestVersion, pathname }: Params) {
  const playCapable = Platform.OS === 'android' && !__DEV__;
  const [status, setStatus] = useState<InAppUpdateStatus>(playCapable ? 'idle' : 'fallback');
  const [readyToInstall, setReadyToInstall] = useState(false);
  const pendingInstallRef = useRef(false);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const onStatus = useCallback((event: StatusUpdateEvent) => {
    if (event.status === IAUInstallStatus.DOWNLOADED) {
      log('downloaded');
      pendingInstallRef.current = true;
      setReadyToInstall(true);
    } else if (event.status === IAUInstallStatus.FAILED) {
      log('download failed, falling back to banner');
      pendingInstallRef.current = false;
      setReadyToInstall(false);
      setStatus('fallback');
    } else if (event.status === IAUInstallStatus.INSTALLED) {
      log('installed');
    }
  }, []);

  useEffect(() => {
    if (!playCapable || status !== 'idle') return;
    if (updateRequired || !updateAvailable || !latestVersion) return;
    if (pathname !== '/') return;

    setStatus('checking');
    const iau = getClient();

    const run = async () => {
      const dismissed = await AsyncStorage.getItem(UPDATE_DISMISSED_KEY).catch(() => null);
      if (dismissed === latestVersion) {
        setStatus('declined');
        return;
      }

      const buildCode = Application.nativeBuildVersion;
      if (!buildCode) {
        log('no native build version, falling back');
        setStatus('fallback');
        return;
      }

      const res = await iau.checkNeedsUpdate({ curVersion: buildCode });
      const info = res.other as AndroidInAppUpdateExtras | undefined;
      const playCode = info?.versionCode;
      if (!res.shouldUpdate || !info?.isFlexibleUpdateAllowed) {
        log(`play has nothing for ${buildCode} (${res.reason ?? 'flexible not allowed'}), falling back`);
        setStatus('fallback');
        return;
      }

      iau.addStatusUpdateListener(onStatus);

      const accepted = await AsyncStorage.getItem(ACCEPTED_CODE_KEY).catch(() => null);
      if (accepted === String(playCode)) {
        log(`resuming accepted update ${playCode}`);
        pendingInstallRef.current = true;
        setStatus('play');
        return;
      }

      iau.addIntentSelectionListener((result) => {
        if (Number(result) === IAUInstallStatus.CANCELED) {
          log(`declined ${playCode}`);
          AsyncStorage.setItem(UPDATE_DISMISSED_KEY, latestVersion).catch(() => undefined);
          setStatus('declined');
        } else {
          log(`accepted ${playCode}`);
          AsyncStorage.setItem(ACCEPTED_CODE_KEY, String(playCode)).catch(() => undefined);
        }
      });

      setStatus('play');
      log(`starting flexible update ${buildCode} -> ${playCode}`);
      await iau.startUpdate({ updateType: IAUUpdateKind.FLEXIBLE });
    };

    run().catch((e) => {
      log(`failed, falling back: ${e instanceof Error ? e.message : String(e)}`);
      setStatus('fallback');
    });
  }, [playCapable, status, updateRequired, updateAvailable, latestVersion, pathname, onStatus]);

  useEffect(() => {
    if (!playCapable) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'background' || !pendingInstallRef.current) return;
      if (isNavigationPath(pathnameRef.current)) return;
      log('installing in background');
      getClient().installUpdate();
    });
    return () => sub.remove();
  }, [playCapable]);

  const install = useCallback(() => {
    log('installing from snackbar');
    getClient().installUpdate();
  }, []);

  return { status, readyToInstall, install };
}
