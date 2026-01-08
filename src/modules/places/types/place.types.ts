export type PlaceType = 'gas_station' | 'taxi_station' | 'repair_shop' | 'restaurant' | 'parking' | 'hospital' | 'other';

export interface Place {
    id: string;
    name: string;
    type: PlaceType;
    lat: number;
    lng: number;
    description: string;
    images: string[];
    verified: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface PlaceContributionRequest {
    name: string;
    type: PlaceType;
    lat: number;
    lng: number;
    description: string;
    images: string[];
}

export const PLACE_TYPES = [
    { id: 'gas_station', label: 'Gas Station', icon: 'water' as const, color: '#EF4444', emoji: '⛽' },
    { id: 'taxi_station', label: 'Taxi Station', icon: 'car' as const, color: '#3B82F6', emoji: '🚕' },
    { id: 'repair_shop', label: 'Repair Shop', icon: 'construct' as const, color: '#F59E0B', emoji: '🔧' },
    { id: 'restaurant', label: 'Restaurant', icon: 'restaurant' as const, color: '#10B981', emoji: '🍽️' },
    { id: 'parking', label: 'Parking', icon: 'car' as const, color: '#8B5CF6', emoji: '🅿️' },
    { id: 'hospital', label: 'Hospital', icon: 'medical' as const, color: '#EC4899', emoji: '🏥' },
    { id: 'other', label: 'Other', icon: 'apps-outline' as const, color: '#6B7280', emoji: '📍' },
] as const;
