import { decodePolyline } from '../../../shared/utils/polyline';
import type { Leg, Maneuver } from '../types/navigation.types';

export interface PreviewStep {
    maneuver: Maneuver;
    center: [number, number];
    bearing: number;
    segmentCoords: [number, number][];
}

export interface ManeuverDisplay {
    icon: string;
    rotation: number;
    label: string;
}

// valhalla style maneuver types
const MANEUVER_TYPE = {
    NONE: 0,
    START: 1,
    START_RIGHT: 2,
    START_LEFT: 3,
    DESTINATION: 4,
    CONTINUE: 6,
    SLIGHT_RIGHT: 7,
    RIGHT: 8,
    SHARP_RIGHT: 9,
    UTURN_RIGHT: 10,
    UTURN_LEFT: 11,
    SHARP_LEFT: 12,
    LEFT: 13,
    SHARP_LEFT_ALT: 14,
    LEFT_ALT: 15,
    SLIGHT_LEFT: 16,
    ROUNDABOUT_ENTER: 26,
    ROUNDABOUT_EXIT: 27,
} as const;

export function buildPreviewSteps(legs: Leg[]): PreviewStep[] {
    const steps: PreviewStep[] = [];

    for (const leg of legs) {
        if (!leg.shape) continue;

        const decoded = decodePolyline(leg.shape, 6);
        const legCoords = decoded.map(([lat, lng]) => [lng, lat] as [number, number]);

        for (const maneuver of leg.maneuvers) {
            if (!maneuver.instruction?.trim()) continue;

            let startIdx = Math.max(0, Math.min(maneuver.begin_shape_index ?? 0, legCoords.length - 1));
            let endIdx = Math.max(startIdx, Math.min(maneuver.end_shape_index ?? startIdx, legCoords.length - 1));

            if (endIdx - startIdx < 2) {
                const mid = startIdx;
                startIdx = Math.max(0, mid - 4);
                endIdx = Math.min(legCoords.length - 1, mid + 4);
            }

            const segmentCoords = legCoords.slice(startIdx, endIdx + 1);

            const midIdx = Math.floor((startIdx + endIdx) / 2);
            const center = legCoords[midIdx] ?? legCoords[startIdx] ?? legCoords[0];

            steps.push({
                maneuver,
                center,
                bearing: maneuver.bearing_after ?? 0,
                segmentCoords: segmentCoords.length > 0 ? segmentCoords : [center],
            });
        }
    }

    return steps;
}

function bearingToCardinal(bearing: number): string {
    const normalized = ((bearing % 360) + 360) % 360;
    if (normalized >= 337.5 || normalized < 22.5) return 'N';
    if (normalized < 67.5) return 'NE';
    if (normalized < 112.5) return 'E';
    if (normalized < 157.5) return 'SE';
    if (normalized < 202.5) return 'S';
    if (normalized < 247.5) return 'SW';
    if (normalized < 292.5) return 'W';
    return 'NW';
}

export function getManeuverDisplay(maneuver: Maneuver): ManeuverDisplay {
    const type = maneuver.type;
    const bearing = maneuver.bearing_after ?? 0;
    const instruction = maneuver.instruction ?? '';

    switch (type) {
        case MANEUVER_TYPE.DESTINATION:
            return { icon: 'flag', rotation: 0, label: 'Arrive' };
        case MANEUVER_TYPE.START:
        case MANEUVER_TYPE.CONTINUE:
            return { icon: 'arrow-up', rotation: bearing, label: bearingToCardinal(bearing) };
        case MANEUVER_TYPE.START_RIGHT:
        case MANEUVER_TYPE.SLIGHT_RIGHT:
        case MANEUVER_TYPE.RIGHT:
        case MANEUVER_TYPE.SHARP_RIGHT:
            return { icon: 'arrow-forward', rotation: 0, label: 'Right' };
        case MANEUVER_TYPE.START_LEFT:
        case MANEUVER_TYPE.SLIGHT_LEFT:
        case MANEUVER_TYPE.LEFT:
        case MANEUVER_TYPE.LEFT_ALT:
        case MANEUVER_TYPE.SHARP_LEFT:
        case MANEUVER_TYPE.SHARP_LEFT_ALT:
            return { icon: 'arrow-back', rotation: 0, label: 'Left' };
        case MANEUVER_TYPE.UTURN_RIGHT:
        case MANEUVER_TYPE.UTURN_LEFT:
            return { icon: 'return-down-back', rotation: type === MANEUVER_TYPE.UTURN_LEFT ? -90 : 90, label: 'U-turn' };
        case MANEUVER_TYPE.ROUNDABOUT_ENTER:
        case MANEUVER_TYPE.ROUNDABOUT_EXIT:
            return { icon: 'sync', rotation: 0, label: 'Roundabout' };
        default: {
            const lower = instruction.toLowerCase();
            if (lower.includes('roundabout')) {
                return { icon: 'sync', rotation: 0, label: 'Roundabout' };
            }
            if (lower.includes('u-turn') || lower.includes('uturn')) {
                return { icon: 'return-down-back', rotation: 0, label: 'U-turn' };
            }
            if (lower.includes('left')) {
                return { icon: 'arrow-back', rotation: 0, label: 'Left' };
            }
            if (lower.includes('right')) {
                return { icon: 'arrow-forward', rotation: 0, label: 'Right' };
            }
            return { icon: 'arrow-up', rotation: bearing, label: bearingToCardinal(bearing) };
        }
    }
}

export function segmentToGeoJSON(coords: [number, number][]) {
    return {
        type: 'Feature' as const,
        properties: {},
        geometry: {
            type: 'LineString' as const,
            coordinates: coords,
        },
    };
}

export function fitBoundsToCoords(coords: [number, number][]) {
    if (coords.length === 0) return null;

    const bounds = coords.reduce(
        (acc, [lng, lat]) => ({
            minLng: Math.min(acc.minLng, lng),
            maxLng: Math.max(acc.maxLng, lng),
            minLat: Math.min(acc.minLat, lat),
            maxLat: Math.max(acc.maxLat, lat),
        }),
        {
            minLng: coords[0][0],
            maxLng: coords[0][0],
            minLat: coords[0][1],
            maxLat: coords[0][1],
        }
    );

    const centerLng = (bounds.minLng + bounds.maxLng) / 2;
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;
    const maxDiff = Math.max(bounds.maxLat - bounds.minLat, bounds.maxLng - bounds.minLng);

    let zoom = 16;
    if (maxDiff > 0.08) zoom = 12;
    else if (maxDiff > 0.04) zoom = 13;
    else if (maxDiff > 0.015) zoom = 14;
    else if (maxDiff > 0.006) zoom = 15;

    return { center: [centerLng, centerLat] as [number, number], zoom };
}
