import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { FREE_DRIVE_GPS_INTERVAL_MS } from '../constants';
import type { MotionFix } from '../utils/motionModel';

export type FreeDriveLocationStatus =
    | 'idle'
    | 'requesting'
    | 'denied'
    | 'tracking'
    | 'error';

interface UseFreeDriveLocationOptions {
    enabled: boolean;
    onFix: (fix: MotionFix) => void;
}

export const useFreeDriveLocation = ({
    enabled,
    onFix,
}: UseFreeDriveLocationOptions) => {
    const [status, setStatus] = useState<FreeDriveLocationStatus>('idle');
    const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
    const onFixRef = useRef(onFix);
    onFixRef.current = onFix;

    const stop = useCallback(() => {
        subscriptionRef.current?.remove();
        subscriptionRef.current = null;
    }, []);

    useEffect(() => {
        if (!enabled) {
            stop();
            setStatus('idle');
            return;
        }

        let cancelled = false;

        const start = async () => {
            setStatus('requesting');
            try {
                const { status: perm } = await Location.requestForegroundPermissionsAsync();
                if (cancelled) return;
                if (perm !== 'granted') {
                    setStatus('denied');
                    return;
                }

                const sub = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.BestForNavigation,
                        timeInterval: FREE_DRIVE_GPS_INTERVAL_MS,
                        distanceInterval: 0,
                        mayShowUserSettingsDialog: true,
                    },
                    (loc) => {
                        const { latitude, longitude, speed, heading } = loc.coords;
                        onFixRef.current({
                            lat: latitude,
                            lng: longitude,
                            speed,
                            heading,
                            t: loc.timestamp || Date.now(),
                        });
                    }
                );

                if (cancelled) {
                    sub.remove();
                    return;
                }
                subscriptionRef.current = sub;
                setStatus('tracking');
            } catch {
                if (!cancelled) setStatus('error');
            }
        };

        void start();

        return () => {
            cancelled = true;
            stop();
        };
    }, [enabled, stop]);

    return { status };
};
