import { useEffect } from 'react';
import { Dimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useRemoteConfig } from '../contexts/RemoteConfigContext';
import { isBigDisplay, isResponsiveLayoutEnabled } from './useLayout';
import { isLandscapeNativeDisplay } from '../../../modules/layout-prefs';

// The manifest locks the app to portrait, so phones never rotate.
export function useOrientationPolicy() {
    // re-run once remote config hydrates, so the kill switch also re-locks orientation
    const remoteConfig = useRemoteConfig();

    useEffect(() => {
        const screen = Dimensions.get('screen');
        const landscapeNative = isLandscapeNativeDisplay();
        const bigScreen = isBigDisplay(screen.width, screen.height);
        if (__DEV__) {
            const decision = landscapeNative || bigScreen ? 'unlocking' : 'staying portrait (phone)';
            console.log(`orientation: screen=${screen.width}x${screen.height} landscapeNative=${landscapeNative} ${decision}`);
        }
        if (!landscapeNative && !bigScreen) return;

        const apply = landscapeNative || isResponsiveLayoutEnabled()
            ? ScreenOrientation.unlockAsync()
            : ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        apply.catch((error) => console.warn('orientation policy failed', error));
    }, [remoteConfig]);
}
