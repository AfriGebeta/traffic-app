import React, { forwardRef, useState, useImperativeHandle, useRef, useEffect, useLayoutEffect, memo, useMemo, useCallback } from 'react';
import { View, StyleSheet, Alert, Text, Animated, Image } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { GebetaMapRef, GebetaMapProps } from '@gebeta/tiles-react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../shared/theme/colors';
import { showToast } from '../../shared/utils/toast';
import { decodePolyline } from '../../shared/utils/polyline';
import {
    buildCumulativeDistances,
    pointAtDistance,
    headingAtDistance,
    sliceFromDistance,
    snapToRouteDistance,
    findCorners,
    calculateDistance,
} from '../../modules/navigation/utils/navigationUtils';

const MAPPIN_IMAGE = require('../../../assets/images/Mappin.png');
const PIN_NORMAL_IMAGE = require('../../../assets/images/pin-normal.png');
const RED_PIN_IMAGE = require('../../../assets/images/red-pin.png');
const WAYPOINT_PIN_IMAGE = require('../../../assets/images/location-pin-2.png');
const MINIBUS_SELECTED_IMAGE = require('../../../assets/images/minibus-selected.png');

const EXPLORE_IMAGES = {
    restaurants: require('../../../assets/images/restaurant.png'),
    gas: require('../../../assets/images/gas-station.png'),
    parking: require('../../../assets/images/parking.png'),
    hospital: require('../../../assets/images/hospital.png'),
    repair: require('../../../assets/images/repair-shop.png'),
    bank: require('../../../assets/images/bank.png'),
    atm: require('../../../assets/images/atm.png'),
};

const INCIDENT_IMAGES = {
    ROAD_CLOSURE: require('../../../assets/images/closure.png'),
    ACCIDENT: require('../../../assets/images/accident.png'),
    TRAFFIC_JAM: require('../../../assets/images/traffic-jam.png'),
    BAD_WEATHER: require('../../../assets/images/bad-weather.png'),
    HAZARD: require('../../../assets/images/hazard.png'),
    CRASH: require('../../../assets/images/crash.png'),
    GATED_COMMUNITY: require('../../../assets/images/gated-community.png'),
    BROKEN_ROAD: require('../../../assets/images/broken-road.png'),
    RADAR: require('../../../assets/images/radar.png'),
    OTHER: require('../../../assets/images/other.png'),
};

const MAP_TILE_LOADING_BACKGROUND = colors.gray[200];

