import { useState, useRef, useEffect } from 'react';
import * as Location from 'expo-location';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import type { GeocodingPlace, Leg, Maneuver } from '../types/navigation.types';
import { showToast } from '../../../shared/utils/toast';
import { navigationService } from '../services/navigation.service';
import { voiceNavigationService } from '../services/voice-navigation.service';
import { decodePolyline } from '../../../shared/utils/polyline';
import { useSimulation } from './useSimulation';
import { useLocationTracking } from './useLocationTracking';
import { useRouteRecalculation } from './useRouteRecalculation';
import { useVoiceInstructions } from './useVoiceInstructions';
import { calculateBearing, calculateDistance, updateInstructionBasedOnPosition as updateInstruction } from '../utils/navigationUtils';
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
    const [currentInstruction, setCurrentInstruction] = useState<string>('');
    const [nextInstruction, setNextInstruction] = useState<string>('');
    const [remainingDistance, setRemainingDistance] = useState<number>(0);
    const [remainingTime, setRemainingTime] = useState<number>(0);
    const [isOffRoute, setIsOffRoute] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);
    const [fullRouteCoordinates, setFullRouteCoordinates] = useState<[number, number][]>([]);
    const [showArrivalModal, setShowArrivalModal] = useState(false);
    const [currentCosting, setCurrentCosting] = useState<'auto' | 'pedestrian'>('auto');
    const [routeOrigin, setRouteOrigin] = useState<GeocodingPlace | null>(null);
    const [routeManeuversList, setRouteManeuversList] = useState<Maneuver[]>([]);
    const [routeLegs, setRouteLegs] = useState<Leg[]>([]);

    const routeCoordinates = useRef<[number, number][]>([]);
    const isNavigatingRef = useRef(false);
    const rerouteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentDestination = useRef<GeocodingPlace | null>(null);
    const routeManeuvers = useRef<any[]>([]);
    const currentManeuverIndex = useRef(0);
    const stopNavigationRef = useRef<(() => void) | null>(null);
    const totalRouteDistance = useRef<number>(0);
    const totalRouteDuration = useRef<number>(0);

    const currentCostingRef = useRef<'auto' | 'pedestrian'>('auto');
    const waypointsRef = useRef<GeocodingPlace[]>([]);
    useEffect(() => { currentCostingRef.current = currentCosting; }, [currentCosting]);
    useEffect(() => { waypointsRef.current = waypoints; }, [waypoints]);


    useVoiceInstructions({
        currentInstruction,
        isNavigating: navigationMode,
        enabled: true,
    });

    const updateInstructionBasedOnPosition = (currentLat: number, currentLng: number) => {
        const result = updateInstruction(
            currentLat,
            currentLng,
            routeManeuvers.current,
            currentManeuverIndex.current,
            routeCoordinates.current
        );
        setCurrentInstruction(result.instruction);
        currentManeuverIndex.current = result.newManeuverIndex;

        const nextIndex = result.newManeuverIndex + 1;
        if (nextIndex < routeManeuvers.current.length) {
            const nextManeuver = routeManeuvers.current[nextIndex];
            setNextInstruction(nextManeuver.instruction || '');
        } else {
            setNextInstruction('');
        }
    };

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
        updateInstructionBasedOnPosition,
        onSimulationComplete: () => {
            if (stopNavigationRef.current) {
                stopNavigationRef.current();
            }
        },
        onArrival: () => setShowArrivalModal(true),
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
        updateInstructionBasedOnPosition,
        recalculateRoute: (fromLocation?: { lat: number; lng: number }) => recalculateRoute(fromLocation),
        rerouteTimeout,
        totalRouteDistance: totalRouteDistance.current,
        totalRouteDuration: totalRouteDuration.current,
        routeManeuversRef: routeManeuvers,
        currentManeuverIndexRef: currentManeuverIndex,
    });

    const { recalculateRoute } = useRouteRecalculation({
        mapRef,
        userLocation,
        currentDestination,
        currentCostingRef,
        waypointsRef,
        routeCoordinates,
        routeManeuvers,
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
        setCurrentInstruction,
        handleStopNavigation: () => {
            if (stopNavigationRef.current) {
                stopNavigationRef.current();
            }
        },
        onArrival: () => setShowArrivalModal(true),
        startSimulation,
        resetClosestIndex,
        setUserLocation,
    });

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
            showToast.error('Navigation Error', 'Origin or destination not available');
            return;
        }

        if (!mapRef.current) {
            showToast.error('Map Error', 'Map reference is not available');
            return;
        }

        const activeWaypoints = waypointsOverride ?? waypoints;

        setIsNavigating(true);
        try {
            const navigationData = await navigationService.getNavigation({
                origin: originCoords,
                destination: [targetDestination.latitude, targetDestination.longitude],
                costing: costingOverride ?? currentCosting,
                waypoints: activeWaypoints.length > 0
                    ? activeWaypoints.map(wp => [wp.latitude, wp.longitude] as [number, number])
                    : undefined,
            });

            const legs = navigationData?.data?.trip?.legs;
            if (!legs || legs.length === 0) {
                showToast.error('Navigation Error', 'Could not calculate route');
                setIsNavigating(false);
                return;
            }

            const allCoordinates: [number, number][] = [];
            const allManeuvers: any[] = [];
            let totalDistance = 0;
            let totalDuration = 0;

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

            routeManeuvers.current = allManeuvers;
            setRouteManeuversList(allManeuvers);
            setRouteLegs(legs);

            //pre fetch audio
            const instructionTexts = allManeuvers
                .map((m: any) => m.instruction)
                .filter((text: string) => text && text.trim().length > 0);

            if (instructionTexts.length > 0) {
                console.log('prefetching audio for', instructionTexts.length, 'instructions');
                voiceNavigationService.prefetchRouteInstructions(instructionTexts).catch(err => {

                });
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

            setRemainingDistance(route.distance || 0);
            setRemainingTime(route.duration || 0);
            const geoJSON = {
                type: 'Feature',
                properties: {
                    distance: route.distance,
                    duration: route.duration,
                },
                geometry: {
                    type: 'LineString',
                    coordinates: route.coordinates,
                }
            };

            setRouteGeoJSON(geoJSON);

            setShowRoutePreview(true);
            setIsNavigating(false);

            if (route.coordinates.length > 0) {
                const bounds = route.coordinates.reduce((acc: { minLng: number; maxLng: number; minLat: number; maxLat: number }, [lng, lat]: [number, number]) => {
                    return {
                        minLng: Math.min(acc.minLng, lng),
                        maxLng: Math.max(acc.maxLng, lng),
                        minLat: Math.min(acc.minLat, lat),
                        maxLat: Math.max(acc.maxLat, lat),
                    };
                }, {
                    minLng: route.coordinates[0][0],
                    maxLng: route.coordinates[0][0],
                    minLat: route.coordinates[0][1],
                    maxLat: route.coordinates[0][1],
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

                const latShift = (bounds.maxLat - bounds.minLat) * 0.8; 
                const centerLng = (bounds.minLng + bounds.maxLng) / 2;
                const centerLat = (bounds.minLat + bounds.maxLat) / 2 - latShift;

                mapRef.current.flyTo({
                    center: [centerLng, centerLat],
                    zoom: zoom,
                    duration: 1500,
                    pitch: 0,
                });
            }
        } catch (error) {
            console.error('Navigation error:', error);
            showToast.error('Navigation Error', 'Could not calculate route');
            setIsNavigating(false);
        }
    };

    const handleStartNavigation = async (setUserLocation?: (location: { lat: number; lng: number }) => void) => {
        if (!mapRef.current) {
            showToast.error('Error', 'Map reference is not available');
            return;
        }

        if (!userLocation) {
            showToast.error('Error', 'Current location not available');
            return;
        }

        if (!selectedDestination) {
            showToast.error('Error', 'Please select a destination first');
            return;
        }

        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showToast.error('Permission Required', 'Location permission is required for navigation');
                return;
            }

            const navigationData = await navigationService.getNavigation({
                origin: [userLocation.lat, userLocation.lng],
                destination: [selectedDestination.latitude, selectedDestination.longitude],
                costing: currentCosting,
                waypoints: waypoints.length > 0
                    ? waypoints.map(wp => [wp.latitude, wp.longitude] as [number, number])
                    : undefined,
            });

            const legs = navigationData?.data?.trip?.legs;
            if (!legs || legs.length === 0) {
                showToast.error('Error', 'Could not calculate route');
                return;
            }

            const allCoordinates: [number, number][] = [];
            const allManeuvers: any[] = [];
            let totalDistance = 0;
            let totalDuration = 0;

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

            const instructionTexts = allManeuvers
                .map((m: any) => m.instruction)
                .filter((text: string) => text && text.trim().length > 0);

            if (instructionTexts.length > 0) {
                console.log('prefetching audio for', instructionTexts.length, 'instructions');
                voiceNavigationService.prefetchRouteInstructions(instructionTexts).catch(err => {

                });
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

            currentDestination.current = selectedDestination;
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

                    //destination arrival
                    if (userLocation && selectedDestination) {
                        const R = 6371000; // earth rad
                        const dLat = (selectedDestination.latitude - userLocation.lat) * Math.PI / 180;
                        const dLng = (selectedDestination.longitude - userLocation.lng) * Math.PI / 180;
                        const a =
                            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                            Math.cos(userLocation.lat * Math.PI / 180) *
                            Math.cos(selectedDestination.latitude * Math.PI / 180) *
                            Math.sin(dLng / 2) *
                            Math.sin(dLng / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        const distanceToDestination = R * c;

                        if (distanceToDestination <= 100) {
                            setShowArrivalModal(true);
                            handleStopNavigation();
                            return;
                        }
                    }

                    if (state.nextInstruction) {
                        const instructionText = state.nextInstruction.instruction || state.nextInstruction.text || '';
                        setCurrentInstruction(instructionText);
                    } else {
                        setCurrentInstruction('Continue ahead');
                    }
                },
                onOffRoute: (distanceFromRoute: number) => {
                    setIsOffRoute(true);
                    showToast.info(
                        t('off-route') || 'Off Route',
                        `${t('you-are') || 'You are'} ${distanceFromRoute.toFixed(0)}m ${t('off-the-planned-route') || 'off the planned route'}`
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

                    showToast.success(
                        t('back-on-route') || 'Back on Route',
                        t('back-on-planned-route') || 'You are back on the planned route'
                    );
                },
                onNavigationComplete: () => {
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

            if (routeManeuvers.current.length > 0) {
                const firstManeuver = routeManeuvers.current[0];
                if (firstManeuver.type === 2 && routeManeuvers.current.length > 1) {
                    setCurrentInstruction(routeManeuvers.current[1].instruction);
                    currentManeuverIndex.current = 1;
                } else {
                    setCurrentInstruction(firstManeuver.instruction);
                }
            }
            const navController = (mapRef.current as any).getNavigationController?.();
            if (navController) {
                navController.on('stepchange', (data: any) => {
                    if (data.step) {
                        const instructionText = data.step.instruction || data.step.text || 'Continue ahead';
                        setCurrentInstruction(instructionText);
                    }
                });

                navController.on('progress', (data: any) => {
                    if (data.currentStep) {
                        const instructionText = data.currentStep.instruction || data.currentStep.text || 'Continue ahead';
                        setCurrentInstruction(instructionText);
                    }
                });
            }
            if (simulateMovement) {
                startSimulation();
                showToast.info('Navigation Started', 'GPS simulation is running for testing');
            } else {
                startLocationTracking();
            }

        } catch (error: any) {
            console.error('Navigation start error:', error);
            showToast.error('Navigation Failed', error.message || 'Could not start navigation');
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

        voiceNavigationService.clearCache();

        stopLocationTracking();
        stopSimulation();

        // Clear reroute timeout
        if (rerouteTimeout.current) {
            clearTimeout(rerouteTimeout.current);
            rerouteTimeout.current = null;
        }

        setRouteGeoJSON(null);
        setSelectedDestination(null);
        setWaypoints([]);
        currentDestination.current = null;
        setCurrentInstruction('');
        setRemainingDistance(0);
        setRemainingTime(0);
        setIsOffRoute(false);
        setIsRecalculating(false);
        setCurrentCosting('auto');

        if (startBackgroundTracking) {
            startBackgroundTracking();
        }

        if (userLocation) {
            mapRef.current?.flyTo({
                center: [userLocation.lng, userLocation.lat],
                zoom: 15,
                duration: 1000,
                pitch: 0,
            });
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
        setCurrentInstruction('');
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

            if (rerouteTimeout.current) {
                clearTimeout(rerouteTimeout.current);
            }
        };
    }, [stopLocationTracking, stopSimulation]);

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
        currentInstruction,
        nextInstruction,
        remainingDistance,
        remainingTime,
        isOffRoute,
        isRecalculating,
        showArrivalModal,
        setShowArrivalModal,
        currentCosting,
        setCurrentCosting,

        routeCoordinates: routeCoordinates.current,
        routeGeoJSON,
        routeOrigin,
        setRouteOrigin,
        routeManeuversList,
        routeLegs,
        handleNavigate,
        handleStartNavigation,
        handleStopNavigation,
        handleClearRoute,
        simulateOffRoute,
        recalculateRoute,
    };
};
