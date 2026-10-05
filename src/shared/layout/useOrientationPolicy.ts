import { useEffect } from 'react';
import { Dimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useRemoteConfig } from '../contexts/RemoteConfigContext';
import { isResponsiveLayoutEnabled, isTabletSized } from './useLayout';

// The manifest locks the app to portrait, so phones never rotate.
// Tablet-sized screens (tablets, car head units) get rotation unlocked at runtime.
export function useOrientationPolicy() {
    // re-run once remote config hydrates, so the kill switch also re-locks orientation
    const remoteConfig = useRemoteConfig();

    useEffect(() => {
        const screen = Dimensions.get('screen');
        if (!isTabletSized(screen.width, screen.height)) return;

        const apply = isResponsiveLayoutEnabled()
            ? ScreenOrientation.unlockAsync()
            : ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        apply.catch((error) => console.warn('orientation policy failed', error));
    }, [remoteConfig]);
}
