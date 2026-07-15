import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import * as Location from 'expo-location';
import { markLocationPermissionSettled } from '../../../shared/utils/permissionSequence';
import { getAppConfig } from '../../../shared/config/remoteConfigValues';

export type UserLocationCoords = { lat: number; lng: number; accuracy?: number; speed?: number };

interface UserLocationContextValue {
    userLocation: UserLocationCoords | null;
    setUserLocation: React.Dispatch<React.SetStateAction<UserLocationCoords | null>>;
    stopLocationTracking: () => void;
    startLocationTracking: () => Promise<void>;
}

const UserLocationContext = createContext<UserLocationContextValue | null>(null);

export function UserLocationProvider({ children }: { children: ReactNode }) {
    const [userLocation, setUserLocation] = useState<UserLocationCoords | null>(null);
    const locationSubscription = useRef<Location.LocationSubscription | null>(null);
    const isBackgroundTrackingActive = useRef(true);
    const isTrackingActive = useRef(false);

    const stopLocationTracking = useCallback(() => {
        isBackgroundTrackingActive.current = false;
        isTrackingActive.current = false;
        if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
        }
    }, []);

    const startLocationTracking = useCallback(async () => {
        if (isTrackingActive.current) {
            isBackgroundTrackingActive.current = true;
            if (locationSubscription.current) {
                return;
            }
            isTrackingActive.current = false;
        }

        try {
            let { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') {
                if (Platform.OS === 'android') {
                    await PermissionsAndroid.requestMultiple([
                        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
                    ]).catch(() => undefined);
                } else {
                    await Location.requestForegroundPermissionsAsync().catch(() => undefined);
                }
                ({ status } = await Location.getForegroundPermissionsAsync());
            }
            markLocationPermissionSettled();
            if (status !== 'granted') {
                return;
            }

            isBackgroundTrackingActive.current = true;
            isTrackingActive.current = true;

            const applyLocation = (coords: Location.LocationObjectCoords) => {
                if (!isBackgroundTrackingActive.current) return;
                setUserLocation({
                    lat: coords.latitude,
                    lng: coords.longitude,
                });
            };

            try {
                const lastKnown = await Location.getLastKnownPositionAsync();
                if (lastKnown) {
                    applyLocation(lastKnown.coords);
                }
            } catch {
            }

            locationSubscription.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: getAppConfig().userLocationIntervalMs,
                    distanceInterval: 0,
                },
                (location) => applyLocation(location.coords)
            );

            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest })
                .then((current) => applyLocation(current.coords))
                .catch(() => { });
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
                .then((current) => applyLocation(current.coords))
                .catch(() => { });
        } catch (error) {
            isTrackingActive.current = false;
            markLocationPermissionSettled();
            console.log('error getting location:', error);
        }
    }, []);

    useEffect(() => {
        void startLocationTracking();

        return () => {
            stopLocationTracking();
        };
    }, [startLocationTracking, stopLocationTracking]);

    return (
        <UserLocationContext.Provider
            value={{
                userLocation,
                setUserLocation,
                stopLocationTracking,
                startLocationTracking,
            }}
        >
            {children}
        </UserLocationContext.Provider>
    );
}

export function useUserLocation() {
    const context = useContext(UserLocationContext);
    if (!context) {
        throw new Error('useUserLocation must be used within a UserLocationProvider');
    }
    return context;
}
