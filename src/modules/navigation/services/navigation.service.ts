import { apiService } from '../../../shared/services/api';
import type {
    GeocodingPlace,
    NavigationRequest,
    NavigationResponse,
} from '../types/navigation.types';
import type { RouteSegment } from '../../taxi/types/taxi.types';
import { calculateDistance } from '../utils/navigationUtils';
import { getAppConfig } from '../../../shared/config/remoteConfigValues';

export const navigationService = {
    async geocodePlace(placeName: string): Promise<GeocodingPlace[]> {
        const response = await apiService.post<{ response: any[] }>('/api/navigation/request-geocoding', {
            placeName
        });

        if (response.error || !response.data) {
            return [];
        }

        const results = response.data.response || [];

        return results.map(place => ({
            id: place.id,
            name: place.name,
            display_name: place.display_name,
            category: place.category,
            location: place.location,
            address: place.address,
            latitude: place.location.lat,
            longitude: place.location.lng,
            Country: place.address.country || '',
            City: place.address.city || '',
            type: place.category || 'location',
        }));
    },

    async reverseGeocode(lat: number, lng: number): Promise<GeocodingPlace> {
        try {
            const response = await apiService.post<{ response: { results: any[] } }>('/api/navigation/request-revgeocoding', {
                coordinate: { lat, lng },
                cursor: 0,
                size: 10
            });

            const results = response.data?.response?.results || response.data?.response || [];

            const placesArray = Array.isArray(results) ? results : [];

            // look for landmark
            const LANDMARK_THRESHOLD = 0.0005;

            for (const place of placesArray) {
                const placeLat = place.location?.lat || place.latitude;
                const placeLng = place.location?.lng || place.longitude;

                if (place.name && placeLat && placeLng) {
                    const distance = Math.sqrt(
                        Math.pow(placeLat - lat, 2) + Math.pow(placeLng - lng, 2)
                    );

                    if (distance < LANDMARK_THRESHOLD) {
                        return {
                            id: place.id || '',
                            name: place.name,
                            display_name: place.display_name || place.name,
                            category: place.category || 'location',
                            location: {
                                lat: lat,
                                lng: lng
                            },
                            address: {
                                city: place.address?.city || place.City || '',
                                country: place.address?.country || place.Country || '',
                                country_code: place.address?.country_code || ''
                            },
                            // Legacy fields
                            latitude: lat,
                            longitude: lng,
                            Country: place.address?.country || place.Country || '',
                            City: place.address?.city || place.City || '',
                            type: place.category || place.type || 'location'
                        };
                    }
                }
            }
        } catch (error) {

        }

        return {
            id: '',
            name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            display_name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            category: 'coordinates',
            location: {
                lat: lat,
                lng: lng
            },
            address: {
                city: '',
                country: '',
                country_code: ''
            },
            latitude: lat,
            longitude: lng,
            Country: '',
            City: '',
            type: 'coordinates'
        };
    },

    async getNavigation(request: NavigationRequest): Promise<NavigationResponse | null> {
        const payload: Record<string, any> = {
            origin: request.origin,
            destination: request.destination,
            costing: request.costing || 'auto',
        };

        if (request.waypoints && request.waypoints.length > 0) {
            payload.waypoints = request.waypoints;
        }

        if (request.alternative) {
            payload.alternative = "t";
        }

        const response = await apiService.post<NavigationResponse>('/api/navigation/request-navigation', payload);

        if (response.error || !response.data) {
            return null;
        }

        return response.data;
    },

    //taxi navigation helpers
    detectSegmentTransition(
        currentLocation: { lat: number; lng: number },
        currentSegment: RouteSegment,
        nextSegment?: RouteSegment
    ): boolean {
        const endPoint = currentSegment.toNode || currentSegment.to;
        const distance = calculateDistance(
            currentLocation.lat,
            currentLocation.lng,
            endPoint.lat,
            endPoint.lng
        );

        const cfg = getAppConfig();
        const threshold =
            currentSegment.mode === 'pedestrian' || currentSegment.type === 'walk'
                ? cfg.walkingEndThresholdM
                : cfg.stationArrivalThresholdM;

        return distance < threshold;
    },

    getSegmentInstruction(segment: RouteSegment, isStart: boolean = false): string {
        if (segment.mode === 'auto' || segment.type === 'taxi') {
            if (isStart) {
                return `Board taxi at ${segment.fromNode?.name || 'station'}`;
            }
            return `Stay on taxi to ${segment.toNode?.name || 'destination'}`;
        } else if (segment.mode === 'pedestrian' || segment.type === 'walk') {
            const destination = segment.toNode?.name || 'destination';
            return `Walk to ${destination}`;
        }
        return 'Continue ahead';
    },
};
