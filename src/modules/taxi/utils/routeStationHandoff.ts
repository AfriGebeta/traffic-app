export type RouteSlot = 'start' | 'end' | 'intermediate';

export const isRouteSlot = (value: unknown): value is RouteSlot =>
    value === 'start' || value === 'end' || value === 'intermediate';

export interface NewRouteStop {
    name: string;
    lat: number;
    lng: number;
    type: 'station' | 'stop';
    landmark?: string;
}

// params for /taxi/add-station; source says how the pin was chosen
export const addStationForRouteParams = (slot: RouteSlot, stop: NewRouteStop, source: 'current' | 'map') => ({
    routeSlot: slot,
    prefillName: stop.name,
    prefillLat: String(stop.lat),
    prefillLng: String(stop.lng),
    prefillType: stop.type,
    prefillSource: source,
    ...(stop.landmark ? { prefillLandmark: stop.landmark } : {}),
});
