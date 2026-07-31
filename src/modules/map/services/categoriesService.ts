import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../../../shared/services/api';

const CACHE_KEY = '@place_categories_v1';

export interface PlaceCategory {
    id: string;
    slug: string;
    label: { en: string; am: string };
}

interface RawCategory {
    id: string;
    label?: { en?: string; am?: string };
    active?: boolean;
}

export const toSlug = (label: string): string =>
    label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

export const FALLBACK_CATEGORIES: PlaceCategory[] = [
    { id: 'restaurant', slug: 'restaurant', label: { en: 'Restaurant', am: 'ምግብ ቤት' } },
    { id: 'hotel', slug: 'hotel', label: { en: 'Hotel', am: 'ሆቴል' } },
    { id: 'hospital', slug: 'hospital', label: { en: 'Hospital', am: 'ሆስፒታል' } },
    { id: 'gas-station', slug: 'gas-station', label: { en: 'Gas Station', am: 'የነዳጅ ማደያ' } },
    { id: 'parking', slug: 'parking', label: { en: 'Parking', am: 'ፓርኪንግ' } },
    { id: 'repair-shop', slug: 'repair-shop', label: { en: 'Repair Shop', am: 'የጥገና ቤት' } },
    { id: 'bank', slug: 'bank', label: { en: 'Bank', am: 'ባንክ' } },
    { id: 'atm', slug: 'atm', label: { en: 'ATM', am: 'ኤቲኤም' } },
];

const normalize = (raw: RawCategory[]): PlaceCategory[] =>
    raw
        .filter((item) => item?.active !== false && !!item?.label?.en)
        .map((item) => ({
            id: item.id,
            slug: toSlug(item.label!.en!),
            label: {
                en: item.label!.en!,
                am: item.label!.am || item.label!.en!,
            },
        }))
        .filter((item) => !!item.slug);

export const categoriesService = {
    async fetchCategories(): Promise<PlaceCategory[]> {
        try {
            const { data, error } = await apiService.get<RawCategory[] | { data?: RawCategory[]; response?: RawCategory[] }>(
                '/api/places/categories'
            );

            if (error || !data) {
                throw new Error(error || 'Empty categories response');
            }

            const raw: RawCategory[] = Array.isArray(data)
                ? data
                : Array.isArray(data?.data)
                    ? data.data
                    : Array.isArray(data?.response)
                        ? data.response
                        : [];

            const categories = normalize(raw);
            if (categories.length === 0) {
                throw new Error('empty categories response');
            }

            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(categories));
            return categories;
        } catch (error) {
            console.log('categories- fetch failed, using cache/fallback:', error);
            const cached = await this.getCached();
            return cached ?? FALLBACK_CATEGORIES;
        }
    },

    async getCached(): Promise<PlaceCategory[] | null> {
        try {
            const stored = await AsyncStorage.getItem(CACHE_KEY);
            if (!stored) return null;
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
        } catch {
            return null;
        }

    },
};
