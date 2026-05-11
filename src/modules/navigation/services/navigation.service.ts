import { apiService } from '../../../shared/services/api';
import type {
    GeocodingPlace,
    NavigationRequest,
    NavigationResponse,
} from '../types/navigation.types';
import type { RouteSegment } from '../../taxi/types/taxi.types';
import { calculateDistance } from '../utils/navigationUtils';

const STATION_ARRIVAL_THRESHOLD = 50; // 50 meters
const WALKING_END_THRESHOLD = 20; // 20 meters

export const navigationService = {
    async geocodePlace(placeName: string): Promise<GeocodingPlace[]> {
        const response = await apiService.post<{ response: GeocodingPlace[] }>('/api/navigation/request-geocoding', {
            placeName
        });

        if (response.error || !response.data) {
            return [];
        }

        const results = response.data.response || [];
        return results;
    },

    async reverseGeocode(lat: number, lng: number): Promise<GeocodingPlace> {
        try {
            const response = await apiService.post<{ response: any[] }>('/api/navigation/request-revgeocoding', {
                coordinate: { lat, lng },
                cursor: 0,
                limit: 10
            });

            const results = response.data?.response || [];

            // look for landmark
            const LANDMARK_THRESHOLD = 0.0005;

            for (const place of results) {
                if (place.name && place.latitude && place.longitude) {
                    const distance = Math.sqrt(
                        Math.pow(place.latitude - lat, 2) + Math.pow(place.longitude - lng, 2)
                    );

                    if (distance < LANDMARK_THRESHOLD) {
                        return {
                            name: place.name,
                            latitude: lat,
                            longitude: lng,
                            Country: place.Country || '',
                            City: place.City || '',
                            type: place.type || 'location'
                        };
                    }
                }
            }
        } catch (error) {

        }

        return {
            name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            latitude: lat,
            longitude: lng,
            Country: '',
            City: '',
            type: 'coordinates'
        };
    },

    async getNavigation(request: NavigationRequest): Promise<NavigationResponse | null> {
        const payload = {
            origin: request.origin,
            destination: request.destination,
            costing: request.costing || 'auto', 
        };

        const response = await apiService.post<NavigationResponse>('/api/navigation/request-navigation', payload);

        if (response.error || !response.data) {
            return null;
        }

        return response.data;
    },

    // Taxi navigation helpers
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

        const threshold =
            currentSegment.mode === 'pedestrian' || currentSegment.type === 'walk'
                ? WALKING_END_THRESHOLD
                : STATION_ARRIVAL_THRESHOLD;

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
