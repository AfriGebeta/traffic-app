import {
    SNAP_DRIVABLE_CLASSES,
    SNAP_BEARING_LOOKAHEAD_M,
    SNAP_HEADING_WEIGHT,
    SNAP_MAX_DIST_M,
    SNAP_AGAINST_DIGITISATION_M,
    SNAP_REVERSAL_ANGLE,
    SNAP_REVERSAL_PENALTY_M,
    SNAP_NAME_MAX_DIST_M,
    SNAP_STICKY_BONUS_M,
} from '../constants';
import {
    LocalFrame,
    XY,
    angleDelta,
    bearingAtDistance,
    bearingXY,
    buildCumulative,
    pointAtDistance,
    projectOnSegment,
} from './geo';

export interface Road {
    key: string;
    cls: string;
    oneway: number;
    name?: string;
    points: XY[];
    cum: number[];
}

export interface SnapResult {
    road: Road;
    foot: XY;
    bearing: number;
    dist: number;
    distanceAlong: number;
    reversed: boolean;
}

const coordKey = (c: number[]): string => `${c[0].toFixed(5)},${c[1].toFixed(5)}`;
const readName = (
    props: Record<string, unknown>,
    lang: string
): string | undefined => {
    const candidates = [`name:${lang}`, 'name:latin', 'name'];
    for (const key of candidates) {
        const value = props[key];
        if (typeof value === 'string' && value.length > 0) return value;
    }
    return undefined;
};

export const buildRoads = (
    features: GeoJSON.Feature[] | undefined,
    frame: LocalFrame,
    lang = 'latin'
): Road[] => {
    if (!features?.length) return [];

    const roads: Road[] = [];
    const seen = new Set<string>();

    for (const f of features) {
        const props = (f.properties ?? {}) as Record<string, unknown>;
        const cls = typeof props.class === 'string' ? props.class : '';
        if (cls && !SNAP_DRIVABLE_CLASSES.has(cls)) continue;

        const geom = f.geometry;
        if (!geom) continue;

        const parts: number[][][] =
            geom.type === 'LineString'
                ? [geom.coordinates as number[][]]
                : geom.type === 'MultiLineString'
                    ? (geom.coordinates as number[][][])
                    : [];

        const onewayRaw = props.oneway;
        const oneway = typeof onewayRaw === 'number' ? onewayRaw : 0;
        const name = readName(props, lang);

        parts.forEach((part, partIndex) => {
            if (part.length < 2) return;
            const key = `${f.id ?? ''}:${partIndex}:${coordKey(part[0])}`;
            if (seen.has(key)) return;
            seen.add(key);

            const points = part.map(([lng, lat]) => frame.toXY(lat, lng));
            roads.push({ key, cls, oneway, name, points, cum: buildCumulative(points) });
        });
    }

    return roads;
};

interface BestOnRoad {
    dist: number;
    foot: XY;
    bearing: number;
    distanceAlong: number;
}

const closestOnRoad = (road: Road, p: XY): BestOnRoad | null => {
    let best: BestOnRoad | null = null;
    for (let i = 0; i < road.points.length - 1; i++) {
        const a = road.points[i];
        const b = road.points[i + 1];
        const proj = projectOnSegment(p, a, b);
        if (!best || proj.dist < best.dist) {
            const span = road.cum[i + 1] - road.cum[i];
            best = {
                dist: proj.dist,
                foot: proj.foot,
                bearing: bearingXY(a, b),
                distanceAlong: road.cum[i] + span * proj.t,
            };
        }
    }
    return best;
};
const lookaheadBearing = (road: Road, from: number): number => {
    const total = road.cum[road.cum.length - 1];
    const start = Math.max(0, Math.min(from, total));
    const end = Math.max(0, Math.min(from + SNAP_BEARING_LOOKAHEAD_M, total));
    if (end - start < 1) return bearingAtDistance(road.points, road.cum, start);
    return bearingXY(
        pointAtDistance(road.points, road.cum, start),
        pointAtDistance(road.points, road.cum, end)
    );
};

export interface SnapMemory {
    key: string;
    bearing: number;
}
export const snapToRoads = (
    roads: Road[],
    p: XY,
    travelBearing: number | null,
    previous: SnapMemory | null,
    maxDist = SNAP_MAX_DIST_M
): SnapResult | null => {
    let winner: SnapResult | null = null;
    let winnerCost = Infinity;
    const reference = travelBearing ?? previous?.bearing ?? null;

    for (const road of roads) {
        const best = closestOnRoad(road, p);
        if (!best || best.dist > maxDist) continue;

        const aheadBearing = lookaheadBearing(road, best.distanceAlong);
        let cost = best.dist;
        let bearing = aheadBearing;
        let reversed = false;

        if (reference != null) {
            let delta = angleDelta(aheadBearing, reference);
            if (road.oneway === 0 && delta > 90) {
                delta = 180 - delta;
                bearing = (aheadBearing + 180) % 360;
                reversed = true;
            }
            cost += SNAP_HEADING_WEIGHT * delta;
        }
        if (reference != null && angleDelta(bearing, reference) > SNAP_REVERSAL_ANGLE) {
            cost += SNAP_REVERSAL_PENALTY_M;
        }
        if (reversed) cost += SNAP_AGAINST_DIGITISATION_M;

        if (previous && road.key === previous.key) cost -= SNAP_STICKY_BONUS_M;

        if (cost < winnerCost) {
            winnerCost = cost;
            winner = {
                road,
                foot: best.foot,
                bearing,
                dist: best.dist,
                distanceAlong: best.distanceAlong,
                reversed,
            };
        }
    }

    return winner;
};

export const nearestRoadName = (
    features: GeoJSON.Feature[] | undefined,
    frame: LocalFrame,
    p: XY,
    lang = 'latin',
    maxDist = SNAP_NAME_MAX_DIST_M
): string | null => {
    const named = buildRoads(features, frame, lang).filter((r) => r.name);
    let bestName: string | null = null;
    let bestDist = Infinity;
    for (const road of named) {
        const best = closestOnRoad(road, p);
        if (best && best.dist < bestDist) {
            bestDist = best.dist;
            bestName = road.name ?? null;
        }
    }
    return bestDist <= maxDist ? bestName : null;
};
