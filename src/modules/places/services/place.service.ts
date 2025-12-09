import { apiService } from '../../../shared/services/api';
import { Place, PlaceContributionRequest } from '../types/place.types';

export const placeService = {
    async contributePlace(data: PlaceContributionRequest): Promise<Place> {
        const response = await apiService.post<Place>('/api/places', data);

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to contribute place');
        }

        return response.data;
    },

    async getPlaces(): Promise<Place[]> {
        const response = await apiService.get<Place[]>('/api/places');

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to fetch places');
        }

        return response.data;
    },
};
