import { useState, useRef, useEffect } from 'react';
import * as Location from 'expo-location';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import type { GeocodingPlace } from '../types/navigation.types';
import { showToast } from '../../../shared/utils/toast';
import { navigationService } from '../services/navigation.service';
import { decodePolyline } from '../../../shared/utils/polyline';
import { useSimulation } from './useSimulation';
import { useLocationTracking } from './useLocationTracking';
import { useRouteRecalculation } from './useRouteRecalculation';
import { calculateBearing, calculateDistance, updateInstructionBasedOnPosition as updateInstruction } from '../utils/navigationUtils';

export const useNavigation = (
    mapRef: React.RefObject<GebetaMapRef | null>,
    userLocation: { lat: number; lng: number } | null,
    setUserLocation?: (location: { lat: number; lng: number }) => void,
    stopBackgroundTracking?: () => void,
    startBackgroundTracking?: () => Promise<void>
) => {
    const [selectedDestination, setSelectedDestination] = useState<GeocodingPlace | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [navigationMode, setNavigationMode] = useState(false);
    const [showRoutePreview, setShowRoutePreview] = useState(false);
    const [currentHeading, setCurrentHeading] = useState(0);
    const [simulateMovement, setSimulateMovement] = useState(false);
    const [currentInstruction, setCurrentInstruction] = useState<string>('');
    const [remainingDistance, setRemainingDistance] = useState<number>(0);
    const [remainingTime, setRemainingTime] = useState<number>(0);
    const [isOffRoute, setIsOffRoute] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);
    const [fullRouteCoordinates, setFullRouteCoordinates] = useState<[number, number][]>([]);

    const routeCoordinates = useRef<[number, number][]>([]);
    const isNavigatingRef = useRef(false);
    const rerouteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentDestination = useRef<GeocodingPlace | null>(null);
    const routeManeuvers = useRef<any[]>([]);
    const currentManeuverIndex = useRef(0);
    const stopNavigationRef = useRef<(() => void) | null>(null);
    const totalRouteDistance = useRef<number>(0);
    const totalRouteDuration = useRef<number>(0);

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
    });

    const { recalculateRoute } = useRouteRecalculation({
        mapRef,
        userLocation,
        currentDestination,
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
        startSimulation,
        resetClosestIndex,
        setUserLocation,
    });

    const handleNavigate = async (setUserLocation?: (location: { lat: number; lng: number }) => void, destination?: GeocodingPlace) => {
        const targetDestination = destination || selectedDestination;

        if (!userLocation || !targetDestination) {
            showToast.error('Navigation Error', 'User location or destination not available');
            return;
        }

        if (!mapRef.current) {
            showToast.error('Map Error', 'Map reference is not available');
            return;
        }

        setIsNavigating(true);
        try {
            const navigationData = await navigationService.getNavigation({
                origin: [userLocation.lat, userLocation.lng],
                destination: [targetDestination.latitude, targetDestination.longitude]
            });

            if (!navigationData?.data?.trip?.legs?.[0]) {
                showToast.error('Navigation Error', 'Could not calculate route');
                setIsNavigating(false);
                return;
            }

            const leg = navigationData.data.trip.legs[0];

            const decodedCoordinates = decodePolyline(leg.shape, 6);

            routeManeuvers.current = leg.maneuvers;

            const route = {
                coordinates: decodedCoordinates.map(coord => [coord[1], coord[0]]) as [number, number][],
                distance: leg.summary.length * 1000,
                duration: leg.summary.time,
                instructions: leg.maneuvers.map((maneuver: any) => ({
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

                const centerLng = (bounds.minLng + bounds.maxLng) / 2;
                const centerLat = (bounds.minLat + bounds.maxLat) / 2;

                const latDiff = bounds.maxLat - bounds.minLat;
                const lngDiff = bounds.maxLng - bounds.minLng;
                const maxDiff = Math.max(latDiff, lngDiff);

                let zoom = 13;
                if (maxDiff > 0.1) zoom = 11;
                else if (maxDiff > 0.05) zoom = 12;
                else if (maxDiff > 0.02) zoom = 13;
                else if (maxDiff > 0.01) zoom = 14;
                else zoom = 15;

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
                destination: [selectedDestination.latitude, selectedDestination.longitude]
            });

            if (!navigationData?.data?.trip?.legs?.[0]) {
                showToast.error('Error', 'Could not calculate route');
                return;
            }

            const leg = navigationData.data.trip.legs[0];
            const decodedCoordinates = decodePolyline(leg.shape, 6);
            const route = {
                coordinates: decodedCoordinates.map(coord => [coord[1], coord[0]]) as [number, number][],
                distance: leg.summary.length * 1000,
                duration: leg.summary.time,
                instructions: leg.maneuvers.map((maneuver: any) => ({
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

                    if (state.nextInstruction) {
                        const instructionText = state.nextInstruction.instruction || state.nextInstruction.text || '';
                        setCurrentInstruction(instructionText);
                    } else {
                        setCurrentInstruction('Continue ahead');
                    }
                },
                onOffRoute: (distanceFromRoute: number) => {
                    setIsOffRoute(true);
                    showToast.info('Off Route', `You are ${distanceFromRoute.toFixed(0)}m off the planned route`);

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

                    showToast.success('Back on Route', 'You are back on the planned route');
                },
                onNavigationComplete: () => {
                    showToast.success('Navigation Complete', 'You have arrived at your destination!');
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

        stopLocationTracking();
        stopSimulation();

        // Clear reroute timeout
        if (rerouteTimeout.current) {
            clearTimeout(rerouteTimeout.current);
            rerouteTimeout.current = null;
        }

        setRouteGeoJSON(null);
        setSelectedDestination(null);
        currentDestination.current = null;
        setCurrentInstruction('');
        setRemainingDistance(0);
        setRemainingTime(0);
        setIsOffRoute(false);
        setIsRecalculating(false);

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
        setCurrentInstruction('');
        setRemainingDistance(0);
        setRemainingTime(0);
        setShowRoutePreview(false);
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
        isNavigating,
        navigationMode,
        showRoutePreview,
        setShowRoutePreview,
        currentHeading,
        simulateMovement,
        setSimulateMovement,
        currentInstruction,
        remainingDistance,
        remainingTime,
        isOffRoute,
        isRecalculating,
        routeCoordinates: routeCoordinates.current,
        routeGeoJSON,
        handleNavigate,
        handleStartNavigation,
        handleStopNavigation,
        handleClearRoute,
        simulateOffRoute,
        recalculateRoute,
    };
};
