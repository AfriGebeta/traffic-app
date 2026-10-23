import { Campaign, GeoJsonBoundary } from '../types/campaign.types';

// ray casting on one ring of [lng, lat] points
const inRing = (lat: number, lng: number, ring: number[][]): boolean => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
        if (crosses) inside = !inside;
    }
    return inside;
};

// polygon = outer ring followed by holes
const inPolygon = (lat: number, lng: number, polygon: number[][][]): boolean =>
    polygon.length > 0 && inRing(lat, lng, polygon[0]) && !polygon.slice(1).some((hole) => inRing(lat, lng, hole));

export const isInsideBoundary = (lat: number, lng: number, boundary?: GeoJsonBoundary | null): boolean => {
    // no area: the backend attaches nothing to the campaign, so nowhere counts
    if (!boundary?.coordinates) return false;
    if (boundary.type === 'Polygon') return inPolygon(lat, lng, boundary.coordinates as number[][][]);
    if (boundary.type === 'MultiPolygon') {
        return (boundary.coordinates as number[][][][]).some((polygon) => inPolygon(lat, lng, polygon));
    }
    return true;
};

export const findCampaignAt = (campaigns: Campaign[], lat: number, lng: number): Campaign | null =>
    campaigns.find((campaign) => isInsideBoundary(lat, lng, campaign.boundary)) ?? null;
