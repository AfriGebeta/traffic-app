import React, { forwardRef, useState, useImperativeHandle, useRef, useEffect, memo, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, Text, Animated, Image } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { GebetaMapRef, GebetaMapProps } from '@gebeta/tiles-react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../shared/theme/colors';
import { showToast } from '../../shared/utils/toast';
import { decodePolyline } from '../../shared/utils/polyline';

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

interface ExtendedGebetaMapProps extends GebetaMapProps {
    routeGeoJSON?: any;
    routeStyle?: {
        color?: string;
        width?: number;
        opacity?: number;
        isDotted?: boolean;
    };
    isNavigating?: boolean;
    userLocation?: { lat: number; lng: number } | null;
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


const NavigationMarkerAnimated = memo(({
    animatedLat,
    animatedLng,
    animatedHeading,
    isNavigating,
    imagesLoaded,
    renderKey,
}: {
    animatedLat: number;
    animatedLng: number;
    animatedHeading: number;
    isNavigating: boolean;
    imagesLoaded: boolean;
    renderKey: number;
}) => {
    if (!isNavigating || !imagesLoaded) return null;

    return (
        <MapLibreGL.PointAnnotation
            key={`nav-marker-${renderKey}`}
            id="user-location-marker-nav"
            coordinate={[animatedLng, animatedLat]}
        >
            <View style={{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{
                    transform: [{ rotate: `${animatedHeading}deg` }],
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Image
                        source={MAPPIN_IMAGE}
                        style={{ width: 50, height: 50 }}
                        resizeMode="contain"
                    />
                </View>
            </View>
        </MapLibreGL.PointAnnotation>
    );
});
NavigationMarkerAnimated.displayName = 'NavigationMarkerAnimated';


const AnimatedRouteSource = memo(({
    routeGeoJSON,
    animatedLat,
    animatedLng,
    lineStyle,
}: {
    routeGeoJSON: any;
    animatedLat: number;
    animatedLng: number;
    lineStyle: any;
}) => {
    const animatedGeoJSON = useMemo(() => {
        if (!routeGeoJSON?.geometry?.coordinates?.length) return routeGeoJSON;
        return {
            ...routeGeoJSON,
            geometry: {
                ...routeGeoJSON.geometry,
                coordinates: [[animatedLng, animatedLat], ...routeGeoJSON.geometry.coordinates],
            },
        };
    }, [routeGeoJSON, animatedLat, animatedLng]);

    if (!animatedGeoJSON) return null;

    return (
        <MapLibreGL.ShapeSource
            id="route-nav-animated-source"
            shape={animatedGeoJSON}
        >
            <MapLibreGL.LineLayer
                id="route-nav-animated-layer"
                style={lineStyle}
            />
        </MapLibreGL.ShapeSource>
    );
});
AnimatedRouteSource.displayName = 'AnimatedRouteSource';


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
    userLocation: { lat: number; lng: number } | null;
    isNavigating: boolean;
    routeGeoJSON: any;
    routeLineStyle: any;
    segmentedRoutes?: Array<{ geoJSON: any; isWalking: boolean; segmentIndex: number }>;
    isTaxiNavigation?: boolean;
    currentTaxiSegmentIndex?: number;
    imagesLoaded: boolean;
    renderKey: number;
}

const AnimatedNavLayer = memo(({
    userLocation,
    isNavigating,
    routeGeoJSON,
    routeLineStyle,
    segmentedRoutes,
    isTaxiNavigation,
    currentTaxiSegmentIndex,
    imagesLoaded,
    renderKey,
}: AnimatedNavLayerProps) => {
    const [animatedNavPos, setAnimatedNavPos] = useState({ lat: 0, lng: 0, heading: 0 });

    const animCurRef = useRef({ lat: 0, lng: 0 });
    const animToRef = useRef({ lat: 0, lng: 0 });

    const velRef = useRef({ lat: 0, lng: 0 });
    const animFirstRef = useRef(true);
    const animHeadingRef = useRef(0);

    useEffect(() => {
        if (!isNavigating || !userLocation) return;
        if (animFirstRef.current) {
            animFirstRef.current = false;
            animCurRef.current = { lat: userLocation.lat, lng: userLocation.lng };
            animToRef.current = { lat: userLocation.lat, lng: userLocation.lng };
            velRef.current = { lat: 0, lng: 0 };
            setAnimatedNavPos({ lat: userLocation.lat, lng: userLocation.lng, heading: 0 });
            return;
        }
        animToRef.current = { lat: userLocation.lat, lng: userLocation.lng };
    }, [userLocation?.lat, userLocation?.lng, isNavigating]);

    useEffect(() => {
        if (!isNavigating) {
            animFirstRef.current = true;
            velRef.current = { lat: 0, lng: 0 };
            return;
        }

        let rafId: number;
        let lastTime = Date.now();

        const tick = () => {
            const now = Date.now();
            const dt = Math.min((now - lastTime) / 1000, 0.05); 
            lastTime = now;

            const target = animToRef.current;
            const cur = animCurRef.current;

            const SPRING = 10;
            const DAMPING = 0.82;

            velRef.current.lat = velRef.current.lat * DAMPING + (target.lat - cur.lat) * SPRING * dt;
            velRef.current.lng = velRef.current.lng * DAMPING + (target.lng - cur.lng) * SPRING * dt;

            const lat = cur.lat + velRef.current.lat * dt;
            const lng = cur.lng + velRef.current.lng * dt;
            animCurRef.current = { lat, lng };

            if (Math.abs(target.lat - lat) > 0.000001 || Math.abs(target.lng - lng) > 0.000001) {
                const rawBearing = calcBearing({ lat, lng }, target);
                let diff = rawBearing - animHeadingRef.current;
                if (diff > 180) diff -= 360;
                if (diff < -180) diff += 360;
                animHeadingRef.current += diff * 0.12;
            }

            setAnimatedNavPos({ lat, lng, heading: animHeadingRef.current });
            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [isNavigating]);

    return (
        <>
            {isNavigating && isTaxiNavigation && segmentedRoutes && segmentedRoutes.length > 0 && (
                <AnimatedSegmentedRoutes
                    segmentedRoutes={segmentedRoutes}
                    animatedLat={animatedNavPos.lat}
                    animatedLng={animatedNavPos.lng}
                    currentTaxiSegmentIndex={currentTaxiSegmentIndex}
                />
            )}
            {isNavigating && routeGeoJSON && !segmentedRoutes && (
                <AnimatedRouteSource
                    routeGeoJSON={routeGeoJSON}
                    animatedLat={animatedNavPos.lat}
                    animatedLng={animatedNavPos.lng}
                    lineStyle={routeLineStyle}
                />
            )}
            <NavigationMarkerAnimated
                animatedLat={animatedNavPos.lat}
                animatedLng={animatedNavPos.lng}
                animatedHeading={animatedNavPos.heading}
                isNavigating={!!isNavigating && !!userLocation && !!imagesLoaded}
                imagesLoaded={!!imagesLoaded}
                renderKey={renderKey}
            />
        </>
    );
});
AnimatedNavLayer.displayName = 'AnimatedNavLayer';


const CustomGebetaMap = forwardRef<GebetaMapRef, ExtendedGebetaMapProps>(
    ({ apiKey, center, zoom, onMapClick, onMapLoaded, mapStyleUrl, mapStyleJson, routeGeoJSON, routeStyle, isNavigating, userLocation, userHeading, showUserLocationMarker, onUserInteraction, incidents, rules, selectedLocation, clickedLocation, selectedDestination, explorePlaces, exploreCategory, onExplorePlacePress, taxiStations, taxiWalkRoutes, taxiRouteSegments, isTaxiNavigation, currentTaxiSegmentIndex, segmentedRoutes, waypointMarkers }, ref) => {
        const [mapStyleState, setMapStyleState] = useState<Record<string, unknown> | null>(null);
        const [loading, setLoading] = useState(true);
        const cameraRef = useRef<any>(null);
        const mapViewRef = useRef<any>(null);
        const hasStartedNavigating = useRef(false);
        const lastCameraUpdate = useRef<{ lat: number; lng: number; heading: number } | null>(null);
        const userHasZoomedOut = useRef(false);
        const lastSetZoom = useRef<number>(18);
        const pulseAnim = useRef(new Animated.Value(1)).current;
        const [imagesLoaded, setImagesLoaded] = useState(false);
        const [renderKey, setRenderKey] = useState(0);

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
            console.log('[GebetaMap] rules changed — count:', rules?.length, 'imagesLoaded:', imagesLoaded, 'isNavigating:', isNavigating, 'mapStyleReady:', !!mapStyleState);
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
                        zoomLevel: 18,
                        animationDuration: 500,
                        pitch: 60,
                        heading: userHeading || 0,
                        animationMode: 'flyTo',
                    });
                }
            } else if (!isNavigating && hasStartedNavigating.current) {
                hasStartedNavigating.current = false;
                lastCameraUpdate.current = null;
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
                if (cameraRef.current) {
                    cameraRef.current.setCamera({
                        centerCoordinate: options.center,
                        zoomLevel: options.zoom,
                        animationMode: 'flyTo',
                        animationDuration: options.duration || 1000,
                        pitch: options.pitch,
                    });
                }
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
        }), []);

