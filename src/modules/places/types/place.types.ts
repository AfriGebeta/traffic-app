export type PlaceType = 'gas_station' | 'taxi_station' | 'restaurant' | 'parking' | 'hospital' | 'building' | 'company' | 'government' | 'mall' | 'shop' | 'other';

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

export type SavedPlaceType = 'HOME' | 'WORK' | 'FAVORITE' | 'CUSTOM';

export interface SavedPlaceAddress {
    country?: string;
    region?: string;
    zone?: string;
    city?: string;
    subCity?: string;
    woreda?: string;
    sefer?: string;
    houseNumber?: string;
    floor?: number;
    buildingTotalFloor?: number;
}

export interface SavedPlace extends SavedPlaceAddress {
    id: string;
    type: SavedPlaceType;
    lat: number;
    lng: number;
    isPrivate: boolean;
    label: string;
    createdAt: string;
    updatedAt: string;
}

export interface SavePlaceRequest extends SavedPlaceAddress {
    type: SavedPlaceType;
    lat?: number;
    lng?: number;
    isPrivate: boolean;
    label: string;
}

export const HOME_ADDRESS_REQUIRED_FIELDS = ['region', 'city', 'subCity', 'woreda', 'sefer'] as const;

export type HomeAddressRequiredField = (typeof HOME_ADDRESS_REQUIRED_FIELDS)[number];

export interface SavePlaceVoiceRequest {
    type: SavedPlaceType;
    label: string;
    lat?: number;
    lng?: number;
    isPrivate: boolean;
    audioUri: string;
}

export class MissingAddressFieldsError extends Error {
    fields: HomeAddressRequiredField[];

    constructor(fields: HomeAddressRequiredField[]) {
        super('Missing address fields: ' + fields.join(', '));
        this.name = 'MissingAddressFieldsError';
        this.fields = fields;
    }
}

export const PLACE_TYPES = [
    { id: 'gas_station', label: 'Gas Station', icon: 'water' as const, color: '#EF4444' },
    { id: 'taxi_station', label: 'Taxi Station', icon: 'car' as const, color: '#3B82F6' },
    { id: 'restaurant', label: 'Restaurant', icon: 'restaurant' as const, color: '#10B981' },
    { id: 'parking', label: 'Parking', icon: 'car' as const, color: '#8B5CF6' },
    { id: 'hospital', label: 'Hospital', icon: 'medical' as const, color: '#EC4899' },
    { id: 'building', label: 'Building', icon: 'business' as const, color: '#F59E0B' },
    { id: 'company', label: 'Company', icon: 'briefcase' as const, color: '#06B6D4' },
    { id: 'government', label: 'Government Office', icon: 'shield' as const, color: '#8B5CF6' },
    { id: 'mall', label: 'Mall', icon: 'cart' as const, color: '#F59E0B' },
    { id: 'shop', label: 'Shop', icon: 'storefront' as const, color: '#EC4899' },
    { id: 'other', label: 'Other', icon: 'apps-outline' as const, color: '#6B7280' },
] as const;
