import { useCallback, useRef } from 'react';
import { PixelRatio } from 'react-native';
import {
    SNAP_MIN_SPEED_FOR_HEADING,
    SNAP_NAME_LAYER_IDS,
    SNAP_NAME_MISS_LIMIT,
    SNAP_NAME_QUERY_SCALE,
    SNAP_QUERY_HALF_PX,
    SNAP_QUERY_MIN_MS,
    SNAP_ROAD_LAYER_IDS,
} from '../constants';
import { LocalFrame, XY } from '../utils/geo';
import {
    Road,
    SnapMemory,
    SnapResult,
    buildRoads,
    nearestRoadName,
    snapToRoads,
} from '../utils/roadSnap';

interface MapQueryable {
    queryRenderedFeaturesInRect: (
        bbox: GeoJSON.BBox,
        filter: undefined,
        layerIDs: string[]
    ) => Promise<GeoJSON.FeatureCollection>;
}

interface SnapRequest {
    p: XY;
    frame: LocalFrame;
    travelBearing: number | null;
    speed: number;
    screenPoint: [number, number];
}

export interface SnapOutcome {
    result: SnapResult | null;
    roadName: string | null;
}

export const useRoadSnapper = (
    mapRef: React.RefObject<MapQueryable | null>,
    lang = 'latin'
) => {
    const roadsRef = useRef<Road[]>([]);
    const roadNameRef = useRef<string | null>(null);
    const nameMissesRef = useRef(0);
    const prevRef = useRef<SnapMemory | null>(null);
    const lastQueryAtRef = useRef(0);
    const inFlightRef = useRef(false);
    const seqRef = useRef(0);

    const reset = useCallback(() => {
        roadsRef.current = [];
        roadNameRef.current = null;
        nameMissesRef.current = 0;
        prevRef.current = null;
        lastQueryAtRef.current = 0;
        inFlightRef.current = false;
        seqRef.current++;
    }, []);
    const refreshRoads = useCallback(
        async (screenPoint: [number, number], frame: LocalFrame, p: XY) => {
            const map = mapRef.current;
            if (!map || inFlightRef.current) return;

            const now = Date.now();
            if (now - lastQueryAtRef.current < SNAP_QUERY_MIN_MS) return;
            lastQueryAtRef.current = now;
            inFlightRef.current = true;

            const seq = seqRef.current;
            const density = PixelRatio.get();
            const px = screenPoint[0] * density;
            const py = screenPoint[1] * density;
            const half = SNAP_QUERY_HALF_PX * density;
            const bbox: GeoJSON.BBox = [py - half, px + half, py + half, px - half];

            try {
                const fc = await map.queryRenderedFeaturesInRect(
                    bbox,
                    undefined,
                    SNAP_ROAD_LAYER_IDS
                );
                if (seq !== seqRef.current) return;
                roadsRef.current = buildRoads(fc?.features, frame, lang);

                const nameHalf = half * SNAP_NAME_QUERY_SCALE;
                const names = await map.queryRenderedFeaturesInRect(
                    [py - nameHalf, px + nameHalf, py + nameHalf, px - nameHalf],
                    undefined,
                    SNAP_NAME_LAYER_IDS
                );
                if (seq !== seqRef.current) return;

                const found = nearestRoadName(names?.features, frame, p, lang);
                if (found) {
                    roadNameRef.current = found;
                    nameMissesRef.current = 0;
                } else if (++nameMissesRef.current >= SNAP_NAME_MISS_LIMIT) {
                    roadNameRef.current = null;
                }
            } catch {
            } finally {
                inFlightRef.current = false;
            }
        },
        [mapRef, lang]
    );

    const snap = useCallback(
        (req: SnapRequest): SnapOutcome => {
            void refreshRoads(req.screenPoint, req.frame, req.p);

            const bearing =
                req.speed >= SNAP_MIN_SPEED_FOR_HEADING ? req.travelBearing : null;
            const result = snapToRoads(
                roadsRef.current,
                req.p,
                bearing,
                prevRef.current
            );
            prevRef.current = result
                ? { key: result.road.key, bearing: result.bearing }
                : null;

            return { result, roadName: roadNameRef.current };
        },
        [refreshRoads]
    );

    return { snap, reset };
};
