import { useEffect, useState } from 'react';
import remoteConfig from '@react-native-firebase/remote-config';
import * as Application from 'expo-application';
import semver from 'semver';

export function useForceUpdate() {
  const [updateRequired, setUpdateRequired] = useState(false);

  useEffect(() => {
    const check = async () => {
      await remoteConfig().setDefaults({ min_android_version: '1.0.0' });
      await remoteConfig().fetchAndActivate();

      const minVersion = remoteConfig().getString('min_android_version');
      const currentVersion = Application.nativeApplicationVersion ?? '0.0.0';

      if (semver.lt(currentVersion, minVersion)) {
        setUpdateRequired(true);
      }
    };

    check().catch(console.error);
  }, []);

  return updateRequired;
}
