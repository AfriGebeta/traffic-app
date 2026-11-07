import { useEffect, useState } from 'react';
import { apiService } from '../../../shared/services/api';
import { PLACE_CATEGORY_IDS, PlaceType } from '../types/place.types';

export interface PlaceCategory {
    id: string;
    // older backends don't send it; then the app falls back to PLACE_CATEGORY_IDS
    slug?: string;
    label?: { en?: string; am?: string };
    active?: boolean;
}

// our type ids use underscores, the backend's slugs dashes: gas_station ↔ gas-station
export const slugForType = (type: string) => type.replace(/_/g, '-');
export const typeForSlug = (slug: string) => slug.replace(/-/g, '_') as PlaceType;

let cached: PlaceCategory[] | null = null;
let inFlight: Promise<PlaceCategory[] | null> | null = null;

// one fetch per app run; null when it fails (the next call tries again)
export const loadPlaceCategories = (): Promise<PlaceCategory[] | null> => {
    if (cached) return Promise.resolve(cached);
    if (inFlight) return inFlight;
    inFlight = apiService
        .get<PlaceCategory[] | { data: PlaceCategory[] }>('/api/places/categories')
        .then((response) => {
            const body = response.data;
            const list = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : null;
            if (list) cached = list;
            return list;
        })
        .catch(() => null)
        .finally(() => {
            inFlight = null;
        });
    return inFlight;
};

const SHOW_WHEN_INACTIVE = new Set<PlaceType>(['charging_station']);

export const categoryIdFor = (type: PlaceType, categories: PlaceCategory[] | null): string | undefined => {
    const hasSlugs = !!categories?.some((category) => category.slug);
    if (!categories || !hasSlugs) return PLACE_CATEGORY_IDS[type];
    const match = categories.find((category) => category.slug === slugForType(type));
    return match && (match.active !== false || SHOW_WHEN_INACTIVE.has(type)) ? match.id : undefined;
};

// types the backend offers right now; everything while the list is unknown or has no slugs
export const isTypeAvailable = (type: PlaceType, categories: PlaceCategory[] | null): boolean => {
    if (!categories || !categories.some((category) => category.slug)) return true;
    return !!categoryIdFor(type, categories);
};

export const usePlaceCategories = (): PlaceCategory[] | null => {
    const [categories, setCategories] = useState<PlaceCategory[] | null>(cached);
    useEffect(() => {
        if (cached) return;
        let alive = true;
        void loadPlaceCategories().then((list) => {
            if (alive) setCategories(list);
        });
        return () => {
            alive = false;
        };
    }, []);
    return categories;
};
