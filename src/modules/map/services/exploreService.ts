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

        return places;
    },

    async reverseGeocode(lat: number, lng: number): Promise<GeocodingPlace | null> {
        const response = await fetch(`${API_URL}/api/navigation/request-revgeocoding`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                coordinate: { lat, lng },
                cursor: 0,
                limit: 10,
            }),
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        const results = data.response || data.results || data.data || [];

        if (results.length > 0) {
            let closestPlace = results[0];
            let minDistance = Number.MAX_VALUE;

            for (const place of results) {
                if (place.name && place.latitude && place.longitude) {
                    const distance = Math.sqrt(
                        Math.pow(place.latitude - lat, 2) + Math.pow(place.longitude - lng, 2)
                    );
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestPlace = place;
                    }
                }
            }

            if (closestPlace.name) {
                return {
                    name: closestPlace.name,
                    latitude: closestPlace.latitude || lat,
                    longitude: closestPlace.longitude || lng,
                    type: closestPlace.type || 'place',
                    Country: closestPlace.Country || '',
                    City: closestPlace.City || '',
                    image: closestPlace.image || closestPlace.photo || closestPlace.imageUrl || undefined,
                };
            }
        }

        return null;
    },

    getCategoryType(categoryId: string): string | undefined {
        return CATEGORY_TYPE_MAP[categoryId];
    },
};
