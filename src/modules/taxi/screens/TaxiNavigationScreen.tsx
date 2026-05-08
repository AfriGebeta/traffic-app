import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GebetaMap from '../../../components/GebetaMap';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { colors } from '../../../shared/theme/colors';
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

export default function TaxiNavigationScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { currentTheme } = useMapTheme();
    const mapRef = useRef<GebetaMapRef>(null);

    const routeData: TaxiNavigationResponse | null = params.routeData
        ? JSON.parse(params.routeData as string)
        : null;

    if (!routeData) {
        return (
            <View className="flex-1 bg-gray-50 items-center justify-center">
                <Text className="text-gray-600">Error loading route</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-4">
                    <Text className="text-orange-500">Go Back</Text>
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

    const { userLocation, setUserLocation } = useUserLocation();

    const [initialCenter] = useState<[number, number]>([routeData.origin.lng, routeData.origin.lat]);
    const [initialZoom] = useState(15);

    const activeRoute = currentRoute || routeData;

    const allRouteCoordinates = useRef<[number, number][]>([]);
    const totalDistance = useRef<number>(0);
    const totalDuration = useRef<number>(0);
    const isNavigatingRef = useRef(true);
    const rerouteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [segmentedRoutes, setSegmentedRoutes] = useState<Array<{
        geoJSON: any;
        isWalking: boolean;
        segmentIndex: number;
    }>>([]);

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
    });

    const { startLocationTracking, stopLocationTracking } = useLocationTracking({
        routeCoordinates: allRouteCoordinates,
        isNavigatingRef,
        mapRef,
        isOffRoute: false,
        setUserLocation,
        setCurrentHeading: setUserHeading,
        setRouteGeoJSON,
        setRemainingDistance,
        setRemainingTime,
        setIsOffRoute: () => { },
        setIsRecalculating: () => { },
        updateInstructionBasedOnPosition: () => { },
        recalculateRoute: async () => { },
        rerouteTimeout,
        totalRouteDistance: totalDistance.current,
        totalRouteDuration: totalDuration.current,
        taxiSegments: activeRoute.segments,
        setSegmentedRoutes,
    });

    const {
        currentSegmentIndex,
        currentSegment,
        isOnTaxi,
        currentInstruction,
        isOffRoute,
        isRecalculating,
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
        <View className="flex-1 bg-gray-50">
            <View className="flex-1">
                <GebetaMap
                    ref={mapRef}
                    apiKey={process.env.EXPO_PUBLIC_GEBETA_API_KEY || ''}
                    mapStyleUrl={currentTheme.styleUrl ? `${currentTheme.styleUrl}?apiKey=${process.env.EXPO_PUBLIC_GEBETA_API_KEY}` : undefined}
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
                />

                {!mapReady && (
                    <View className="absolute inset-0 items-center justify-center bg-gray-100">
                        <ActivityIndicator size="large" color={colors.primary.main} />
                    </View>
                )}

                {(isOffRoute || isRecalculating) && (
                    <View
                        className="absolute right-4 rounded-2xl px-4 py-2 shadow-lg flex-row items-center border border-orange-500/50"
                        style={{
                            top: insets.top + 16,
                            backgroundColor: 'rgba(249, 115, 22, 0.9)'
                        }}
                    >
                        {isRecalculating && (
                            <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                        )}
                        <Text className="text-white font-semibold">
                            {isRecalculating ? 'Recalculating...' : 'Off Route'}
                        </Text>
                    </View>
                )}

                {/* Top Navigation Bar - Floating Style */}
                <View className="absolute left-4 right-4" style={{ top: insets.top + 18 }}>
                    <View
                        className="border border-white/10"
                        style={{
                            backgroundColor: 'rgba(55, 65, 81, 0.75)',
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            borderBottomLeftRadius: 24,
                            borderBottomRightRadius: 0,
                            padding: 16,
                        }}
                    >
                        <View className="flex-row items-start justify-between">
                            <View className="flex-1">
                                <View className="flex-row items-baseline gap-2 mb-1">
                                    <Text className="text-white text-2xl font-extrabold">
                                        {formatDistance(remainingDistance)}
                                    </Text>
                                    <Text className="text-gray-300 text-base font-bold">
                                        • {formatTime(remainingTime)}
                                    </Text>
                                </View>

                                <Text className="text-gray-300 text-sm font-semibold mb-2" numberOfLines={1}>
                                    {endNode.name}
                                </Text>

                                <View className="flex-row items-center gap-3">
                                    <View className="flex-row items-center">
                                        <View
                                            className="w-6 h-6 rounded-full items-center justify-center"
                                            style={{ backgroundColor: isOnTaxi ? colors.primary.main : '#3B82F6' }}
                                        >
                                            <Ionicons
                                                name={isOnTaxi ? 'car' : 'walk'}
                                                size={14}
                                                color="white"
                                            />
                                        </View>
                                        <Text className="text-gray-300 text-xs font-semibold ml-1.5">
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

                            <TouchableOpacity
                                className="bg-white/10 rounded-full p-3"
                                onPress={handleStopNavigation}
                                style={{ borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)' }}
                            >
                                <Ionicons name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        {currentInstruction && (
                            <View className="absolute -bottom-10 -right-0.5">
                                <View
                                    className="px-3 py-2 flex-row items-center gap-2 border border-white/10"
                                    style={{
                                        backgroundColor: 'rgba(55, 65, 81, 0.75)',
                                        borderTopLeftRadius: 0,
                                        borderTopRightRadius: 0,
                                        borderBottomLeftRadius: 12,
                                        borderBottomRightRadius: 12,
                                    }}
                                >
                                    <Ionicons
                                        name={isOnTaxi ? 'car' : 'walk'}
                                        size={18}
                                        color={colors.primary.main}
                                    />
                                    <Text className="text-white text-xs font-bold" numberOfLines={1} style={{ maxWidth: 150 }}>
                                        {currentInstruction}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>

                <View
                    className="absolute left-4 right-4"
                    style={{ bottom: insets.bottom + 24 }}
                >
                    <View
                        className="rounded-3xl p-4 border border-white/10"
                        style={{ backgroundColor: 'rgba(55, 65, 81, 0.75)' }}
                    >
                        {/* Segment Progress Bar */}
                        <View className="mb-3">
                            <SegmentProgressBar
                                segments={progressSegments}
                                currentIndex={currentSegmentIndex}
                            />
                        </View>

                        {currentSegment && (
                            <View className="bg-white/10 rounded-xl p-3 border border-white/10">
                                <Text className="text-gray-400 text-xs mb-1">
                                    {isOnTaxi ? 'Exit at' : 'Heading to'}
                                </Text>
                                <Text className="text-white font-semibold">
                                    {currentSegment.toNode?.name || 'Destination'}
                                </Text>
                            </View>
                        )}
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
