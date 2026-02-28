import React, { forwardRef, useState, useImperativeHandle, useRef, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, Text, Animated, Image } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { GebetaMapRef, GebetaMapProps } from '@gebeta/tiles-react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../shared/theme/colors';

const MAPPIN_IMAGE = require('../../../assets/images/Mappin.png');
const PIN_NORMAL_IMAGE = require('../../../assets/images/pin-normal.png');
const RED_PIN_IMAGE = require('../../../assets/images/red-pin.png');

const EXPLORE_IMAGES = {
    restaurants: require('../../../assets/images/restaurant.png'),
    gas: require('../../../assets/images/gas-station.png'),
    parking: require('../../../assets/images/parking.png'),
    hospital: require('../../../assets/images/hospital.png'),
    repair: require('../../../assets/images/repair-shop.png'),
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
    OTHER: require('../../../assets/images/other.png'),
};

interface ExtendedGebetaMapProps extends GebetaMapProps {
    routeGeoJSON?: any;
    routeStyle?: {
        color?: string;
        width?: number;
        opacity?: number;
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
}


const CustomGebetaMap = forwardRef<GebetaMapRef, ExtendedGebetaMapProps>(
    ({ apiKey, center, zoom, onMapClick, onMapLoaded, mapStyleUrl, mapStyleJson, routeGeoJSON, routeStyle, isNavigating, userLocation, userHeading, showUserLocationMarker, onUserInteraction, incidents, selectedLocation, clickedLocation, selectedDestination, explorePlaces, exploreCategory, onExplorePlacePress }, ref) => {
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
            preloadImages();
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

                    const offsetDistance = 0.0007; //distance in deg.
                    const headingRad = ((userHeading || 0) * Math.PI) / 180;

                    // down the screen
                    const latOffset = offsetDistance * Math.cos(headingRad);
                    const lngOffset = offsetDistance * Math.sin(headingRad);

                    const cameraConfig: any = {
                        centerCoordinate: [userLocation.lng + lngOffset, userLocation.lat + latOffset],
                        animationDuration: 300,
                        pitch: 60,
                        heading: userHeading || 0,
                        animationMode: 'easeTo',
                    };

                    //only set zoom if user didnt zoom out
                    if (!userHasZoomedOut.current) {
                        cameraConfig.zoomLevel = 18;
                        lastSetZoom.current = 18;
                    }

                    console.log('Setting camera, userHasZoomedOut:', userHasZoomedOut.current, 'config:', cameraConfig);
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
                        compassViewMargins={{ x: 16, y: 120 }}
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

                        {routeGeoJSON && (
                            <MapLibreGL.ShapeSource
                                key={`route-${routeGeoJSON.properties?.timestamp || Date.now()}-${JSON.stringify(routeGeoJSON.geometry.coordinates[0])}`}
                                id="route-preview-source"
                                shape={routeGeoJSON}
                            >
                                <MapLibreGL.LineLayer
                                    id="route-preview-layer"
                                    style={{
                                        lineColor: defaultRouteStyle.color,
                                        lineWidth: defaultRouteStyle.width,
                                        lineOpacity: isNavigating ? 0.6 : defaultRouteStyle.opacity,
                                        lineCap: 'round',
                                        lineJoin: 'round',
                                    }}
                                />
                            </MapLibreGL.ShapeSource>
                        )}

                        {isNavigating && userLocation && imagesLoaded && (
                            <MapLibreGL.PointAnnotation
                                key={`nav-marker-${renderKey}`}
                                id="user-location-marker-nav"
                                coordinate={[userLocation.lng, userLocation.lat]}
                            >
                                <View style={{
                                    width: 60,
                                    height: 60,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <View style={{
                                        transform: [{ rotate: `${userHeading || 0}deg` }],
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <Image
                                            source={MAPPIN_IMAGE}
                                            style={{
                                                width: 50,
                                                height: 50,
                                            }}
                                            resizeMode="contain"
                                        />
                                    </View>
                                </View>
                            </MapLibreGL.PointAnnotation>
                        )}

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

                        {selectedLocation && (
                            <MapLibreGL.PointAnnotation
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

                        {selectedDestination && imagesLoaded && !clickedLocation && (
                            <MapLibreGL.PointAnnotation
                                key={`destination-${renderKey}`}
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
                                    <Image
                                        source={RED_PIN_IMAGE}
                                        style={{
                                            width: 32,
                                            height: 32,
                                        }}
                                        resizeMode="contain"
                                    />
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
