import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
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
import { useTaxiRecalculation } from '../../navigation/hooks/useTaxiRecalculation';
import { SegmentProgressBar } from '../../navigation/components/SegmentProgressBar';
import { ArrivalModal } from '../../navigation/components/ArrivalModal';
import { decodeTaxiSegmentPaths } from '../../navigation/utils/navigationUtils';
import { segmentStartIndex } from '../../navigation/utils/taxiRecalcRules';
import { useRemoteConfig } from '../../../shared/contexts/RemoteConfigContext';
import LekfelPaySheet from '../components/LekfelPaySheet';

import LekfelLogo from '../../../../assets/images/lekfel.svg';

const NAV_GREEN = '#0F9D58';

export default function TaxiNavigationScreen() {
    useKeepAwake();
    const router = useRouter();
    const { t } = useTranslation();
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
    const [currentRoute, setCurrentRoute] = useState<TaxiNavigationResponse | null>(
        () => ({ ...routeData, planId: routeData.planId ?? Date.now() })
    );
    const [simulateMovement, setSimulateMovement] = useState(params.simulateMovement === 'true');
    const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);
    const [userHeading, setUserHeading] = useState(0);
    const [remainingDistance, setRemainingDistance] = useState(0);
    const [remainingTime, setRemainingTime] = useState(0);
    const [isOffRoute, setIsOffRoute] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [hasUserZoomedOut, setHasUserZoomedOut] = useState(false);
    const [showPaySheet, setShowPaySheet] = useState(false);
    const [routeEpoch, setRouteEpoch] = useState(0);


    const [navigationState, setNavigationState] = useState<{
        userLocation: { lat: number; lng: number; accuracy?: number; speed?: number } | null;
        segmentedRoutes: Array<{
            geoJSON: any;
            isWalking: boolean;
            segmentIndex: number;
        }>;
    }>({
        userLocation: null,
        segmentedRoutes: []
    });

    const {
        userLocation: bgUserLocation,
        setUserLocation: setBgUserLocation,
        stopLocationTracking: stopBackgroundTracking,
        startLocationTracking: startBackgroundTracking,
    } = useUserLocation();

    const latestNavLocationRef = useRef<{ lat: number; lng: number } | null>(null);

    const updateNavigationState = useCallback((
        location: { lat: number; lng: number; accuracy?: number; speed?: number },
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

    const setUserLocation = useCallback((location: { lat: number; lng: number; accuracy?: number; speed?: number }) => {
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

    useEffect(() => {
        if (userLocation) {
            latestNavLocationRef.current = { lat: userLocation.lat, lng: userLocation.lng };
        }
    }, [userLocation]);

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

        const paths = decodeTaxiSegmentPaths(activeRoute.segments ?? []);
        activeRoute.segments?.forEach((segment, idx) => {
            paths[idx].forEach(([lat, lng]: [number, number]) => {
                coords.push([lng, lat]);
            });
            distance += segment.distance * 1000;
            duration += segment.time;
        });

        allRouteCoordinates.current = coords;
        totalDistance.current = distance;
        totalDuration.current = duration;

        if (pendingClosestIndex.current !== null) {
            setClosestIndexRef.current(pendingClosestIndex.current);
            pendingClosestIndex.current = null;
        }

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

        const paths = decodeTaxiSegmentPaths(activeRoute.segments);

        const routes = activeRoute.segments.map((seg, idx) => {
            const coordinates = paths[idx].map(([lat, lng]: [number, number]) => [lng, lat] as [number, number]);

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

        if (__DEV__) {
            console.log('[TaxiDebug] source segments:', activeRoute.segments.map((seg, idx) => ({
                idx,
                type: seg.type,
                mode: seg.mode,
                polylineChars: seg.polyline?.length ?? 0,
                points: paths[idx].length,
                first: paths[idx][0],
                last: paths[idx][paths[idx].length - 1],
            })));
        }

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

    const setClosestIndexRef = useRef<(index: number) => void>(() => { });
    const currentSegmentIndexRef = useRef(0);
    const pendingClosestIndex = useRef<number | null>(null);

    const {
        recalculateRoute,
        observeFix,
        offRouteProfileRef,
        suggestion,
        isReplanning,
        acceptSuggestion,
        dismissSuggestion,
    } = useTaxiRecalculation({
        route: activeRoute,
        currentSegmentIndexRef,
        isNavigatingRef,
        setIsRecalculating,
        onRoutePatched: (patchedRoute, segmentIndex) => {
            const paths = decodeTaxiSegmentPaths(patchedRoute.segments ?? []);
            pendingClosestIndex.current = segmentStartIndex(
                paths.map((path) => path.length),
                segmentIndex
            );

            setCurrentRoute(patchedRoute);
            setRouteEpoch((epoch) => epoch + 1);
        },
        onReplanned: (newRoute) => {
            pendingClosestIndex.current = 0;
            setCurrentRoute(newRoute);
            setRouteEpoch((epoch) => epoch + 1);
            const boardingName = newRoute.segments?.find(
                (seg) => seg.mode === 'auto' || seg.type === 'taxi'
            )?.fromNode?.name;
            showToast(boardingName ? `New route: board at ${boardingName}` : 'New route calculated');
        },
    });

    const { startLocationTracking, stopLocationTracking, setClosestIndex } = useLocationTracking({
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
        recalculateRoute,
        offRouteProfileRef,
        activeSegmentIndexRef: currentSegmentIndexRef,
        rerouteTimeout,
        totalRouteDistance: totalDistance.current,
        totalRouteDuration: totalDuration.current,
        taxiSegments: activeRoute.segments,
        setSegmentedRoutes,
        updateNavigationState,
    });

    setClosestIndexRef.current = setClosestIndex;

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

    currentSegmentIndexRef.current = currentSegmentIndex;

    useEffect(() => {
        if (!userLocation) return;
        observeFix({ lat: userLocation.lat, lng: userLocation.lng }, isOffRoute);
    }, [userLocation, isOffRoute, observeFix]);

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

            if (!simulateMovement && latestNavLocationRef.current) {
                setBgUserLocation(latestNavLocationRef.current);
            }
            void startBackgroundTracking();
        };
    }, [simulateMovement]);

    const handleStopNavigation = () => {
        setIsNavigating(false);
        isNavigatingRef.current = false;
        stopSimulation();
        stopLocationTracking();
        router.back();
    };

    const handleRecenter = () => {
        if (!mapRef.current) return;

        (mapRef.current as any).recenterNavigation?.();
        setHasUserZoomedOut(false);
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
        currentSegmentIndex,
        drawn: segmentedRoutes.map(r =>
            `${r.segmentIndex}:${r.isWalking ? 'walk' : 'taxi'}:${r.geoJSON.geometry.coordinates.length}`
        ).join(' '),
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
                    routeGeoJSON={routeGeoJSON}
                    currentTaxiSegmentIndex={currentSegmentIndex}
                    userLocation={userLocation}
                    userHeading={userHeading}
                    showUserLocationMarker={true}
                    segmentedRoutes={segmentedRoutes}
                    routeEpoch={routeEpoch}
                    taxiStations={taxiStations.length > 0 ? taxiStations : undefined}
                    onUserInteraction={() => setHasUserZoomedOut(true)}
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
                            backgroundColor: '#0F9D58',
                            borderTopLeftRadius: 20,
                            borderTopRightRadius: 20,
                            borderBottomLeftRadius: 20,
                            borderBottomRightRadius: 0,
                            padding: 20,
                        }}
                    >
                        <Text className="text-white text-3xl font-bold mb-1">
                            {currentInstruction || (isOnTaxi ? 'Stay on taxi' : 'Walk to station')}
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>
                            for {formatDistance(remainingDistance)}
                        </Text>

                        <View className="flex-row items-center gap-3 mt-3">
                            <View className="flex-row items-center">
                                <View
                                    className="w-6 h-6 rounded-full items-center justify-center"
                                    style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
                                >
                                    <Ionicons
                                        name={isOnTaxi ? 'car' : 'walk'}
                                        size={14}
                                        color="white"
                                    />
                                </View>
                                <Text className="text-xs font-semibold ml-1.5 text-white">
                                    {isOnTaxi ? 'On Taxi' : 'Walking'}
                                </Text>
                            </View>
                            <View className="flex-row items-center">
                                <Ionicons name="cash" size={14} color="white" />
                                <Text className="font-bold ml-1 text-sm text-white">
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
                    {suggestion && (
                        <View
                            className="flex-row items-center rounded-2xl mb-3 px-3 py-2.5"
                            style={{
                                backgroundColor: isDark ? theme.surface : 'rgba(255, 255, 255, 0.97)',
                                borderWidth: 1,
                                borderColor: colors.primary.main,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.12,
                                shadowRadius: 8,
                                elevation: 4,
                            }}
                        >
                            <Ionicons name="alert-circle" size={20} color={colors.primary.main} />
                            <Text
                                className="flex-1 ml-2 text-sm"
                                style={{ color: theme.textPrimary }}
                                numberOfLines={2}
                            >
                                {suggestion.reason === 'unreachable'
                                    ? `Can't reach ${suggestion.targetName} from here`
                                    : `You've moved away from ${suggestion.targetName}`}
                            </Text>
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={acceptSuggestion}
                                disabled={isReplanning}
                                className="rounded-full px-3 py-1.5 ml-2"
                                style={{ backgroundColor: colors.primary.main, opacity: isReplanning ? 0.6 : 1 }}
                            >
                                {isReplanning ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text className="text-white text-xs font-semibold">
                                        {suggestion.reason === 'unreachable' ? 'New route' : 'New station'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={dismissSuggestion}
                                className="ml-1 p-1"
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="close" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    )}

                    <View className="flex-row mb-3">
                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => setShowPaySheet(true)}
                            className="flex-row items-center rounded-full"
                            style={{
                                backgroundColor: '#DCFCE7',
                                borderWidth: 1,
                                borderColor: theme.green,
                                paddingVertical: 4,
                                paddingHorizontal: 6,
                                paddingRight: 14,
                            }}
                        >
                            <LekfelLogo width={26} height={26} />
                            <Text
                                className="ml-1.5"
                                style={{ color: theme.textPrimary, fontSize: 13, fontFamily: 'PlusJakartaSans-Bold' }}
                            >
                                {t('pay-with-lekfel')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {hasUserZoomedOut && (
                        <View className="items-center mb-3">
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={handleRecenter}
                                className="flex-row items-center rounded-full"
                                style={{
                                    backgroundColor: theme.surface,
                                    paddingVertical: 12,
                                    paddingHorizontal: 22,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.18,
                                    shadowRadius: 6,
                                    elevation: 5,
                                }}
                            >
                                <Ionicons name="navigate" size={20} color={NAV_GREEN} />
                                <Text
                                    className="font-semibold ml-2"
                                    style={{ color: theme.textPrimary, fontSize: 16 }}
                                >
                                    Re-center
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

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
                                onPress={handleStopNavigation}
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 24,
                                    backgroundColor: theme.surface,
                                    borderWidth: 2,
                                    borderColor: NAV_GREEN,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginLeft: 12,
                                }}
                            >
                                <Ionicons name="close" size={24} color={NAV_GREEN} />
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

                <LekfelPaySheet
                    visible={showPaySheet}
                    onClose={() => setShowPaySheet(false)}
                    originName={activeRoute?.startNode?.name}
                    originLat={activeRoute?.startNode?.lat}
                    originLng={activeRoute?.startNode?.lng}
                    destinationName={endNode.name}
                    destinationLat={endNode.lat}
                    destinationLng={endNode.lng}
                />
            </View>
        </View>
    );
}