const ensureStyleBackgroundLayer = (styleJson: Record<string, any>): Record<string, any> => {
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
                paint: { 'background-color': MAP_TILE_LOADING_BACKGROUND },
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
    userLocation?: { lat: number; lng: number; accuracy?: number } | null;
    userHeading?: number;
    showUserLocationMarker?: boolean;
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
    boundingBox?: {
        north: number;
        south: number;
        east: number;
        west: number;
    } | null;
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



const NavigationMarker = memo(({
    lat,
    lng,
    heading,
    visible,
}: {
    lat: number;
    lng: number;
    heading: number;
    visible: boolean;
}) => {
    const shape = useMemo(() => ({
        type: 'Feature' as const,
        properties: { heading },
        geometry: { type: 'Point' as const, coordinates: [lng, lat] },
    }), [lat, lng, heading]);

    if (!visible) return null;

    return (
        <MapLibreGL.ShapeSource id="nav-marker-source" shape={shape}>
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
                }}
            />
        </MapLibreGL.ShapeSource>
    );
});
NavigationMarker.displayName = 'NavigationMarker';


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

    return (
        <>
            {animatedSegments.map((route) => {
                if (route.geoJSON.geometry.coordinates.length === 0) return null;

                const lineStyle: any = {
                    lineColor: route.isWalking ? '#EF4444' : '#3B82F6',
                    lineWidth: route.isWalking ? 5 : 7,
                    lineOpacity: currentTaxiSegmentIndex === route.segmentIndex ? 1 : 0.7,
                    lineCap: 'round',
                    lineJoin: 'round',
                };
                if (route.isWalking) {
                    lineStyle.lineDasharray = [0, 2];
                }

                return (
                    <MapLibreGL.ShapeSource
                        key={`segment-${route.segmentIndex}-source`}
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
        </>
    );
});
AnimatedSegmentedRoutes.displayName = 'AnimatedSegmentedRoutes';


interface AnimatedNavLayerProps {
    userLocation: { lat: number; lng: number; accuracy?: number } | null;
    isNavigating: boolean;
    routeGeoJSON: any;
    routeLineStyle: any;
    segmentedRoutes?: Array<{ geoJSON: any; isWalking: boolean; segmentIndex: number }>;
    isTaxiNavigation?: boolean;
    currentTaxiSegmentIndex?: number;
    imagesLoaded: boolean;
    moveCamera?: (center: [number, number], heading: number) => void;
}


const NAV_RENDER_MS = 33;
const NAV_CAMERA_MS = 40;
const NAV_CAMERA_LOOKAHEAD_M = 35;

const NAV_HEADING_FILTER = 0.15;
const NAV_POS_SMOOTH = 0.12;
const NAV_SPEED_SMOOTH = 0.6; 
const NAV_SETTLE_SMOOTH = 0.04; 
const NAV_MAX_PREDICT_S = 7;
const NAV_CORNER_ANGLE = 25;
const NAV_CORNER_BUFFER_M = 4;
const NAV_UNSNAP_M = 14;
const NAV_RESNAP_M = 12;

const NAV_UNSNAP_ACC_FACTOR = 1.5; 
const NAV_UNSNAP_DEBOUNCE_MS = 3000;
const NAV_UNSNAP_HEADING_ANGLE = 70;  
const NAV_UNSNAP_HEADING_MIN_DIST = 8;  
const NAV_UNSNAP_HEADING_MIN_MOVE = 8; 
const NAV_FREE_SMOOTH = 0.2;  
const NAV_ZOOM = 19;

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
}: AnimatedNavLayerProps) => {
    const coords: [number, number][] | undefined = routeGeoJSON?.geometry?.coordinates;
    const useRouteModel = !isTaxiNavigation && !!coords && coords.length > 1;

    const cum = useMemo(
        () => (coords && coords.length > 1 ? buildCumulativeDistances(coords) : null),
        [coords]
    );

    const corners = useMemo(
        () => (coords && cum ? findCorners(coords, cum, NAV_CORNER_ANGLE) : []),
        [coords, cum]
    );

    const [render, setRender] = useState({ lat: 0, lng: 0, heading: 0, s: 0 });

    const renderedSRef = useRef(0);
    const vRef = useRef(0);
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

        if (firstRef.current) {
            firstRef.current = false;
            freeRoamRef.current = false;
            renderedSRef.current = snappedS;
            lastOnRouteSRef.current = snappedS;
            vRef.current = 0;
            headingRef.current = headingAtDistance(coords, cum, snappedS);
            lastFixRef.current = { s: snappedS, t: now };
            prevRawRef.current = { lat: userLocation.lat, lng: userLocation.lng };
            const [lng0, lat0] = pointAtDistance(coords, cum, snappedS);
            setRender({ lat: lat0, lng: lng0, heading: headingRef.current, s: snappedS });
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
                    const routeB = headingAtDistance(coords, cum, snappedS);
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
            renderedSRef.current = snappedS;
            vRef.current = 0;
            lastFixRef.current = { s: snappedS, t: now };
            lastOnRouteSRef.current = snappedS;
        } else {
            unsnapStartRef.current = null;
            const prev = lastFixRef.current!;
            const dt = Math.max(0.001, (now - prev.t) / 1000);
            let measured = (snappedS - prev.s) / dt;
            if (measured < 0) measured = 0;
            vRef.current = vRef.current * (1 - NAV_SPEED_SMOOTH) + measured * NAV_SPEED_SMOOTH;
            if (vRef.current < 0.5) vRef.current = 0;
            lastFixRef.current = { s: snappedS, t: now };
            lastOnRouteSRef.current = snappedS;
        }

        prevRawRef.current = { lat: userLocation.lat, lng: userLocation.lng };
    }, [userLocation?.lat, userLocation?.lng, isNavigating, useRouteModel, coords, cum]);

    useEffect(() => {
        if (!isNavigating) {
            firstRef.current = true;
            return;
        }

        let rafId: number;
        let lastEmit = 0;
        let lastCam = 0;

        const tick = () => {
            const now = Date.now();
            let lat: number, lng: number, heading: number, s: number;

            let freeRoaming = false;

            if (!useRouteModel || !coords || !cum) {
                const cur = taxiCurRef.current;
                const to = taxiToRef.current;
                const ALPHA = 0.2;
                lat = cur.lat + (to.lat - cur.lat) * ALPHA;
                lng = cur.lng + (to.lng - cur.lng) * ALPHA;
                taxiCurRef.current = { lat, lng };
                if (Math.abs(to.lat - lat) > 1e-6 || Math.abs(to.lng - lng) > 1e-6) {
                    const raw = calcBearing({ lat, lng }, to);
                    let diff = raw - headingRef.current;
                    if (diff > 180) diff -= 360;
                    if (diff < -180) diff += 360;
                    headingRef.current += diff * NAV_HEADING_FILTER;
                }
                heading = headingRef.current;
                s = 0;
            } else if (freeRoamRef.current) {
                freeRoaming = true;
                const cur = freeCurRef.current;
                const to = freeTargetRef.current;
                lat = cur.lat + (to.lat - cur.lat) * NAV_FREE_SMOOTH;
                lng = cur.lng + (to.lng - cur.lng) * NAV_FREE_SMOOTH;
                freeCurRef.current = { lat, lng };
                if (Math.abs(to.lat - lat) > 1e-6 || Math.abs(to.lng - lng) > 1e-6) {
                    const raw = calcBearing({ lat, lng }, to);
                    let diff = raw - headingRef.current;
                    if (diff > 180) diff -= 360;
                    if (diff < -180) diff += 360;
                    headingRef.current += diff * NAV_HEADING_FILTER;
                }
                heading = headingRef.current;
                s = lastOnRouteSRef.current;
            } else {
                const total = cum[cum.length - 1];
                const fix = lastFixRef.current;

                const elapsed = fix ? Math.min((now - fix.t) / 1000, NAV_MAX_PREDICT_S) : 0;
                let target = fix
                    ? Math.min(fix.s + vRef.current * elapsed, total)
                    : renderedSRef.current;

                if (fix && corners.length > 0) {
                    let nextCorner = Infinity;
                    for (let i = 0; i < corners.length; i++) {
                        if (corners[i] > fix.s) { nextCorner = corners[i]; break; }
                    }
                    if (nextCorner !== Infinity) {
                        const cap = Math.max(nextCorner - NAV_CORNER_BUFFER_M, fix.s);
                        target = Math.min(target, cap);
                    }
                }

                let newS = renderedSRef.current + (target - renderedSRef.current) * NAV_POS_SMOOTH;
                if (newS < renderedSRef.current) {
                    newS = vRef.current < 0.5
                        ? renderedSRef.current + (target - renderedSRef.current) * NAV_SETTLE_SMOOTH
                        : renderedSRef.current;
                }
                s = newS;
                renderedSRef.current = s;
                const pt = pointAtDistance(coords, cum, s);
                lng = pt[0];
                lat = pt[1];
                const rawH = headingAtDistance(coords, cum, s);
                let diff = rawH - headingRef.current;
                if (diff > 180) diff -= 360;
                if (diff < -180) diff += 360;
                headingRef.current += diff * NAV_HEADING_FILTER;
                heading = headingRef.current;
            }

            if (now - lastEmit >= NAV_RENDER_MS) {
                lastEmit = now;
                setRender({ lat, lng, heading, s });
            }

            if (moveCamera && now - lastCam >= NAV_CAMERA_MS) {
                lastCam = now;
                const camCenter: [number, number] = (useRouteModel && coords && cum && !freeRoaming)
                    ? pointAtDistance(coords, cum, s + NAV_CAMERA_LOOKAHEAD_M)
                    : [lng, lat];
                moveCamera(camCenter, heading);
            }

            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [isNavigating, useRouteModel, coords, cum, corners, moveCamera]);

    const lineShape = useMemo(() => {
        if (!useRouteModel || !coords || !cum) return null;
        return {
            type: 'Feature' as const,
            properties: {},
            geometry: {
                type: 'LineString' as const,
                coordinates: sliceFromDistance(coords, cum, render.s),
            },
        };
    }, [useRouteModel, coords, cum, render.s]);

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
                <MapLibreGL.ShapeSource id="route-nav-animated-source" shape={lineShape}>
                    <MapLibreGL.LineLayer id="route-nav-animated-layer" style={routeLineStyle} />
                </MapLibreGL.ShapeSource>
            )}
            <NavigationMarker
                lat={render.lat}
                lng={render.lng}
                heading={render.heading}
                visible={!!isNavigating && !!userLocation && !!imagesLoaded}
            />
        </>
    );
});
AnimatedNavLayer.displayName = 'AnimatedNavLayer';