        useEffect(() => {
            async function processStyle() {
                try {
                    let styleJson: any;

                    if (mapStyleJson) {
                        styleJson = mapStyleJson;
                    } else if (mapStyleUrl) {
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

                    setMapStyleState(styleJson);
                    setLoading(false);
                } catch (error) {
                    console.error("Error loading style JSON:", error);
                    Alert.alert("Map Style Load Error", String(error));
                    setLoading(false);
                }
            }

            processStyle();
        }, [apiKey, mapStyleUrl, mapStyleJson]);

        const handleMapLoad = () => {
            onMapLoaded?.();
        };

        useEffect(() => {
            if (isNavigating && userLocation && cameraRef.current) {
                const hasChanged = !lastCameraUpdate.current ||
                    Math.abs(lastCameraUpdate.current.lat - userLocation.lat) > 0.00001 ||
                    Math.abs(lastCameraUpdate.current.lng - userLocation.lng) > 0.00001 ||
                    Math.abs(lastCameraUpdate.current.heading - (userHeading || 0)) > 1;

                if (hasChanged) {

                    const offsetDistance = 0.0007;
                    const headingRad = ((userHeading || 0) * Math.PI) / 180;

                    const latOffset = offsetDistance * Math.cos(headingRad);
                    const lngOffset = offsetDistance * Math.sin(headingRad);

                    const cameraConfig: any = {
                        centerCoordinate: [userLocation.lng + lngOffset, userLocation.lat + latOffset],
                        animationDuration: 700,
                        pitch: 60,
                        heading: userHeading || 0,
                        animationMode: 'easeTo',
                    };

                    //only set zoom if user didnt zoom out
                    if (!userHasZoomedOut.current) {
                        cameraConfig.zoomLevel = 18;
                        lastSetZoom.current = 18;
                    }

                    cameraRef.current.setCamera(cameraConfig);

                    lastCameraUpdate.current = {
                        lat: userLocation.lat,
                        lng: userLocation.lng,
                        heading: userHeading || 0,
                    };
                }
            }
        }, [isNavigating, userLocation?.lat, userLocation?.lng, userHeading]);

        if (loading || !mapStyleState) {
            return (
                <View style={[styles.container, styles.loaderContainer]}>
                    <ActivityIndicator size="large" color="#000" />
                </View>
            );
        }

        return (
            <View style={styles.container}>
                <View
                    style={styles.map}
                    onTouchStart={() => {
                        if (isNavigating) {
                            setTimeout(() => {
                                userHasZoomedOut.current = true;
                                if (onUserInteraction) {
                                    onUserInteraction();
                                }
                            }, 500);
                        }
                    }}
                >
                    <MapLibreGL.MapView
                        ref={mapViewRef}
                        style={styles.map}
                        mapStyle={mapStyleState}
                        attributionEnabled={false}
                        logoEnabled={false}
                        compassEnabled={!isNavigating}
                        compassViewPosition={1}
                        compassViewMargins={{ x: 16, y: 130 }}
                        onPress={(e) => {
                            const coords = (e.geometry as any)?.coordinates;
                            if (coords && onMapClick) {
                                onMapClick([coords[0], coords[1]], e);
                            }
                        }}
                        onRegionIsChanging={(e: any) => {
                            if (isNavigating && e.properties?.zoom !== undefined) {
                                const currentZoom = e.properties.zoom;
                                if (Math.abs(currentZoom - lastSetZoom.current) > 0.5) {
                                    if (!userHasZoomedOut.current) {
                                        userHasZoomedOut.current = true;
                                        if (onUserInteraction) {
                                            onUserInteraction();
                                        }
                                    }
                                }
                            }
                        }}
                        onDidFinishLoadingMap={handleMapLoad}
                    >
                        <MapLibreGL.Camera
                            ref={cameraRef}
                            centerCoordinate={center}
                            zoomLevel={zoom}
                            pitch={0}
                            heading={0}
                            animationMode="flyTo"
                            animationDuration={800}
                            maxBounds={undefined}
                            defaultSettings={{
                                centerCoordinate: center,
                                zoomLevel: zoom,
                            }}
                        />


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
                                        lineOpacity: routeStyle?.isDotted ? 1 : defaultRouteStyle.opacity,
                                        lineCap: 'round',
                                        lineJoin: 'round',
                                        ...(routeStyle?.isDotted && { lineDasharray: [0, 2] }),
                                    }}
                                />
                            </MapLibreGL.ShapeSource>
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
                            renderKey={renderKey}
                        />

                        {!isNavigating && showUserLocationMarker && userLocation && imagesLoaded && (
                            <MapLibreGL.PointAnnotation
                                key={`user-location-${renderKey}`}
                                id="user-location-marker-static"
                                coordinate={[userLocation.lng, userLocation.lat]}
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
    loaderContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    map: {
        flex: 1,
    },
});

CustomGebetaMap.displayName = 'CustomGebetaMap';

export default CustomGebetaMap;
export type { ExtendedGebetaMapProps };
