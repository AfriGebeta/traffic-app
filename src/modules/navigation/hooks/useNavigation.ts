import { useState, useRef, useEffect } from 'react';
import * as Location from 'expo-location';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import type { GeocodingPlace } from '../types/navigation.types';
import { showToast } from '../../../shared/utils/toast';
import { navigationService } from '../services/navigation.service';
import { decodePolyline } from '../../../shared/utils/polyline';

export const useNavigation = (
    mapRef: React.RefObject<GebetaMapRef | null>,
    userLocation: { lat: number; lng: number } | null,
    setUserLocation?: (location: { lat: number; lng: number }) => void
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

    const locationSubscription = useRef<Location.LocationSubscription | null>(null);
    const simulationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const routeCoordinates = useRef<[number, number][]>([]);
    const currentRouteIndex = useRef(0);
    const isNavigatingRef = useRef(false);
    const lastRerouteTime = useRef<number>(0);
    const rerouteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentDestination = useRef<GeocodingPlace | null>(null);
    const routeManeuvers = useRef<any[]>([]);
    const currentManeuverIndex = useRef(0);

    const calculateBearing = (from: [number, number], to: [number, number]): number => {
        const [fromLng, fromLat] = from;
        const [toLng, toLat] = to;

        const dLng = (toLng - fromLng) * Math.PI / 180;
        const lat1 = fromLat * Math.PI / 180;
        const lat2 = toLat * Math.PI / 180;

        const y = Math.sin(dLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

        const bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360; 
    };

    const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
        const R = 6371000; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const updateInstructionBasedOnPosition = (currentLat: number, currentLng: number) => {
        if (routeManeuvers.current.length === 0) {
            setCurrentInstruction('Continue ahead');
            return;
        }

        let closestManeuverIndex = currentManeuverIndex.current;
        let minDistance = Infinity;

        for (let i = currentManeuverIndex.current; i < routeManeuvers.current.length; i++) {
            const maneuver = routeManeuvers.current[i];
            if (maneuver.begin_shape_index !== undefined && routeCoordinates.current[maneuver.begin_shape_index]) {
                const [maneuverLng, maneuverLat] = routeCoordinates.current[maneuver.begin_shape_index];
                const distance = calculateDistance(currentLat, currentLng, maneuverLat, maneuverLng);

                if (distance < minDistance) {
                    minDistance = distance;
                    closestManeuverIndex = i;
                }
            }
        }

        const nextManeuver = routeManeuvers.current[closestManeuverIndex];

        const TURN_APPROACH_DISTANCE = 50;
        const ADVANCE_THRESHOLD = 20;

        if (minDistance < ADVANCE_THRESHOLD && closestManeuverIndex < routeManeuvers.current.length - 1) {
            currentManeuverIndex.current = closestManeuverIndex + 1;
            const newManeuver = routeManeuvers.current[currentManeuverIndex.current];
            console.log('avanced to next maneuver:', newManeuver.instruction);
            setCurrentInstruction(newManeuver.instruction || 'Continue ahead');
        } else if (minDistance < TURN_APPROACH_DISTANCE) {
            console.log('showing turn instruction:', nextManeuver.instruction, `(${minDistance.toFixed(0)}m away)`);
            setCurrentInstruction(nextManeuver.instruction || 'Continue ahead');
        } else {
            setCurrentInstruction('Continue ahead');
        }
    };

    const recalculateRoute = async (fromLocation?: { lat: number; lng: number }) => {
        const locationToUse = fromLocation || userLocation;

        if (!locationToUse || !currentDestination.current) {
            return;
        }

        const now = Date.now();
        const timeSinceLastReroute = now - lastRerouteTime.current;

        if (timeSinceLastReroute < 10000) {
            console.log('no reroute - Cooldown Active');
            console.log(`⏱️  Cooldown remaining: ${((10000 - timeSinceLastReroute) / 1000).toFixed(1)}s`);
            return;
        }
        if (rerouteTimeout.current) {
            clearTimeout(rerouteTimeout.current);
            rerouteTimeout.current = null;
        }

        setIsRecalculating(true);
        lastRerouteTime.current = now;

        console.log('recalculating');
        console.log(`from: [${locationToUse.lat.toFixed(6)}, ${locationToUse.lng.toFixed(6)}]`);
        console.log(`to: ${currentDestination.current.name}`);

        try {
            const navigationData = await navigationService.getNavigation({
                origin: [locationToUse.lat, locationToUse.lng],
                destination: [currentDestination.current.latitude, currentDestination.current.longitude]
            });

            if (!navigationData?.data?.trip?.legs?.[0]) {
                showToast.error('Reroute Failed', 'Could not calculate new route');
                setIsRecalculating(false);
                return;
            }

            const leg = navigationData.data.trip.legs[0];
            const decodedCoordinates = decodePolyline(leg.shape, 6);

            // Store maneuvers for instruction display
            routeManeuvers.current = leg.maneuvers;

            const newRoute = {
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

            routeCoordinates.current = newRoute.coordinates;
            setFullRouteCoordinates(newRoute.coordinates);
            const newGeoJSON = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: newRoute.coordinates,
                }
            };
            setRouteGeoJSON(newGeoJSON);
            if (mapRef.current) {
                mapRef.current.stopNavigation();
            }
            if (mapRef.current) {
                mapRef.current.startNavigation(newRoute, {
                    followUserLocation: true,
                    cameraPitch: 60,
                    cameraZoom: 18,
                    updateInterval: 1000,
                    offRouteThreshold: 30, 
                    onNavigationUpdate: (state: any) => {
                        console.log('navigation Update:', {
                            isNavigating: state.isNavigating,
                            distanceRemaining: state.distanceRemaining,
                            durationRemaining: state.durationRemaining,
                            nextInstruction: state.nextInstruction,
                            currentStepIndex: state.currentStepIndex,
                        });

                        setIsNavigating(state.isNavigating);
                        isNavigatingRef.current = state.isNavigating;
                        setRemainingDistance(state.distanceRemaining);
                        setRemainingTime(state.durationRemaining);


                        if (state.nextInstruction) {
                            const instructionText = state.nextInstruction.instruction || state.nextInstruction.text || '';
                            console.log('current instruction:', instructionText);
                            setCurrentInstruction(instructionText);
                        } else {
                            setCurrentInstruction('Continue ahead');
                        }
                    },
                    onOffRoute: (distanceFromRoute: number) => {
                        console.log(`off route by ${distanceFromRoute.toFixed(0)}m`);
                        setIsOffRoute(true);

                        if (rerouteTimeout.current) {
                            clearTimeout(rerouteTimeout.current);
                        }
                        rerouteTimeout.current = setTimeout(() => {
                            recalculateRoute();
                        }, 3000);
                    },
                    onBackOnRoute: () => {
                        console.log('Back on route');
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
            }

            setIsRecalculating(false);

            console.log('route recalculated');
            console.log(`new route distance: ${(newRoute.distance / 1000).toFixed(2)} km`);
            showToast.success('Route Recalculated', 'Following new route');

            if (simulateMovement && !simulationInterval.current) {
                console.log('restarting simulation with new route');
                startSimulation();
            }

        } catch (error: any) {
            console.error('reroute failed');
            console.error('Error:', error);
            showToast.error('Reroute Failed', error.message || 'Could not calculate new route');
            setIsRecalculating(false);
        }
    };
    const startLocationTracking = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showToast.error('Permission Denied', 'Location permission is required for navigation');
                return;
            }

            if (locationSubscription.current) {
                locationSubscription.current.remove();
            }

            console.log('Starting location tracking for navigation...');

            locationSubscription.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 1000,
                    distanceInterval: 5,
                    mayShowUserSettingsDialog: true,
                },
                (location) => {
                    const { latitude, longitude, heading } = location.coords;

                    // Update route to show only remaining path and calculate bearing
                    if (isNavigatingRef.current && routeCoordinates.current.length > 0) {
                        let closestIndex = 0;
                        let minDistance = Infinity;

                        routeCoordinates.current.forEach((coord, index) => {
                            const [routeLng, routeLat] = coord;
                            const distance = Math.sqrt(
                                Math.pow(routeLng - longitude, 2) + Math.pow(routeLat - latitude, 2)
                            );
                            if (distance < minDistance) {
                                minDistance = distance;
                                closestIndex = index;
                            }
                        });
                        const [closestLng, closestLat] = routeCoordinates.current[closestIndex];
                        const R = 6371000; 
                        const dLat = (latitude - closestLat) * Math.PI / 180;
                        const dLng = (longitude - closestLng) * Math.PI / 180;
                        const a =
                            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                            Math.cos(closestLat * Math.PI / 180) *
                            Math.cos(latitude * Math.PI / 180) *
                            Math.sin(dLng / 2) *
                            Math.sin(dLng / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        const distanceFromRoute = R * c;
                        const OFF_ROUTE_THRESHOLD = 40; 
                        if (distanceFromRoute > OFF_ROUTE_THRESHOLD && !isOffRoute) {
                            
                            console.log('off route detected (Manual)');
                            console.log(`distance from route: ${distanceFromRoute.toFixed(1)}m`);
                            console.log(`auto-reroute in 3 seconds...`);

                            setIsOffRoute(true);
                            showToast.info('Off Route', `You are ${distanceFromRoute.toFixed(0)}m off the planned route`);

                            // Auto-reroute after 3 seconds
                            if (rerouteTimeout.current) {
                                clearTimeout(rerouteTimeout.current);
                            }
                            rerouteTimeout.current = setTimeout(() => {
                                console.log('3 seconds elapsed, triggering reroute...');
                                recalculateRoute();
                            }, 3000);
                        } else if (distanceFromRoute <= OFF_ROUTE_THRESHOLD && isOffRoute) {
                            
                            console.log('back on route (Manual)');
                            console.log('cancelling pending reroute');

                            setIsOffRoute(false);
                            setIsRecalculating(false);
                            if (rerouteTimeout.current) {
                                clearTimeout(rerouteTimeout.current);
                                rerouteTimeout.current = null;
                            }

                            showToast.success('Back on Route', 'You are back on the planned route');
                        }

                        if (closestIndex < routeCoordinates.current.length - 1) {
                            const currentPoint: [number, number] = [longitude, latitude];
                            const nextPoint = routeCoordinates.current[closestIndex + 1];
                            const bearing = calculateBearing(currentPoint, nextPoint);
                            setCurrentHeading(bearing);
                        } else if (heading !== null && heading !== undefined) {
                            setCurrentHeading(heading);
                        }

                        const remainingCoords = routeCoordinates.current.slice(closestIndex);
                        if (remainingCoords.length > 0) {
                            const remainingGeoJSON = {
                                type: 'Feature',
                                properties: {},
                                geometry: {
                                    type: 'LineString',
                                    coordinates: remainingCoords,
                                }
                            };
                            setRouteGeoJSON(remainingGeoJSON);

                            let totalDistance = 0;
                            for (let i = 0; i < remainingCoords.length - 1; i++) {
                                const [lng1, lat1] = remainingCoords[i];
                                const [lng2, lat2] = remainingCoords[i + 1];

                                const R = 6371000; 
                                const dLat = (lat2 - lat1) * Math.PI / 180;
                                const dLng = (lng2 - lng1) * Math.PI / 180;
                                const a =
                                    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                    Math.cos(lat1 * Math.PI / 180) *
                                    Math.cos(lat2 * Math.PI / 180) *
                                    Math.sin(dLng / 2) *
                                    Math.sin(dLng / 2);
                                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                totalDistance += R * c;
                            }

                            setRemainingDistance(totalDistance);

                            const averageSpeedMps = (35 * 1000) / 3600;
                            const estimatedTime = totalDistance / averageSpeedMps;
                            setRemainingTime(estimatedTime);
                        }
                    }

                    updateInstructionBasedOnPosition(latitude, longitude);

                    if (mapRef.current && isNavigatingRef.current) {
                        mapRef.current.updateNavigationPosition([longitude, latitude]);
                    }
                    let displayLat = latitude;
                    let displayLng = longitude;

                    if (isNavigatingRef.current && routeCoordinates.current.length > 0) {
                        let closestIndex = 0;
                        let minDistance = Infinity;

                        routeCoordinates.current.forEach((coord, index) => {
                            const [routeLng, routeLat] = coord;
                            const distance = calculateDistance(latitude, longitude, routeLat, routeLng);
                            if (distance < minDistance) {
                                minDistance = distance;
                                closestIndex = index;
                            }
                        });

                        const MAP_MATCHING_THRESHOLD = 10;
                        if (minDistance <= MAP_MATCHING_THRESHOLD) {
                            const [snappedLng, snappedLat] = routeCoordinates.current[closestIndex];
                            displayLat = snappedLat;
                            displayLng = snappedLng;
                            console.log(`map matched: ${minDistance.toFixed(1)}m from route, snapped to route`);
                        }
                    }

                    if (setUserLocation) {
                        setUserLocation({ lat: displayLat, lng: displayLng });

                        // Update instruction based on position
                        updateInstructionBasedOnPosition(displayLat, displayLng);
                    }
                }
            );
        } catch (error) {
            console.error('Error starting location tracking:', error);
            showToast.error('Location Error', 'Could not start location tracking');
        }
    };

    const stopLocationTracking = () => {
        if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
        }
    };

    // GPS simulation for testing
    const startSimulation = () => {
        if (simulationInterval.current) {
            clearInterval(simulationInterval.current);
        }

        currentRouteIndex.current = 0;

        console.log('starting GPS simulation with', routeCoordinates.current.length, 'points');

        simulationInterval.current = setInterval(() => {
            if (currentRouteIndex.current >= routeCoordinates.current.length) {
                stopSimulation();
                showToast.success('Arrived', 'You have reached your destination!');
                handleStopNavigation();
                return;
            }

            const [lng, lat] = routeCoordinates.current[currentRouteIndex.current];

            // Calculate bearing to next point
            let bearing = 0;
            if (currentRouteIndex.current < routeCoordinates.current.length - 1) {
                const currentPoint = routeCoordinates.current[currentRouteIndex.current];
                const nextPoint = routeCoordinates.current[currentRouteIndex.current + 1];
                bearing = calculateBearing(currentPoint, nextPoint);
                setCurrentHeading(bearing);
            }

            console.log(`simulating position ${currentRouteIndex.current}/${routeCoordinates.current.length}: [${lng}, ${lat}] bearing: ${bearing.toFixed(1)}°`);

            updateInstructionBasedOnPosition(lat, lng);

            if (mapRef.current && isNavigatingRef.current) {
                console.log('updating navigation position');
                mapRef.current.updateNavigationPosition([lng, lat]);
            } else {
                console.log('cannot update - mapRef:', !!mapRef.current, 'isNavigating:', isNavigatingRef.current);
            }
            if (setUserLocation) {
                console.log('setting user location to:', { lat, lng });
                setUserLocation({ lat, lng });

                updateInstructionBasedOnPosition(lat, lng);
            } else {
                console.log('setUserLocation is not provided');
            }
            const remainingCoords = routeCoordinates.current.slice(currentRouteIndex.current);
            if (remainingCoords.length > 0) {
                const remainingGeoJSON = {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: remainingCoords,
                    }
                };
                setRouteGeoJSON(remainingGeoJSON);

                let totalDistance = 0;
                for (let i = 0; i < remainingCoords.length - 1; i++) {
                    const [lng1, lat1] = remainingCoords[i];
                    const [lng2, lat2] = remainingCoords[i + 1];

                    const R = 6371000; 
                    const dLat = (lat2 - lat1) * Math.PI / 180;
                    const dLng = (lng2 - lng1) * Math.PI / 180;
                    const a =
                        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(lat1 * Math.PI / 180) *
                        Math.cos(lat2 * Math.PI / 180) *
                        Math.sin(dLng / 2) *
                        Math.sin(dLng / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    totalDistance += R * c;
                }

                setRemainingDistance(totalDistance);

                const averageSpeedMps = (35 * 1000) / 3600; 
                const estimatedTime = totalDistance / averageSpeedMps;
                setRemainingTime(estimatedTime);

                console.log(`remaining: ${(totalDistance / 1000).toFixed(2)} km, ${(estimatedTime / 60).toFixed(1)} min`);
            }

            currentRouteIndex.current += 1;
        }, 2000);
    };

    const stopSimulation = () => {
        console.log('Stopping GPS simulation');
        if (simulationInterval.current) {
            clearInterval(simulationInterval.current);
            simulationInterval.current = null;
        }
    };

    // Navigation flow using backend API + official SDK display methods
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
            // Get directions from YOUR backend API (not SDK's public API)
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
                    console.log('📊 Navigation Update:', {
                        isNavigating: state.isNavigating,
                        distanceRemaining: state.distanceRemaining,
                        durationRemaining: state.durationRemaining,
                        nextInstruction: state.nextInstruction,
                        currentStepIndex: state.currentStepIndex,
                    });

                    setIsNavigating(state.isNavigating);
                    isNavigatingRef.current = state.isNavigating;

                    setRemainingDistance(state.distanceRemaining);
                    setRemainingTime(state.durationRemaining);

                    if (state.nextInstruction) {
                        const instructionText = state.nextInstruction.instruction || state.nextInstruction.text || '';
                        console.log('current instruction:', instructionText);
                        setCurrentInstruction(instructionText);
                    } else {
                        setCurrentInstruction('Continue ahead');
                    }
                },
                onOffRoute: (distanceFromRoute: number) => {
                    console.log('off route detected');
                    console.log(`distance from route: ${distanceFromRoute.toFixed(1)}m`);
                    console.log(`auto-reroute in 3 seconds...`);

                    setIsOffRoute(true);
                    showToast.info('Off Route', `You are ${distanceFromRoute.toFixed(0)}m off the planned route`);

                    if (rerouteTimeout.current) {
                        clearTimeout(rerouteTimeout.current);
                    }
                    rerouteTimeout.current = setTimeout(() => {
                        console.log('3 seconds elapsed, triggering reroute...');
                        recalculateRoute();
                    }, 3000);
                },
                onBackOnRoute: () => {
                    console.log('back on route');
                    console.log('cancelling pending reroute');

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

            if (routeManeuvers.current.length > 0) {
                const firstManeuver = routeManeuvers.current[0];
                if (firstManeuver.type === 2 && routeManeuvers.current.length > 1) {
                    setCurrentInstruction(routeManeuvers.current[1].instruction);
                    currentManeuverIndex.current = 1;
                } else {
                    setCurrentInstruction(firstManeuver.instruction);
                }
                console.log('initial instruction:', currentInstruction);
            }
            const navController = (mapRef.current as any).getNavigationController?.();
            if (navController) {
                console.log('navigation controller available, setting up stepchange listener');
                navController.on('stepchange', (data: any) => {
                    console.log('step changed:', {
                        stepIndex: data.stepIndex,
                        instruction: data.step?.instruction || data.step?.text,
                        step: data.step,
                    });

                    if (data.step) {
                        const instructionText = data.step.instruction || data.step.text || 'Continue ahead';
                        setCurrentInstruction(instructionText);
                    }
                });

                navController.on('progress', (data: any) => {
                    console.log('progress update:', {
                        currentStep: data.currentStep?.instruction,
                        nextStep: data.nextStep?.instruction,
                    });

                    if (data.currentStep) {
                        const instructionText = data.currentStep.instruction || data.currentStep.text || 'Continue ahead';
                        setCurrentInstruction(instructionText);
                    }
                });
            } else {
                console.log('navigation controller not available');
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

        if (userLocation) {
            mapRef.current?.flyTo({
                center: [userLocation.lng, userLocation.lat],
                zoom: 15,
                duration: 1000,
                pitch: 0,
            });
        }
    };

    const handleClearRoute = () => {
        setRouteGeoJSON(null);
        setSelectedDestination(null);
        setCurrentInstruction('');
        setRemainingDistance(0);
        setRemainingTime(0);
        setShowRoutePreview(false);
    };

    const simulateOffRoute = (setUserLocation: (location: { lat: number; lng: number }) => void) => {
        if (!navigationMode || routeCoordinates.current.length === 0) {
            showToast.error('Error', 'Start navigation first');
            return;
        }

        const currentIndex = currentRouteIndex.current;
        if (currentIndex >= routeCoordinates.current.length) return;
        const wasSimulating = simulateMovement && simulationInterval.current !== null;
        if (wasSimulating) {
            console.log('pausing simulation for off-route test');
            if (simulationInterval.current) {
                clearInterval(simulationInterval.current);
                simulationInterval.current = null;
            }
        }

        const [currentLng, currentLat] = routeCoordinates.current[currentIndex];
        const offsetLat = currentLat + 0.00045;
        const offsetLng = currentLng + 0.00045;

        const offRouteLocation = { lat: offsetLat, lng: offsetLng };

        setUserLocation(offRouteLocation);

        const R = 6371000; 
        const dLat = (offsetLat - currentLat) * Math.PI / 180;
        const dLng = (offsetLng - currentLng) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(currentLat * Math.PI / 180) *
            Math.cos(offsetLat * Math.PI / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        console.log(`test: Moved ${distance.toFixed(0)}m off route`);
        console.log(`test: From [${currentLng}, ${currentLat}] to [${offsetLng}, ${offsetLat}]`);
        console.log(`test: Waiting for off-route detection (threshold: 40m)...`);
        if (wasSimulating) {
            console.log(`test: Simulation paused - marker will stay off-route`);
        }

        showToast.info(
            'Testing Off-Route',
            `Moved ${distance.toFixed(0)}m away. ${wasSimulating ? 'Simulation paused.' : ''} Watch for detection!`
        );
        if (mapRef.current) {
            mapRef.current.updateNavigationPosition([offsetLng, offsetLat]);

            setTimeout(() => {
                const navState = mapRef.current?.getNavigationState();
                console.log('test: Navigation state after position update:', navState);

                console.log('manually triggering off-route detection and reroute...');
                setIsOffRoute(true);
                showToast.info('Off Route', `You are ${distance.toFixed(0)}m off the planned route`);

                if (rerouteTimeout.current) {
                    clearTimeout(rerouteTimeout.current);
                }
                rerouteTimeout.current = setTimeout(() => {
                    console.log('3 seconds elapsed, triggering reroute...');
                    recalculateRoute(offRouteLocation);
                }, 3000);
            }, 500);
        }
    };

    useEffect(() => {
        return () => {
            stopLocationTracking();
            stopSimulation();

            // Clear reroute timeout on unmount
            if (rerouteTimeout.current) {
                clearTimeout(rerouteTimeout.current);
            }
        };
    }, []);

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
        recalculateRoute, // Expose for manual reroute button
    };
};