const CustomGebetaMap = forwardRef<GebetaMapRef, ExtendedGebetaMapProps>(
    ({ apiKey, center, zoom, onMapClick, onMapLoaded, mapStyleUrl, mapStyleJson, routeGeoJSON, routeStyle, isNavigating, userLocation, userHeading, showUserLocationMarker, onUserInteraction, incidents, rules, selectedLocation, clickedLocation, selectedDestination, routeOrigin, explorePlaces, exploreCategory, onExplorePlacePress, taxiStations, taxiWalkRoutes, taxiRouteSegments, isTaxiNavigation, currentTaxiSegmentIndex, segmentedRoutes, waypointMarkers, activeSegmentGeoJSON, previewStepLocation, externalCameraControl, boundingBox }, ref) => {
        const [mapStyleState, setMapStyleState] = useState<Record<string, unknown> | null>(() =>
            mapStyleJson ? ensureStyleBackgroundLayer(mapStyleJson as Record<string, any>) : null
        );
        const cameraRef = useRef<any>(null);
        const mapViewRef = useRef<any>(null);
        const hasStartedNavigating = useRef(false);
        const userHasZoomedOut = useRef(false);
        const cameraSuspendedRef = useRef(false);   
        const cameraResumeUntilRef = useRef(0);     
        const lastSetZoom = useRef<number>(18);
        const pulseAnim = useRef(new Animated.Value(1)).current;
        const [imagesLoaded, setImagesLoaded] = useState(false);
        const [renderKey, setRenderKey] = useState(0);
        const lastFreeCameraRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
        const pendingFlyTo = useRef<{
            center: [number, number];
            zoom?: number;
            duration?: number;
            pitch?: number;
        } | null>(null);
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
        }) => {
            const cameraConfig = {
                centerCoordinate: options.center,
                zoomLevel: options.zoom,
                animationMode: 'flyTo' as const,
                animationDuration: options.duration ?? 1000,
                pitch: options.pitch ?? 0,
            };

            if (cameraRef.current) {
                pendingFlyTo.current = null;
                cameraRef.current.setCamera(cameraConfig);
            } else {
                pendingFlyTo.current = options;
            }
        }, []);

        const moveCamera = useCallback((center: [number, number], heading: number) => {
            if (!cameraRef.current) return;
            const now = Date.now();
            if (userHasZoomedOut.current) {
                cameraSuspendedRef.current = true;
                return;
            }
            if (now < cameraResumeUntilRef.current) return;
            if (cameraSuspendedRef.current) {
                cameraSuspendedRef.current = false;
                cameraResumeUntilRef.current = now + 600;
                cameraRef.current.setCamera({
                    centerCoordinate: center,
                    heading,
                    pitch: 60,
                    zoomLevel: NAV_ZOOM,
                    animationDuration: 600,
                    animationMode: 'flyTo',
                });
                lastSetZoom.current = NAV_ZOOM;
                return;
            }
            cameraRef.current.setCamera({
                centerCoordinate: center,
                heading,
                pitch: 60,
                zoomLevel: NAV_ZOOM,
                animationDuration: NAV_CAMERA_MS,
                animationMode: 'linearTo',
            });
            lastSetZoom.current = NAV_ZOOM;
        }, []);

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
                        ...Object.values(INCIDENT_IMAGES).map(img =>
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
            console.log('rules changed — count:', rules?.length, 'imagesLoaded:', imagesLoaded, 'isNavigating:', isNavigating, 'mapStyleReady:', !!mapStyleState);
            if (!imagesLoaded || !mapStyleState) return;
            const timer = setTimeout(() => setRenderKey(prev => prev + 1), 200);
            return () => clearTimeout(timer);
        }, [rules, imagesLoaded, mapStyleState]);

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

        useEffect(() => {
            if (imagesLoaded && taxiStations && taxiStations.length > 0) {
                setRenderKey(prev => prev + 1);
                setTimeout(() => setRenderKey(prev => prev + 1), 100);
                setTimeout(() => setRenderKey(prev => prev + 1), 200);
            }
        }, [taxiStations, imagesLoaded]);


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

        useEffect(() => {
            if (isNavigating && !hasStartedNavigating.current) {
                hasStartedNavigating.current = true;
                userHasZoomedOut.current = false;
                //initial nav zoom
                if (cameraRef.current && userLocation) {
                    const offsetDistance = 0.0007;
                    const headingRad = ((userHeading || 0) * Math.PI) / 180;
                    const latOffset = offsetDistance * Math.cos(headingRad);
                    const lngOffset = offsetDistance * Math.sin(headingRad);

                    cameraRef.current.setCamera({
                        centerCoordinate: [userLocation.lng + lngOffset, userLocation.lat + latOffset],
                        zoomLevel: NAV_ZOOM,
                        animationDuration: 500,
                        pitch: 60,
                        heading: userHeading || 0,
                        animationMode: 'flyTo',
                    });
                }
            } else if (!isNavigating && hasStartedNavigating.current) {
                hasStartedNavigating.current = false;
                userHasZoomedOut.current = false;
            }
        }, [isNavigating, userLocation, userHeading]);

        const defaultRouteStyle = {
            color: routeStyle?.color || '#3B82F6',
            width: 9,
            opacity: routeStyle?.opacity || 0.8,
        };

        useImperativeHandle(ref, () => ({
            flyTo: (options: any) => {
                applyFlyTo(options);
            },
            recenterNavigation: () => {
                userHasZoomedOut.current = false;
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
        }), [applyFlyTo]);

        useEffect(() => {
            if (mapStyleJson) {
                setMapStyleState(ensureStyleBackgroundLayer(mapStyleJson as Record<string, any>));
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

                    setMapStyleState(ensureStyleBackgroundLayer(styleJson));
                } catch (error) {
                    console.error("Error loading style JSON:", error);
                    Alert.alert("Map Style Load Error", String(error));
                }
            }

            processStyle();
        }, [apiKey, mapStyleUrl, mapStyleJson]);

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

        const handleMapLoad = useCallback(() => {
            if (!externalCameraControl) {
                applyInitialCamera();
            } else if (lastFreeCameraRef.current) {
                cameraRef.current?.setCamera({
                    centerCoordinate: lastFreeCameraRef.current.center,
                    zoomLevel: lastFreeCameraRef.current.zoom,
                    animationDuration: 0,
                    animationMode: 'moveTo',
                });
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



        if (!mapStyleState || !center) {
            return (
                <View style={[styles.container, { backgroundColor: MAP_TILE_LOADING_BACKGROUND }]} />
            );
        }

        return (
            <View style={styles.container}>
                <View
                    style={styles.mapSurface}
                    onTouchStart={() => {
                        if (onUserInteraction) {
                            onUserInteraction();
                        }
                        if (isNavigating) {
                            userHasZoomedOut.current = true;
                        }
                    }}
                >
                    <MapLibreGL.MapView
                        ref={mapViewRef}
                        style={styles.mapSurface}
                        mapStyle={mapStyleState}
                        attributionEnabled={false}
                        logoEnabled={false}
                        compassEnabled={!isNavigating}
                        compassViewPosition={1}
                        compassViewMargins={{ x: 16, y: 130 }}
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
                                } catch (err) {
                                    console.log('[GebetaMap] queryRenderedFeaturesAtPoint error:', err);
                                }
                            }

                            onMapClick([coords[0], coords[1]], { ...e, features });
                        }}
                        onRegionIsChanging={(e: any) => {
                            // console.log('event properties:', JSON.stringify(e.properties));
                            // console.log('event geometry:', JSON.stringify(e.geometry));

                            if (!isNavigating && externalCameraControl) {
                                const c = e.geometry?.coordinates;
                                const z = e.properties?.zoom;
                                if (Array.isArray(c) && z !== undefined) {
                                    lastFreeCameraRef.current = { center: [c[0], c[1]], zoom: z };
                                }
                            }

                            if (e.properties?.zoom !== undefined) {
                                const zoomLevel = e.properties.zoom;
                                // console.log('zoom level:', zoomLevel.toFixed(1));

                                if (isNavigating) {
                                    if (Math.abs(zoomLevel - lastSetZoom.current) > 0.5) {
                                        if (!userHasZoomedOut.current) {
                                            userHasZoomedOut.current = true;
                                            if (onUserInteraction) {
                                                onUserInteraction();
                                            }
                                        }
                                    }
                                }
                            } else {
                                // console.log('zoom not found in event properties');
                            }
                        }}
                        onDidFinishLoadingMap={handleMapLoad}
                    >
                        <MapLibreGL.Camera
                            ref={cameraRef}
                            {...(externalCameraControl || isNavigating
                                ? {}
                                : {
                                    centerCoordinate: center,
                                    zoomLevel: zoom ?? 15,
                                    animationMode: 'moveTo' as const,
                                    animationDuration: 0,
                                })}
                            {...(isNavigating ? {} : { pitch: 0, heading: 0 })}
                            maxBounds={undefined}
                            defaultSettings={{
                                centerCoordinate: externalCameraControl && lastFreeCameraRef.current
                                    ? lastFreeCameraRef.current.center
                                    : center,
                                zoomLevel: isNavigating
                                    ? NAV_ZOOM
                                    : (externalCameraControl && lastFreeCameraRef.current
                                        ? lastFreeCameraRef.current.zoom
                                        : (zoom ?? 15)),
                            }}
                        />

                        <MapLibreGL.Images images={{ navPuck: MAPPIN_IMAGE }} />


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
                                lineStyle.lineDasharray = [0, 2];
                            }
                            return (
                                <MapLibreGL.ShapeSource
                                    key={`segment-static-${route.segmentIndex}`}
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


                        {!isNavigating && routeGeoJSON && !segmentedRoutes && (
                            <MapLibreGL.ShapeSource
                                key={`route-preview-${routeStyle?.isDotted ? 'dotted' : 'solid'}`}
                                id="route-preview-source"
                                shape={routeGeoJSON}
                            >
                                <MapLibreGL.LineLayer
                                    id="route-preview-layer"
                                    style={{
                                        lineColor: defaultRouteStyle.color,
                                        lineWidth: routeStyle?.isDotted ? 6 : defaultRouteStyle.width,
                                        lineOpacity: activeSegmentGeoJSON ? 0.35 : (routeStyle?.isDotted ? 1 : defaultRouteStyle.opacity),
                                        lineCap: 'round',
                                        lineJoin: 'round',
                                        ...(routeStyle?.isDotted && { lineDasharray: [0, 2] }),
                                    }}
                                />
                            </MapLibreGL.ShapeSource>
                        )}

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
                                const coords = decodePolyline(route.polyline, 6);
                                const mapCoords = coords.map(([lat, lng]) => [lng, lat]);


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
                                        key={`taxi-walk-${route.type}-${index}`}
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
                                lineColor: defaultRouteStyle.color,
                                lineWidth: routeStyle?.isDotted ? 6 : defaultRouteStyle.width,
                                lineOpacity: 0.6,
                                lineCap: 'round',
                                lineJoin: 'round',
                                ...(routeStyle?.isDotted && { lineDasharray: [0, 2] }),
                            }}
                            segmentedRoutes={segmentedRoutes}
                            isTaxiNavigation={!!isTaxiNavigation}
                            currentTaxiSegmentIndex={currentTaxiSegmentIndex}
                            imagesLoaded={!!imagesLoaded}
                            moveCamera={moveCamera}
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

                        {!isNavigating && !routeOrigin && showUserLocationMarker && userLocation && imagesLoaded && (
                            <MapLibreGL.PointAnnotation
                                key={`user-location-static-${renderKey}`}
                                id="user-location-marker-static"
                                coordinate={[userLocation.lng, userLocation.lat]}
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
                                        style={{
                                            width: 40,
                                            height: 40,
                                        }}
                                        resizeMode="contain"
                                    />
                                </View>
                            </MapLibreGL.PointAnnotation>
                        )}

                        {incidents && imagesLoaded && incidents.map((incident) => {
                            const imageSource = INCIDENT_IMAGES[incident.type.name as keyof typeof INCIDENT_IMAGES];

                            return (
                                <MapLibreGL.PointAnnotation
                                    key={`incident-${incident.id}-${renderKey}`}
                                    id={`incident-${incident.id}`}
                                    coordinate={[incident.lng, incident.lat]}
                                    onSelected={() => {
                                        showToast.info('Incident', incident.type.label || incident.type.name);
                                    }}
                                >
                                    <View style={{
                                        width: 40,
                                        height: 40,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        {imageSource ? (
                                            <Image
                                                source={imageSource}
                                                style={{
                                                    width: 36,
                                                    height: 36,
                                                }}
                                                resizeMode="contain"
                                            />
                                        ) : (
                                            <Ionicons name="alert-circle" size={32} color="#F97316" />
                                        )}
                                    </View>
                                </MapLibreGL.PointAnnotation>
                            );
                        })}

                        {rules && imagesLoaded && mapStyleState && !isNavigating && rules.map((rule, index) => {
                            return (
                                <MapLibreGL.PointAnnotation
                                    key={`rule-${rule.id}-${renderKey}`}
                                    id={`rule-${rule.id}`}
                                    coordinate={[rule.lng, rule.lat]}
                                >
                                    <View style={{
                                        width: 40,
                                        height: 40,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        {rule.type.img ? (
                                            <Image
                                                source={{ uri: rule.type.img }}
                                                style={{
                                                    width: 36,
                                                    height: 36,
                                                }}
                                                resizeMode="contain"
                                            />
                                        ) : (
                                            <Ionicons name="warning" size={32} color="#EF4444" />
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
                            const imageSource = EXPLORE_IMAGES[exploreCategory as keyof typeof EXPLORE_IMAGES];

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
                                        {imageSource ? (
                                            <Image
                                                source={imageSource}
                                                style={{
                                                    width: 36,
                                                    height: 36,
                                                }}
                                                resizeMode="contain"
                                            />
                                        ) : (
                                            <Ionicons name="location" size={28} color={colors.primary.main} />
                                        )}
                                    </View>
                                </MapLibreGL.PointAnnotation>
                            );
                        })}

                        {taxiStations && imagesLoaded && taxiStations.map((station) => {

                            const getStationStyle = () => {
                                switch (station.type) {
                                    case 'start':
                                        return {
                                            color: colors.primary.main,
                                            size: 50
                                        };
                                    case 'end':
                                        return {
                                            color: colors.primary.main,
                                            size: 50
                                        };
                                    case 'intermediate':
                                        return {
                                            color: colors.primary.main,
                                            size: 46
                                        };
                                }
                            };

                            const style = getStationStyle();

                            return (
                                <React.Fragment key={`taxi-station-fragment-${station.id}`}>
                                    <MapLibreGL.PointAnnotation
                                        key={`taxi-station-${station.type}-${station.id}-${renderKey}`}
                                        id={`taxi-station-${station.type}-${station.id}`}
                                        coordinate={[station.lng, station.lat]}
                                    >
                                        <View style={{
                                            width: style.size,
                                            height: style.size,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <Image
                                                source={MINIBUS_SELECTED_IMAGE}
                                                style={{
                                                    width: style.size,
                                                    height: style.size,
                                                }}
                                                resizeMode="contain"
                                            />
                                        </View>
                                    </MapLibreGL.PointAnnotation>
                                    <MapLibreGL.PointAnnotation
                                        key={`taxi-station-label-${station.id}-${renderKey}`}
                                        id={`taxi-station-label-${station.id}`}
                                        coordinate={[station.lng, station.lat]}
                                        anchor={{ x: 0.5, y: -0.8 }}
                                    >
                                        <View style={{
                                            backgroundColor: '#FFFFFF',
                                            paddingHorizontal: 10,
                                            paddingVertical: 5,
                                            borderRadius: 10,
                                            borderWidth: 2,
                                            borderColor: style.color,
                                            maxWidth: 120,
                                        }}>
                                            <Text style={{
                                                fontSize: 12,
                                                fontWeight: 'bold',
                                                color: '#1F2937',
                                                textAlign: 'center',
                                            }} numberOfLines={2}>
                                                {station.name}
                                            </Text>
                                        </View>
                                    </MapLibreGL.PointAnnotation>
                                </React.Fragment>
                            );
                        })}
                    </MapLibreGL.MapView>
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
        backgroundColor: MAP_TILE_LOADING_BACKGROUND,
    },
});

CustomGebetaMap.displayName = 'CustomGebetaMap';

export default CustomGebetaMap;
export type { ExtendedGebetaMapProps };
