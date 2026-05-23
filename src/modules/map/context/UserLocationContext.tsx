import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import * as Location from 'expo-location';

export type UserLocationCoords = { lat: number; lng: number };

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
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log('location denied');
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
                const lastKnown = await Location.getLastKnownPositionAsync({
                    maxAge: 10 * 60 * 1000,
                });
                if (lastKnown) {
                    applyLocation(lastKnown.coords);
                }
            } catch {
            }

            try {
                const current = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                applyLocation(current.coords);
            } catch {
                try {
                    const current = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Lowest,
                    });
                    applyLocation(current.coords);
                } catch {
                }
            }

            locationSubscription.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 1000,
                    distanceInterval: 0,
                },
                (location) => applyLocation(location.coords)
            );
        } catch (error) {
            isTrackingActive.current = false;
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
