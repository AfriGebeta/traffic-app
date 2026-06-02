import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { navigationTrackingService } from '../../navigation/services/tracking.service';

interface UseCollectorTrackingProps {
    isCollecting: boolean; 
    routeName?: string;
}

export const useCollectorTracking = ({
    isCollecting,
    routeName,
}: UseCollectorTrackingProps) => {
    const collectionIdRef = useRef<string | null>(null);
    const trackingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
    const previousCollectingRef = useRef<boolean>(false);
    const hasPointsRef = useRef<boolean>(false);

    useEffect(() => {
        const startTracking = async () => {
            if (isCollecting) {
                if (!collectionIdRef.current) {
                    const sessionName = routeName ? `collection_${routeName}` : 'collection';
                    collectionIdRef.current = `${sessionName}_${Date.now()}`;
                    hasPointsRef.current = false;
                    console.log('collector:Started tracking:', collectionIdRef.current);
                }

                try {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== 'granted') {
                        console.log('collector: Location permission denied');
                        return;
                    }

                    if (!locationSubscriptionRef.current) {
                        locationSubscriptionRef.current = await Location.watchPositionAsync(
                            {
                                accuracy: Location.Accuracy.High,
                                timeInterval: 5000, 
                                distanceInterval: 0,
                            },
                            (location) => {
                                if (collectionIdRef.current) {
                                    const { latitude, longitude } = location.coords;
                                    navigationTrackingService.addNavigationPoint(
                                        collectionIdRef.current,
                                        latitude,
                                        longitude
                                    );
                                    hasPointsRef.current = true;
                                    console.log('collector point added:', { latitude, longitude });
                                }
                            }
                        );
                    }
                } catch (error) {
                    console.error('error starting location tracking: collector', error);
                }
            } else {
                if (locationSubscriptionRef.current) {
                    locationSubscriptionRef.current.remove();
                    locationSubscriptionRef.current = null;
                }

                if (trackingIntervalRef.current) {
                    clearInterval(trackingIntervalRef.current);
                    trackingIntervalRef.current = null;
                }

                if (collectionIdRef.current && previousCollectingRef.current) {
                    const collectionId = collectionIdRef.current;
                    console.log('collect: collection ended, syncing:', collectionId);

                    if (hasPointsRef.current) {
                        navigationTrackingService.endNavigationAndSync(collectionId).then((success) => {
                            if (success) {
                                console.log('collector data synced successfully');
                            } else {
                                console.log('failed to sync (will retry in background)');
                            }
                        });
                    } else {
                        console.log('collector points collected, skipping sync');
                    }

                    collectionIdRef.current = null;
                    hasPointsRef.current = false;
                }
            }

            previousCollectingRef.current = isCollecting;
        };

        startTracking();

        return () => {
            if (locationSubscriptionRef.current) {
                locationSubscriptionRef.current.remove();
                locationSubscriptionRef.current = null;
            }
            if (trackingIntervalRef.current) {
                clearInterval(trackingIntervalRef.current);
                trackingIntervalRef.current = null;
            }
        };
    }, [isCollecting, routeName]);

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'background' && collectionIdRef.current && hasPointsRef.current) {
                navigationTrackingService.checkAndSync();
            } else if (nextAppState === 'active') {
                navigationTrackingService.checkAndSync();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, []);

    const endTracking = async (): Promise<boolean> => {
        if (collectionIdRef.current) {
            const collectionId = collectionIdRef.current;

            if (locationSubscriptionRef.current) {
                locationSubscriptionRef.current.remove();
                locationSubscriptionRef.current = null;
            }

            let success = false;
            if (hasPointsRef.current) {
                success = await navigationTrackingService.endNavigationAndSync(collectionId);
            } else {
                success = true;
            }

            collectionIdRef.current = null;
            hasPointsRef.current = false;
            previousCollectingRef.current = false;

            return success;
        }
        return false;
    };

    return {
        currentCollectionId: collectionIdRef.current,
        endTracking,
        hasPoints: hasPointsRef.current,
    };
};
