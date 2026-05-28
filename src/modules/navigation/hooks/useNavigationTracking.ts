import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { navigationTrackingService } from '../services/tracking.service';

interface UseNavigationTrackingProps {
    isNavigating: boolean;
    userLocation: { lat: number; lng: number } | null;
}

export const useNavigationTracking = ({
    isNavigating,
    userLocation,
}: UseNavigationTrackingProps) => {
    const navigationIdRef = useRef<string | null>(null);
    const trackingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const previousNavigatingRef = useRef<boolean>(false);

    useEffect(() => {
        if (isNavigating && userLocation) {
            if (!navigationIdRef.current) {
                navigationIdRef.current = `nav_${Date.now()}`;
                console.log('[Tracking] Started tracking navigation:', navigationIdRef.current);
            }

            trackingIntervalRef.current = setInterval(() => {
                if (navigationIdRef.current && userLocation) {
                    navigationTrackingService.addNavigationPoint(
                        navigationIdRef.current,
                        userLocation.lat,
                        userLocation.lng
                    );
                }
            }, 5000);
        } else {
            if (trackingIntervalRef.current) {
                clearInterval(trackingIntervalRef.current);
                trackingIntervalRef.current = null;
            }

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

        return () => {
            if (trackingIntervalRef.current) {
                clearInterval(trackingIntervalRef.current);
            }
        };
    }, [isNavigating, userLocation]);

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
