import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import { EXPLORE_CATEGORIES, type ExploreCategoryId, type ExploreParams } from '../types/explore.types';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export { EXPLORE_CATEGORIES, type ExploreCategoryId };

export const exploreService = {
    async fetchPlacesByCategory(
        categoryId: ExploreCategoryId,
        userLocation: { lat: number; lng: number },
        size: number = 5
    ): Promise<GeocodingPlace[]> {
        const type = EXPLORE_CATEGORIES[categoryId];
        if (!type) {
            throw new Error('Invalid category');
        }

        const params: ExploreParams = {
            coordinate: {
                lat: userLocation.lat,
                lng: userLocation.lng,
            },
            type,
            cursor: 0,
            size,
        };

        const requestBody = JSON.stringify(params);
        

        const response = await fetch(`${API_URL}/api/navigation/request-revgeocoding`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: requestBody,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        let rawResults: any[] = [];
        if (data.response?.results && Array.isArray(data.response.results)) {
            rawResults = data.response.results;
        } else if (data.data?.results && Array.isArray(data.data.results)) {
            rawResults = data.data.results;
        } else if (Array.isArray(data.data)) {
            rawResults = data.data;
        } else if (Array.isArray(data.response)) {
            rawResults = data.response;
        } else if (Array.isArray(data.results)) {
            rawResults = data.results;
        }

        const places: GeocodingPlace[] = rawResults.map((item: any) => ({
            id: item.id || '',
            name: item.name || 'Unknown',
            display_name: item.display_name || item.name || 'Unknown',
            category: item.category || type,
            location: {
                lat: item.location?.lat || item.latitude || 0,
                lng: item.location?.lng || item.longitude || 0,
            },
            address: {
                city: item.address?.city || item.City || '',
                country: item.address?.country || item.Country || '',
                country_code: item.address?.country_code || '',
            },
            latitude: item.location?.lat || item.latitude || 0,
            longitude: item.location?.lng || item.longitude || 0,
            type: item.category || item.type || type,
            Country: item.address?.country || item.Country || '',
            City: item.address?.city || item.City || '',
        }));

        return places;
    },

    async fetchAllCategories(
        userLocation: { lat: number; lng: number }
    ): Promise<Record<ExploreCategoryId, GeocodingPlace[]>> {
        const categories = Object.keys(EXPLORE_CATEGORIES) as ExploreCategoryId[];

        const results = await Promise.all(
            categories.map(async (categoryId) => {
                try {
                    const places = await this.fetchPlacesByCategory(categoryId, userLocation, 5);
                    return { categoryId, places };
                } catch (error) {
                    console.error(`Error fetching ${categoryId}:`, error);
                    return { categoryId, places: [] };
                }
            })
        );

        return results.reduce((acc, { categoryId, places }) => {
            acc[categoryId] = places;
            return acc;
        }, {} as Record<ExploreCategoryId, GeocodingPlace[]>);
    },
};
