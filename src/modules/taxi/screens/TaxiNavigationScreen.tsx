import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GebetaMap from '../../../components/GebetaMap';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { showToast } from '../../../shared/utils/toast';
import { useMapTheme } from '../../map/context/MapThemeContext';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { TaxiNavigationResponse } from '../types/taxi.types';
import { useTaxiNavigation } from '../../navigation/hooks/useTaxiNavigation';
import { useTaxiSimulation } from '../../navigation/hooks/useTaxiSimulation';
import { useLocationTracking } from '../../navigation/hooks/useLocationTracking';
import { SegmentProgressBar } from '../../navigation/components/SegmentProgressBar';
import { ArrivalModal } from '../../navigation/components/ArrivalModal';
import { decodePolyline } from '../../../shared/utils/polyline';
import { useRemoteConfig } from '../../../shared/contexts/RemoteConfigContext';

export default function TaxiNavigationScreen() {
    useKeepAwake();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { currentTheme } = useMapTheme();
    const { colors: theme, isDark } = useTheme();
    const { apiKey } = useRemoteConfig();
    const mapRef = useRef<GebetaMapRef>(null);

    const routeData: TaxiNavigationResponse | null = params.routeData
        ? JSON.parse(params.routeData as string)
        : null;

    if (!routeData) {
        return (
            <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
                <Text style={{ color: theme.textSecondary }}>Error loading route</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-4">
                    <Text style={{ color: theme.primary }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const [mapReady, setMapReady] = useState(false);
    const [showArrivalModal, setShowArrivalModal] = useState(false);
    const [isNavigating, setIsNavigating] = useState(true);
    const [currentRoute, setCurrentRoute] = useState<TaxiNavigationResponse | null>(routeData);
    const [simulateMovement, setSimulateMovement] = useState(params.simulateMovement === 'true');
    const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);
    const [userHeading, setUserHeading] = useState(0);
    const [remainingDistance, setRemainingDistance] = useState(0);
    const [remainingTime, setRemainingTime] = useState(0);
    const [isOffRoute, setIsOffRoute] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);


    const [navigationState, setNavigationState] = useState<{
        userLocation: { lat: number; lng: number } | null;
        segmentedRoutes: Array<{
            geoJSON: any;
            isWalking: boolean;
            segmentIndex: number;
        }>;
    }>({
        userLocation: null,
        segmentedRoutes: []
    });

    const { userLocation: bgUserLocation, setUserLocation: setBgUserLocation, stopLocationTracking: stopBackgroundTracking } = useUserLocation();

    const updateNavigationState = useCallback((
        location: { lat: number; lng: number },
        routes: Array<{
            geoJSON: any;
            isWalking: boolean;
            segmentIndex: number;
        }>
    ) => {
        setNavigationState({
            userLocation: location,
            segmentedRoutes: routes
        });
    }, []);

    const setUserLocation = useCallback((location: { lat: number; lng: number }) => {
        setNavigationState(prev => ({
            ...prev,
            userLocation: location
        }));
    }, []);

    const setSegmentedRoutes = useCallback((routes: Array<{
        geoJSON: any;
        isWalking: boolean;
        segmentIndex: number;
    }>) => {
        setNavigationState(prev => ({
            ...prev,
            segmentedRoutes: routes
        }));
    }, []);

    const userLocation = navigationState.userLocation;
    const segmentedRoutes = navigationState.segmentedRoutes;

    const [initialCenter] = useState<[number, number]>([routeData.origin.lng, routeData.origin.lat]);
    const [initialZoom] = useState(15);

    const activeRoute = currentRoute || routeData;

    const taxiStations = activeRoute.segments ? [
        {
            id: activeRoute.startNode?.id || 1,
            name: activeRoute.startNode?.name || 'Start',
            lat: activeRoute.startNode?.lat || 0,
            lng: activeRoute.startNode?.lng || 0,
            type: 'start' as const
        },
        {
            id: activeRoute.endNode?.id || 2,
            name: activeRoute.endNode?.name || 'End',
            lat: activeRoute.endNode?.lat || 0,
            lng: activeRoute.endNode?.lng || 0,
            type: 'end' as const
        }
    ] : [];

    const allRouteCoordinates = useRef<[number, number][]>([]);
    const totalDistance = useRef<number>(0);
    const totalDuration = useRef<number>(0);
    const isNavigatingRef = useRef(true);
    const rerouteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const coords: [number, number][] = [];
        let distance = 0;
        let duration = 0;

        activeRoute.segments?.forEach(segment => {
            try {
                const decoded = decodePolyline(segment.polyline, 6);
                decoded.forEach(([lat, lng]: [number, number]) => {
                    coords.push([lng, lat]);
                });
                distance += segment.distance * 1000;
                duration += segment.time;
            } catch (error) {
                console.error('Error decoding segment:', error);
            }
        });

        allRouteCoordinates.current = coords;
        totalDistance.current = distance;
        totalDuration.current = duration;

        if (coords.length > 0) {
            setRouteGeoJSON({
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: coords,
                }
            });
        }

        console.log('[Taxi Navigation] Built complete route:', {
            points: coords.length,
            distance,
            duration,
        });
    }, [activeRoute]);

    useEffect(() => {
        if (!activeRoute.segments) return;

        const routes = activeRoute.segments.map((seg, idx) => {
            const decoded = decodePolyline(seg.polyline, 6);
            const coordinates = decoded.map(([lat, lng]: [number, number]) => [lng, lat] as [number, number]);

            return {
                geoJSON: {
                    type: 'Feature' as const,
                    properties: { segmentIndex: idx },
                    geometry: {
                        type: 'LineString' as const,
                        coordinates
                    }
                },
                isWalking: seg.type === 'walk' || seg.mode === 'pedestrian',
                segmentIndex: idx
            };
        });

        setSegmentedRoutes(routes);
    }, [activeRoute]);

    const { startSimulation, stopSimulation, simulateOffRoute, isSimulating } = useTaxiSimulation({
        routeCoordinates: allRouteCoordinates,
        isNavigatingRef,
        mapRef,
        setUserLocation,
        setCurrentHeading: setUserHeading,
        setRouteGeoJSON,
        setRemainingDistance,
        setRemainingTime,
        updateInstructionBasedOnPosition: () => { },
        onArrival: () => {
            setShowArrivalModal(true);
            setIsNavigating(false);
        },
        totalRouteDistance: totalDistance.current,
        totalRouteDuration: totalDuration.current,
        taxiSegments: activeRoute.segments,
        setSegmentedRoutes,
        updateNavigationState,
    });

    const { startLocationTracking, stopLocationTracking } = useLocationTracking({
        routeCoordinates: allRouteCoordinates,
        isNavigatingRef,
        mapRef,
        isOffRoute,
        setUserLocation,
        setCurrentHeading: setUserHeading,
        setRouteGeoJSON,
        setRemainingDistance,
        setRemainingTime,
        setIsOffRoute,
        setIsRecalculating,
        updateInstructionBasedOnPosition: () => { },
        recalculateRoute: async (fromLocation) => {
            if (!fromLocation) return;

            setIsRecalculating(true);
            showToast.info('Recalculating', 'Finding new route...');

            try {
                const { taxiService } = await import('../../taxi/services/taxi.service');
                const newRoute = await taxiService.requestTaxiNavigation({
                    origin: [fromLocation.lat, fromLocation.lng],
                    destination: [
                        activeRoute.destination.lat,
                        activeRoute.destination.lng,
                    ],
                });

                if (newRoute.success && newRoute.segments) {
                    setCurrentRoute(newRoute);

                    const coords: [number, number][] = [];
                    let distance = 0;
                    let duration = 0;

                    newRoute.segments?.forEach(segment => {
                        try {
                            const decoded = decodePolyline(segment.polyline, 6);
                            decoded.forEach(([lat, lng]: [number, number]) => {
                                coords.push([lng, lat]);
                            });
                            distance += segment.distance * 1000;
                            duration += segment.time;
                        } catch (error) {
                            console.error('Error decoding segment:', error);
                        }
                    });

                    allRouteCoordinates.current = coords;
                    totalDistance.current = distance;
                    totalDuration.current = duration;

                    showToast.success('Route Updated', 'New route calculated');
                } else {
                    showToast.error('Recalculation Failed', 'Could not find alternative route');
                }
            } catch (error) {
                console.error('Recalculation error:', error);
                showToast.error('Error', 'Failed to recalculate route');
            } finally {
                setIsRecalculating(false);
            }
        },
        rerouteTimeout,
        totalRouteDistance: totalDistance.current,
        totalRouteDuration: totalDuration.current,
        taxiSegments: activeRoute.segments,
        setSegmentedRoutes,
        updateNavigationState,
    });

    const {
        currentSegmentIndex,
        currentSegment,
        isOnTaxi,
        currentInstruction,
        endNode,
        totalFare,
        currency,
    } = useTaxiNavigation({
        taxiRoute: activeRoute,
        mapRef,
        userLocation,
        setUserLocation,
        onNavigationComplete: () => {
            setShowArrivalModal(true);
            setIsNavigating(false);
        },
        onRouteUpdate: (newRoute) => {
            setCurrentRoute(newRoute);
        },
    });

    const progressSegments = activeRoute.segments?.map((seg, idx) => ({
        type: (seg.mode === 'pedestrian' || seg.type === 'walk' ? 'walk' : 'taxi') as 'walk' | 'taxi',
        label: seg.mode === 'pedestrian' || seg.type === 'walk'
            ? idx === 0 ? 'Walk' : 'Walk'
            : 'Taxi',
    })) || [];

    useEffect(() => {
        console.log('[Taxi Nav] Starting navigation, simulateMovement:', simulateMovement);

        stopBackgroundTracking();

        if (simulateMovement) {
            startSimulation();
        } else {
            startLocationTracking();
        }

        return () => {
            console.log('[Taxi Nav] Cleaning up navigation');
            stopLocationTracking();
            stopSimulation();
        };
    }, [simulateMovement]);

    const handleStopNavigation = () => {
        setIsNavigating(false);
        isNavigatingRef.current = false;
        stopSimulation();
        stopLocationTracking();
        router.back();
    };

    const formatDistance = (meters: number): string => {
        if (meters < 1000) {
            return `${Math.round(meters)} m`;
        }
        return `${(meters / 1000).toFixed(1)} km`;
    };

    const formatTime = (seconds: number): string => {
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
            return `${minutes} min`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    };

    console.log('[TaxiNav] Rendering map with segmentedRoutes:', {
        count: segmentedRoutes.length,
        isTaxiNavigation: true,
        currentSegmentIndex
    });

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <View className="flex-1">
                <GebetaMap
                    ref={mapRef}
                    apiKey={apiKey || ''}
                    mapStyleUrl={currentTheme.styleUrl ? `${currentTheme.styleUrl}?apiKey=${apiKey}` : undefined}
                    mapStyleJson={currentTheme.styleJson}
                    center={initialCenter}
                    zoom={initialZoom}
                    onMapLoaded={() => setMapReady(true)}
                    isNavigating={isNavigating}
                    isTaxiNavigation={true}
                    currentTaxiSegmentIndex={currentSegmentIndex}
                    userLocation={userLocation}
                    userHeading={userHeading}
                    showUserLocationMarker={true}
                    segmentedRoutes={segmentedRoutes}
                    taxiStations={taxiStations.length > 0 ? taxiStations : undefined}
                />

                {(isOffRoute || isRecalculating) && (
                    <View
                        className="absolute right-4 rounded-2xl px-4 py-2 shadow-lg flex-row items-center"
                        style={{
                            top: insets.top + 16,
                            backgroundColor: isDark ? theme.surface : 'rgba(255, 255, 255, 0.95)',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 8,
                            elevation: 4,
                        }}
                    >
                        {isRecalculating && (
                            <ActivityIndicator size="small" color={colors.primary.main} style={{ marginRight: 8 }} />
                        )}
                        <Text className="font-semibold" style={{ color: colors.primary.main }}>
                            {isRecalculating ? 'Recalculating...' : 'Off Route'}
                        </Text>
                    </View>
                )}

                <View className="absolute left-4 right-4" style={{ top: insets.top + 18 }}>
                    <View
                        style={{
                            backgroundColor: isDark ? theme.surface : 'rgba(255, 255, 255, 0.95)',
                            borderRadius: 20,
                            padding: 20,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 12,
                            elevation: 5,
                        }}
                    >
                        <View className="flex-row items-start justify-between mb-3">
                            <View className="flex-1">
                                <Text className="text-3xl font-bold mb-1" style={{ color: theme.textPrimary }}>
                                    {currentInstruction || (isOnTaxi ? 'Stay on taxi' : 'Walk to station')}
                                </Text>
                                <Text className="text-base" style={{ color: theme.textSecondary }}>
                                    for {formatDistance(remainingDistance)}
                                </Text>
                            </View>
                        </View>

                        <View className="flex-row items-center gap-3">
                            <View className="flex-row items-center">
                                <View
                                    className="w-6 h-6 rounded-full items-center justify-center"
                                    style={{ backgroundColor: isOnTaxi ? colors.primary.main : theme.blue }}
                                >
                                    <Ionicons
                                        name={isOnTaxi ? 'car' : 'walk'}
                                        size={14}
                                        color="white"
                                    />
                                </View>
                                <Text className="text-xs font-semibold ml-1.5" style={{ color: theme.textPrimary }}>
                                    {isOnTaxi ? 'On Taxi' : 'Walking'}
                                </Text>
                            </View>
                            <View className="flex-row items-center">
                                <Ionicons name="cash" size={14} color={colors.primary.main} />
                                <Text className="font-bold ml-1 text-sm" style={{ color: colors.primary.main }}>
                                    {totalFare} {currency}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View
                    className="absolute left-4 right-4"
                    style={{ bottom: insets.bottom + 24 }}
                >
                    <View
                        className="rounded-3xl p-4"
                        style={{
                            backgroundColor: isDark ? theme.surface : 'rgba(255, 255, 255, 0.95)',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 12,
                            elevation: 5,
                        }}
                    >

                        <View className="flex-row items-center justify-between mb-3">
                            <View className="flex-1">
                                <Text className="text-2xl font-bold" style={{ color: theme.textPrimary }}>
                                    {formatTime(remainingTime)}
                                </Text>
                                <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                                    ETA {new Date(Date.now() + remainingTime * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                </Text>
                                <Text className="text-sm font-semibold mt-1" style={{ color: theme.textPrimary }} numberOfLines={1}>
                                    {endNode.name}
                                </Text>
                            </View>

                            <TouchableOpacity
                                className="rounded-xl px-6 py-3"
                                style={{ backgroundColor: colors.primary.main }}
                                onPress={handleStopNavigation}
                            >
                                <Text className="text-white text-sm font-bold">
                                    Exit
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <SegmentProgressBar
                            segments={progressSegments}
                            currentIndex={currentSegmentIndex}
                        />
                    </View>
                </View>

                <ArrivalModal
                    visible={showArrivalModal}
                    onClose={() => {
                        setShowArrivalModal(false);
                        router.back();
                    }}
                    destinationName={endNode.name}
                />
            </View>
        </View>
    );
}
