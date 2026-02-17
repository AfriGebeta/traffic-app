import type { GeocodingPlace } from '../../navigation/types/navigation.types';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const CATEGORY_TYPE_MAP: Record<string, string> = {
    restaurants: 'restaurant',
    gas: 'gas station',
    parking: 'parking',
    hospital: 'hospital',
    repair: 'car repair',
};

interface ExploreParams {
    coordinate: { lat: number; lng: number };
    type: string;
    cursor?: number;
    limit?: number;
}

export const exploreService = {
    async searchNearby(
        categoryId: string,
        userLocation: { lat: number; lng: number },
        limit: number = 20
    ): Promise<GeocodingPlace[]> {
        const type = CATEGORY_TYPE_MAP[categoryId];
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
            image: item.image || item.photo || item.imageUrl || undefined,
        }));

        console.log('Transformed places:', places.length, places);

        return places;
    },

    getCategoryType(categoryId: string): string | undefined {
        return CATEGORY_TYPE_MAP[categoryId];
    },
};
