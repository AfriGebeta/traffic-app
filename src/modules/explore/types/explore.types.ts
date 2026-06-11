export const EXPLORE_CATEGORIES = {
    museum: 'museum',
    hotel: 'hotel',
    park: 'park',
    restaurant: 'restaurant',
    mall: 'mall',
} as const;

export type ExploreCategoryId = keyof typeof EXPLORE_CATEGORIES;

export interface ExploreParams {
    coordinate: { lat: number; lng: number };
    category: string;
    cursor?: number;
    size?: number;
}
