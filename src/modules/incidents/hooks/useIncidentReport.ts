import { useState } from 'react';
import * as Location from 'expo-location';
import { incidentService } from '../services/incident.service';
import { Incident } from '../types/incident.types';

export const useIncidentReport = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

    const getCurrentLocation = async (): Promise<{ lat: number; lng: number } | null> => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                setError('Location permission denied');
                return null;
            }

            const currentLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const coords = {
                lat: currentLocation.coords.latitude,
                lng: currentLocation.coords.longitude,
            };

            setLocation(coords);
            return coords;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'failed to get location';
            setError(errorMessage);
            return null;
        }
    };

    const reportIncident = async (
        typeId: string,
        description: string,
        coords?: { lat: number; lng: number },
        direction?: string
    ): Promise<Incident | null> => {
        setLoading(true);
        setError(null);

        try {
            const locationToUse = coords || location || (await getCurrentLocation());

            if (!locationToUse) {
                setError('unable to get current location');
                return null;
            }

            const response = await incidentService.report({
                lat: locationToUse.lat,
                lng: locationToUse.lng,
                typeId,
                description,
                direction,
            });

            if (response.error) {
                setError(response.error);
                return null;
            }

            return response.data || null;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to report incident';
            setError(errorMessage);
            return null;
        } finally {
            setLoading(false);
        }
    };

    return {
        reportIncident,
        getCurrentLocation,
        loading,
        error,
        location,
    };
};
