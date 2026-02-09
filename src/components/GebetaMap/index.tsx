import React, { forwardRef, useState, useImperativeHandle, useRef, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, Text, Animated, Image } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { GebetaMapRef, GebetaMapProps } from '@gebeta/tiles-react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../shared/theme/colors';

const MAPPIN_IMAGE = require('../../../assets/images/Mappin.png');
const PIN_NORMAL_IMAGE = require('../../../assets/images/pin-normal.png');

const EXPLORE_IMAGES = {
    restaurants: require('../../../assets/images/restaurant.png'),
    gas: require('../../../assets/images/gas-station.png'),
    parking: require('../../../assets/images/parking.png'),
    hospital: require('../../../assets/images/hospital.png'),
    repair: require('../../../assets/images/repair-shop.png'),
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
    ({ apiKey, center, zoom, onMapClick, onMapLoaded, mapStyleUrl, mapStyleJson, routeGeoJSON, routeStyle, isNavigating, userLocation, userHeading, showUserLocationMarker, incidents, selectedLocation, explorePlaces, exploreCategory, onExplorePlacePress }, ref) => {
        const [mapStyleState, setMapStyleState] = useState<Record<string, unknown> | null>(null);
        const [loading, setLoading] = useState(true);
        const cameraRef = useRef<any>(null);
        const mapViewRef = useRef<any>(null);
        const hasStartedNavigating = useRef(false);
        const lastCameraUpdate = useRef<{ lat: number; lng: number; heading: number } | null>(null);
        const pulseAnim = useRef(new Animated.Value(1)).current;
        const [imagesLoaded, setImagesLoaded] = useState(false);

        useEffect(() => {
            const preloadImages = async () => {
                try {
                    await Promise.all([
                        Image.prefetch(Image.resolveAssetSource(MAPPIN_IMAGE).uri),
                        Image.prefetch(Image.resolveAssetSource(PIN_NORMAL_IMAGE).uri),
                        ...Object.values(EXPLORE_IMAGES).map(img =>
                            Image.prefetch(Image.resolveAssetSource(img).uri)
                        ),
                    ]);
                    setImagesLoaded(true);
                } catch (error) {
                    console.warn('Failed to preload some images:', error);
                    setImagesLoaded(true); 
                }
            };
            preloadImages();
        }, []);

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
            } else if (!isNavigating && hasStartedNavigating.current) {
                hasStartedNavigating.current = false;
                lastCameraUpdate.current = null;
            }
        }, [isNavigating]);

        const defaultRouteStyle = {
            color: routeStyle?.color || '#3B82F6',
            width: routeStyle?.width || 5,
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
                    cameraRef.current.setCamera({
                        centerCoordinate: [userLocation.lng, userLocation.lat],
                        zoomLevel: 18,
                        animationDuration: 300,
                        pitch: 60,
                        heading: userHeading || 0,
                        animationMode: 'easeTo',
                    });

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
                <MapLibreGL.MapView
                    ref={mapViewRef}
                    style={styles.map}
                    mapStyle={mapStyleState}
                    attributionEnabled={false}
                    logoEnabled={false}
                    onPress={(e) => {
                        const coords = (e.geometry as any)?.coordinates;
                        if (coords && onMapClick) {
                            onMapClick([coords[0], coords[1]], e);
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
                            key={`route-${JSON.stringify(routeGeoJSON.geometry.coordinates[0])}`}
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
                            key={`nav-marker-${userLocation.lat}-${userLocation.lng}`}
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
                            key={`user-location-${userLocation.lat}-${userLocation.lng}-${imagesLoaded}`}
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

                    {incidents && incidents.map((incident) => {
                        const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
                            'TRAFFIC_POLICE': 'shield-checkmark',
                            'TRAFFIC_JAM': 'car',
                            'CRASH': 'warning',
                            'ACCIDENT': 'nuclear',
                            'ROAD_CLOSURE': 'close-circle',
                            'SPEED_BUMP': 'triangle',
                            'POT_HOLE': 'alert-circle',
                            'FLOODING': 'water',
                            'GATED_COMMUNITY': 'home',
                            'OTHER': 'apps-outline',
                        };

                        const colorMap: Record<string, string> = {
                            'TRAFFIC_POLICE': '#3B82F6',
                            'TRAFFIC_JAM': '#EF4444',
                            'CRASH': '#F59E0B',
                            'ACCIDENT': '#F59E0B',
                            'ROAD_CLOSURE': '#8B5CF6',
                            'SPEED_BUMP': '#F59E0B',
                            'POT_HOLE': '#EF4444',
                            'FLOODING': '#3B82F6',
                            'GATED_COMMUNITY': '#10B981',
                            'OTHER': '#F97316',
                        };

                        const iconName = iconMap[incident.type.name] || 'alert-circle';
                        const iconColor = colorMap[incident.type.name] || '#F97316';

                        return (
                            <MapLibreGL.PointAnnotation
                                key={incident.id}
                                id={`incident-${incident.id}`}
                                coordinate={[incident.lng, incident.lat]}
                            >
                                <View style={{
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <Ionicons name={iconName} size={32} color={iconColor} />
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

                    {explorePlaces && imagesLoaded && explorePlaces.map((place, index) => {
                        const imageSource = EXPLORE_IMAGES[exploreCategory as keyof typeof EXPLORE_IMAGES];

                        return (
                            <MapLibreGL.PointAnnotation
                                key={`explore-${index}-${place.latitude}-${place.longitude}-${imagesLoaded}`}
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

                <View style={styles.attributionContainer}>
                    <Text style={styles.attributionText}>© Gebeta Maps</Text>
                </View>
            </View>
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
    attributionContainer: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    attributionText: {
        fontSize: 12,
        color: '#333',
        fontWeight: '500',
    },
});

CustomGebetaMap.displayName = 'CustomGebetaMap';

export default CustomGebetaMap;
export type { ExtendedGebetaMapProps };
