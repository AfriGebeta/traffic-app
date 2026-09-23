import { useState } from 'react';
import * as Location from 'expo-location';
import { incidentService } from '../services/incident.service';
import { Incident } from '../types/incident.types';

export interface IncidentReportResult {
    incident: Incident | null;
    error?: string;
    status?: number;
}

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
        typeName: string,
        description: string,
        coords?: { lat: number; lng: number },
        direction?: string,
        images?: string[]
    ): Promise<IncidentReportResult> => {
        setLoading(true);
        setError(null);

        try {
            const locationToUse = coords || location || (await getCurrentLocation());

            if (!locationToUse) {
                setError('unable to get current location');
                return { incident: null, error: 'unable to get current location' };
            }

            const response = await incidentService.report({
                lat: locationToUse.lat,
                lng: locationToUse.lng,
                type: typeName,
                description,
                direction,
                ...(images && images.length > 0 && { image: images }),
            });

            if (response.error) {
                setError(response.error);
                return { incident: null, error: response.error, status: response.status };
            }

            return { incident: response.data || null };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to report incident';
            setError(errorMessage);
            return { incident: null, error: errorMessage };
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
