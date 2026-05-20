import type { GeocodingPlace } from '../types/navigation.types';
import type { PreviewStep } from '../utils/navigationPreviewUtils';

export interface NavigationPreviewData {
    routeGeoJSON: any;
    previewSteps: PreviewStep[];
    destination: GeocodingPlace;
    origin: GeocodingPlace | null;
    distance: number;
    duration: number;
    waypoints: GeocodingPlace[];
}

let previewCache: NavigationPreviewData | null = null;

export const setNavigationPreviewData = (data: NavigationPreviewData) => {
    previewCache = data;
};

export const getNavigationPreviewData = (): NavigationPreviewData | null => {
    return previewCache;
};

export const clearNavigationPreviewData = () => {
    previewCache = null;
};
