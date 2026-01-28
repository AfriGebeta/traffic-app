import { useState } from 'react';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import { exploreService } from '../services/exploreService';

export const useExplore = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<GeocodingPlace[]>([]);

    const searchNearby = async (
        categoryId: string,
        userLocation: { lat: number; lng: number } | null
    ): Promise<GeocodingPlace[]> => {
        if (!userLocation) {
            throw new Error('User location not available');
        }

        setIsLoading(true);
        try {
            const places = await exploreService.searchNearby(categoryId, userLocation);
            setResults(places);
            return places;
        } catch (error) {
            console.error('Explore search error:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const clearResults = () => {
        setResults([]);
    };

    return {
        isLoading,
        results,
        searchNearby,
        clearResults,
    };
};
