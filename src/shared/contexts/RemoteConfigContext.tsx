import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getRemoteConfig, fetchAndActivate, getString, getValue, setDefaults, setConfigSettings } from '@react-native-firebase/remote-config';
import semver from 'semver';
import * as Application from 'expo-application';
import { buildRemoteConfigDefaults, hydrateAppConfig, getAppConfig, RC_KEYS } from '../config/remoteConfigValues';

const FALLBACK_API_KEY = process.env.EXPO_PUBLIC_GEBETA_API_KEY ?? '';

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
  mapStyles: RemoteMapStyle[];
}

const RemoteConfigContext = createContext<RemoteConfigState>({
  apiKey: FALLBACK_API_KEY,
  updateRequired: false,
  mapStyles: FALLBACK_MAP_STYLES,
});

export function RemoteConfigProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RemoteConfigState>({
    apiKey: FALLBACK_API_KEY,
    updateRequired: false,
    mapStyles: FALLBACK_MAP_STYLES,
  });

  useEffect(() => {
    const fetchConfig = async () => {
      const rc = getRemoteConfig();

      await setDefaults(rc, {
        min_android_version: '1.0.0',
        gebeta_api_key: FALLBACK_API_KEY,
        map_styles: JSON.stringify(FALLBACK_MAP_STYLES),
        ...buildRemoteConfigDefaults(),
      });
      await setConfigSettings(rc, { minimumFetchIntervalMillis: 0 });
      await fetchAndActivate(rc);

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
      const minVersion = getString(rc, 'min_android_version');
      const currentVersion = Application.nativeApplicationVersion ?? '0.0.0';
      const updateRequired = semver.lt(currentVersion, minVersion);

      let mapStyles = FALLBACK_MAP_STYLES;
      try {
        const raw = getString(rc, 'map_styles');
        if (raw) mapStyles = JSON.parse(raw);
      } catch {
        console.error('remoteconfig: failed to parse map_styles, using fallback');
      }

      const source = getString(rc, 'gebeta_api_key') ? 'remote-config' : 'fallback';
      console.log(`remoteconfig: apikey source: ${source}, min_android_version: ${minVersion}, map_styles: ${mapStyles.map(s => s.id).join(', ')}`);
      setState({ apiKey, updateRequired, mapStyles });
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
