import { apiService } from '../../../shared/services/api';
import type {
    GeocodingPlace,
    NavigationRequest,
    NavigationResponse,
} from '../types/navigation.types';

export const navigationService = {
    async geocodePlace(placeName: string): Promise<GeocodingPlace[]> {
        const response = await apiService.post<{ response: GeocodingPlace[] }>('/api/navigation/request-geocoding', {
            placeName
        });

        if (response.error || !response.data) {
            console.error('Geocoding error:', response.error);
            return [];
        }

        const results = response.data.response || [];
        return results;
    },

    async getNavigation(request: NavigationRequest): Promise<NavigationResponse | null> {
        const response = await apiService.post<NavigationResponse>('/api/navigation/request-navigation', request);

        if (response.error || !response.data) {
            console.error('Navigation error:', response.error);
            return null;
        }

        return response.data;
    },
};
