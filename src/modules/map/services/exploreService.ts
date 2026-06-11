import type { GeocodingPlace } from '../../navigation/types/navigation.types';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const CATEGORY_TYPE_MAP: Record<string, string> = {
    restaurants: 'restaurant',
    gas: 'gas station',
    parking: 'parking',
    hospital: 'hospital',
    repair: 'car repair',
    bank: 'bank',
    atm: 'atm',
};

interface ExploreParams {
    coordinate: { lat: number; lng: number };
    category: string;
    cursor?: number;
    size?: number;
}

export const exploreService = {
    async searchNearby(
        categoryId: string,
        userLocation: { lat: number; lng: number },
        size: number = 5
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
            category: type,
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
            const errorText = await response.text();
            console.error(`[Map Explore] HTTP error ${response.status}:`, errorText);
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
                size: 10,
            }),
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();

        let results: any[] = [];
        if (data.response?.results && Array.isArray(data.response.results)) {
            results = data.response.results;
        } else if (data.data?.results && Array.isArray(data.data.results)) {
            results = data.data.results;
        } else if (Array.isArray(data.data)) {
            results = data.data;
        } else if (Array.isArray(data.response)) {
            results = data.response;
        } else if (Array.isArray(data.results)) {
            results = data.results;
        }

        if (results.length > 0) {
            let closestPlace = results[0];
            let minDistance = Number.MAX_VALUE;

            for (const place of results) {
                const placeLat = place.location?.lat || place.latitude;
                const placeLng = place.location?.lng || place.longitude;
                if (place.name && placeLat && placeLng) {
                    const distance = Math.sqrt(
                        Math.pow(placeLat - lat, 2) + Math.pow(placeLng - lng, 2)
                    );
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestPlace = place;
                    }
                }
            }

            if (closestPlace.name) {
                return {
                    id: closestPlace.id || '',
                    name: closestPlace.name,
                    display_name: closestPlace.display_name || closestPlace.name,
                    category: closestPlace.category || 'place',
                    location: {
                        lat: closestPlace.location?.lat || closestPlace.latitude || lat,
                        lng: closestPlace.location?.lng || closestPlace.longitude || lng,
                    },
                    address: {
                        city: closestPlace.address?.city || closestPlace.City || '',
                        country: closestPlace.address?.country || closestPlace.Country || '',
                        country_code: closestPlace.address?.country_code || '',
                    },
                    latitude: closestPlace.location?.lat || closestPlace.latitude || lat,
                    longitude: closestPlace.location?.lng || closestPlace.longitude || lng,
                    type: closestPlace.category || closestPlace.type || 'place',
                    Country: closestPlace.address?.country || closestPlace.Country || '',
                    City: closestPlace.address?.city || closestPlace.City || '',
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
