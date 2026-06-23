import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getRemoteConfig, fetchAndActivate, getString, setDefaults } from '@react-native-firebase/remote-config';
import semver from 'semver';
import * as Application from 'expo-application';

const FALLBACK_API_KEY = process.env.EXPO_PUBLIC_GEBETA_API_KEY ?? '';

interface RemoteConfigState {
  apiKey: string;
  updateRequired: boolean;
}

const RemoteConfigContext = createContext<RemoteConfigState>({
  apiKey: FALLBACK_API_KEY,
  updateRequired: false,
});

export function RemoteConfigProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RemoteConfigState>({
    apiKey: FALLBACK_API_KEY,
    updateRequired: false,
  });

  useEffect(() => {
    const fetchConfig = async () => {
      const rc = getRemoteConfig();

      await setDefaults(rc, {
        min_android_version: '1.0.0',
        gebeta_api_key: FALLBACK_API_KEY,
      });
      await fetchAndActivate(rc);

      const apiKey = getString(rc, 'gebeta_api_key') || FALLBACK_API_KEY;
      const minVersion = getString(rc, 'min_android_version');
      const currentVersion = Application.nativeApplicationVersion ?? '0.0.0';
      const updateRequired = semver.lt(currentVersion, minVersion);

      const source = getString(rc, 'gebeta_api_key') ? 'remote-config' : 'fallback';
      console.log(`remoteconfig: apikey source: ${source}, min_android_version: ${minVersion}`);
      setState({ apiKey, updateRequired });
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
