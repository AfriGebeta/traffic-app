import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GeocodingPlace } from '../types/navigation.types';

const RECENT_SEARCHES_KEY = '@recent_searches';
const MAX_RECENT_SEARCHES = 5;

export interface RecentSearch extends GeocodingPlace {
    searchedAt: number;
    query?: string;
}

const isSamePlace = (a: GeocodingPlace, b: GeocodingPlace) =>
    a.latitude === b.latitude && a.longitude === b.longitude;

const normalizePlace = (place: GeocodingPlace): GeocodingPlace => ({
    ...place,
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
});

export const recentSearchService = {
    async getRecentSearches(): Promise<RecentSearch[]> {
        try {
            const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
            if (!stored) {
                return [];
            }

            const parsed = JSON.parse(stored) as RecentSearch[];
            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed
                .map((item) => normalizePlace(item) as RecentSearch)
                .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
                .slice(0, MAX_RECENT_SEARCHES);
        } catch {
            return [];
        }
    },

    async addRecentSearch(place: GeocodingPlace, query?: string): Promise<RecentSearch[]> {
        try {
            const normalizedPlace = normalizePlace(place);
            const current = await this.getRecentSearches();
            const entry: RecentSearch = {
                ...normalizedPlace,
                searchedAt: Date.now(),
                ...(query?.trim() ? { query: query.trim() } : {}),
            };

            const filtered = current.filter((item) => !isSamePlace(item, normalizedPlace));
            const updated = [entry, ...filtered].slice(0, MAX_RECENT_SEARCHES);

            await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
            return updated;
        } catch {
            return [];
        }
    },

    async removeRecentSearch(place: GeocodingPlace): Promise<RecentSearch[]> {
        try {
            const normalizedPlace = normalizePlace(place);
            const current = await this.getRecentSearches();
            const updated = current.filter((item) => !isSamePlace(item, normalizedPlace));
            await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
            return updated;
        } catch {
            return [];
        }
    },

    async clearRecentSearches(): Promise<void> {
        try {
            await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
        } catch {
        }
    },
};
