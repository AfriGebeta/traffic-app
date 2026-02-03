import React, {
    useEffect,
    useState,
    useImperativeHandle,
    forwardRef,
    useRef,

} from "react";
import {
    View,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Text,
    Image,
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import * as MapLibreGL from "@maplibre/maplibre-react-native";
import type { Fence, FencePoint } from "./FenceManager";
import { FlyToOptions, GebetaMaps } from "./GebetaMaps";

export type GebetaMapRef = {
    addImageMarker: (lngLat: [number, number], imageUrl: string, size?: [number, number], onClick?: any, zIndex?: number, popupHtml?: string, color?: string, iconName?: string) => any;
    addMarker: GebetaMaps["addMarker"];
    clearMarkers: GebetaMaps["clearAllMarkers"];
    getMarkers: GebetaMaps["getMarkers"];
    getMapInstance: () => unknown | null;
    startFence: () => void;
    addFencePoint: GebetaMaps["addFencePoint"];
    closeFence: () => void;
    clearFence: () => void;
    clearAllFences: () => void;
    getFences: () => Fence[];
    getFencePoints: () => FencePoint[];
    isDrawingFence: () => boolean;
    addPath: GebetaMaps["addPath"];
    clearPaths: () => void;
    addClusteredMarker: GebetaMaps["addClusteredMarker"];
    clearClusteredMarkers: () => void;
    updateClustering: () => void;
    setClusteringEnabled: (enabled: boolean) => void;
    setClusterImage: (url: string) => void;
    geocode: GebetaMaps["geocode"];
    reverseGeocode: GebetaMaps["reverseGeocode"];
    getDirections: GebetaMaps["getDirections"];
    displayRoute: GebetaMaps["displayRoute"];
    clearRoute: () => void;
    getCurrentRoute: () => any;
    getRouteSummary: () => any;
    updateRouteStyle: GebetaMaps["updateRouteStyle"];
    flyTo: (options: FlyToOptions) => void;
    startNavigation?: (route: any, options?: any) => void;
    stopNavigation?: () => void;
    updateNavigationPosition?: (lngLat: [number, number]) => void;
    getNavigationState?: () => any;
    isNavigating?: () => boolean;
    getNavigationController?: () => any;
    convertDirectionsToNavigationRoute?: (directionsResponse: any) => any;
};

export interface GebetaMapProps {
    apiKey: string;
    center: [number, number];
    zoom: number;
    onMapClick?: (lngLat: [number, number], event: unknown) => void;
    onMapLoaded?: () => void;
    mapStyleUrl?: string; // URL to style JSON
    mapStyleJson?: Record<string, unknown>; // Direct style JSON object
    userLocation?: { lat: number; lng: number } | null;
    showUserLocation?: boolean;
    userHeading?: number;
}

export type MarkerData = {
    marker: unknown;
    popup?: unknown;
};

interface MapMarker {
    id: string;
    coordinates: [number, number];
    title?: string;
    icon?: string;
    iconSize?: [number, number];
    color?: string;
    iconName?: string;
    onSelected?: (lngLat: [number, number], marker: any, event: any) => void;
}

// let them pass this when initializing
// const STYLE_URL = "https://tiles.gebeta.app/styles/standard/style.json?device=mobile";

const GebetaMapImpl = forwardRef<GebetaMapRef, GebetaMapProps>(
    ({ apiKey, center, zoom, onMapClick, onMapLoaded, mapStyleUrl, mapStyleJson, userLocation, showUserLocation, userHeading }, ref) => {
        const [mapStyleState, setMapStyleState] = useState<Record<string, unknown> | null>(null);
        const [markers, setMarkers] = useState<MapMarker[]>([]);
        const [currentRoute, setCurrentRoute] = useState<any>(null);
        const cameraRef = useRef<any>(null);
        const [loading, setLoading] = useState(true);
        const [controller] = useState(() => new GebetaMaps({ apiKey }));
        const gebetaMapsInstance = useRef<GebetaMaps | null>(controller);
        const mapViewRef = useRef<any>(null);

        useImperativeHandle(ref, () => ({
            addImageMarker: (lngLat, imageUrl, size, onClick, zIndex, popupHtml, color, iconName) => {
                const result = gebetaMapsInstance.current!.addImageMarker(lngLat, imageUrl, size, onClick, zIndex, popupHtml);
                const markerData: MapMarker = {
                    id: `marker-${Date.now()}-${Math.random()}`,
                    coordinates: lngLat,
                    icon: imageUrl,
                    iconSize: size,
                    color: color,
                    iconName: iconName,
                    onSelected: onClick,
                };
                setMarkers((prev) => [...prev, markerData]);
                return result;
            },
            addMarker: (markerOptions) => {
                const marker = gebetaMapsInstance.current!.addMarker(markerOptions);
                setMarkers((prev) => [...prev, marker]);
                return marker;
            },
            clearMarkers: () => {
                gebetaMapsInstance.current!.clearAllMarkers();
                setMarkers([]);
            },
            getMarkers: () => gebetaMapsInstance.current!.getMarkers(),
            getMapInstance: () => gebetaMapsInstance.current?.getMapInstance() || null,
            startFence: () => gebetaMapsInstance.current!.startFence(),
            addFencePoint: (...args) => gebetaMapsInstance.current!.addFencePoint(...args),
            closeFence: () => gebetaMapsInstance.current!.closeFence(),
            clearFence: () => gebetaMapsInstance.current!.clearFence(),
            clearAllFences: () => gebetaMapsInstance.current!.clearAllFences(),
            getFences: () => gebetaMapsInstance.current!.getFences(),
            getFencePoints: () => gebetaMapsInstance.current!.getFencePoints(),
            isDrawingFence: () => gebetaMapsInstance.current!.isDrawingFence(),
            addPath: (...args) => gebetaMapsInstance.current!.addPath(...args),
            clearPaths: () => gebetaMapsInstance.current!.clearPaths(),
            addClusteredMarker: (...args) => gebetaMapsInstance.current!.addClusteredMarker(...args),
            clearClusteredMarkers: () => gebetaMapsInstance.current!.clearClusteredMarkers(),
            updateClustering: () => gebetaMapsInstance.current!.updateClustering(),
            setClusteringEnabled: (enabled) => gebetaMapsInstance.current!.setClusteringEnabled(enabled),
            setClusterImage: (url) => gebetaMapsInstance.current!.setClusterImage(url),
            geocode: (...args) => gebetaMapsInstance.current!.geocode(...args),
            reverseGeocode: (...args) => gebetaMapsInstance.current!.reverseGeocode(...args),
            getDirections: (...args) => gebetaMapsInstance.current!.getDirections(...args),
            displayRoute: (...args) => {
                gebetaMapsInstance.current!.displayRoute(...args);
                setCurrentRoute(gebetaMapsInstance.current!.getCurrentRoute());
            },
            clearRoute: () => {
                gebetaMapsInstance.current!.clearRoute();
                setCurrentRoute(null);
            },
            getCurrentRoute: () => gebetaMapsInstance.current!.getCurrentRoute(),
            getRouteSummary: () => gebetaMapsInstance.current!.getRouteSummary(),
            updateRouteStyle: (...args) => gebetaMapsInstance.current!.updateRouteStyle(...args),
            flyTo: (options) => gebetaMapsInstance.current!.flyTo(options),
        }), []);

        useEffect(() => {
            async function processStyle() {
                try {
                    let styleJson: any;

                    // Priority: mapStyleJson > mapStyle > default
                    if (mapStyleJson) {
                        // Use provided JSON directly
                        styleJson = mapStyleJson;
                    } else if (mapStyleUrl) {
                        // Fetch from URL
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
                    console.error("Error loading or modifying style JSON:", error);
                    Alert.alert("Map Style Load Error", String(error));
                    setLoading(false);
                }
            }

            processStyle();
        }, [apiKey, mapStyleUrl, mapStyleJson]);

        const handleMapLoad = async () => {
            if (gebetaMapsInstance.current && cameraRef.current) {
                gebetaMapsInstance.current.setCameraInstance(cameraRef.current);
            }

            //navigation img
            if (mapViewRef.current) {
                try {

                    const arrowSvg = `data:image/svg+xml;base64,${btoa(`
                        <svg width="50" height="50" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="25" cy="25" r="20" fill="#3B82F6" stroke="white" stroke-width="3"/>
                            <polygon points="25,10 18,32 25,28 32,32" fill="white"/>
                        </svg>
                    `)}`;

                    await mapViewRef.current.addImage('navigation-arrow', arrowSvg);
                } catch (error) {
                    console.log('Error adding navigation arrow image:', error);
                }
            }

            onMapLoaded?.();
        };

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
                    ref={(ref) => {
                        mapViewRef.current = ref;
                        if (ref) {
                            controller.setMapInstance(ref);
                        }
                    }}
                    style={styles.map}
                    mapStyle={mapStyleState}
                    attributionEnabled={false}
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
                        zoomLevel={zoom} />
                    {currentRoute && (
                        <>
                            <MapLibreGL.ShapeSource
                                id="route-source"
                                shape={currentRoute}
                            >
                                <MapLibreGL.LineLayer
                                    id="route-layer"
                                    style={{
                                        lineColor: currentRoute?.style?.color || '#007cbf',
                                        lineWidth: currentRoute?.style?.width || 3,
                                        lineOpacity: currentRoute?.style?.opacity || 1,
                                        lineCap: 'round',
                                        lineJoin: 'round'
                                    }}
                                />
                            </MapLibreGL.ShapeSource>
                        </>
                    )}
                    {showUserLocation && userLocation && (
                        <MapLibreGL.PointAnnotation
                            key={`user-${userLocation.lat}-${userLocation.lng}`}
                            id="user-location-marker"
                            coordinate={[userLocation.lng, userLocation.lat]}
                        >
                            <View style={{
                                width: 50,
                                height: 50,
                                alignItems: 'center',
                                justifyContent: 'center',
                                transform: [{ rotate: `${userHeading || 0}deg` }]
                            }}>
                                {/*outer glow*/}
                                <View style={{
                                    position: 'absolute',
                                    width: 50,
                                    height: 50,
                                    borderRadius: 25,
                                    backgroundColor: '#3B82F6',
                                    opacity: 0.2,
                                }} />
                                {/*main arrow shape*/}
                                <View style={{
                                    width: 0,
                                    height: 0,
                                    backgroundColor: 'transparent',
                                    borderStyle: 'solid',
                                    borderLeftWidth: 16,
                                    borderRightWidth: 16,
                                    borderBottomWidth: 40,
                                    borderLeftColor: 'transparent',
                                    borderRightColor: 'transparent',
                                    borderBottomColor: '#3B82F6',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.4,
                                    shadowRadius: 4,
                                    elevation: 8,
                                }}>
                                    {/*white border thing */}
                                    <View style={{
                                        position: 'absolute',
                                        top: 2,
                                        left: -14,
                                        width: 0,
                                        height: 0,
                                        backgroundColor: 'transparent',
                                        borderStyle: 'solid',
                                        borderLeftWidth: 14,
                                        borderRightWidth: 14,
                                        borderBottomWidth: 36,
                                        borderLeftColor: 'transparent',
                                        borderRightColor: 'transparent',
                                        borderBottomColor: '#FFFFFF',
                                    }} />
                                </View>
                            </View>
                        </MapLibreGL.PointAnnotation>
                    )}
                    {markers.map((marker, index) => (
                        <MapLibreGL.PointAnnotation
                            key={marker.id || index}
                            id={marker.id || `marker-${index}`}
                            coordinate={marker.coordinates}
                            title={marker.title || ''}
                            onSelected={() => {
                                if (marker.onSelected) {
                                    marker.onSelected(marker.coordinates, marker, null);
                                }
                            }}
                        >
                            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                {marker.icon ? (
                                    <Image
                                        source={{ uri: marker.icon }}
                                        style={{
                                            width: marker.iconSize?.[0] || 32,
                                            height: marker.iconSize?.[1] || 32,
                                        }}
                                        resizeMode="contain"
                                    />
                                ) : (
                                    marker.iconName && (
                                        <Ionicons
                                            name={marker.iconName as any}
                                            size={28}
                                            color={marker.color || '#EF4444'}
                                        />
                                    )
                                )}
                            </View>
                        </MapLibreGL.PointAnnotation>
                    ))}
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
        justifyContent: "center",
        alignItems: "center",
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

const GebetaMap = React.memo(GebetaMapImpl);

export default GebetaMap;

export type { Fence, FencePoint };
