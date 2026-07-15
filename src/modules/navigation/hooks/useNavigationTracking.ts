import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { navigationTrackingService } from '../services/tracking.service';
import { getAppConfig } from '../../../shared/config/remoteConfigValues';

interface UseNavigationTrackingProps {
    isNavigating: boolean;
    userLocation: { lat: number; lng: number } | null;
}

const TRACKING_POINT_INTERVAL_MS = 5000;

export const useNavigationTracking = ({
    isNavigating,
    userLocation,
}: UseNavigationTrackingProps) => {
    const navigationIdRef = useRef<string | null>(null);
    const previousNavigatingRef = useRef<boolean>(false);
    const lastPointTimeRef = useRef<number>(0);
    const lastPointTimeRef = useRef<number>(0);

    // Record points from location updates instead of setInterval: RN pauses JS
    // timers while the app is backgrounded, but location updates keep arriving
    // through the foreground service, so tracking continues in the background.
    useEffect(() => {
        if (!isNavigating || !navigationIdRef.current || !userLocation) return;

        const now = Date.now();
        if (now - lastPointTimeRef.current < TRACKING_POINT_INTERVAL_MS) return;
        lastPointTimeRef.current = now;

        console.log(
            `[Tracking] ${navigationIdRef.current} point @ ${new Date(now).toISOString()} →`,
            `lat: ${userLocation.lat}, lng: ${userLocation.lng}`
        );
        navigationTrackingService.addNavigationPoint(
            navigationIdRef.current,
            userLocation.lat,
            userLocation.lng
        );
    }, [isNavigating, userLocation]);

    useEffect(() => {
        if (isNavigating) {
            if (!navigationIdRef.current) {
                navigationIdRef.current = `nav_${Date.now()}`;
                lastPointTimeRef.current = 0;
                lastPointTimeRef.current = 0;
                console.log('[Tracking] Started tracking navigation:', navigationIdRef.current);
            }
        } else {
            if (navigationIdRef.current && previousNavigatingRef.current) {
                const navId = navigationIdRef.current;
                console.log(' trackomg: navigation ended, syncing immediately:', navId);
                navigationTrackingService.endNavigationAndSync(navId).then((success) => {
                    if (success) {
                        console.log('tracking: navigation data synced successfully');
                    } else {
                        console.log('track: Failed to sync navigation data');
                    }
                });
                navigationIdRef.current = null;
            }
        }

        previousNavigatingRef.current = isNavigating;
    }, [isNavigating]);

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                navigationTrackingService.checkAndSync();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, []);

    return {
        currentNavigationId: navigationIdRef.current,
    };
};
