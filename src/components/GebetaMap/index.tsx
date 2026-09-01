import React, { forwardRef, useState, useImperativeHandle, useRef, useEffect, useLayoutEffect, memo, useMemo, useCallback } from 'react';
import { View, StyleSheet, Alert, Text, Animated, Image, PixelRatio, AppState } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { GebetaMapRef, GebetaMapProps } from '@gebeta/tiles-react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../shared/theme/colors';
import { useTheme } from '../../shared/theme/ThemeContext';
import { getAppConfig } from '../../shared/config/remoteConfigValues';
import { showToast } from '../../shared/utils/toast';
import { decodePolyline } from '../../shared/utils/polyline';
import {
    buildCumulativeDistances,
    pointAtDistance,
    headingAtDistance,
    sliceFromDistance,
    sliceRangeDistance,
    smoothRouteCorners,
    snapToRouteDistance,
    calculateDistance,
    calculateBearing,
} from '../../modules/navigation/utils/navigationUtils';
import AccidentLightIcon from '../../../assets/images/accident-light.svg';
import AccidentDarkIcon from '../../../assets/images/accident-dark.svg';
import BadWeatherLightIcon from '../../../assets/images/bad-weather-light.svg';
import BadWeatherDarkIcon from '../../../assets/images/bad-weather-dark.svg';
import BrokenRoadLightIcon from '../../../assets/images/broken-road-light.svg';
import BrokenRoadDarkIcon from '../../../assets/images/broken-road-dark.svg';
import ClosureLightIcon from '../../../assets/images/closure-light.svg';
import ClosureDarkIcon from '../../../assets/images/closure-dark.svg';

import CrashLightIcon from '../../../assets/images/crash-light.svg';
import CrashDarkIcon from '../../../assets/images/crash-dark.svg';
import GatedCommunityLightIcon from '../../../assets/images/gated-community-light.svg';
import GatedCommunityDarkIcon from '../../../assets/images/gated-community-dark.svg';
import HazardLightIcon from '../../../assets/images/hazard-light.svg';
import HazardDarkIcon from '../../../assets/images/hazard-dark.svg';
import OtherLightIcon from '../../../assets/images/other-light.svg';
import OtherDarkIcon from '../../../assets/images/other-dark.svg';
import RadarLightIcon from '../../../assets/images/radar-light.svg';
import RadarDarkIcon from '../../../assets/images/radar-dark.svg';

import TrafficJamLightIcon from '../../../assets/images/traffic-jam-light.svg';
import TrafficJamDarkIcon from '../../../assets/images/traffic-jam-dark.svg';

const MAPPIN_IMAGE = require('../../../assets/images/Mappin.png');
const NAV_ARROWHEAD_IMAGE = require('../../../assets/images/nav-arrowhead.png');
const PIN_NORMAL_IMAGE = require('../../../assets/images/pin-normal.png');
const RED_PIN_IMAGE = require('../../../assets/images/red-pin.png');
const WAYPOINT_PIN_IMAGE = require('../../../assets/images/location-pin-2.png');
const MINIBUS_SELECTED_IMAGE = require('../../../assets/images/minibus-selected.png');
const TAXI_MARKER_IMAGE = require('../../../assets/images/taxi-marker.png');

const EXPLORE_FALLBACK_IMAGE = require('../../../assets/images/other.png');

const HOME_FOLLOW_MIN_MOVE_METERS = 25;

const HOME_PAN_PIXEL_TOLERANCE = 30;
const HOME_ZOOM_TOLERANCE = 0.25;

const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection' as const, features: [] };

const HOME_FOLLOW_MAX_DRIFT_METERS = 120;

const INCIDENT_MIN_ZOOM = 13;
const RULE_MIN_ZOOM = 14;
const MARKER_ZOOM_HYSTERESIS = 0.3;
const MARKER_BOUNDS_PADDING_RATIO = 0.25;
const MARKER_BOUNDS_EPSILON = 1e-4;

type MarkerBounds = [west: number, south: number, east: number, north: number];

const isMarkerLayerVisible = (zoomLevel: number, minZoom: number, wasVisible: boolean) =>
    zoomLevel >= (wasVisible ? minZoom - MARKER_ZOOM_HYSTERESIS : minZoom);

const markerBoundsChanged = (prev: MarkerBounds | null, next: MarkerBounds) => {
    if (!prev) return true;
    return next.some((value, index) => Math.abs(value - prev[index]) > MARKER_BOUNDS_EPSILON);
};

const filterMarkersToBounds = <T extends { lat: number; lng: number }>(
    items: T[],
    bounds: MarkerBounds | null,
): T[] => {
    if (!bounds) return items;
    const [west, south, east, north] = bounds;
    if (east <= west || north <= south) return items;
    const lngPad = (east - west) * MARKER_BOUNDS_PADDING_RATIO;
    const latPad = (north - south) * MARKER_BOUNDS_PADDING_RATIO;
    return items.filter(
        (item) =>
            item.lng >= west - lngPad &&
            item.lng <= east + lngPad &&
            item.lat >= south - latPad &&
            item.lat <= north + latPad,
    );
};

const EXPLORE_IMAGES: Record<string, any> = {
    restaurant: require('../../../assets/images/restaurant.png'),
    restaurants: require('../../../assets/images/restaurant.png'),
    hotel: require('../../../assets/images/hotel.png'),
    'gas-station': require('../../../assets/images/gas-station.png'),
    gas: require('../../../assets/images/gas-station.png'),
    parking: require('../../../assets/images/parking.png'),
    hospital: require('../../../assets/images/hospital.png'),
    'repair-shop': require('../../../assets/images/repair-shop.png'),
    repair: require('../../../assets/images/repair-shop.png'),
    bank: require('../../../assets/images/bank.png'),
    atm: require('../../../assets/images/atm.png'),
};

const INCIDENT_SVG_ICONS: Record<string, { light: React.FC<{ width?: number; height?: number }>; dark: React.FC<{ width?: number; height?: number }> }> = {
    ROAD_CLOSURE: { light: ClosureLightIcon, dark: ClosureDarkIcon },
    ACCIDENT: { light: AccidentLightIcon, dark: AccidentDarkIcon },
    TRAFFIC_JAM: { light: TrafficJamLightIcon, dark: TrafficJamDarkIcon },
    BAD_WEATHER: { light: BadWeatherLightIcon, dark: BadWeatherDarkIcon },
    HAZARD: { light: HazardLightIcon, dark: HazardDarkIcon },
    CRASH: { light: CrashLightIcon, dark: CrashDarkIcon },
    GATED_COMMUNITY: { light: GatedCommunityLightIcon, dark: GatedCommunityDarkIcon },
    BROKEN_ROAD: { light: BrokenRoadLightIcon, dark: BrokenRoadDarkIcon },
    RADAR: { light: RadarLightIcon, dark: RadarDarkIcon },
    OTHER: { light: OtherLightIcon, dark: OtherDarkIcon },
};

const MAP_TILE_LOADING_BACKGROUND_LIGHT = colors.gray[200];
const MAP_TILE_LOADING_BACKGROUND_DARK = colors.gray[800];

const getTileLoadingBackground = (isDark: boolean) =>
    isDark ? MAP_TILE_LOADING_BACKGROUND_DARK : MAP_TILE_LOADING_BACKGROUND_LIGHT;

const ensureStyleBackgroundLayer = (styleJson: Record<string, any>, isDark: boolean): Record<string, any> => {
    const layers = Array.isArray(styleJson.layers) ? [...styleJson.layers] : [];
    const hasBackground = layers.some((layer) => layer.type === 'background');
    if (hasBackground) {
        return styleJson;
    }
    return {
        ...styleJson,
        layers: [
            {
                id: 'gebeta-map-background',
                type: 'background',
                paint: { 'background-color': getTileLoadingBackground(isDark) },
            },
            ...layers,
        ],
    };
};

interface ExtendedGebetaMapProps extends Omit<GebetaMapProps, 'center'> {
    center?: [number, number];
    routeGeoJSON?: any;
    routeStyle?: {
        color?: string;
        width?: number;
        opacity?: number;
        isDotted?: boolean;
    };
    isNavigating?: boolean;
    userLocation?: { lat: number; lng: number; accuracy?: number; speed?: number } | null;
    userHeading?: number;
    showUserLocationMarker?: boolean;
    onUserLocationUpdate?: (location: { lat: number; lng: number }) => void;
    onRegionCenterChange?: (center: [number, number]) => void;
    onUserInteraction?: () => void;
    incidents?: Array<{
        id: string;
        lat: number;
        lng: number;
        type: {
            name: string;
            label: string;
            icon: string | null;
        };
        description: string;
    }>;
    rules?: Array<{
        id: string;
        lat: number;
        lng: number;
        type: {
            img: string;
            name: string;
        };
    }>;
    selectedLocation?: { lat: number; lng: number } | null;
    clickedLocation?: { lat: number; lng: number } | null;
    selectedDestination?: { latitude: number; longitude: number; name: string } | null;
    routeOrigin?: { latitude: number; longitude: number; name: string } | null;
    explorePlaces?: Array<{
        name: string;
        latitude: number;
        longitude: number;
        type: string;
    }>;
    exploreCategory?: string | null;
    onExplorePlacePress?: (place: any) => void;
    taxiStations?: Array<{
        id: number;
        name: string;
        lat: number;
        lng: number;
        type: 'start' | 'end' | 'intermediate';
    }>;
    taxiWalkRoutes?: Array<{
        type: 'origin' | 'transfer' | 'destination';
        polyline: string;
        coordinates?: Array<[number, number]>;
    }>;
    taxiRouteSegments?: Array<{
        coordinates: Array<[number, number]>;
        cost: number;
        from: string;
        to: string;
    }>;
    isTaxiNavigation?: boolean;
    currentTaxiSegmentIndex?: number;
    segmentedRoutes?: Array<{
        geoJSON: any;
        isWalking: boolean;
        segmentIndex: number;
    }>;
    waypointMarkers?: Array<{ latitude: number; longitude: number; name: string }>;
    activeSegmentGeoJSON?: any;
    previewStepLocation?: { lng: number; lat: number } | null;
    externalCameraControl?: boolean;
    isHomeMap?: boolean;
    //position the cam purely from the initial center
    staticInitialCamera?: boolean;
    freeCamera?: boolean;
    maneuvers?: Array<{ begin_shape_index: number; type?: number }>;
    boundingBox?: {
        north: number;
        south: number;
        east: number;
        west: number;
    } | null;
    alternativeRoutesGeoJSON?: any[];
    routeTimeLabels?: Array<{ coordinate: [number, number]; label: string; isPrimary: boolean }>;
}


// the bearing between two lat/lng points
const calcBearing = (
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
): number => {
    const lat1 = from.lat * Math.PI / 180;
    const lat2 = to.lat * Math.PI / 180;
    const dLng = (to.lng - from.lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
};



const NavigationMarker = memo(forwardRef<any, {
    lat: number;
    lng: number;
    heading: number;
    visible: boolean;
    hidden: boolean;
}>(({
    lat,
    lng,
    heading,
    visible,
    hidden,
}, ref) => {
    const shape = useMemo(() => ({
        type: 'Feature' as const,
        properties: { heading },
        geometry: { type: 'Point' as const, coordinates: [lng, lat] },
    }), [lat, lng, heading]);

    if (!visible) return null;

    return (
        <MapLibreGL.ShapeSource ref={ref} id="nav-marker-source" shape={shape}>
            <MapLibreGL.SymbolLayer
                id="nav-marker-layer"
                style={{
                    iconImage: 'navPuck',
                    iconSize: 1.1,
                    iconRotate: ['get', 'heading'],
                    iconRotationAlignment: 'map',
                    iconAllowOverlap: true,
                    iconIgnorePlacement: true,
                    iconAnchor: 'center',
                    iconOpacity: hidden ? 0 : 1,
                }}
            />
        </MapLibreGL.ShapeSource>
    );
}));
NavigationMarker.displayName = 'NavigationMarker';

const WALK_DASH_PATTERN = [0.1, 2];

const useForegroundEpoch = () => {
    const [epoch, setEpoch] = useState(0);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') setEpoch((value) => value + 1);
        });
        return () => subscription.remove();
    }, []);

    return epoch;
};

