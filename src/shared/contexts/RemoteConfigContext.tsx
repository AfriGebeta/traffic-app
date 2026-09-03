import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import { getRemoteConfig, fetchAndActivate, getString, getValue, getAll, setDefaults, setConfigSettings } from '@react-native-firebase/remote-config';
import semver from 'semver';
import * as Application from 'expo-application';
import { buildRemoteConfigDefaults, hydrateAppConfig, getAppConfig, RC_KEYS } from '../config/remoteConfigValues';
import { initializeAppCheckSingleton, getAppCheckToken } from '../utils/appCheck';

const FALLBACK_API_KEY = process.env.EXPO_PUBLIC_GEBETA_API_KEY ?? '';

const isIOS = Platform.OS === 'ios';

const MIN_VERSION_KEY = isIOS ? 'min_ios_version' : 'min_android_version';
const LATEST_VERSION_KEY = isIOS ? 'latest_ios_version' : 'latest_android_version';
const STORE_URL_KEY = isIOS ? 'store_url_ios' : 'store_url_android';

const FALLBACK_STORE_URL = isIOS
  ? 'itms-beta://'
  : 'https://play.google.com/store/apps/details?id=co.gebeta.apps.android.map';

export interface RemoteMapStyle {
  id: string;
  name: string;
  nameAmharic: string;
  icon: string;
  url: string;
  enabled: boolean;
}

const FALLBACK_MAP_STYLES: RemoteMapStyle[] = [
  { id: 'standard', name: 'Classic', nameAmharic: 'ክላሲክ', icon: 'map-outline', url: 'https://tiles.gebeta.app/styles/standard/style.json', enabled: true },
  { id: 'custom3', name: 'Standard', nameAmharic: 'መደበኛ', icon: 'color-palette-outline', url: 'https://tiles.gebeta.app/styles/standard/light.json', enabled: true },
  { id: 'dark', name: 'Dark', nameAmharic: 'ጨለማ', icon: 'moon-outline', url: 'https://tiles.gebeta.app/styles/standard/dark.json', enabled: true },
  { id: 'raster', name: 'Satellite', nameAmharic: 'ሳተላይት', icon: 'globe-outline', url: 'https://tiles.gebeta.app/styles/raster/raster.json', enabled: true },
];

interface RemoteConfigState {
  apiKey: string;
  updateRequired: boolean;
  updateAvailable: boolean;
  latestVersion: string;
  storeUrl: string;
  mapStyles: RemoteMapStyle[];
}

const RemoteConfigContext = createContext<RemoteConfigState>({
  apiKey: FALLBACK_API_KEY,
  updateRequired: false,
  updateAvailable: false,
  latestVersion: '',
  storeUrl: FALLBACK_STORE_URL,
  mapStyles: FALLBACK_MAP_STYLES,
});

