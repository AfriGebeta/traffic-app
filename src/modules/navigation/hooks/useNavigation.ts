import { useState, useRef, useEffect } from 'react';
import * as Location from 'expo-location';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import type { GeocodingPlace, Leg, Maneuver } from '../types/navigation.types';
import { navigationService } from '../services/navigation.service';
import { showToast } from '../../../shared/utils/toast';
import { voiceNavigationService } from '../services/voice-navigation.service';
import { decodePolyline } from '../../../shared/utils/polyline';
import { useSimulation } from './useSimulation';
import { useLocationTracking } from './useLocationTracking';
import { useRouteRecalculation } from './useRouteRecalculation';
import { useInstructionEngine } from './useInstructionEngine';
import { ManeuverType } from '../utils/instructionEngine';
import { startNavService, stopNavService, updateNavNotification } from '../services/nav-foreground-service';
import { addNavExitListener } from '../../../../modules/nav-notification';
import { dashboardEventsService } from '../../../shared/services/dashboard-events.service';
import { calculateBearing, calculateDistance } from '../utils/navigationUtils';
import { useTranslation } from '../../../shared/hooks/useTranslation';

export const useNavigation = (
    mapRef: React.RefObject<GebetaMapRef | null>,
    userLocation: { lat: number; lng: number } | null,
    setUserLocation?: (location: { lat: number; lng: number }) => void,
    stopBackgroundTracking?: () => void,
    startBackgroundTracking?: () => Promise<void>
) => {
    const { t } = useTranslation();
    const [selectedDestination, setSelectedDestination] = useState<GeocodingPlace | null>(null);
    const [waypoints, setWaypoints] = useState<GeocodingPlace[]>([]);
    const [isNavigating, setIsNavigating] = useState(false);
    const [navigationMode, setNavigationMode] = useState(false);
    const [showRoutePreview, setShowRoutePreview] = useState(false);
    const [currentHeading, setCurrentHeading] = useState(0);
    const [simulateMovement, setSimulateMovement] = useState(false);

    const [remainingDistance, setRemainingDistance] = useState<number>(0);
    const [remainingTime, setRemainingTime] = useState<number>(0);

    const [currentSpeed, setCurrentSpeed] = useState<number>(0);
    const [isOffRoute, setIsOffRoute] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);
    const [fullRouteCoordinates, setFullRouteCoordinates] = useState<[number, number][]>([]);
    const [showArrivalModal, setShowArrivalModal] = useState(false);
    const [arrivalStage, setArrivalStage] = useState<'approaching' | 'arrived'>('approaching');
    const [currentCosting, setCurrentCosting] = useState<'auto' | 'pedestrian'>('auto');
    const [routeOrigin, setRouteOrigin] = useState<GeocodingPlace | null>(null);
    const [routeManeuversList, setRouteManeuversList] = useState<Maneuver[]>([]);
    const [routeLegs, setRouteLegs] = useState<Leg[]>([]);

    interface RouteOption {
        geoJSON: any;
        distance: number;
        duration: number;
        coordinates: [number, number][];
        maneuvers: Maneuver[];
        legs: Leg[];
    }

    const [allRouteOptions, setAllRouteOptions] = useState<RouteOption[]>([]);
    const allRouteOptionsRef = useRef<RouteOption[]>([]);
    const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
    const [alternativeRoutesGeoJSON, setAlternativeRoutesGeoJSON] = useState<any[]>([]);

    const routeCoordinates = useRef<[number, number][]>([]);
    const isNavigatingRef = useRef(false);
    const rerouteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const navigateRequestIdRef = useRef(0);
    const previewRouteCacheRef = useRef<Map<string, RouteOption[]>>(new Map());
    const currentDestination = useRef<GeocodingPlace | null>(null);
    const routeManeuvers = useRef<any[]>([]);
    const currentManeuverIndex = useRef(0);
    const stopNavigationRef = useRef<(() => void) | null>(null);
    const totalRouteDistance = useRef<number>(0);
    const totalRouteDuration = useRef<number>(0);

    const currentCostingRef = useRef<'auto' | 'pedestrian'>('auto');
    const waypointsRef = useRef<GeocodingPlace[]>([]);
    const currentSpeedRef = useRef(0);
    useEffect(() => { currentCostingRef.current = currentCosting; }, [currentCosting]);
    useEffect(() => { waypointsRef.current = waypoints; }, [waypoints]);
    useEffect(() => { currentSpeedRef.current = currentSpeed; }, [currentSpeed]);

    useEffect(() => {
        const sub = addNavExitListener(() => {
            if (isNavigatingRef.current) {
                stopNavigationRef.current?.();
            }
        });
        return () => sub.remove();
    }, []);


    const instructionEngine = useInstructionEngine({
        legs: routeLegs,
        userLocation,
        speedKmh: currentSpeed,
        isNavigating: navigationMode && !isRecalculating,
        voiceEnabled: true,
    });

    const engineState = instructionEngine.state;

    //simulation hook
    const { startSimulation, stopSimulation, simulateOffRoute: simulateOffRouteInternal } = useSimulation({
        routeCoordinates,
        isNavigatingRef,
        mapRef,
        setUserLocation,
        setCurrentHeading,
        setRouteGeoJSON,
        setRemainingDistance,
        setRemainingTime,
        onSimulationComplete: () => {
            setArrivalStage('arrived');
            setShowArrivalModal(true);
            stopNavigationRef.current?.();
        },
        onArrival: () => {
            setArrivalStage('approaching');
            setShowArrivalModal(true);
        },
        totalRouteDistance: totalRouteDistance.current,
        totalRouteDuration: totalRouteDuration.current,
    });

    //location tracking hook
    const { startLocationTracking, stopLocationTracking, resetClosestIndex } = useLocationTracking({
        routeCoordinates,
        isNavigatingRef,
        mapRef,
        isOffRoute,
        setUserLocation,
        setCurrentHeading,

        setRouteGeoJSON,
        setRemainingDistance,
        setRemainingTime,

        setIsOffRoute,
        setIsRecalculating,
        setCurrentSpeed,
        recalculateRoute: (fromLocation?: { lat: number; lng: number }) => recalculateRoute(fromLocation),
        rerouteTimeout,
        totalRouteDistance: totalRouteDistance.current,
        totalRouteDuration: totalRouteDuration.current,
        routeManeuversRef: routeManeuvers,
        currentManeuverIndexRef: currentManeuverIndex,
        onArrival: () => {
            setArrivalStage('approaching');
            setShowArrivalModal(true);
        },
        onDestinationReached: () => {
            setArrivalStage('arrived');
            setShowArrivalModal(true);
            stopNavigationRef.current?.();
        },
    });

    const { recalculateRoute } = useRouteRecalculation({
        mapRef,
        userLocation,
        currentDestination,
        currentCostingRef,
        waypointsRef,
        routeCoordinates,
        routeManeuvers,
        currentManeuverIndexRef: currentManeuverIndex,
        totalRouteDistance,
        totalRouteDuration,
        rerouteTimeout,
        simulateMovement,

        setFullRouteCoordinates,
        setRouteGeoJSON,
        setIsRecalculating,
        setIsOffRoute,
        setIsNavigating,
        isNavigatingRef,

        setRemainingDistance,
        setRemainingTime,
        setRouteLegs,
        setRouteManeuversList,
        handleStopNavigation: () => {
            if (stopNavigationRef.current) {
                stopNavigationRef.current();
            }
        },
        onArrival: () => {
            setArrivalStage('approaching');
            setShowArrivalModal(true);
        },
        startSimulation,
        resetClosestIndex,
        setUserLocation,
    });

    const parseLegsIntoOption = (legs: Leg[]): Omit<RouteOption, 'geoJSON'> & { geoJSON: any } => {
        const coords: [number, number][] = [];
        const maneuvers: Maneuver[] = [];
        let distance = 0;
        let duration = 0;
        for (let i = 0; i < legs.length; i++) {
            const leg = legs[i];
            const decoded = decodePolyline(leg.shape, 6);
            const legCoords = decoded.map(c => [c[1], c[0]]) as [number, number][];
            if (i === 0) coords.push(...legCoords);
            else coords.push(...legCoords.slice(1));
            maneuvers.push(...leg.maneuvers);
            distance += leg.summary.length * 1000;
            duration += leg.summary.time;
        }
        const geoJSON = {
            type: 'Feature',
            properties: { distance, duration },
            geometry: { type: 'LineString', coordinates: coords },
        };
        return { geoJSON, distance, duration, coordinates: coords, maneuvers, legs };
    };

    const handleSelectRoute = (index: number) => {
        const option = allRouteOptionsRef.current[index];
        if (!option) return;
        setRouteGeoJSON(option.geoJSON);
        setRemainingDistance(option.distance);
        setRemainingTime(option.duration);
        routeCoordinates.current = option.coordinates;
        setFullRouteCoordinates(option.coordinates);
        totalRouteDistance.current = option.distance;
        totalRouteDuration.current = option.duration;
        routeManeuvers.current = option.maneuvers;
        setRouteManeuversList(option.maneuvers);
        setRouteLegs(option.legs);
        setSelectedRouteIndex(index);
        setAlternativeRoutesGeoJSON(
            allRouteOptionsRef.current.filter((_, i) => i !== index).map(r => r.geoJSON)
        );
    };

    const MAX_ROUTE_OPTIONS = 2;

    const buildPreviewCacheKey = (
        costing: 'auto' | 'pedestrian',
        targetDestination: GeocodingPlace,
        activeWaypoints: GeocodingPlace[],
        customOrigin: GeocodingPlace | null
    ) => [
        costing,
        `${targetDestination.latitude},${targetDestination.longitude}`,
        activeWaypoints.map(wp => `${wp.latitude},${wp.longitude}`).join(';'),
        customOrigin ? `${customOrigin.latitude},${customOrigin.longitude}` : 'user-location',
    ].join('|');

    const applyRouteOptions = (routeOptions: RouteOption[]) => {
        const main = routeOptions[0];
        allRouteOptionsRef.current = routeOptions;
        setAllRouteOptions(routeOptions);
        setSelectedRouteIndex(0);
        setAlternativeRoutesGeoJSON(routeOptions.slice(1).map(r => r.geoJSON));
        routeManeuvers.current = main.maneuvers;
        setRouteManeuversList(main.maneuvers);
        setRouteLegs(main.legs);
        routeCoordinates.current = main.coordinates;
        setFullRouteCoordinates(main.coordinates);
        totalRouteDistance.current = main.distance;
        totalRouteDuration.current = main.duration;
        setRemainingDistance(main.distance);
        setRemainingTime(main.duration);
        setRouteGeoJSON(main.geoJSON);
    };

    const fetchAlternativeRoutes = async (
        originCoords: [number, number],
        targetDestination: GeocodingPlace,
        activeWaypoints: GeocodingPlace[],
        primaryOption: RouteOption,
        previewCacheKey?: string
    ) => {
        try {
            const data = await navigationService.getNavigation({
                origin: originCoords,
                destination: [targetDestination.latitude, targetDestination.longitude],
                costing: 'auto',
                waypoints: activeWaypoints.length > 0
                    ? activeWaypoints.map(wp => [wp.latitude, wp.longitude] as [number, number])
                    : undefined,
                alternative: true,
            });

            // Discard if the user has started a different navigation in the meantime.
            if (allRouteOptionsRef.current[0] !== primaryOption) return;

            const alts = data?.data?.alternates ?? [];
            const routeOptions: RouteOption[] = [primaryOption];
            for (const alt of alts) {
                if (routeOptions.length >= MAX_ROUTE_OPTIONS) break;
                const altLegs = alt.trip?.legs;
                if (!altLegs || altLegs.length === 0) continue;
                routeOptions.push(parseLegsIntoOption(altLegs));
            }

            if (routeOptions.length <= 1) return; // no usable alternatives

            allRouteOptionsRef.current = routeOptions;
            setAllRouteOptions(routeOptions);
            setAlternativeRoutesGeoJSON(routeOptions.slice(1).map(r => r.geoJSON));
            if (previewCacheKey) {
                previewRouteCacheRef.current.set(previewCacheKey, routeOptions);
            }
        } catch {
            // Alternatives are best-effort; keep the primary route on failure.
        }
    };

    const handleNavigate = async (
        setUserLocation?: (location: { lat: number; lng: number }) => void,
        destination?: GeocodingPlace,
        costingOverride?: 'auto' | 'pedestrian',
        waypointsOverride?: GeocodingPlace[],
        originOverride?: GeocodingPlace | null
    ) => {
        const targetDestination = destination || selectedDestination;

        if (originOverride !== undefined) {
            setRouteOrigin(originOverride);
        }

        const effectiveOrigin = originOverride !== undefined ? originOverride : routeOrigin;

        const originCoords: [number, number] | null = effectiveOrigin
            ? [effectiveOrigin.latitude, effectiveOrigin.longitude]
            : userLocation
                ? [userLocation.lat, userLocation.lng]
                : null;

        if (!originCoords || !targetDestination) {
            showToast('Navigation Error: Origin or destination not available');
            return;
        }

        if (!mapRef.current) {
            showToast('Map Error: Map reference is not available');
            return;
        }

        const activeWaypoints = waypointsOverride ?? waypoints;
        const effectiveCosting = costingOverride ?? currentCosting;

        const previewCacheKey = buildPreviewCacheKey(effectiveCosting, targetDestination, activeWaypoints, effectiveOrigin);
        const cachedOptions = previewRouteCacheRef.current.get(previewCacheKey);
        if (cachedOptions && cachedOptions.length > 0) {
            navigateRequestIdRef.current++;
            applyRouteOptions(cachedOptions);
            setShowRoutePreview(true);
            setIsNavigating(false);
            return;
        }

        const requestId = ++navigateRequestIdRef.current;
        setIsNavigating(true);
        try {
            const navigationData = await navigationService.getNavigation({
                origin: originCoords,
                destination: [targetDestination.latitude, targetDestination.longitude],
                costing: effectiveCosting,
                waypoints: activeWaypoints.length > 0
                    ? activeWaypoints.map(wp => [wp.latitude, wp.longitude] as [number, number])
                    : undefined,
            });

            if (requestId !== navigateRequestIdRef.current) return;

            const legs = navigationData?.data?.trip?.legs;
            if (!legs || legs.length === 0) {
                showToast('Navigation Error: Could not calculate route');
                setIsNavigating(false);
                return;
            }

            const mainOption = parseLegsIntoOption(legs);
            allRouteOptionsRef.current = [mainOption];
            setAllRouteOptions([mainOption]);
            setSelectedRouteIndex(0);
            setAlternativeRoutesGeoJSON([]);
            previewRouteCacheRef.current.set(previewCacheKey, [mainOption]);

            const { coordinates: allCoordinates, maneuvers: allManeuvers, distance: totalDistance, duration: totalDuration } = mainOption;

            routeManeuvers.current = allManeuvers;
            setRouteManeuversList(allManeuvers);
            setRouteLegs(legs);


            routeCoordinates.current = allCoordinates;
            setFullRouteCoordinates(allCoordinates);

            totalRouteDistance.current = totalDistance;
            totalRouteDuration.current = totalDuration;

            setRemainingDistance(totalDistance || 0);
            setRemainingTime(totalDuration || 0);

            setRouteGeoJSON(mainOption.geoJSON);
            dashboardEventsService.routeGenerated();

            setShowRoutePreview(true);
            setIsNavigating(false);

            if (allCoordinates.length > 0) {
                const bounds = allCoordinates.reduce((acc: { minLng: number; maxLng: number; minLat: number; maxLat: number }, [lng, lat]: [number, number]) => {
                    return {
                        minLng: Math.min(acc.minLng, lng),
                        maxLng: Math.max(acc.maxLng, lng),
                        minLat: Math.min(acc.minLat, lat),
                        maxLat: Math.max(acc.maxLat, lat),
                    };
                }, {
                    minLng: allCoordinates[0][0],
                    maxLng: allCoordinates[0][0],
                    minLat: allCoordinates[0][1],
                    maxLat: allCoordinates[0][1],
                });

                const latDiff = bounds.maxLat - bounds.minLat;
                const lngDiff = bounds.maxLng - bounds.minLng;

                const adjustedLatDiff = latDiff * 1.8;
                const maxDiff = Math.max(adjustedLatDiff, lngDiff);

                let zoom = 13;
                if (maxDiff > 0.15) zoom = 10;
                else if (maxDiff > 0.1) zoom = 11;
                else if (maxDiff > 0.05) zoom = 12;
                else if (maxDiff > 0.02) zoom = 13;
                else if (maxDiff > 0.01) zoom = 14;
                else zoom = 15;

                zoom = Math.max(zoom - 1, 10);

                const latShift = (bounds.maxLat - bounds.minLat) * 1.3;
                const centerLng = (bounds.minLng + bounds.maxLng) / 2;
                const centerLat = (bounds.minLat + bounds.maxLat) / 2 - latShift;

                mapRef.current.flyTo({
                    center: [centerLng, centerLat],
                    zoom: zoom,
                    duration: 1500,
                    pitch: 0,
                });
            }

            if (effectiveCosting === 'auto') {
                fetchAlternativeRoutes(originCoords, targetDestination, activeWaypoints, mainOption, previewCacheKey);
            }
        } catch (error) {
            console.error('Navigation error:', error);
            showToast('Navigation Error: Could not calculate route');
            setIsNavigating(false);
        }
    };

    const handleStartNavigation = async (
        setUserLocation?: (location: { lat: number; lng: number }) => void,
        destinationOverride?: GeocodingPlace,
    ) => {
        const targetDestination = destinationOverride || selectedDestination;

        if (!mapRef.current) {
            showToast('Error: Map reference is not available');
            return;
        }

        if (!userLocation) {
            showToast('Error: Current location not available');
            return;
        }

        if (!targetDestination) {
            showToast('Error: Please select a destination first');
            return;
        }

        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showToast('Permission Required: Location permission is required for navigation');
                return;
            }

            let allCoordinates: [number, number][];
            let allManeuvers: any[];
            let totalDistance: number;
            let totalDuration: number;

            const hasSelectedOption = allRouteOptionsRef.current.length > 0 && routeCoordinates.current.length > 0;

            if (hasSelectedOption) {
                allCoordinates = routeCoordinates.current;
                allManeuvers = routeManeuvers.current;
                totalDistance = totalRouteDistance.current;
                totalDuration = totalRouteDuration.current;
            } else {
                let navigationData: Awaited<ReturnType<typeof navigationService.getNavigation>> | null = null;
                const prefetch = (globalThis as any).__voiceRoutePrefetch;
                if (prefetch?.key === `${targetDestination.latitude},${targetDestination.longitude}`) {
                    delete (globalThis as any).__voiceRoutePrefetch;
                    navigationData = await prefetch.promise;
                }

                if (!navigationData) {
                    navigationData = await navigationService.getNavigation({
                        origin: [userLocation.lat, userLocation.lng],
                        destination: [targetDestination.latitude, targetDestination.longitude],
                        costing: currentCosting,
                        waypoints: waypoints.length > 0
                            ? waypoints.map(wp => [wp.latitude, wp.longitude] as [number, number])
                            : undefined,
                    });
                }

                const legs = navigationData?.data?.trip?.legs;
                if (!legs || legs.length === 0) {
                    showToast('Error: Could not calculate route');
                    return;
                }

                allCoordinates = [];
                allManeuvers = [];
                totalDistance = 0;
                totalDuration = 0;

                for (let i = 0; i < legs.length; i++) {
                    const leg = legs[i];
                    const decoded = decodePolyline(leg.shape, 6);
                    const legCoords = decoded.map(coord => [coord[1], coord[0]]) as [number, number][];
                    if (i === 0) {
                        allCoordinates.push(...legCoords);
                    } else {
                        allCoordinates.push(...legCoords.slice(1));
                    }
                    allManeuvers.push(...leg.maneuvers);
                    totalDistance += leg.summary.length * 1000;
                    totalDuration += leg.summary.time;
                }
            }

            const route = {
                coordinates: allCoordinates,
                distance: totalDistance,
                duration: totalDuration,
                instructions: allManeuvers.map((maneuver: any) => ({
                    type: 'turn' as const,
                    distance: maneuver.length * 1000,
                    text: maneuver.instruction,
                    coordinate: [0, 0] as [number, number],
                })),
            };

            routeCoordinates.current = route.coordinates;
            setFullRouteCoordinates(route.coordinates);

            totalRouteDistance.current = route.distance;
            totalRouteDuration.current = route.duration;

            currentDestination.current = targetDestination;
            setShowRoutePreview(false);

            const initialGeoJSON = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: route.coordinates,
                }
            };
            setRouteGeoJSON(initialGeoJSON);

            mapRef.current.startNavigation(route, {
                followUserLocation: true,
                cameraPitch: 60,
                cameraZoom: 18,
                updateInterval: 1000,
                offRouteThreshold: 30,
                onNavigationUpdate: (state: any) => {
                    setIsNavigating(state.isNavigating);
                    isNavigatingRef.current = state.isNavigating;

                    setRemainingDistance(state.distanceRemaining);
                    setRemainingTime(state.durationRemaining);

                },
                onOffRoute: (distanceFromRoute: number) => {
                    setIsOffRoute(true);
                    showToast(
                        `${t('off-route') || 'Off Route'}: ${t('you-are') || 'You are'} ${distanceFromRoute.toFixed(0)}m ${t('off-the-planned-route') || 'off the planned route'}`
                    );

                    if (rerouteTimeout.current) {
                        clearTimeout(rerouteTimeout.current);
                    }
                    rerouteTimeout.current = setTimeout(() => {
                        recalculateRoute();
                    }, 3000);
                },
                onBackOnRoute: () => {
                    setIsOffRoute(false);
                    setIsRecalculating(false);

                    if (rerouteTimeout.current) {
                        clearTimeout(rerouteTimeout.current);
                        rerouteTimeout.current = null;
                    }

                    showToast(
                        `${t('back-on-route') || 'Back on Route'}: ${t('back-on-planned-route') || 'You are back on the planned route'}`
                    );
                },
                onNavigationComplete: () => {
                    setArrivalStage('arrived');
                    setShowArrivalModal(true);
                    handleStopNavigation();
                },
            } as any);

            setNavigationMode(true);
            setIsNavigating(true);
            isNavigatingRef.current = true;
            currentManeuverIndex.current = 0;

            if (stopBackgroundTracking) {
                stopBackgroundTracking();
            }

            if (simulateMovement) {
                startSimulation();
                showToast('Navigation Started: GPS simulation is running for testing');
            } else {
                startLocationTracking();
                void startNavService(engineState?.primaryText || 'Navigating…');
            }

        } catch (error: any) {
            console.error('Navigation start error:', error);
            showToast(`Navigation Failed: ${error.message || 'Could not start navigation'}`);
            setIsNavigating(false);
            isNavigatingRef.current = false;
            setNavigationMode(false);
        }
    };

    const handleStopNavigation = () => {
        if (mapRef.current) {
            mapRef.current.stopNavigation();
        }

        setNavigationMode(false);
        setIsNavigating(false);
        isNavigatingRef.current = false;

        voiceNavigationService.stopSpeaking();
        voiceNavigationService.clearCache();

        stopLocationTracking();
        stopSimulation();
        void stopNavService();

        // Clear reroute timeout
        if (rerouteTimeout.current) {
            clearTimeout(rerouteTimeout.current);
            rerouteTimeout.current = null;
        }

        setRouteGeoJSON(null);
        setSelectedDestination(null);
        setWaypoints([]);
        currentDestination.current = null;
        allRouteOptionsRef.current = [];
        setAllRouteOptions([]);
        setSelectedRouteIndex(0);
        setAlternativeRoutesGeoJSON([]);
        previewRouteCacheRef.current.clear();
        setRemainingDistance(0);
        setRemainingTime(0);
        setIsOffRoute(false);
        setIsRecalculating(false);
        setCurrentCosting('auto');

        if (startBackgroundTracking) {
            startBackgroundTracking();
        }

    };
    stopNavigationRef.current = handleStopNavigation;

    const handleClearRoute = () => {
        setRouteGeoJSON(null);
        setSelectedDestination(null);
        setWaypoints([]);
        setRouteOrigin(null);
        setRouteManeuversList([]);
        setRouteLegs([]);
        routeManeuvers.current = [];
        allRouteOptionsRef.current = [];
        setAllRouteOptions([]);
        setSelectedRouteIndex(0);
        setAlternativeRoutesGeoJSON([]);
        previewRouteCacheRef.current.clear();

        setRemainingDistance(0);
        setRemainingTime(0);
        setShowRoutePreview(false);
        setCurrentCosting('auto');
    };
    const simulateOffRoute = (setUserLocation: (location: { lat: number; lng: number }) => void) => {
        simulateOffRouteInternal(
            setUserLocation,
            navigationMode,
            simulateMovement,
            recalculateRoute,
            setIsOffRoute,
            rerouteTimeout
        );
    };

    useEffect(() => {
        return () => {
            stopLocationTracking();
            stopSimulation();
            void stopNavService();

            if (rerouteTimeout.current) {
                clearTimeout(rerouteTimeout.current);
            }
        };
    }, [stopLocationTracking, stopSimulation]);

    useEffect(() => {
        if (!navigationMode) return;
        const distanceText = remainingDistance >= 1000
            ? `${(remainingDistance / 1000).toFixed(1)} km`
            : `${Math.round(remainingDistance / 10) * 10} m`;
        const minutes = Math.max(1, Math.round(remainingTime / 60));
        const summary = `${distanceText} · ${minutes} min`;
        const body = engineState?.primaryText ? `${engineState.primaryText} · ${summary}` : summary;
        void updateNavNotification(body);
    }, [navigationMode, engineState?.primaryText, remainingDistance, remainingTime]);

    return {
        selectedDestination,
        setSelectedDestination,
        waypoints,
        setWaypoints,

        isNavigating,
        navigationMode,
        showRoutePreview,
        setShowRoutePreview,
        currentHeading,
        simulateMovement,
        setSimulateMovement,

        currentInstruction: isRecalculating
            ? 'Recalculating route…'
            : engineState?.primaryText || '',
        nextInstruction: isRecalculating ? '' : engineState?.thenText || '',
        maneuverType: isRecalculating ? ManeuverType.Continue : engineState?.primaryManeuverType,
        nextManeuverType: isRecalculating ? undefined : engineState?.thenStep?.type,
        maneuverDistance: !isRecalculating && engineState ? engineState.distanceToManeuver : undefined,
        remainingDistance: engineState ? engineState.distanceRemaining : remainingDistance,
        remainingTime: engineState ? engineState.timeRemaining : remainingTime,
        totalRouteDistance: totalRouteDistance.current,
        currentSpeed,
        isOffRoute,
        isRecalculating,

        showArrivalModal,
        setShowArrivalModal,
        arrivalStage,
        currentCosting,
        setCurrentCosting,

        routeCoordinates: routeCoordinates.current,
        routeGeoJSON,
        routeOrigin,
        setRouteOrigin,
        routeManeuversList,
        routeLegs,
        allRouteOptions,
        selectedRouteIndex,
        alternativeRoutesGeoJSON,
        handleSelectRoute,
        handleNavigate,
        handleStartNavigation,
        handleStopNavigation,
        handleClearRoute,
        simulateOffRoute,
        recalculateRoute,
    };
};