const AnimatedSegmentedRoutes = memo(({
    segmentedRoutes,
    animatedLat,
    animatedLng,
    currentTaxiSegmentIndex,
}: {
    segmentedRoutes: Array<{ geoJSON: any; isWalking: boolean; segmentIndex: number }>;
    animatedLat: number;
    animatedLng: number;
    currentTaxiSegmentIndex?: number;
}) => {
    const animatedSegments = useMemo(() => {
        return segmentedRoutes.map((seg) => {
            if (seg.segmentIndex !== currentTaxiSegmentIndex) return seg;
            const coords = seg.geoJSON.geometry.coordinates;
            if (coords.length === 0) return seg;
            return {
                ...seg,
                geoJSON: {
                    ...seg.geoJSON,
                    geometry: {
                        ...seg.geoJSON.geometry,
                        coordinates: [[animatedLng, animatedLat], ...coords],
                    },
                },
            };
        });
    }, [segmentedRoutes, animatedLat, animatedLng, currentTaxiSegmentIndex]);

    const foregroundEpoch = useForegroundEpoch();

    return (
        <>
            {animatedSegments.map((route) => {
                if (route.geoJSON.geometry.coordinates.length === 0) return null;

                const lineWidth = route.isWalking ? 10 : 16;
                const lineStyle: any = {
                    lineColor: route.isWalking ? '#EF4444' : '#3B82F6',
                    lineWidth,
                    lineOpacity: currentTaxiSegmentIndex === route.segmentIndex ? 1 : 0.7,
                    lineCap: 'round',
                    lineJoin: 'round',
                };
                if (route.isWalking) {
                    lineStyle.lineDasharray = WALK_DASH_PATTERN;
                }

                return (
                    <MapLibreGL.ShapeSource
                        key={`segment-${route.segmentIndex}-source-${route.isWalking ? foregroundEpoch : 0}`}
                        id={`segment-${route.segmentIndex}-source`}
                        shape={route.geoJSON}
                    >
                        {!route.isWalking && (
                            <MapLibreGL.LineLayer
                                id={`segment-${route.segmentIndex}-casing-layer`}
                                style={{
                                    lineColor: '#1e3a8a',
                                    lineWidth: lineWidth + 4,
                                    lineOpacity: 0.5,
                                    lineCap: 'round',
                                    lineJoin: 'round',
                                }}
                            />
                        )}
                        <MapLibreGL.LineLayer
                            id={`segment-${route.segmentIndex}-layer`}
                            style={lineStyle}
                        />
                    </MapLibreGL.ShapeSource>
                );
            })}
        </>
    );
});
AnimatedSegmentedRoutes.displayName = 'AnimatedSegmentedRoutes';


interface AnimatedNavLayerProps {
    userLocation: { lat: number; lng: number; accuracy?: number; speed?: number } | null;
    isNavigating: boolean;
    routeGeoJSON: any;
    routeLineStyle: any;
    segmentedRoutes?: Array<{ geoJSON: any; isWalking: boolean; segmentIndex: number }>;
    isTaxiNavigation?: boolean;
    currentTaxiSegmentIndex?: number;
    imagesLoaded: boolean;
    moveCamera?: (center: [number, number], heading: number) => void;
    cameraLocked: boolean;
    maneuvers?: Array<{ begin_shape_index: number; type?: number }>;
}


const NAV_LINE_MS = 33;
const NAV_LINE_TRIM_AHEAD_M = 0;
const NAV_LINE_LAG_COMP_S = 0.15;
const NAV_TAXI_RENDER_MS = NAV_LINE_MS;
const NAV_CAMERA_MS = 0;

const NAV_ARROW_SHOW_M = 300;
const NAV_ARROW_PASS_M = 0;
const NAV_ARROW_BACK_M = 22;
const NAV_ARROW_FWD_M = 15;

const NAV_ARROW_TURN_TYPES = new Set([9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 26, 27]);
const NAV_PUCK_SCREEN_FRACTION = 0.68;
const NAV_PUCK_OVERLAY_SIZE = 48;
const NAV_PUCK_FORWARD_PX = 4;
const navCameraPaddingTop = (mapHeight: number) => {
    const desiredDp = (2 * NAV_PUCK_SCREEN_FRACTION - 1) * mapHeight;
    return Math.max(0, Math.round(desiredDp / PixelRatio.getFontScale()));
};

const NAV_HEADING_TAU = 0.10;
const NAV_V_SMOOTH = 0.35;
const NAV_STOP_SPEED = 0.7;
const NAV_CORR_TAU = 0.6;
const NAV_FREE_TAU = 0.072;
const NAV_DT_CLAMP_S = 0.1;
const NAV_HEADING_LOOKAHEAD = 25;

const NAV_SNAP_BACK_TOLERANCE_M = 2;
const NAV_UNSNAP_M = 14;
const NAV_RESNAP_M = 12;

const NAV_UNSNAP_ACC_FACTOR = 1.5;
const NAV_UNSNAP_DEBOUNCE_MS = 3000;
const NAV_UNSNAP_HEADING_ANGLE = 70;
const NAV_UNSNAP_HEADING_MIN_DIST = 8;
const NAV_UNSNAP_HEADING_MIN_MOVE = 8;

const angleDiff = (a: number, b: number) => {
    let diff = Math.abs(a - b);
    if (diff > 180) diff = 360 - diff;
    return diff;
};

