import { buildCumulativeDistances, pointAtDistance, sliceFromDistance, snapToRouteDistance } from './navigationUtils';

export const TAXI_ROAD_JOIN_M = 15;
export const createTaxiRoad = (coordinates?: [number, number][]) => coordinates && coordinates.length > 1
    ? { coordinates, cumulative: buildCumulativeDistances(coordinates) } : null;
export type TaxiRoad = NonNullable<ReturnType<typeof createTaxiRoad>>;
export const projectTaxiPosition = (road: TaxiRoad, lat: number, lng: number) =>
    snapToRouteDistance(road.coordinates, road.cumulative, lat, lng, 0, Infinity);

export const taxiRoadCoordinates = (road: TaxiRoad | null, lat: number, lng: number): [number, number][] => {
    if (!road) return [];
    const match = projectTaxiPosition(road, lat, lng);
    const remaining = sliceFromDistance(road.coordinates, road.cumulative, match.s);
    return remaining.length > 1 ? remaining : [];
};

export const positionOnTaxiRoad = (road: TaxiRoad, distance: number) => {
    const [lng, lat] = pointAtDistance(road.coordinates, road.cumulative, distance);
    return { lat, lng };
};
