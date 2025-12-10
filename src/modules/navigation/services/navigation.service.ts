import { apiService } from '../../../shared/services/api';

export interface GeocodingPlace {
    name: string;
    latitude: number;
    longitude: number;
    Country: string;
    City: string;
    type: string;
}

export interface GeocodingResponse {
    msg: string;
    data: GeocodingPlace[];
}

export interface NavigationRequest {
    origin: [number, number];
    destination: [number, number];
}

export interface NavigationResponse {
    msg: string;
    timetaken: number;
    totalDistance: number;
    direction: [number, number][];
}

export const navigationService = {
    async geocodePlace(placeName: string): Promise<GeocodingPlace[]> {
        const response = await apiService.post<{ response: GeocodingResponse }>('/api/navigation/request-geocoding', {
            placeName
        });

        if (response.error || !response.data) {
            console.error('Geocoding error:', response.error);
            return [];
        }

        return response.data.response.data || [];
    },

    async getNavigation(request: NavigationRequest): Promise<NavigationResponse | null> {
        const response = await apiService.post<{ data: NavigationResponse }>('/api/navigation/request-navigation', request);

        if (response.error || !response.data) {
            console.error('Navigation error:', response.error);
            return null;
        }

        return response.data.data;
    },
};