const AnimatedNavLayer = memo(({
    userLocation,
    isNavigating,
    routeGeoJSON,
    routeLineStyle,
    segmentedRoutes,
    isTaxiNavigation,
    currentTaxiSegmentIndex,
    imagesLoaded,
    moveCamera,
    cameraLocked,
    maneuvers,
}: AnimatedNavLayerProps) => {
    const rawCoords: [number, number][] | undefined = routeGeoJSON?.geometry?.coordinates;
    const coords = useMemo(
        () => (!isTaxiNavigation && rawCoords && rawCoords.length > 2 ? smoothRouteCorners(rawCoords) : rawCoords),
        [rawCoords, isTaxiNavigation]
    );
    const useRouteModel = !!coords && coords.length > 1;

    const cum = useMemo(
        () => (coords && coords.length > 1 ? buildCumulativeDistances(coords) : null),
        [coords]
    );

    const [render, setRender] = useState({ lat: 0, lng: 0, heading: 0 });
    const [lineS, setLineS] = useState(0);
    const [arrowIdx, setArrowIdx] = useState(-1);

    const maneuverS = useMemo(() => {
        if (!coords || !cum || !rawCoords || !maneuvers || maneuvers.length < 3) return [];
        return maneuvers
            .slice(1, -1)
            .filter((m) => m.type == null || NAV_ARROW_TURN_TYPES.has(m.type))
            .map((m) => {
                const idx = Math.min(Math.max(m.begin_shape_index, 0), rawCoords.length - 1);
                const [lngM, latM] = rawCoords[idx];
                return snapToRouteDistance(coords, cum, latM, lngM, 0, Number.POSITIVE_INFINITY).s;
            })
            .sort((a, b) => a - b);
    }, [coords, cum, rawCoords, maneuvers]);

    const puckSrcRef = useRef<any>(null);
    const lineSrcRef = useRef<any>(null);

    const renderedSRef = useRef(0);
    const vRef = useRef(0);
    const arrowIdxRef = useRef(-1);
    const lastFixRef = useRef<{ s: number; t: number } | null>(null);
    const firstRef = useRef(true);
    const headingRef = useRef(0);

    const freeRoamRef = useRef(false);
    const freeTargetRef = useRef({ lat: 0, lng: 0 });
    const freeCurRef = useRef({ lat: 0, lng: 0 });
    const lastOnRouteSRef = useRef(0);
    const unsnapStartRef = useRef<number | null>(null);
    const prevRawRef = useRef<{ lat: number; lng: number } | null>(null);
    const taxiCurRef = useRef({ lat: 0, lng: 0 });
    const taxiToRef = useRef({ lat: 0, lng: 0 });

    useEffect(() => {
        firstRef.current = true;
        lastFixRef.current = null;
        renderedSRef.current = 0;
        vRef.current = 0;
        freeRoamRef.current = false;
        lastOnRouteSRef.current = 0;
        unsnapStartRef.current = null;
        prevRawRef.current = null;
        setLineS(0);
        arrowIdxRef.current = -1;
        setArrowIdx(-1);
    }, [coords]);

    useEffect(() => {
        if (!isNavigating || !userLocation) return;

        if (!useRouteModel || !coords || !cum) {
            if (firstRef.current) {
                firstRef.current = false;
                taxiCurRef.current = { lat: userLocation.lat, lng: userLocation.lng };
            }
            taxiToRef.current = { lat: userLocation.lat, lng: userLocation.lng };
            return;
        }

        const now = Date.now();
        const searchWindow = freeRoamRef.current ? Number.POSITIVE_INFINITY : 400;
        const { s: snappedS, distance } = snapToRouteDistance(
            coords, cum, userLocation.lat, userLocation.lng,
            firstRef.current ? 0 : renderedSRef.current,
            searchWindow
        );

        const prevFixS = lastFixRef.current?.s;
        const routeS = prevFixS != null
            ? Math.max(snappedS, prevFixS - NAV_SNAP_BACK_TOLERANCE_M)
            : snappedS;

        if (firstRef.current) {
            firstRef.current = false;
            freeRoamRef.current = false;
            renderedSRef.current = routeS;
            vRef.current = userLocation.speed != null && userLocation.speed >= 0 ? userLocation.speed : 0;
            lastOnRouteSRef.current = routeS;
            headingRef.current = headingAtDistance(coords, cum, routeS);
            lastFixRef.current = { s: routeS, t: now };
            prevRawRef.current = { lat: userLocation.lat, lng: userLocation.lng };
            const [lng0, lat0] = pointAtDistance(coords, cum, routeS);
            setRender({ lat: lat0, lng: lng0, heading: headingRef.current });
            setLineS(routeS);
            return;
        }

        let free: boolean;
        if (freeRoamRef.current) {
            free = distance > NAV_RESNAP_M;
        } else {
            const acc = userLocation.accuracy;
            const beyondNoise = acc == null ? true : distance > acc * NAV_UNSNAP_ACC_FACTOR;
            const positionOff = distance > NAV_UNSNAP_M && beyondNoise;

            let headingOff = false;
            const prev = prevRawRef.current;
            if (prev && distance > NAV_UNSNAP_HEADING_MIN_DIST) {
                const moved = calculateDistance(prev.lat, prev.lng, userLocation.lat, userLocation.lng);
                if (moved > NAV_UNSNAP_HEADING_MIN_MOVE) {
                    const travel = calcBearing(prev, { lat: userLocation.lat, lng: userLocation.lng });
                    const routeB = headingAtDistance(coords, cum, routeS);
                    let dh = Math.abs(travel - routeB);
                    if (dh > 180) dh = 360 - dh;
                    headingOff = dh > NAV_UNSNAP_HEADING_ANGLE;
                }
            }

            if (positionOff || headingOff) {
                if (unsnapStartRef.current == null) unsnapStartRef.current = now;
                free = now - unsnapStartRef.current >= NAV_UNSNAP_DEBOUNCE_MS;
            } else {
                unsnapStartRef.current = null;
                free = false;
            }
        }

        if (free) {
            if (!freeRoamRef.current) {
                const [lngL, latL] = pointAtDistance(coords, cum, renderedSRef.current);
                freeCurRef.current = { lat: latL, lng: lngL };
            }
            freeRoamRef.current = true;
            freeTargetRef.current = { lat: userLocation.lat, lng: userLocation.lng };
        } else if (freeRoamRef.current) {
            freeRoamRef.current = false;
            unsnapStartRef.current = null;
            renderedSRef.current = routeS;
            vRef.current = userLocation.speed != null && userLocation.speed >= 0 ? userLocation.speed : 0;
            lastFixRef.current = { s: routeS, t: now };
            lastOnRouteSRef.current = routeS;
        } else {
            unsnapStartRef.current = null;
            const prev = lastFixRef.current!;
            const dtFix = Math.max(0.001, (now - prev.t) / 1000);
            let measured = (routeS - prev.s) / dtFix;
            if (measured < 0) measured = 0;
            if (measured > 60) measured = 60;
            const sample = userLocation.speed != null && userLocation.speed >= 0 ? userLocation.speed : measured;
            if (sample <= NAV_STOP_SPEED) {
                vRef.current = 0;
            } else if (sample < vRef.current) {
                vRef.current = sample;
            } else {
                vRef.current = vRef.current * (1 - NAV_V_SMOOTH) + sample * NAV_V_SMOOTH;
                if (vRef.current < 0.4) vRef.current = 0;
            }
            lastFixRef.current = { s: routeS, t: now };
            lastOnRouteSRef.current = routeS;
        }

        prevRawRef.current = { lat: userLocation.lat, lng: userLocation.lng };
    }, [userLocation?.lat, userLocation?.lng, userLocation?.speed, isNavigating, useRouteModel, coords, cum]);

    useEffect(() => {
        if (!isNavigating) {
            firstRef.current = true;
            return;
        }

        let rafId: number;
        let lastLine = 0;
        let lastRender = 0;
        let lastCam = 0;
        let lastTick = 0;

        const tick = () => {
            const now = Date.now();
            const dt = lastTick ? Math.min((now - lastTick) / 1000, NAV_DT_CLAMP_S) : 0.016;
            lastTick = now;
            const headAlpha = 1 - Math.exp(-dt / NAV_HEADING_TAU);
            const freeAlpha = 1 - Math.exp(-dt / NAV_FREE_TAU);

            let lat: number, lng: number, heading: number, s: number;

            if (!useRouteModel || !coords || !cum) {
                const cur = taxiCurRef.current;
                const to = taxiToRef.current;
                lat = cur.lat + (to.lat - cur.lat) * freeAlpha;
                lng = cur.lng + (to.lng - cur.lng) * freeAlpha;
                taxiCurRef.current = { lat, lng };
                if (Math.abs(to.lat - lat) > 1e-6 || Math.abs(to.lng - lng) > 1e-6) {
                    const raw = calcBearing({ lat, lng }, to);
                    let diff = raw - headingRef.current;
                    if (diff > 180) diff -= 360;
                    if (diff < -180) diff += 360;
                    headingRef.current += diff * headAlpha;
                }
                heading = headingRef.current;
                s = 0;
            } else if (freeRoamRef.current) {
                const cur = freeCurRef.current;
                const to = freeTargetRef.current;
                lat = cur.lat + (to.lat - cur.lat) * freeAlpha;
                lng = cur.lng + (to.lng - cur.lng) * freeAlpha;
                freeCurRef.current = { lat, lng };
                if (Math.abs(to.lat - lat) > 1e-6 || Math.abs(to.lng - lng) > 1e-6) {
                    const raw = calcBearing({ lat, lng }, to);
                    let diff = raw - headingRef.current;
                    if (diff > 180) diff -= 360;
                    if (diff < -180) diff += 360;
                    headingRef.current += diff * headAlpha;
                }
                heading = headingRef.current;
                s = lastOnRouteSRef.current;
            } else {
                const total = cum[cum.length - 1];

                const fix = lastFixRef.current;
                const sinceFix = fix ? (now - fix.t) / 1000 : 0;
                const targetS = fix ? Math.min(fix.s + vRef.current * sinceFix, total) : renderedSRef.current;

                const corrAlpha = 1 - Math.exp(-dt / NAV_CORR_TAU);
                let newS = renderedSRef.current + (targetS - renderedSRef.current) * corrAlpha;
                if (newS < renderedSRef.current) newS = renderedSRef.current;   // never step backward
                if (newS > total) newS = total;
                s = newS;
                renderedSRef.current = s;
                const pt = pointAtDistance(coords, cum, s);
                lng = pt[0];
                lat = pt[1];
                const aheadPt = pointAtDistance(coords, cum, s + NAV_HEADING_LOOKAHEAD);
                const rawH = (Math.abs(aheadPt[0] - pt[0]) > 1e-7 || Math.abs(aheadPt[1] - pt[1]) > 1e-7)
                    ? calculateBearing(pt, aheadPt)
                    : headingAtDistance(coords, cum, s);
                let diff = rawH - headingRef.current;
                if (diff > 180) diff -= 360;
                if (diff < -180) diff += 360;
                headingRef.current += diff * headAlpha;
                heading = headingRef.current;
            }

            puckSrcRef.current?.setNativeProps({
                shape: JSON.stringify({
                    type: 'Feature',
                    properties: { heading },
                    geometry: { type: 'Point', coordinates: [lng, lat] },
                }),
            });

            if (isTaxiNavigation && now - lastRender >= NAV_TAXI_RENDER_MS) {
                lastRender = now;
                setRender({ lat, lng, heading });
            }

            if (useRouteModel && !isTaxiNavigation && coords && cum && now - lastLine >= NAV_LINE_MS) {
                lastLine = now;
                lineSrcRef.current?.setNativeProps({
                    shape: JSON.stringify({
                        type: 'Feature',
                        properties: {},
                        geometry: {
                            type: 'LineString',
                            coordinates: sliceFromDistance(
                                coords,
                                cum,
                                s + NAV_LINE_TRIM_AHEAD_M + vRef.current * NAV_LINE_LAG_COMP_S
                            ),
                        },
                    }),
                });
            }

            if (useRouteModel && maneuverS.length > 0) {
                let want = -1;
                for (let i = 0; i < maneuverS.length; i++) {
                    if (s <= maneuverS[i] + NAV_ARROW_PASS_M) {
                        if (maneuverS[i] - s <= NAV_ARROW_SHOW_M) want = i;
                        break;
                    }
                }
                if (want !== arrowIdxRef.current) {
                    arrowIdxRef.current = want;
                    setArrowIdx(want);
                }
            }

            if (moveCamera && now - lastCam >= NAV_CAMERA_MS) {
                lastCam = now;
                moveCamera([lng, lat], heading);
            }

            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [isNavigating, useRouteModel, coords, cum, moveCamera, isTaxiNavigation, maneuverS]);

    const arrowShapes = useMemo(() => {
        if (!useRouteModel || !coords || !cum || arrowIdx < 0 || arrowIdx >= maneuverS.length) return null;
        const sM = maneuverS[arrowIdx];
        const shaftCoords = sliceRangeDistance(coords, cum, sM - NAV_ARROW_BACK_M, sM + NAV_ARROW_FWD_M);
        if (shaftCoords.length < 2) return null;
        const tip = shaftCoords[shaftCoords.length - 1];
        return {
            shaft: {
                type: 'Feature' as const,
                properties: {},
                geometry: { type: 'LineString' as const, coordinates: shaftCoords },
            },
            head: {
                type: 'Feature' as const,
                properties: { rot: headingAtDistance(coords, cum, sM + NAV_ARROW_FWD_M) },
                geometry: { type: 'Point' as const, coordinates: tip },
            },
        };
    }, [useRouteModel, coords, cum, arrowIdx, maneuverS]);

    const lineShape = useMemo(() => {
        if (!useRouteModel || isTaxiNavigation || !coords || !cum) return null;
        return {
            type: 'Feature' as const,
            properties: {},
            geometry: {
                type: 'LineString' as const,
                coordinates: sliceFromDistance(coords, cum, lineS + NAV_LINE_TRIM_AHEAD_M),
            },
        };
    }, [useRouteModel, isTaxiNavigation, coords, cum, lineS]);

    return (
        <>
            {isNavigating && isTaxiNavigation && segmentedRoutes && segmentedRoutes.length > 0 && (
                <AnimatedSegmentedRoutes
                    segmentedRoutes={segmentedRoutes}
                    animatedLat={render.lat}
                    animatedLng={render.lng}
                    currentTaxiSegmentIndex={currentTaxiSegmentIndex}
                />
            )}
            {isNavigating && lineShape && (
                <MapLibreGL.ShapeSource ref={lineSrcRef} id="route-nav-animated-source" shape={lineShape}>
                    <MapLibreGL.LineLayer
                        id="route-nav-casing-layer"
                        belowLayerID="nav-marker-layer"
                        style={{
                            lineColor: '#1e3a8a',
                            lineWidth: (routeLineStyle.lineWidth ?? 16) + 4,
                            lineOpacity: 0.5,
                            lineCap: 'round',
                            lineJoin: 'round',
                        }}
                    />
                    <MapLibreGL.LineLayer
                        id="route-nav-animated-layer"
                        belowLayerID="nav-marker-layer"
                        style={{ ...routeLineStyle, lineOpacity: 1 }}
                    />
                </MapLibreGL.ShapeSource>
            )}
            {isNavigating && arrowShapes && imagesLoaded && (
                <>
                    <MapLibreGL.ShapeSource id="nav-arrow-shaft-source" shape={arrowShapes.shaft}>
                        <MapLibreGL.LineLayer
                            id="nav-arrow-casing-layer"
                            belowLayerID="nav-marker-layer"
                            style={{
                                lineColor: '#1e3a8a',
                                lineWidth: 13,
                                lineCap: 'round',
                                lineJoin: 'round',
                            }}
                        />
                        <MapLibreGL.LineLayer
                            id="nav-arrow-shaft-layer"
                            belowLayerID="nav-marker-layer"
                            style={{
                                lineColor: '#ffffff',
                                lineWidth: 8,
                                lineCap: 'round',
                                lineJoin: 'round',
                            }}
                        />
                    </MapLibreGL.ShapeSource>
                    <MapLibreGL.ShapeSource id="nav-arrow-head-source" shape={arrowShapes.head}>
                        <MapLibreGL.SymbolLayer
                            id="nav-arrow-head-layer"
                            belowLayerID="nav-marker-layer"
                            style={{
                                iconImage: 'navArrowHead',
                                iconSize: 0.35,
                                iconRotate: ['get', 'rot'],
                                iconRotationAlignment: 'map',
                                iconPitchAlignment: 'map',
                                iconAnchor: 'bottom',
                                iconAllowOverlap: true,
                                iconIgnorePlacement: true,
                            }}
                        />
                    </MapLibreGL.ShapeSource>
                </>
            )}
            <NavigationMarker
                ref={puckSrcRef}
                lat={render.lat}
                lng={render.lng}
                heading={render.heading}
                visible={!!isNavigating && !!userLocation && !!imagesLoaded}
                hidden={cameraLocked}
            />
        </>
    );
});
AnimatedNavLayer.displayName = 'AnimatedNavLayer';


const CustomGebetaMap = forwardRef<GebetaMapRef, ExtendedGebetaMapProps>(
    ({ apiKey, center, zoom, onMapClick, onMapLoaded, mapStyleUrl, mapStyleJson, routeGeoJSON, routeStyle, isNavigating, userLocation, userHeading, showUserLocationMarker, onUserLocationUpdate, onRegionCenterChange, onUserInteraction, incidents, rules, selectedLocation, clickedLocation, selectedDestination, routeOrigin, explorePlaces, exploreCategory, onExplorePlacePress, taxiStations, taxiWalkRoutes, taxiRouteSegments, isTaxiNavigation, currentTaxiSegmentIndex, segmentedRoutes, waypointMarkers, activeSegmentGeoJSON, previewStepLocation, externalCameraControl, isHomeMap, staticInitialCamera, freeCamera, maneuvers, boundingBox, alternativeRoutesGeoJSON, routeTimeLabels }, ref) => {
        const { isDark } = useTheme();
        const foregroundEpoch = useForegroundEpoch();
        const [mapStyleState, setMapStyleState] = useState<Record<string, unknown> | null>(() =>
            mapStyleJson ? ensureStyleBackgroundLayer(mapStyleJson as Record<string, any>, isDark) : null
        );
        const cameraRef = useRef<any>(null);
        const mapViewRef = useRef<any>(null);
        const [mapHeight, setMapHeight] = useState(0);
        const mapHeightRef = useRef(0);
        const hasStartedNavigating = useRef(false);
        const homeFollowPausedRef = useRef(false);
        const userHasZoomedOut = useRef(false);
        const lastHomeFollowPanAtRef = useRef(0);
        const lastHomeFollowCenterRef = useRef<{ lat: number; lng: number } | null>(null);
        const lastRegionCenterRef = useRef<[number, number] | null>(null);
        const pendingHomeResetRef = useRef(false);

        const commandedCenterRef = useRef<[number, number] | null>(null);
        const prevCommandedCenterRef = useRef<[number, number] | null>(null);
        const commandedZoomRef = useRef<number | null>(null);
        const lastKnownZoomRef = useRef<number | null>(null);
        const lastSettledCenterRef = useRef<[number, number] | null>(null);

        const markHomeCommand = useCallback((
            commandCenter: [number, number],
            commandZoom?: number,
        ) => {
            prevCommandedCenterRef.current = commandedCenterRef.current;
            commandedCenterRef.current = commandCenter;
            if (commandZoom !== undefined) {
                commandedZoomRef.current = commandZoom;
                lastKnownZoomRef.current = commandZoom;
            }
        }, []);
        const [markerLayerVisibility, setMarkerLayerVisibility] = useState(() => {
            const initialZoom = zoom ?? 15;
            return {
                incidents: initialZoom >= INCIDENT_MIN_ZOOM,
                rules: initialZoom >= RULE_MIN_ZOOM,
            };
        });
        const markerLayerVisibilityRef = useRef(markerLayerVisibility);
        const [markerBounds, setMarkerBounds] = useState<MarkerBounds | null>(null);

        const updateMarkerViewport = useCallback((e: any) => {
            const zoomLevel = e?.properties?.zoomLevel ?? e?.properties?.zoom;

            if (typeof zoomLevel === 'number') {
                const prev = markerLayerVisibilityRef.current;
                const next = {
                    incidents: isMarkerLayerVisible(zoomLevel, INCIDENT_MIN_ZOOM, prev.incidents),
                    rules: isMarkerLayerVisible(zoomLevel, RULE_MIN_ZOOM, prev.rules),
                };
                if (next.incidents !== prev.incidents || next.rules !== prev.rules) {
                    markerLayerVisibilityRef.current = next;
                    setMarkerLayerVisibility(next);
                }
            }

            const visibleBounds = e?.properties?.visibleBounds;
            if (Array.isArray(visibleBounds) && visibleBounds.length === 2) {
                const [ne, sw] = visibleBounds;
                if (Array.isArray(ne) && Array.isArray(sw)) {
                    const next: MarkerBounds = [sw[0], sw[1], ne[0], ne[1]];
                    setMarkerBounds(prev => (markerBoundsChanged(prev, next) ? next : prev));
                }
            }
        }, []);

        const visibleIncidents = useMemo(() => {
            if (!incidents || !markerLayerVisibility.incidents) return [];
            return filterMarkersToBounds(incidents, markerBounds);
        }, [incidents, markerLayerVisibility.incidents, markerBounds]);

        const visibleRules = useMemo(() => {
            if (!rules || !markerLayerVisibility.rules) return [];
            return filterMarkersToBounds(rules, markerBounds);
        }, [rules, markerLayerVisibility.rules, markerBounds]);

        const cameraSuspendedRef = useRef(false);
        const cameraResumeUntilRef = useRef(0);
        const NAV_ZOOM = getAppConfig().navZoom;
        const lastSetZoom = useRef<number>(NAV_ZOOM);
        const pulseAnim = useRef(new Animated.Value(1)).current;
        const [imagesLoaded, setImagesLoaded] = useState(false);
        const [renderKey, setRenderKey] = useState(0);
        const [homeCameraEpoch, setHomeCameraEpoch] = useState(0);
        const [homeCameraTarget, setHomeCameraTarget] = useState<{
            center: [number, number];
            zoom: number;
        } | null>(null);
        const [navCameraFree, setNavCameraFree] = useState(false);
        const lastFreeCameraRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
        const navGraceUntilRef = useRef(0);
        const lastAnimatedProgrammaticAtRef = useRef(0);
        const lastRegionSnapshotRef = useRef<{
            center: [number, number];
            heading: number;
            zoom: number;
        } | null>(null);
        const pendingRecenterRef = useRef(false);
        const pendingFlyTo = useRef<{
            center: [number, number];
            zoom?: number;
            duration?: number;
            pitch?: number;
        } | null>(null);
        const lastFlyToAtRef = useRef(0);
        const flyToTokenRef = useRef(0);
        const lastRegionEventAtRef = useRef(0);
        const pendingStyleRestoreRef = useRef(false);
        const prevStyleKeyRef = useRef<string | null>(null);
        useEffect(() => {
            const styleKey = mapStyleState ? JSON.stringify(mapStyleState) : null;
            if (prevStyleKeyRef.current && styleKey && prevStyleKeyRef.current !== styleKey) {
                pendingStyleRestoreRef.current = true;
            }
            prevStyleKeyRef.current = styleKey;
        }, [mapStyleState]);
        const applyInitialCamera = useCallback(() => {
            if (!center || isNavigating || !cameraRef.current) return;

            cameraRef.current.setCamera({
                centerCoordinate: center,
                zoomLevel: zoom ?? 15,
                animationDuration: 0,
                animationMode: 'moveTo',
            });
        }, [center, zoom, isNavigating]);

        const applyFlyTo = useCallback((options: {
            center: [number, number];
            zoom?: number;
            duration?: number;
            pitch?: number;
            heading?: number;
        }) => {
            const cameraConfig = {
                centerCoordinate: options.center,
                zoomLevel: options.zoom,
                animationMode: 'easeTo' as const,
                animationDuration: options.duration ?? 1000,
                pitch: options.pitch ?? 0,
                // left alone unless asked: navigation rotates the map, and only the caller
                // knows whether the view should be levelled back to north-up
                ...(options.heading !== undefined && { heading: options.heading }),
            };
            if (cameraRef.current) {
                pendingFlyTo.current = null;
                lastFlyToAtRef.current = Date.now();
                markHomeCommand(options.center, options.zoom);
                cameraRef.current.setCamera(cameraConfig);
                const issuedAt = Date.now();
                const token = ++flyToTokenRef.current;
                setTimeout(() => {
                    if (
                        flyToTokenRef.current === token &&
                        cameraRef.current &&
                        lastRegionEventAtRef.current < issuedAt
                    ) {
                        markHomeCommand(options.center, options.zoom);
                        cameraRef.current.setCamera(cameraConfig);
                    }
                }, 300);
            } else {
                pendingFlyTo.current = options;
            }
        }, [markHomeCommand]);

        const unlockNavCamera = useCallback((_reason: string) => {
            if (userHasZoomedOut.current) {
                return;
            }
            userHasZoomedOut.current = true;
            setNavCameraFree(true);
            onUserInteraction?.();
        }, [onUserInteraction]);

        const markAnimatedProgrammaticCamera = useCallback(() => {
            lastAnimatedProgrammaticAtRef.current = Date.now();
        }, []);

        const handleMapTouchForUnlock = useCallback(() => {
            if (!isNavigating) {
                if (externalCameraControl) {
                    homeFollowPausedRef.current = true;
                }
                return;
            }
            if (userHasZoomedOut.current || navCameraFree) return;
            const now = Date.now();
            if (now < navGraceUntilRef.current) return;
            unlockNavCamera('touch');
        }, [isNavigating, navCameraFree, unlockNavCamera, externalCameraControl]);

        const handleNavigationGestureUnlock = useCallback((e: any, source: string) => {
            if (!isNavigating || userHasZoomedOut.current || navCameraFree) return;

            const now = Date.now();
            if (now < navGraceUntilRef.current) return;

            const props = e.properties ?? {};

            const zoomLevel = props.zoomLevel ?? props.zoom;
            const heading = props.heading ?? 0;
            const coords = e.geometry?.coordinates;
            if (zoomLevel === undefined || !Array.isArray(coords) || coords.length < 2) return;

            const current = {
                center: [coords[0], coords[1]] as [number, number],
                heading,
                zoom: zoomLevel,
            };

            if (Math.abs(zoomLevel - NAV_ZOOM) > 0.2) {
                lastSetZoom.current = zoomLevel;
                lastFreeCameraRef.current = { center: current.center, zoom: zoomLevel };
                unlockNavCamera(`${source}-zoom`);
                return;
            }

            if (now - lastAnimatedProgrammaticAtRef.current < 1200) return;

            const prev = lastRegionSnapshotRef.current;

            lastRegionSnapshotRef.current = current;
            if (!prev) return;

            const headingDelta = angleDiff(current.heading, prev.heading);
            if (headingDelta > 10) {
                lastFreeCameraRef.current = {
                    center: current.center,
                    zoom: current.zoom,
                };
                unlockNavCamera(`${source}-rotate`);
                return;
            }

            const centerDrift = calculateDistance(
                prev.center[1],
                prev.center[0],
                current.center[1],
                current.center[0],
            );

            const zoomDeltaFromPrev = Math.abs(zoomLevel - prev.zoom);
            if (centerDrift > 3 && zoomDeltaFromPrev < 0.15) {
                lastFreeCameraRef.current = {
                    center: current.center,
                    zoom: current.zoom,
                };
                unlockNavCamera(`${source}-pan`);
            }
        }, [isNavigating, navCameraFree, unlockNavCamera]);

        const handleRegionWillChange = useCallback((e: any) => {
            const props = e.properties ?? {};
            if (
                !isNavigating &&
                externalCameraControl &&
                props.isUserInteraction === true &&
                props.animated !== true
            ) {
                homeFollowPausedRef.current = true;
            }

        }, [isNavigating, externalCameraControl]);

        const centerLng = center?.[0];
        const centerLat = center?.[1];
        const exploreCenterAppliedRef = useRef(false);
        useEffect(() => {
            if (isNavigating || !externalCameraControl) return;
            if (staticInitialCamera) return;
            if (centerLng == null || centerLat == null || !cameraRef.current) return;
            if (homeFollowPausedRef.current) return;

            const firstApply = !exploreCenterAppliedRef.current;
            exploreCenterAppliedRef.current = true;
            markHomeCommand([centerLng, centerLat], firstApply ? (zoom ?? 15) : undefined);
            cameraRef.current.setCamera({
                centerCoordinate: [centerLng, centerLat],
                ...(firstApply ? { zoomLevel: zoom ?? 15 } : {}),
                animationDuration: firstApply ? 0 : 500,
                animationMode: firstApply ? 'moveTo' : 'easeTo',
            });
        }, [centerLng, centerLat, isNavigating, externalCameraControl, staticInitialCamera]);

        useEffect(() => {
            if (isNavigating || !externalCameraControl) return;
            if (isHomeMap || freeCamera) return;
            if (!userLocation || !cameraRef.current) return;
            if (homeFollowPausedRef.current) return;

            const now = Date.now();
            if (now - lastHomeFollowPanAtRef.current < 400) return;

            const lastCenter = lastHomeFollowCenterRef.current;
            if (
                lastCenter &&
                calculateDistance(
                    lastCenter.lat,
                    lastCenter.lng,
                    userLocation.lat,
                    userLocation.lng,
                ) < HOME_FOLLOW_MIN_MOVE_METERS
            ) {
                return;
            }

            const cameraCenter = lastRegionCenterRef.current;
            if (
                cameraCenter &&
                calculateDistance(
                    cameraCenter[1],
                    cameraCenter[0],
                    userLocation.lat,
                    userLocation.lng,
                ) > HOME_FOLLOW_MAX_DRIFT_METERS
            ) {
                homeFollowPausedRef.current = true;
                return;
            }

            lastHomeFollowPanAtRef.current = now;
            lastHomeFollowCenterRef.current = { lat: userLocation.lat, lng: userLocation.lng };
            markHomeCommand([userLocation.lng, userLocation.lat]);

            cameraRef.current.setCamera({
                centerCoordinate: [userLocation.lng, userLocation.lat],
                animationDuration: 500,
                animationMode: 'easeTo',
            });
        }, [userLocation?.lat, userLocation?.lng, isNavigating, externalCameraControl, isHomeMap, freeCamera]);

        const applyRecenterFlyTo = useCallback(() => {
            if (!cameraRef.current || !userLocation) return false;

            cameraRef.current.setCamera({
                centerCoordinate: [userLocation.lng, userLocation.lat],
                padding: { paddingTop: navCameraPaddingTop(mapHeightRef.current) },
                zoomLevel: NAV_ZOOM,
                heading: userHeading || 0,
                pitch: 60,

                animationDuration: 600,
                animationMode: 'flyTo',
            });
            markAnimatedProgrammaticCamera();
            cameraResumeUntilRef.current = Date.now() + 700;
            lastSetZoom.current = NAV_ZOOM;

            lastRegionSnapshotRef.current = null;
            return true;
        }, [userLocation, userHeading, markAnimatedProgrammaticCamera]);

        const moveCamera = useCallback((center: [number, number], heading: number) => {
            if (userHasZoomedOut.current) {
                cameraSuspendedRef.current = true;
                return;
            }
            if (!cameraRef.current) {
                return;
            }
            const now = Date.now();
            if (now < cameraResumeUntilRef.current) {
                return;
            }
            if (cameraSuspendedRef.current) {
                cameraSuspendedRef.current = false;
                cameraResumeUntilRef.current = now + 600;
                cameraRef.current.setCamera({
                    centerCoordinate: center,
                    padding: { paddingTop: navCameraPaddingTop(mapHeightRef.current) },
                    heading,
                    pitch: 60,
                    zoomLevel: NAV_ZOOM,
                    animationDuration: 600,
                    animationMode: 'flyTo',
                });
                markAnimatedProgrammaticCamera();
                lastSetZoom.current = NAV_ZOOM;
                return;
            }
            cameraRef.current.setCamera({
                centerCoordinate: center,
                padding: { paddingTop: navCameraPaddingTop(mapHeightRef.current) },
                heading,
                pitch: 60,
                animationDuration: 0,
                animationMode: 'moveTo',
            });
        }, [markAnimatedProgrammaticCamera]);

        useEffect(() => {
            if (!mapStyleState || !pendingFlyTo.current) return;

            const pending = pendingFlyTo.current;
            const frameId = requestAnimationFrame(() => {
                if (cameraRef.current && pendingFlyTo.current === pending) {
                    applyFlyTo(pending);
                }
            });

            return () => cancelAnimationFrame(frameId);
        }, [mapStyleState, applyFlyTo]);

        const showStaticPuck = !isNavigating && !routeOrigin && !!showUserLocationMarker;

        // Preload images on mount
        useEffect(() => {
            const preloadImages = async () => {
                try {
                    await Promise.all([
                        Image.prefetch(Image.resolveAssetSource(MAPPIN_IMAGE).uri),
                        Image.prefetch(Image.resolveAssetSource(PIN_NORMAL_IMAGE).uri),
                        Image.prefetch(Image.resolveAssetSource(RED_PIN_IMAGE).uri),
                        Image.prefetch(Image.resolveAssetSource(WAYPOINT_PIN_IMAGE).uri),
                        Image.prefetch(Image.resolveAssetSource(MINIBUS_SELECTED_IMAGE).uri),
                        ...Object.values(EXPLORE_IMAGES).map(img =>
                            Image.prefetch(Image.resolveAssetSource(img).uri)
                        ),
                    ]);
                    await new Promise(resolve => setTimeout(resolve, 100));
                    setImagesLoaded(true);
                    setTimeout(() => setRenderKey(prev => prev + 1), 50);
                } catch (error) {
                    console.warn('Failed to preload some images:', error);
                    setImagesLoaded(true);
                }
            };

            const fallbackTimeout = setTimeout(() => {
                if (!imagesLoaded) {
                    setImagesLoaded(true);
                }
            }, 1000);

            preloadImages();

            return () => clearTimeout(fallbackTimeout);
        }, []);

        useEffect(() => {

            if (imagesLoaded && (showUserLocationMarker || isNavigating)) {
                setRenderKey(prev => prev + 1);
                setTimeout(() => setRenderKey(prev => prev + 1), 100);
            }
        }, [imagesLoaded, showUserLocationMarker, isNavigating]);

        useEffect(() => {
            if (imagesLoaded && mapStyleState) {
                setRenderKey(prev => prev + 1);
                setTimeout(() => setRenderKey(prev => prev + 1), 100);
                setTimeout(() => setRenderKey(prev => prev + 1), 300);
            }
        }, [mapStyleState, imagesLoaded]);


        useEffect(() => {
            if (imagesLoaded && explorePlaces && explorePlaces.length > 0) {
                setRenderKey(prev => prev + 1);
                setTimeout(() => setRenderKey(prev => prev + 1), 100);
                setTimeout(() => setRenderKey(prev => prev + 1), 200);
            }
        }, [explorePlaces, exploreCategory, imagesLoaded]);

        useEffect(() => {
            if (!imagesLoaded || !mapStyleState) return;
            const timer = setTimeout(() => setRenderKey(prev => prev + 1), 200);
            return () => clearTimeout(timer);
        }, [rules, visibleRules.length, markerLayerVisibility.rules, imagesLoaded, mapStyleState]);


        useEffect(() => {
            if (imagesLoaded && selectedLocation) {
                setRenderKey(prev => prev + 1);
                setTimeout(() => setRenderKey(prev => prev + 1), 100);
            }
        }, [selectedLocation, imagesLoaded]);

        useEffect(() => {
            if (selectedDestination) {
                const timer = setTimeout(() => setRenderKey(prev => prev + 1), 150);
                return () => clearTimeout(timer);
            }
        }, [selectedDestination]);

        useEffect(() => {
            if (routeOrigin) {
                const timer = setTimeout(() => setRenderKey(prev => prev + 1), 150);
                return () => clearTimeout(timer);
            }
        }, [routeOrigin]);

        useEffect(() => {
            if (imagesLoaded) {
                setRenderKey(prev => prev + 1);
            }
        }, [waypointMarkers]);

        const taxiStationsKey = useMemo(
            () => (taxiStations && taxiStations.length > 0
                ? taxiStations.map((s) => `${s.id}:${s.lat}:${s.lng}`).join(',')
                : null),
            [taxiStations]
        );
        const taxiStationsShape = useMemo(() => {
            if (!taxiStations || taxiStations.length === 0) return null;
            return {
                type: 'FeatureCollection' as const,
                features: taxiStations.map((station) => ({
                    type: 'Feature' as const,
                    properties: { name: station.name },
                    geometry: { type: 'Point' as const, coordinates: [station.lng, station.lat] },
                })),
            };
        }, [taxiStationsKey]);


        useEffect(() => {
            if (showUserLocationMarker && !isNavigating) {
                pulseAnim.setValue(1);
                const pulse = Animated.loop(
                    Animated.sequence([
                        Animated.timing(pulseAnim, {
                            toValue: 1.15,
                            duration: 1000,
                            useNativeDriver: true,
                        }),
                        Animated.timing(pulseAnim, {
                            toValue: 1,
                            duration: 1000,
                            useNativeDriver: true,
                        }),
                    ])
                );
                pulse.start();
                return () => {
                    pulse.stop();
                    pulseAnim.setValue(1);
                };
            } else {
                pulseAnim.setValue(1);
            }
        }, [showUserLocationMarker, isNavigating, pulseAnim, mapStyleState]);

        const stableUserLocation = useRef<[number, number] | null>(null);
        useEffect(() => {
            if (userLocation) {
                stableUserLocation.current = [userLocation.lng, userLocation.lat];
            }
        }, [userLocation?.lat, userLocation?.lng]);

        useLayoutEffect(() => {
            if (isNavigating && !hasStartedNavigating.current) {
                hasStartedNavigating.current = true;
                userHasZoomedOut.current = false;
                setNavCameraFree(false);
                cameraSuspendedRef.current = false;
                cameraResumeUntilRef.current = 0;

                navGraceUntilRef.current = Date.now() + 2500;
                lastSetZoom.current = NAV_ZOOM;
                lastRegionSnapshotRef.current = null;
                markAnimatedProgrammaticCamera();
                if (cameraRef.current && userLocation) {
                    cameraRef.current.setCamera({
                        centerCoordinate: [userLocation.lng, userLocation.lat],
                        padding: { paddingTop: navCameraPaddingTop(mapHeightRef.current) },
                        zoomLevel: NAV_ZOOM,
                        animationDuration: 500,
                        pitch: 60,
                        heading: userHeading || 0,
                        animationMode: 'flyTo',
                    });
                    markAnimatedProgrammaticCamera();
                }
            } else if (!isNavigating && hasStartedNavigating.current) {
                hasStartedNavigating.current = false;
                lastFreeCameraRef.current = null;
                lastRegionCenterRef.current = null;

                homeFollowPausedRef.current = false;
                lastHomeFollowCenterRef.current = null;
                commandedCenterRef.current = null;
                prevCommandedCenterRef.current = null;
                commandedZoomRef.current = null;
                lastKnownZoomRef.current = null;
                lastSettledCenterRef.current = null;
                pendingHomeResetRef.current = true;
                userHasZoomedOut.current = false;
                setNavCameraFree(false);
                navGraceUntilRef.current = 0;
                lastRegionSnapshotRef.current = null;
            }
        }, [isNavigating, userLocation, userHeading, markAnimatedProgrammaticCamera]);

        useEffect(() => {
            if (!pendingHomeResetRef.current) return;
            if (isNavigating || !externalCameraControl) return;
            if (!userLocation) return;

            const applyHomeReset = () => {
                if (!cameraRef.current || !pendingHomeResetRef.current) return false;
                pendingHomeResetRef.current = false;
                markHomeCommand([userLocation.lng, userLocation.lat], zoom ?? 15);
                lastHomeFollowCenterRef.current = { lat: userLocation.lat, lng: userLocation.lng };
                cameraRef.current.setCamera({
                    centerCoordinate: [userLocation.lng, userLocation.lat],
                    zoomLevel: zoom ?? 15,
                    heading: 0,
                    pitch: 0,
                    padding: { paddingTop: 0 },
                    animationDuration: 400,
                    animationMode: 'easeTo',
                });
                return true;
            };

            if (applyHomeReset()) return;

            const frameId = requestAnimationFrame(() => {
                if (!applyHomeReset()) {
                    setTimeout(applyHomeReset, 150);
                }
            });
            return () => cancelAnimationFrame(frameId);
        }, [isNavigating, externalCameraControl, userLocation?.lat, userLocation?.lng, zoom]);

        useLayoutEffect(() => {
            if (!pendingRecenterRef.current || navCameraFree || !isNavigating) return;

            if (applyRecenterFlyTo()) {
                pendingRecenterRef.current = false;
                return;
            }

            const frameId = requestAnimationFrame(() => {
                if (pendingRecenterRef.current && applyRecenterFlyTo()) {
                    pendingRecenterRef.current = false;
                }
            });
            return () => cancelAnimationFrame(frameId);
        }, [navCameraFree, isNavigating, applyRecenterFlyTo]);

        const NAV_LINE_COLOR = '#4285F4';
        const defaultRouteStyle = {
            color: routeStyle?.color || '#1D4ED8',
            width: 9,
            navWidth: 16,
            opacity: routeStyle?.opacity || 0.8,
        };

        // the dash mode is baked into the data, not just the layer style: flipping only the
        // style leaves the already-painted line untouched until a camera change invalidates
        // the tile (which is why zooming out "fixes" it). changing the shape makes the source
        // re-upload and repaint immediately.
        const previewRouteShape = useMemo(() => {
            if (isNavigating || !routeGeoJSON || segmentedRoutes) return EMPTY_FEATURE_COLLECTION;
            return {
                ...routeGeoJSON,
                properties: {
                    ...(routeGeoJSON.properties ?? {}),
                    lineMode: routeStyle?.isDotted ? 'dotted' : 'solid',
                },
            };
        }, [isNavigating, routeGeoJSON, segmentedRoutes, routeStyle?.isDotted]);

        const hasAlternativeRoutes = !isNavigating
            && !segmentedRoutes
            && !routeStyle?.isDotted
            && Array.isArray(alternativeRoutesGeoJSON)
            && alternativeRoutesGeoJSON.length > 0;

        const alternativeRoutesShape = useMemo(() => (
            hasAlternativeRoutes
                ? {
                    type: 'FeatureCollection' as const,
                    features: alternativeRoutesGeoJSON!.map((alt: any) => (
                        alt?.type === 'FeatureCollection' ? alt.features ?? [] : [alt]
                    )).flat(),
                }
                : EMPTY_FEATURE_COLLECTION
        ), [hasAlternativeRoutes, alternativeRoutesGeoJSON]);

        useImperativeHandle(ref, () => ({
            flyTo: (options: any) => {
                applyFlyTo(options);
            },
            /**
             * Rebuild the Camera in place, keeping the current view. Returning to a screen
             * whose map stayed mounted under another map leaves the native camera unable to
             * hold user gestures; remounting it (the one thing recenterOnce does that fixes
             * this) clears that without moving the view.
             */
            refreshCamera: () => {
                // everything recenterOnce does, except the camera move: pausing follow is what
                // stops the explore-centre effect re-applying the center prop, and the epoch
                // bump rebuilds the Camera. together they are what the recentre button does
                // that makes the map controllable again.
                homeFollowPausedRef.current = true;
                pendingFlyTo.current = null;
                flyToTokenRef.current += 1;

                const settledCenter = lastRegionCenterRef.current;
                const settledZoom = lastKnownZoomRef.current;
                const target = settledCenter && settledZoom !== null
                    ? { center: settledCenter, zoom: settledZoom }
                    : lastFreeCameraRef.current;

                if (target) {
                    // the remounted Camera reads defaultSettings from this, so it comes back
                    // exactly where the user left it instead of jumping
                    lastFreeCameraRef.current = target;
                    setHomeCameraTarget(target);
                    markHomeCommand(target.center, target.zoom);
                }

                setHomeCameraEpoch((current) => current + 1);

                // the remount alone was not enough: issue a real setCamera at the current
                // position after the new Camera mounts, which is the part of recenterOnce
                // that actually makes the map controllable again. no visible movement.
                if (target) {
                    requestAnimationFrame(() => {
                        cameraRef.current?.setCamera({
                            centerCoordinate: target.center,
                            zoomLevel: target.zoom,
                            animationDuration: 0,
                            animationMode: 'moveTo',
                        });
                    });
                }

            },
            recenterOnce: (options: { center: [number, number]; zoom?: number }) => {
                homeFollowPausedRef.current = true;
                pendingFlyTo.current = null;
                flyToTokenRef.current += 1;
                lastFreeCameraRef.current = {
                    center: options.center,
                    zoom: options.zoom ?? lastKnownZoomRef.current ?? (zoom ?? 15),
                };
                setHomeCameraTarget(lastFreeCameraRef.current);
                markHomeCommand(options.center, options.zoom);
                setHomeCameraEpoch((current) => current + 1);
            },
            resumeFollow: () => {
                homeFollowPausedRef.current = false;
                lastHomeFollowCenterRef.current = null;

                lastRegionCenterRef.current = null;
                commandedCenterRef.current = null;
                prevCommandedCenterRef.current = null;
                commandedZoomRef.current = null;
                lastSettledCenterRef.current = null;
            },
            recenterNavigation: () => {
                userHasZoomedOut.current = false;
                cameraSuspendedRef.current = false;
                cameraResumeUntilRef.current = 0;
                navGraceUntilRef.current = Date.now() + 1500;
                lastSetZoom.current = NAV_ZOOM;

                lastRegionSnapshotRef.current = null;
                markAnimatedProgrammaticCamera();
                pendingRecenterRef.current = true;
                setNavCameraFree(false);
            },
            addImageMarker: () => ({ marker: {} }),
            addMarker: () => ({}),
            clearMarkers: () => { },
            getMarkers: () => [],

            getMapInstance: () => mapViewRef.current,
            startFence: () => { },
            addFencePoint: () => { },
            closeFence: () => { },
            clearFence: () => { },
            clearAllFences: () => { },
            getFences: () => [],
            getFencePoints: () => [],

            isDrawingFence: () => false,
            addPath: () => { },
            clearPaths: () => { },

            addClusteredMarker: () => { },
            clearClusteredMarkers: () => { },
            updateClustering: () => { },
            setClusteringEnabled: () => { },
            setClusterImage: () => { },
            geocode: async () => [],
            reverseGeocode: async () => [],
            getDirections: async () => null,

            convertDirectionsToNavigationRoute: () => null,
            displayRoute: () => { },
            clearRoute: () => { },
            getCurrentRoute: () => null,
            getRouteSummary: () => null,
            updateRouteStyle: () => { },
            startNavigation: () => { },
            stopNavigation: () => { },
            updateNavigationPosition: () => { },
            getNavigationState: () => null,
            isNavigating: () => false,
        }), [applyFlyTo, markAnimatedProgrammaticCamera, markHomeCommand, NAV_ZOOM, zoom]);

        useEffect(() => {
            if (mapStyleJson) {
                setMapStyleState(ensureStyleBackgroundLayer(mapStyleJson as Record<string, any>, isDark));
                return;
            }

            async function processStyle() {
                try {
                    let styleJson: any;

                    if (mapStyleUrl) {
                        const response = await fetch(mapStyleUrl);
                        if (!response.ok) throw new Error(`Failed to fetch style JSON: ${response.status}`);
                        styleJson = await response.json();
                    } else {
                        const defaultStyleUrl = `https://tiles.gebeta.app/styles/standard/style.json?device=mobile&apiKey=${apiKey}`;
                        const response = await fetch(defaultStyleUrl);
                        if (!response.ok) throw new Error(`Failed to fetch default style JSON: ${response.status}`);
                        styleJson = await response.json();
                    }

                    if (styleJson.sources) {
                        for (const sourceKey of Object.keys(styleJson.sources)) {
                            const source = styleJson.sources[sourceKey];
                            if (Array.isArray(source.tiles)) {
                                source.tiles = source.tiles.map((tileUrl: string) => {
                                    const separator = tileUrl.includes('?') ? '&' : '?';
                                    return `${tileUrl}${separator}apiKey=${apiKey}`;
                                });
                            }
                        }
                    }

                    setMapStyleState(ensureStyleBackgroundLayer(styleJson, isDark));
                } catch (error) {
                    console.error("Error loading style JSON:", error);
                    Alert.alert("Map Style Load Error", String(error));
                }
            }

            processStyle();
        }, [apiKey, mapStyleUrl, mapStyleJson, isDark]);

        useLayoutEffect(() => {
            if (!center || isNavigating || !mapStyleState || externalCameraControl) return;

            applyInitialCamera();
            const frameId = requestAnimationFrame(applyInitialCamera);
            const retryId = setTimeout(applyInitialCamera, 150);

            return () => {
                cancelAnimationFrame(frameId);
                clearTimeout(retryId);
            };
        }, [center?.[0], center?.[1], zoom, isNavigating, mapStyleState, applyInitialCamera, externalCameraControl]);

        const handleStyleLoad = useCallback(() => {
            const settledCenter = lastRegionCenterRef.current;
            const settledZoom = lastKnownZoomRef.current;
            if (
                externalCameraControl &&
                pendingStyleRestoreRef.current &&
                settledCenter &&
                settledZoom !== null &&
                Date.now() - lastFlyToAtRef.current > 2500
            ) {
                markHomeCommand(settledCenter, settledZoom);
                cameraRef.current?.setCamera({
                    centerCoordinate: settledCenter,
                    zoomLevel: settledZoom,
                    animationDuration: 0,
                    animationMode: 'moveTo',
                });
            }
            pendingStyleRestoreRef.current = false;
        }, [externalCameraControl, markHomeCommand]);

        const handleMapLoad = useCallback(() => {
            if (!externalCameraControl) {
                applyInitialCamera();
            }
            if (pendingFlyTo.current) {
                applyFlyTo(pendingFlyTo.current);
            }
            onMapLoaded?.();

            if (userLocation && showUserLocationMarker && !isNavigating && !routeOrigin) {
                setRenderKey(prev => prev + 1);
                setTimeout(() => setRenderKey(prev => prev + 1), 100);
                setTimeout(() => setRenderKey(prev => prev + 1), 300);
            }
        }, [
            externalCameraControl,
            applyInitialCamera,
            applyFlyTo,
            onMapLoaded,
            userLocation,
            showUserLocationMarker,
            isNavigating,
            routeOrigin,
        ]);



        const showFollowCamera = isNavigating && !navCameraFree;
        const showExploreCamera = !isNavigating && externalCameraControl;
        const cameraDefaultCenter = useMemo<[number, number] | undefined>(
            () => centerLng == null || centerLat == null ? undefined : [centerLng, centerLat],
            [centerLng, centerLat],
        );
        const exploreCameraTarget = homeCameraTarget || lastFreeCameraRef.current;
        const exploreCameraDefaultSettings = useMemo(() => ({
            centerCoordinate: showExploreCamera && exploreCameraTarget
                ? exploreCameraTarget.center
                : cameraDefaultCenter,
            zoomLevel: exploreCameraTarget?.zoom ?? (zoom ?? 15),
        }), [
            cameraDefaultCenter,
            zoom,
            showExploreCamera,
            exploreCameraTarget,
        ]);
        const followCameraDefaultSettings = useMemo(() => ({
            centerCoordinate: cameraDefaultCenter,
            zoomLevel: NAV_ZOOM,
            pitch: 60,
            heading: userHeading || 0,
        }), [
            cameraDefaultCenter,
            NAV_ZOOM,
            userHeading,
        ]);
        const cameraDefaultSettings = showFollowCamera
            ? followCameraDefaultSettings
            : exploreCameraDefaultSettings;

        useEffect(() => {
            if (!homeCameraTarget) return;
            const frameId = requestAnimationFrame(() => setHomeCameraTarget(null));
            return () => cancelAnimationFrame(frameId);
        }, [homeCameraTarget]);

        if (!mapStyleState || !center) {
            return (
                <View style={[styles.container, { backgroundColor: getTileLoadingBackground(isDark) }]} />
            );
        }

        return (
            <View style={styles.container}>
                <View
                    style={[styles.mapSurface, { backgroundColor: getTileLoadingBackground(isDark) }]}
                    onLayout={(e) => {
                        const h = e.nativeEvent.layout.height;
                        mapHeightRef.current = h;
                        setMapHeight(h);
                    }}
                >
                    <MapLibreGL.MapView
                        ref={mapViewRef}
                        style={styles.mapSurface}
                        mapStyle={mapStyleState}
                        attributionEnabled={false}
                        logoEnabled={false}
                        compassEnabled={!isNavigating || navCameraFree}
                        scrollEnabled={true}
                        zoomEnabled={true}
                        rotateEnabled={true}
                        pitchEnabled={true}
                        compassViewPosition={1}
                        compassViewMargins={{ x: isHomeMap ? 10 : 16, y: isHomeMap ? 240 : 130 }}
                        {...({ onTouchStart: handleMapTouchForUnlock } as Record<string, unknown>)}
                        onRegionWillChange={handleRegionWillChange}
                        onPress={async (e) => {
                            const coords = (e.geometry as any)?.coordinates;
                            if (!coords || !onMapClick) return;
                            let features: any[] = [];
                            const screenPointX = (e.properties as any)?.screenPointX;
                            const screenPointY = (e.properties as any)?.screenPointY;
                            if (
                                mapViewRef.current &&
                                typeof screenPointX === 'number' &&
                                typeof screenPointY === 'number'
                            ) {
                                try {
                                    const fc = await mapViewRef.current.queryRenderedFeaturesAtPoint(
                                        [screenPointX, screenPointY],
                                        undefined,
                                        []
                                    );
                                    features = fc?.features ?? [];
                                } catch {
                                }
                            }

                            onMapClick([coords[0], coords[1]], { ...e, features });
                        }}
                        onRegionIsChanging={(e: any) => {
                            lastRegionEventAtRef.current = Date.now();
                            const c = e.geometry?.coordinates;
                            if (Array.isArray(c)) {
                                lastRegionCenterRef.current = [c[0], c[1]];
                            }
                            const zoomLevel = e.properties?.zoomLevel ?? e.properties?.zoom;

                            if (isNavigating && navCameraFree) {
                                if (Array.isArray(c) && zoomLevel !== undefined) {
                                    lastFreeCameraRef.current = { center: [c[0], c[1]], zoom: zoomLevel };
                                }
                                return;
                            }

                            if (!isNavigating && externalCameraControl) {
                                if (
                                    Array.isArray(c) &&
                                    zoomLevel !== undefined &&
                                    Date.now() - lastFlyToAtRef.current > 2500
                                ) {
                                    lastFreeCameraRef.current = { center: [c[0], c[1]], zoom: zoomLevel };
                                }
                            }

                            if (isNavigating && !navCameraFree) {
                                handleNavigationGestureUnlock(e, 'region-is-changing');
                            }
                        }}
                        onRegionDidChange={(e: any) => {
                            updateMarkerViewport(e);

                            const centerCoords = e.geometry?.coordinates;
                            if (Array.isArray(centerCoords)) {
                                lastRegionCenterRef.current = [centerCoords[0], centerCoords[1]];
                                onRegionCenterChange?.([centerCoords[0], centerCoords[1]]);
                            }

                            if (isNavigating || !externalCameraControl) return;

                            const props = e.properties;
                            const zoomLevel = props?.zoomLevel ?? props?.zoom;

                            if (Array.isArray(centerCoords) && zoomLevel !== undefined) {
                                const accepted = ([
                                    commandedCenterRef.current,
                                    prevCommandedCenterRef.current,
                                ].filter(Boolean) as [number, number][]);
                                if (accepted.length === 0 && lastSettledCenterRef.current) {
                                    accepted.push(lastSettledCenterRef.current);
                                }
                                if (accepted.length > 0) {
                                    const metersPerPixel =
                                        (156543.03392 *
                                            Math.cos((centerCoords[1] * Math.PI) / 180)) /
                                        Math.pow(2, zoomLevel);
                                    const offsetPixels = Math.min(
                                        ...accepted.map((commanded) =>
                                            calculateDistance(
                                                commanded[1],
                                                commanded[0],
                                                centerCoords[1],
                                                centerCoords[0],
                                            ) / metersPerPixel,
                                        ),
                                    );
                                    if (offsetPixels > HOME_PAN_PIXEL_TOLERANCE) {
                                        homeFollowPausedRef.current = true;
                                    }
                                }

                                const expectedZoom =
                                    commandedZoomRef.current ?? lastKnownZoomRef.current;
                                if (
                                    expectedZoom !== null &&
                                    Math.abs(zoomLevel - expectedZoom) > HOME_ZOOM_TOLERANCE
                                ) {
                                    homeFollowPausedRef.current = true;
                                }
                                lastKnownZoomRef.current = zoomLevel;
                                commandedZoomRef.current = null;
                                lastSettledCenterRef.current = [centerCoords[0], centerCoords[1]];
                            }

                            if (Date.now() - lastFlyToAtRef.current < 2500) return;

                            if (Array.isArray(centerCoords) && zoomLevel !== undefined) {
                                lastFreeCameraRef.current = {
                                    center: [centerCoords[0], centerCoords[1]],
                                    zoom: zoomLevel,
                                };
                            }
                        }}
                        onDidFinishLoadingMap={handleMapLoad}
                        onDidFinishLoadingStyle={handleStyleLoad}
                    >
                        {(showFollowCamera || showExploreCamera) && (
                            <MapLibreGL.Camera
                                key={showFollowCamera
                                    ? 'nav-follow-camera'
                                    : `explore-camera-${homeCameraEpoch}`}
                                ref={cameraRef}
                                maxBounds={undefined}
                                followUserLocation={isHomeMap || freeCamera ? false : undefined}
                                defaultSettings={cameraDefaultSettings}
                            />
                        )}

                        <MapLibreGL.Images images={{ navPuck: MAPPIN_IMAGE, navArrowHead: NAV_ARROWHEAD_IMAGE, taxiStation: TAXI_MARKER_IMAGE }} />


                        {!(isNavigating && isTaxiNavigation) && segmentedRoutes && segmentedRoutes.length > 0 && segmentedRoutes.map((route) => {
                            if (route.geoJSON.geometry.coordinates.length === 0) return null;
                            const isCurrentSegment = currentTaxiSegmentIndex === route.segmentIndex;
                            const lineStyle: any = {
                                lineColor: route.isWalking ? '#EF4444' : '#3B82F6',
                                lineWidth: route.isWalking ? 5 : 7,
                                lineOpacity: isCurrentSegment ? 1 : 0.7,
                                lineCap: 'round',
                                lineJoin: 'round',
                            };
                            if (route.isWalking) {
                                lineStyle.lineDasharray = WALK_DASH_PATTERN;
                            }
                            return (
                                <MapLibreGL.ShapeSource
                                    key={`segment-static-${route.segmentIndex}-${route.isWalking ? foregroundEpoch : 0}`}
                                    id={`segment-${route.segmentIndex}-source`}
                                    shape={route.geoJSON}
                                >
                                    <MapLibreGL.LineLayer
                                        id={`segment-${route.segmentIndex}-layer`}
                                        style={lineStyle}
                                    />
                                </MapLibreGL.ShapeSource>
                            );
                        })}


                        <MapLibreGL.ShapeSource
                            id="route-alternative-source"
                            shape={alternativeRoutesShape}
                        >
                            <MapLibreGL.LineLayer
                                id="route-alternative-layer"
                                style={{
                                    lineColor: colors.primary.main,
                                    lineWidth: 5,
                                    lineOpacity: 0.5,
                                    lineCap: 'round',
                                    lineJoin: 'round',
                                }}
                            />
                        </MapLibreGL.ShapeSource>

                        {hasAlternativeRoutes && routeTimeLabels?.map((item, i) => (
                            <MapLibreGL.PointAnnotation
                                key={`route-time-label-${i}`}
                                id={`route-time-label-${i}`}
                                coordinate={item.coordinate}
                                anchor={{ x: 0.5, y: 1 }}
                            >
                                <View collapsable={false} style={{ width: 120, height: 44, alignItems: 'center', justifyContent: 'flex-end' }}>
                                    <View
                                        collapsable={false}
                                        style={{
                                            backgroundColor: '#FFFFFF',
                                            paddingHorizontal: 10,
                                            paddingVertical: 5,
                                            borderRadius: 14,
                                            borderWidth: 1,
                                            borderColor: item.isPrimary ? colors.primary.main : '#D1D5DB',
                                            shadowColor: '#000',
                                            shadowOpacity: 0.2,
                                            shadowRadius: 4,
                                            shadowOffset: { width: 0, height: 1 },
                                            elevation: 3,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: '#374151',
                                                fontSize: 12,
                                                fontWeight: '700',
                                            }}
                                            numberOfLines={1}
                                        >
                                            {item.label}
                                        </Text>
                                    </View>
                                    <View
                                        style={{
                                            width: 0,
                                            height: 0,
                                            borderLeftWidth: 5,
                                            borderRightWidth: 5,
                                            borderTopWidth: 6,
                                            borderLeftColor: 'transparent',
                                            borderRightColor: 'transparent',
                                            borderTopColor: item.isPrimary ? colors.primary.main : '#D1D5DB',
                                            marginTop: -1,
                                        }}
                                    />
                                </View>
                            </MapLibreGL.PointAnnotation>
                        ))}

                        <MapLibreGL.ShapeSource
                            key={`route-preview-source-${routeStyle?.isDotted ? 'dotted' : 'solid'}`}
                            id={`route-preview-source-${routeStyle?.isDotted ? 'dotted' : 'solid'}`}
                            shape={previewRouteShape}
                        >
                            <MapLibreGL.LineLayer
                                key={`route-preview-layer-${routeStyle?.isDotted ? 'dotted' : 'solid'}`}
                                id={`route-preview-layer-${routeStyle?.isDotted ? 'dotted' : 'solid'}`}
                                style={{
                                    lineColor: defaultRouteStyle.color,
                                    lineWidth: routeStyle?.isDotted ? 6 : defaultRouteStyle.width,
                                    lineOpacity: activeSegmentGeoJSON ? 0.35 : (routeStyle?.isDotted ? 1 : defaultRouteStyle.opacity),
                                    lineCap: 'round',
                                    lineJoin: 'round',
                                    ...(routeStyle?.isDotted
                                        ? { lineDasharray: WALK_DASH_PATTERN }
                                        : { lineDasharray: [1, 0] }),
                                }}
                            />
                        </MapLibreGL.ShapeSource>

                        {!isNavigating && activeSegmentGeoJSON && (
                            <MapLibreGL.ShapeSource
                                key="route-active-segment-source"
                                id="route-active-segment-source"
                                shape={activeSegmentGeoJSON}
                            >
                                <MapLibreGL.LineLayer
                                    id="route-active-segment-layer"
                                    style={{
                                        lineColor: '#2563EB',
                                        lineWidth: 10,
                                        lineOpacity: 1,
                                        lineCap: 'round',
                                        lineJoin: 'round',
                                    }}
                                />
                            </MapLibreGL.ShapeSource>
                        )}

                        {!isNavigating && previewStepLocation && imagesLoaded && (
                            <MapLibreGL.PointAnnotation
                                key={`preview-step-${previewStepLocation.lng}-${previewStepLocation.lat}-${renderKey}`}
                                id="preview-step-marker"
                                coordinate={[previewStepLocation.lng, previewStepLocation.lat]}
                                anchor={{ x: 0.5, y: 0.5 }}
                            >
                                <View style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 10,
                                    backgroundColor: '#2563EB',
                                    borderWidth: 3,
                                    borderColor: '#FFFFFF',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 4,
                                    elevation: 6,
                                }} />
                            </MapLibreGL.PointAnnotation>
                        )}

                        {taxiRouteSegments && taxiRouteSegments.map((segment, index) => {
                            const taxiRouteGeoJSON = {
                                type: 'Feature' as const,
                                properties: {},
                                geometry: {
                                    type: 'LineString' as const,
                                    coordinates: segment.coordinates
                                }
                            };
                            return (
                                <MapLibreGL.ShapeSource
                                    key={`taxi-segment-${index}`}
                                    id={`taxi-segment-${index}-source`}
                                    shape={taxiRouteGeoJSON}
                                >
                                    <MapLibreGL.LineLayer
                                        id={`taxi-segment-${index}-layer`}
                                        style={{
                                            lineColor: colors.primary.main,
                                            lineWidth: 6,
                                            lineOpacity: 0.8,
                                            lineCap: 'round',
                                            lineJoin: 'round',
                                        }}
                                    />
                                </MapLibreGL.ShapeSource>
                            );
                        })}

                        {taxiWalkRoutes && taxiWalkRoutes.map((route, index) => {
                            try {
                                const mapCoords = route.coordinates
                                    ?? decodePolyline(route.polyline, 6).map(([lat, lng]) => [lng, lat] as [number, number]);

                                if (mapCoords.length < 2) return null;


                                const color = isTaxiNavigation ? '#3B82F6' : '#EF4444';

                                const walkGeoJSON = {
                                    type: 'Feature' as const,
                                    properties: {},
                                    geometry: {
                                        type: 'LineString' as const,
                                        coordinates: mapCoords
                                    }
                                };
                                return (
                                    <MapLibreGL.ShapeSource
                                        key={`taxi-walk-${route.type}-${index}-${foregroundEpoch}`}
                                        id={`taxi-walk-${route.type}-${index}-source`}
                                        shape={walkGeoJSON}
                                    >
                                        <MapLibreGL.LineLayer
                                            id={`taxi-walk-${route.type}-${index}-layer`}
                                            style={{
                                                lineColor: color,
                                                lineWidth: isTaxiNavigation ? 4 : 8,
                                                lineOpacity: 1,
                                                lineDasharray: [2, 2], //dotted line
                                                lineCap: 'round',
                                            }}
                                        />
                                    </MapLibreGL.ShapeSource>
                                );
                            } catch (error) {
                                console.error(`[GebetaMap] Error decoding ${route.type} walk route:`, error);
                                return null;
                            }
                        })}

                        {routeGeoJSON && selectedDestination && (() => {
                            const routeCoords = routeGeoJSON.geometry.coordinates;
                            const lastRoutePoint = routeCoords[routeCoords.length - 1];
                            const destinationPoint = [selectedDestination.longitude, selectedDestination.latitude];

                            const walkingPathGeoJSON = {
                                type: 'Feature' as const,
                                properties: {},
                                geometry: {
                                    type: 'LineString' as const,
                                    coordinates: [lastRoutePoint, destinationPoint]
                                }
                            };

                            return (
                                <MapLibreGL.ShapeSource
                                    key="walking-path"
                                    id="walking-path-source"
                                    shape={walkingPathGeoJSON}
                                >
                                    <MapLibreGL.LineLayer
                                        id="walking-path-layer"
                                        style={{
                                            lineColor: isNavigating ? '#888888' : '#666666',
                                            lineWidth: isNavigating ? 5 : 4,
                                            lineOpacity: isNavigating ? 0.8 : 0.7,
                                            lineDasharray: [0.5, 2],
                                            lineCap: 'round',
                                        }}
                                    />
                                </MapLibreGL.ShapeSource>
                            );
                        })()}

                        {/* bounding box for neighborhood */}
                        {boundingBox && (() => {
                            const boxGeoJSON = {
                                type: 'Feature' as const,
                                properties: {},
                                geometry: {
                                    type: 'Polygon' as const,
                                    coordinates: [[
                                        [boundingBox.west, boundingBox.north],
                                        [boundingBox.east, boundingBox.north],
                                        [boundingBox.east, boundingBox.south],
                                        [boundingBox.west, boundingBox.south],
                                        [boundingBox.west, boundingBox.north],
                                    ]]
                                }
                            };

                            return (
                                <MapLibreGL.ShapeSource
                                    key="bounding-box"
                                    id="bounding-box-source"
                                    shape={boxGeoJSON}
                                >
                                    <MapLibreGL.FillLayer
                                        id="bounding-box-fill"
                                        style={{
                                            fillColor: colors.primary.main,
                                            fillOpacity: 0.15,
                                        }}
                                    />
                                    <MapLibreGL.LineLayer
                                        id="bounding-box-line"
                                        style={{
                                            lineColor: colors.primary.main,
                                            lineWidth: 2,
                                            lineOpacity: 1,
                                        }}
                                    />
                                </MapLibreGL.ShapeSource>
                            );
                        })()}

                        <AnimatedNavLayer
                            userLocation={userLocation ?? null}
                            isNavigating={!!isNavigating}
                            routeGeoJSON={routeGeoJSON ?? null}
                            routeLineStyle={{
                                lineColor: NAV_LINE_COLOR,
                                lineWidth: routeStyle?.isDotted ? 6 : defaultRouteStyle.navWidth,
                                lineOpacity: 0.6,
                                lineCap: 'round',
                                lineJoin: 'round',
                                ...(routeStyle?.isDotted && { lineDasharray: WALK_DASH_PATTERN }),
                            }}
                            segmentedRoutes={segmentedRoutes}
                            isTaxiNavigation={!!isTaxiNavigation}
                            currentTaxiSegmentIndex={currentTaxiSegmentIndex}
                            imagesLoaded={!!imagesLoaded}
                            moveCamera={moveCamera}
                            cameraLocked={!!showFollowCamera}
                            maneuvers={maneuvers}
                        />

                        {!isNavigating && routeOrigin && imagesLoaded && (
                            <MapLibreGL.PointAnnotation
                                key={`route-origin-${routeOrigin.latitude}-${routeOrigin.longitude}-${renderKey}`}
                                id="route-origin-marker"
                                coordinate={[routeOrigin.longitude, routeOrigin.latitude]}
                                anchor={{ x: 0.5, y: 1 }}
                            >
                                <View style={{
                                    width: 50,
                                    height: 50,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <Image
                                        source={PIN_NORMAL_IMAGE}
                                        style={{ width: 40, height: 40 }}
                                        resizeMode="contain"
                                    />
                                </View>
                            </MapLibreGL.PointAnnotation>
                        )}

                        {showStaticPuck && (
                            <MapLibreGL.UserLocation
                                renderMode="native"
                                androidRenderMode="compass"
                                showsUserHeadingIndicator
                                onUpdate={(loc: any) => {
                                    const coords = loc?.coords;
                                    if (coords && onUserLocationUpdate) {
                                        onUserLocationUpdate({ lat: coords.latitude, lng: coords.longitude });
                                    }
                                }}
                            />
                        )}

                        {imagesLoaded && visibleIncidents.map((incident) => {
                            const iconPair = INCIDENT_SVG_ICONS[incident.type.name as keyof typeof INCIDENT_SVG_ICONS];
                            const IncidentSvgIcon = iconPair ? (isDark ? iconPair.dark : iconPair.light) : null;

                            return (
                                <MapLibreGL.PointAnnotation
                                    key={`incident-${incident.id}-${renderKey}`}
                                    id={`incident-${incident.id}`}
                                    coordinate={[incident.lng, incident.lat]}
                                    onSelected={() => {
                                        showToast(`Incident: ${incident.type.label || incident.type.name}`);
                                    }}
                                >
                                    <View style={{
                                        width: 28,
                                        height: 28,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        {IncidentSvgIcon ? (
                                            <IncidentSvgIcon width={24} height={24} />
                                        ) : (
                                            <Ionicons name="alert-circle" size={22} color="#F97316" />
                                        )}
                                    </View>
                                </MapLibreGL.PointAnnotation>
                            );
                        })}

                        {imagesLoaded && mapStyleState && !isNavigating && visibleRules.map((rule) => {
                            return (
                                <MapLibreGL.PointAnnotation
                                    key={`rule-${rule.id}-${renderKey}`}
                                    id={`rule-${rule.id}`}
                                    coordinate={[rule.lng, rule.lat]}
                                >
                                    <View style={{
                                        width: 28,
                                        height: 28,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        {rule.type.img ? (
                                            <Image
                                                source={{ uri: rule.type.img }}
                                                style={{
                                                    width: 24,
                                                    height: 24,
                                                }}
                                                resizeMode="contain"
                                            />
                                        ) : (
                                            <Ionicons name="warning" size={22} color="#EF4444" />
                                        )}
                                    </View>
                                </MapLibreGL.PointAnnotation>
                            );
                        })}

                        {selectedLocation && imagesLoaded && (
                            <MapLibreGL.PointAnnotation
                                key={`selected-location-${renderKey}`}
                                id="selected-location-marker"
                                coordinate={[selectedLocation.lng, selectedLocation.lat]}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <View style={{
                                        position: 'absolute',
                                        width: 40,
                                        height: 40,
                                        borderRadius: 20,
                                        backgroundColor: '#EF4444',
                                        opacity: 0.3,
                                    }} />
                                    <View style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: 10,
                                        backgroundColor: '#EF4444',
                                        borderWidth: 3,
                                        borderColor: '#FFFFFF',
                                    }} />
                                </View>
                            </MapLibreGL.PointAnnotation>
                        )}

                        {clickedLocation && imagesLoaded && (
                            <MapLibreGL.PointAnnotation
                                key={`clicked-location-${renderKey}`}
                                id="clicked-location-marker"
                                coordinate={[clickedLocation.lng, clickedLocation.lat]}
                                anchor={{ x: 0.5, y: 1 }}
                            >
                                <View
                                    style={{
                                        width: 28,
                                        height: 28,
                                        alignItems: 'center',
                                        justifyContent: 'flex-end',
                                    }}
                                >
                                    <Image
                                        source={RED_PIN_IMAGE}
                                        style={{
                                            width: 28,
                                            height: 28,
                                        }}
                                        resizeMode="contain"
                                    />
                                </View>
                            </MapLibreGL.PointAnnotation>
                        )}

                        {waypointMarkers && imagesLoaded && waypointMarkers.map((wp, index) => (
                            <MapLibreGL.PointAnnotation
                                key={`waypoint-${index}-${wp.latitude}-${wp.longitude}-${renderKey}`}
                                id={`waypoint-marker-${index}`}
                                coordinate={[wp.longitude, wp.latitude]}
                                anchor={{ x: 0.5, y: 1 }}
                            >
                                <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'flex-end' }}>
                                    <Image
                                        source={WAYPOINT_PIN_IMAGE}
                                        style={{ width: 28, height: 28 }}
                                        resizeMode="contain"
                                    />
                                </View>
                            </MapLibreGL.PointAnnotation>
                        ))}

                        {selectedDestination && (
                            <MapLibreGL.PointAnnotation
                                key={`destination-${selectedDestination.latitude}-${selectedDestination.longitude}-${renderKey}`}
                                id="destination-marker"
                                coordinate={[selectedDestination.longitude, selectedDestination.latitude]}
                                anchor={{ x: 0.5, y: 1 }}
                            >
                                <View
                                    style={{
                                        width: 32,
                                        height: 32,
                                        alignItems: 'center',
                                        justifyContent: 'flex-end',
                                    }}
                                >
                                    {imagesLoaded ? (
                                        <Image
                                            source={RED_PIN_IMAGE}
                                            style={{
                                                width: 32,
                                                height: 32,
                                            }}
                                            resizeMode="contain"
                                        />
                                    ) : (
                                        <Ionicons name="location" size={32} color="#EF4444" />
                                    )}
                                </View>
                            </MapLibreGL.PointAnnotation>
                        )}

                        {explorePlaces && imagesLoaded && explorePlaces.map((place, index) => {
                            const imageSource =
                                (exploreCategory && EXPLORE_IMAGES[exploreCategory]) || EXPLORE_FALLBACK_IMAGE;

                            return (
                                <MapLibreGL.PointAnnotation
                                    key={`explore-${exploreCategory}-${index}-${renderKey}`}
                                    id={`explore-place-${index}`}
                                    coordinate={[place.longitude, place.latitude]}
                                    onSelected={() => onExplorePlacePress?.(place)}
                                >
                                    <View style={{
                                        width: 40,
                                        height: 40,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <Image
                                            source={imageSource}
                                            style={{
                                                width: 36,
                                                height: 36,
                                            }}
                                            resizeMode="contain"
                                        />

                                    </View>
                                </MapLibreGL.PointAnnotation>
                            );
                        })}

                        {taxiStationsShape && imagesLoaded && (
                            <MapLibreGL.ShapeSource id="taxi-stations-source" shape={taxiStationsShape}>
                                <MapLibreGL.SymbolLayer
                                    id="taxi-stations-layer"
                                    style={{
                                        iconImage: 'taxiStation',
                                        iconSize: 0.9,
                                        iconAnchor: 'bottom',
                                        iconAllowOverlap: true,
                                        iconIgnorePlacement: true,
                                        textField: ['get', 'name'],
                                        textFont: ['JakartaSans'],
                                        textSize: 12,
                                        textColor: '#1F2937',
                                        textHaloColor: '#FFFFFF',
                                        textHaloWidth: 1.5,
                                        textAnchor: 'bottom',
                                        textOffset: [0, -4.8],
                                        textMaxWidth: 8,
                                        textOptional: true,
                                    }}
                                />
                            </MapLibreGL.ShapeSource>
                        )}
                    </MapLibreGL.MapView>

                    {showFollowCamera && !!userLocation && imagesLoaded && mapHeight > 0 && (
                        <View
                            pointerEvents="none"
                            style={[
                                styles.navPuckOverlay,
                                { top: mapHeight * NAV_PUCK_SCREEN_FRACTION - NAV_PUCK_OVERLAY_SIZE / 2 - NAV_PUCK_FORWARD_PX },
                            ]}
                        >
                            <Image
                                source={MAPPIN_IMAGE}
                                style={styles.navPuckImage}
                                resizeMode="stretch"
                            />
                        </View>
                    )}
                </View>
            </View >
        );
    }
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    mapSurface: {
        flex: 1,
    },
    navPuckOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    navPuckImage: {
        width: NAV_PUCK_OVERLAY_SIZE * 1.25,
        height: NAV_PUCK_OVERLAY_SIZE,
    },
});

CustomGebetaMap.displayName = 'CustomGebetaMap';

export default CustomGebetaMap;
export type { ExtendedGebetaMapProps };
