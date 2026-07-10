import { decodePolyline } from '../../../shared/utils/polyline';
import { getAppConfig } from '../../../shared/config/remoteConfigValues';

export type TaxiSegmentInput = {
    polyline: string;
    type: string;
    mode: string;
};

export type SegmentedRouteOutput = {
    geoJSON: {
        type: 'Feature';
        properties: { segmentIndex: number; markerLat?: number; markerLng?: number };
        geometry: { type: 'LineString'; coordinates: [number, number][] };
    };
    isWalking: boolean;
    segmentIndex: number;
};

export const buildSegmentedRoutesFromPosition = (
    taxiSegments: TaxiSegmentInput[],
    closestIndex: number,
    displayLat: number,
    displayLng: number,
    includeMarkerInProps = false
): SegmentedRouteOutput[] => {
    let coordCount = 0;
    let currentSegIdx = 0;
    let positionInSegment = closestIndex;

    for (let i = 0; i < taxiSegments.length; i++) {
        const decoded = decodePolyline(taxiSegments[i].polyline, 6);
        if (closestIndex < coordCount + decoded.length) {
            currentSegIdx = i;
            positionInSegment = closestIndex - coordCount;
            break;
        }
        coordCount += decoded.length;
    }

    return taxiSegments.map((seg, idx) => {
        const decoded = decodePolyline(seg.polyline, 6);
        let coordinates = decoded.map(([lat, lng]: [number, number]) => [lng, lat] as [number, number]);

        if (idx === currentSegIdx) {
            // Start from the next point on the route, not from user's off-road position
            coordinates = coordinates.slice(positionInSegment + 1);
        } else if (idx < currentSegIdx) {
            coordinates = [];
        }

        const properties: { segmentIndex: number; markerLat?: number; markerLng?: number } = {
            segmentIndex: idx,
        };
        if (includeMarkerInProps) {
            properties.markerLat = displayLat;
            properties.markerLng = displayLng;
        }

        return {
            geoJSON: {
                type: 'Feature' as const,
                properties,
                geometry: {
                    type: 'LineString' as const,
                    coordinates,
                },
            },
            isWalking: seg.type === 'walk' || seg.mode === 'pedestrian',
            segmentIndex: idx,
        };
    });
};

/**

 * @param from - Starting coordinate [longitude, latitude]
 * @param to - Ending coordinate [longitude, latitude]
 * @returns Bearing in degrees (0-360)
 */
export const calculateBearing = (from: [number, number], to: [number, number]): number => {
    const [fromLng, fromLat] = from;
    const [toLng, toLat] = to;

    const dLng = ((toLng - fromLng) * Math.PI) / 180;
    const lat1 = (fromLat * Math.PI) / 180;
    const lat2 = (toLat * Math.PI) / 180;

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
};

/**
 * @param lat1 - First latitude
 * @param lng1 - First longitude
 * @param lat2 - Second latitude
 * @param lng2 - Second longitude
 * @returns Distance in meters
 */
export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export const buildCumulativeDistances = (coords: [number, number][]): number[] => {
    const cum: number[] = new Array(coords.length);
    cum[0] = 0;
    for (let i = 1; i < coords.length; i++) {
        const [lng1, lat1] = coords[i - 1];
        const [lng2, lat2] = coords[i];
        cum[i] = cum[i - 1] + calculateDistance(lat1, lng1, lat2, lng2);
    }
    return cum;
};

const segmentIndexAtDistance = (cum: number[], s: number): number => {
    if (s <= 0) return 0;
    if (s >= cum[cum.length - 1]) return cum.length - 2;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= s) lo = mid + 1;
        else hi = mid;
    }
    return Math.max(0, lo - 1);
};

export const pointAtDistance = (
    coords: [number, number][],
    cum: number[],
    s: number
): [number, number] => {
    if (coords.length === 0) return [0, 0];
    if (coords.length === 1) return coords[0];
    const total = cum[cum.length - 1];
    const clamped = Math.max(0, Math.min(s, total));
    const i = segmentIndexAtDistance(cum, clamped);
    const segLen = cum[i + 1] - cum[i];
    const t = segLen > 0 ? (clamped - cum[i]) / segLen : 0;
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    return [lng1 + t * (lng2 - lng1), lat1 + t * (lat2 - lat1)];
};

