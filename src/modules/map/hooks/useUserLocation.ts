import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';

export const useUserLocation = () => {
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const locationSubscription = useRef<Location.LocationSubscription | null>(null);
    const isBackgroundTrackingActive = useRef(true);

    const startLocationTracking = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log('location denied');
                return;
            }

            isBackgroundTrackingActive.current = true;

            const initialLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            if (isBackgroundTrackingActive.current) {
                setUserLocation({
                    lat: initialLocation.coords.latitude,
                    lng: initialLocation.coords.longitude,
                });
            }

            // start watching update
            locationSubscription.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 5000,
                    distanceInterval: 10,
                },
                (location) => {
                    if (isBackgroundTrackingActive.current) {
                        setUserLocation({
                            lat: location.coords.latitude,
                            lng: location.coords.longitude,
                        });
                    }
                }
            );
        } catch (error) {
            console.log('error getting location:', error);
        }
    };

    const stopLocationTracking = () => {
        isBackgroundTrackingActive.current = false;
        if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
        }
        console.log('[useUserLocation] Background location tracking stopped');
    };

    useEffect(() => {
        startLocationTracking();

        return () => {
            stopLocationTracking();
        };
    }, []);

    return { userLocation, setUserLocation, stopLocationTracking, startLocationTracking };
};
