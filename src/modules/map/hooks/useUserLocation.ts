import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export const useUserLocation = () => {
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    const getUserLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                });
                setUserLocation({
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                });
            }
        } catch (error) {
            console.log('Error getting location:', error);
        }
    };

    useEffect(() => {
        getUserLocation();
    }, []);

    return { userLocation, setUserLocation };
};
