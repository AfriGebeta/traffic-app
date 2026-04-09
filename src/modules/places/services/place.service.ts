import { apiService } from '../../../shared/services/api';
import { Place, PlaceContributionRequest, SavedPlace, SavePlaceRequest } from '../types/place.types';

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

    async savePlace(data: SavePlaceRequest): Promise<SavedPlace> {
        const response = await apiService.post<SavedPlace>('/api/places/saved', data);

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to save place');
        }

        return response.data;
    },

    async getSavedPlaces(): Promise<SavedPlace[]> {
        const response = await apiService.get<SavedPlace[]>('/api/places/saved');

        if (response.error || !response.data) {
            throw new Error(response.error || 'Failed to fetch saved places');
        }

        return response.data;
    },

    async deleteSavedPlace(placeId: string): Promise<void> {
        const response = await apiService.delete<void>(`/api/places/saved/${placeId}`);

        if (response.error) {
            throw new Error(response.error || 'Failed to delete saved place');
        }
    },

    async isPlaceSaved(lat: number, lng: number): Promise<SavedPlace | null> {
        try {
            const savedPlaces = await this.getSavedPlaces();

            const threshold = 0.0001;
            return savedPlaces.find(
                place => Math.abs(place.lat - lat) < threshold && Math.abs(place.lng - lng) < threshold
            ) || null;
        } catch (error) {
            return null;
        }
    },
};