export const headingAtDistance = (
    coords: [number, number][],
    cum: number[],
    s: number
): number => {
    if (coords.length < 2) return 0;
    const i = segmentIndexAtDistance(cum, Math.max(0, Math.min(s, cum[cum.length - 1])));
    return calculateBearing(coords[i], coords[i + 1]);
};

export const smoothRouteCorners = (
    coords: [number, number][],
    radiusM = 10,
    minAngleDeg = 8,
    samples = 6
): [number, number][] => {
    if (coords.length < 3) return coords;
    const out: [number, number][] = [coords[0]];
    for (let i = 1; i < coords.length - 1; i++) {
        const prev = coords[i - 1];
        const cur = coords[i];
        const next = coords[i + 1];
        const bIn = calculateBearing(prev, cur);
        const bOut = calculateBearing(cur, next);
        let turn = Math.abs(bOut - bIn);
        if (turn > 180) turn = 360 - turn;
        if (turn < minAngleDeg) {
            out.push(cur);
            continue;
        }
        const lenIn = calculateDistance(prev[1], prev[0], cur[1], cur[0]);
        const lenOut = calculateDistance(cur[1], cur[0], next[1], next[0]);
        const d = Math.min(radiusM, lenIn / 2, lenOut / 2);
        if (d < 0.5 || lenIn === 0 || lenOut === 0) {
            out.push(cur);
            continue;
        }
        const tIn = 1 - d / lenIn;
        const p0: [number, number] = [
            prev[0] + (cur[0] - prev[0]) * tIn,
            prev[1] + (cur[1] - prev[1]) * tIn,
        ];
        const tOut = d / lenOut;
        const p2: [number, number] = [
            cur[0] + (next[0] - cur[0]) * tOut,
            cur[1] + (next[1] - cur[1]) * tOut,
        ];
        for (let k = 0; k <= samples; k++) {
            const t = k / samples;
            const a = (1 - t) * (1 - t);
            const b = 2 * t * (1 - t);
            const c = t * t;
            out.push([
                a * p0[0] + b * cur[0] + c * p2[0],
                a * p0[1] + b * cur[1] + c * p2[1],
            ]);
        }
    }
    out.push(coords[coords.length - 1]);
    return out;
};

export const sliceRangeDistance = (
    coords: [number, number][],
    cum: number[],
    s0: number,
    s1: number
): [number, number][] => {
    if (coords.length < 2) return [];
    const total = cum[cum.length - 1];
    const a = Math.max(0, Math.min(s0, total));
    const b = Math.max(0, Math.min(s1, total));
    if (b - a < 0.5) return [];
    const i0 = segmentIndexAtDistance(cum, a);
    const i1 = segmentIndexAtDistance(cum, b);
    const head = pointAtDistance(coords, cum, a);
    const tail = pointAtDistance(coords, cum, b);
    return [head, ...coords.slice(i0 + 1, i1 + 1), tail];
};

export const sliceFromDistance = (
    coords: [number, number][],
    cum: number[],
    s: number
): [number, number][] => {
    if (coords.length === 0) return [];
    const total = cum[cum.length - 1];
    const clamped = Math.max(0, Math.min(s, total));
    const i = segmentIndexAtDistance(cum, clamped);
    const head = pointAtDistance(coords, cum, clamped);
    // Drop vertices we've already passed; keep everything from i+1 onward.
    return [head, ...coords.slice(i + 1)];
};

