import { PLACE_TYPES, PlaceType } from '../types/place.types';

const KEYWORD_MAP: { keywords: string[]; type: PlaceType }[] = [
    { keywords: ['gas', 'fuel', 'petrol'], type: 'gas_station' },
    { keywords: ['taxi', 'bus_station', 'bus station'], type: 'taxi_station' },
    { keywords: ['cafe', 'coffee', 'teahouse'], type: 'cafe' },
    { keywords: ['restaurant', 'food', 'bar', 'pub'], type: 'restaurant' },
    { keywords: ['parking'], type: 'parking' },
    { keywords: ['pharmacy', 'drug'], type: 'pharmacy' },
    { keywords: ['clinic'], type: 'clinic' },
    { keywords: ['hospital', 'medical', 'health', 'doctor'], type: 'hospital' },
    { keywords: ['atm'], type: 'atm' },
    { keywords: ['bank'], type: 'bank' },
    { keywords: ['hotel', 'guest', 'lodge', 'motel'], type: 'hotel' },
    { keywords: ['school', 'university', 'college', 'kindergarten'], type: 'school' },
    { keywords: ['park', 'garden'], type: 'park' },
    { keywords: ['mall', 'supermarket'], type: 'mall' },
    { keywords: ['shop', 'store', 'market', 'boutique'], type: 'shop' },
    { keywords: ['company', 'office', 'business'], type: 'company' },
    { keywords: ['government', 'municipal', 'embassy', 'ministry'], type: 'government' },
    { keywords: ['building', 'apartment', 'tower'], type: 'building' },
];

const VALID_TYPES = new Set<string>(PLACE_TYPES.map((p) => p.id));

export const resolvePlaceType = (...candidates: (string | undefined | null)[]): PlaceType | null => {
    const normalized = candidates
        .filter((c): c is string => Boolean(c))
        .map((c) => c.trim().toLowerCase())
        .filter((c) => c.length > 0 && c !== 'coordinates');

    for (const value of normalized) {
        const slug = value.replace(/[^a-z0-9]+/g, '_');

        if (VALID_TYPES.has(slug) && slug !== 'other') return slug as PlaceType;
    }

    for (const value of normalized) {
        for (const { keywords, type } of KEYWORD_MAP) {
            if (keywords.some((keyword) => value.includes(keyword))) return type;
        }
    }

    return null;
};
