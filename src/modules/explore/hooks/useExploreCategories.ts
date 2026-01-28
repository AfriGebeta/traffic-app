import { useState, useEffect } from 'react';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import { exploreService } from '../services/exploreService';
import type { ExploreCategoryId } from '../types/explore.types';

export const useExploreCategories = (userLocation: { lat: number; lng: number } | null) => {
    const [isLoading, setIsLoading] = useState(false);
    const [categories, setCategories] = useState<Record<ExploreCategoryId, GeocodingPlace[]>>({
        museum: [],
        hotel: [],
        park: [],
        restaurant: [],
        mall: [],
    });
    const [error, setError] = useState<string | null>(null);

    const fetchCategories = async () => {
        if (!userLocation) {
            setError('Location not available');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const data = await exploreService.fetchAllCategories(userLocation);
            setCategories(data);
        } catch (err) {
            setError('Failed to fetch places');
            console.error('Error fetching categories:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMorePlaces = async (categoryId: ExploreCategoryId) => {
        if (!userLocation) return;

        try {
            const places = await exploreService.fetchPlacesByCategory(categoryId, userLocation, 20);
            setCategories((prev) => ({
                ...prev,
                [categoryId]: places,
            }));
        } catch (err) {
            console.error(`Error fetching more ${categoryId}:`, err);
        }
    };

    return {
        isLoading,
        categories,
        error,
        fetchCategories,
        fetchMorePlaces,
    };
};
