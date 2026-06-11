export interface BoundingBox {
    north: number;
    south: number;
    east: number;
    west: number;
}

export interface Neighborhood {
    id: string;
    name: string;
    localName?: string;
    slug: string;
    description?: string;
    lat: number;
    lng: number;
    boundingBox?: BoundingBox;
    city?: string;
    subcity?: string;
    woreda?: string;
    verified: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface NeighborhoodContributionRequest {
    name: string;
    localName?: string;
    slug: string;
    description?: string;
    lat: number;
    lng: number;
    boundingBox?: BoundingBox;
    city?: string;
    subcity?: string;
    woreda?: string;
    verified?: boolean;
}
