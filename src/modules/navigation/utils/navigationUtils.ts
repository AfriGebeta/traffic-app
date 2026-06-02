import { decodePolyline } from '../../../shared/utils/polyline';

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

/**
 * Update navigation instruction based on current position
 * @param currentLat - Current latitude
 * @param currentLng - Current longitude
 * @param routeManeuvers - Array of route maneuvers
 * @param currentManeuverIndex - Current maneuver index
 * @param routeCoordinates - Array of route coordinates
 * @returns Object with updated instruction and maneuver index
 */
export const updateInstructionBasedOnPosition = (
    currentLat: number,
    currentLng: number,
    routeManeuvers: any[],
    currentManeuverIndex: number,
    routeCoordinates: [number, number][]
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

    const TURN_APPROACH_DISTANCE = 200;
    const ADVANCE_THRESHOLD = 60;

    if (minDistance < ADVANCE_THRESHOLD && closestManeuverIndex < routeManeuvers.length - 1) {
        const newManeuverIndex = closestManeuverIndex + 1;
        const newManeuver = routeManeuvers[newManeuverIndex];
        return {
            instruction: newManeuver.instruction || 'Continue ahead',
            newManeuverIndex,
        };
    } else if (minDistance < TURN_APPROACH_DISTANCE) {
        return {
            instruction: nextManeuver.instruction || 'Continue ahead',
            newManeuverIndex: currentManeuverIndex,
        };
    } else {
        return {
            instruction: 'Continue ahead',
            newManeuverIndex: currentManeuverIndex,
        };
    }
};
