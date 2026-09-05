import { projectTaxiPosition, positionOnTaxiRoad, TAXI_ROAD_JOIN_M, type TaxiRoad } from './taxiRoadGeometry';

export interface TaxiPosition {
    lat: number;
    lng: number;
}

export interface TaxiMotion {
    from: TaxiPosition;
    to: TaxiPosition;
    startedAt: number;
    durationMs: number;
    road?: TaxiRoad;
    fromDistance?: number;
    toDistance?: number;
}

export const sampleTaxiMotion = (motion: TaxiMotion, now: number): TaxiPosition => {
    const progress = Math.max(0, Math.min(1, (now - motion.startedAt) / motion.durationMs));
    if (motion.road && motion.fromDistance != null && motion.toDistance != null) {
        return positionOnTaxiRoad(motion.road,
            motion.fromDistance + (motion.toDistance - motion.fromDistance) * progress);
    }
    return {
        lat: motion.from.lat + (motion.to.lat - motion.from.lat) * progress,
        lng: motion.from.lng + (motion.to.lng - motion.from.lng) * progress,
    };
};

export const retargetTaxiMotion = (
    previous: TaxiMotion | null,
    target: TaxiPosition,
    now: number,
    gpsIntervalMs: number,
    road?: TaxiRoad | null,
): TaxiMotion => {
    const from = previous ? sampleTaxiMotion(previous, now) : target;
    const motion: TaxiMotion = {
        from, to: target, startedAt: now,
        durationMs: Math.max(250, Math.min(2000, gpsIntervalMs))
    };
    if (road) {
        const start = projectTaxiPosition(road, from.lat, from.lng);
        const end = projectTaxiPosition(road, target.lat, target.lng);
        if (start.distance <= TAXI_ROAD_JOIN_M && end.distance <= TAXI_ROAD_JOIN_M) {
            motion.road = road;
            motion.fromDistance = start.s;
            motion.toDistance = end.s;
        }
    }
    return motion;
};
