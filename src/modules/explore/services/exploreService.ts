import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import { EXPLORE_CATEGORIES, type ExploreCategoryId, type ExploreParams } from '../types/explore.types';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export { EXPLORE_CATEGORIES, type ExploreCategoryId };

export const exploreService = {
    async fetchPlacesByCategory(
        categoryId: ExploreCategoryId,
        userLocation: { lat: number; lng: number },
        limit: number = 5
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
            limit,
        };

        const response = await fetch(`${API_URL}/api/navigation/request-revgeocoding`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const rawResults = data.response || data.results || data.data || [];

        const places: GeocodingPlace[] = rawResults.map((item: any) => ({
            name: item.name || 'Unknown',
            latitude: item.latitude || 0,
            longitude: item.longitude || 0,
            type: item.type || type,
            Country: item.Country || '',
            City: item.City || '',
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