export function RemoteConfigProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RemoteConfigState>({
    apiKey: FALLBACK_API_KEY,
    updateRequired: false,
    updateAvailable: false,
    latestVersion: '',
    storeUrl: FALLBACK_STORE_URL,
    mapStyles: FALLBACK_MAP_STYLES,
  });

  useEffect(() => {
    const fetchConfig = async () => {
      const rc = getRemoteConfig();

      await setDefaults(rc, {
        min_android_version: '1.0.0',
        min_ios_version: '1.0.0',
        latest_android_version: '',
        latest_ios_version: '',
        store_url_android: 'https://play.google.com/store/apps/details?id=co.gebeta.apps.android.map',
        store_url_ios: 'itms-beta://',
        gebeta_api_key: FALLBACK_API_KEY,
        map_styles: JSON.stringify(FALLBACK_MAP_STYLES),
        ...buildRemoteConfigDefaults(),
      });
      await setConfigSettings(rc, { minimumFetchIntervalMillis: 0 });

      // Remote Config may be App Check enforced — make sure a token exists before fetching
      initializeAppCheckSingleton();
      const appCheckToken = await getAppCheckToken();
      console.log(`remoteconfig: appcheck token before fetch: ${appCheckToken ? 'present' : 'MISSING'}`);

      try {
        const activated = await fetchAndActivate(rc);
        console.log(
          `remoteconfig: fetchAndActivate activated=${activated}, lastFetchStatus=${rc.lastFetchStatus}, fetchTime=${rc.fetchTimeMillis}`
        );
      } catch (e) {
        console.error('remoteconfig: fetchAndActivate FAILED', e);
      }
      const all = getAll(rc);
      const remoteKeys = Object.keys(all).filter((k) => all[k].getSource() === 'remote');
      console.log(
        `remoteconfig: template has ${Object.keys(all).length} keys, ${remoteKeys.length} from remote: ${remoteKeys.join(', ') || '(none)'}`
      );

      hydrateAppConfig(rc);

      const appConfig = getAppConfig();
      const fromRemote = (Object.keys(RC_KEYS) as (keyof typeof RC_KEYS)[])
        .filter((k) => getValue(rc, RC_KEYS[k]).getSource() === 'remote')
        .map((k) => `${RC_KEYS[k]}=${appConfig[k]}`);
      console.log(
        `remoteconfig: tier2 ${fromRemote.length}/${Object.keys(RC_KEYS).length} keys from remote` +
        (fromRemote.length ? ` → ${fromRemote.join(', ')}` : ' (all baked-in defaults)')
      );
      console.log('remoteconfig: tier2 resolved values:', JSON.stringify(appConfig));

      const apiKey = getString(rc, 'gebeta_api_key') || FALLBACK_API_KEY;
      const minVersion = getString(rc, MIN_VERSION_KEY);
      console.log(
        `remoteconfig: source ${MIN_VERSION_KEY}=${getValue(rc, MIN_VERSION_KEY).getSource()}, ${LATEST_VERSION_KEY}=${getValue(rc, LATEST_VERSION_KEY).getSource()}`
      );
      const currentVersion = Application.nativeApplicationVersion ?? '0.0.0';
      const storeUrl = getString(rc, STORE_URL_KEY) || FALLBACK_STORE_URL;

      if (!semver.valid(minVersion) || !semver.valid(currentVersion)) {
        console.error(
          `remoteconfig: invalid version compare, ${MIN_VERSION_KEY}="${minVersion}" current="${currentVersion}", skipping force update`
        );
      }
      const updateRequired =
        !!semver.valid(minVersion) &&
        !!semver.valid(currentVersion) &&
        semver.lt(currentVersion, minVersion);

      const rawLatest = getString(rc, LATEST_VERSION_KEY);
      const latestVersion = semver.valid(rawLatest)
        ? rawLatest
        : (semver.valid(minVersion) ? minVersion : '');
      const updateAvailable =
        !updateRequired &&
        !!latestVersion &&
        !!semver.valid(currentVersion) &&
        semver.gt(latestVersion, currentVersion);

      let mapStyles = FALLBACK_MAP_STYLES;
      try {
        const raw = getString(rc, 'map_styles');
        if (raw) mapStyles = JSON.parse(raw);
      } catch {
        console.error('remoteconfig: failed to parse map_styles, using fallback');
      }

      const source = getString(rc, 'gebeta_api_key') ? 'remote-config' : 'fallback';
      console.log(`remoteconfig: apikey source: ${source}, ${MIN_VERSION_KEY}: ${minVersion}, current: ${currentVersion}, updateRequired: ${updateRequired}, ${LATEST_VERSION_KEY}: ${latestVersion || '(unset)'}, updateAvailable: ${updateAvailable}, storeUrl: ${storeUrl}, map_styles: ${mapStyles.map(s => s.id).join(', ')}`);
      setState({ apiKey, updateRequired, updateAvailable, latestVersion, storeUrl, mapStyles });
    };

    fetchConfig().catch(console.error);
  }, []);

  return (
    <RemoteConfigContext.Provider value={state}>
      {children}
    </RemoteConfigContext.Provider>
  );
}

export function useRemoteConfig() {
  return useContext(RemoteConfigContext);
}