export const snapToRouteDistance = (
    coords: [number, number][],
    cum: number[],
    lat: number,
    lng: number,
    fromS: number,
    windowMeters = 400
): { s: number; distance: number } => {
    if (coords.length < 2) return { s: 0, distance: Infinity };

    const total = cum[cum.length - 1];
    const lo = Math.max(0, fromS - windowMeters);
    const hi = Math.min(total, fromS + windowMeters);
    const startIdx = segmentIndexAtDistance(cum, lo);
    const endIdx = segmentIndexAtDistance(cum, hi);

    const scan = (from: number, to: number): { s: number; distance: number } => {
        let best = { s: fromS, distance: Infinity };
        for (let i = from; i <= to && i < coords.length - 1; i++) {
            const [lng1, lat1] = coords[i];
            const [lng2, lat2] = coords[i + 1];
            const dx = lng2 - lng1;
            const dy = lat2 - lat1;
            let t = 0;
            if (dx !== 0 || dy !== 0) {
                t = Math.max(0, Math.min(1,
                    ((lng - lng1) * dx + (lat - lat1) * dy) / (dx * dx + dy * dy)
                ));
            }
            const projLng = lng1 + t * dx;
            const projLat = lat1 + t * dy;
            const dist = calculateDistance(lat, lng, projLat, projLng);
            if (dist < best.distance) {
                const segLen = cum[i + 1] - cum[i];
                best = { s: cum[i] + t * segLen, distance: dist };
            }
        }
        return best;
    };

    let result = scan(startIdx, endIdx);
    if (result.distance > windowMeters) {
        const full = scan(0, coords.length - 2);
        if (full.distance < result.distance) result = full;
    }
    return result;
};
export const findCorners = (
    coords: [number, number][],
    cum: number[],
    angleThresholdDeg = 25
): number[] => {
    const corners: number[] = [];
    for (let i = 1; i < coords.length - 1; i++) {
        const b1 = calculateBearing(coords[i - 1], coords[i]);
        const b2 = calculateBearing(coords[i], coords[i + 1]);
        let diff = Math.abs(b2 - b1);
        if (diff > 180) diff = 360 - diff;
        if (diff > angleThresholdDeg) corners.push(cum[i]);
    }
    return corners;
};

/**
 * @param currentLat - current lat
 * @param currentLng - current lon
 * @param routeManeuvers - array of route maneuvers
 * @param currentManeuverIndex - current maneu idex
 * @param routeCoordinates - array of route coordinates
 * @returns obj with updated instruction and maneuver index
 */

export const updateInstructionBasedOnPosition = (
    currentLat: number,
    currentLng: number,
    routeManeuvers: any[],
    currentManeuverIndex: number,
    routeCoordinates: [number, number][],
    currentSpeedKmh: number = 0
): { instruction: string; newManeuverIndex: number } => {
    if (routeManeuvers.length === 0) {
        return { instruction: 'Continue ahead', newManeuverIndex: currentManeuverIndex };
    }

    let closestManeuverIndex = currentManeuverIndex;
    let minDistance = Infinity;

    for (let i = currentManeuverIndex; i < routeManeuvers.length; i++) {
        const maneuver = routeManeuvers[i];
        if (maneuver.begin_shape_index !== undefined && routeCoordinates[maneuver.begin_shape_index]) {
            const [maneuverLng, maneuverLat] = routeCoordinates[maneuver.begin_shape_index];
            const distance = calculateDistance(currentLat, currentLng, maneuverLat, maneuverLng);

            if (distance < minDistance) {
                minDistance = distance;
                closestManeuverIndex = i;
            }
        }
    }

    const nextManeuver = routeManeuvers[closestManeuverIndex];

    const cfg = getAppConfig();

    if (minDistance < cfg.advanceThresholdM && closestManeuverIndex < routeManeuvers.length - 1) {
        const newManeuverIndex = closestManeuverIndex + 1;
        const newManeuver = routeManeuvers[newManeuverIndex];
        return {
            instruction: newManeuver.instruction || 'Continue ahead',
            newManeuverIndex,
        };
    }

    const speedMps = Math.max(currentSpeedKmh, 0) / 3.6;
    const preTransitionDistance = Math.min(
        Math.max(speedMps * cfg.preTransitionLeadTimeSec, cfg.preTransitionMinDistanceM),
        cfg.preTransitionMaxDistanceM
    );

    if (minDistance < preTransitionDistance) {
        return {
            instruction: nextManeuver.verbal_pre_transition_instruction || nextManeuver.instruction || 'Continue ahead',
            newManeuverIndex: currentManeuverIndex,
        };
    } else {
        return {
            instruction: 'Continue ahead',
            newManeuverIndex: currentManeuverIndex,
        };
    }
};
