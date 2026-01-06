import { useState, useRef, useEffect } from 'react';
import * as Location from 'expo-location';
import { GebetaMapRef } from '../../../lib/gebeta-map/GebetaMap';
import { navigationService } from '../services/navigation.service';
import type { GeocodingPlace, Maneuver } from '../types/navigation.types';
import { showToast } from '../../../shared/utils/toast';
import { decodePolyline } from '../../../shared/utils/polyline';

export const useNavigation = (
    mapRef: React.RefObject<GebetaMapRef | null>,
    userLocation: { lat: number; lng: number } | null,
    setUserLocation?: (location: { lat: number; lng: number }) => void
) => {
    const [selectedDestination, setSelectedDestination] = useState<GeocodingPlace | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [navigationMode, setNavigationMode] = useState(false);
    const [currentHeading, setCurrentHeading] = useState(0);
    const [simulateMovement, setSimulateMovement] = useState(false);
    const [snappedLocation, setSnappedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [currentInstruction, setCurrentInstruction] = useState<string>('');
    const [remainingDistance, setRemainingDistance] = useState<number>(0);
    const [remainingTime, setRemainingTime] = useState<number>(0);

    const locationSubscription = useRef<Location.LocationSubscription | null>(null);
    const simulationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const instructionHideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const routeCoordinates = useRef<[number, number][]>([]);
    const maneuvers = useRef<Maneuver[]>([]);
    const currentRouteIndex = useRef(0);
    const currentManeuverIndex = useRef(0);
    const maneuverCompleted = useRef(false);

    const findClosestPointOnRoute = (userLat: number, userLng: number): { index: number; snappedLat: number; snappedLng: number } => {
        let closestIndex = currentRouteIndex.current;
        let minDistance = Infinity;
        let snappedLat = userLat;
        let snappedLng = userLng;

        const searchStart = Math.max(0, currentRouteIndex.current - 5);
        const searchEnd = Math.min(routeCoordinates.current.length - 1, currentRouteIndex.current + 20);

        for (let i = searchStart; i < searchEnd; i++) {
            const [lat1, lng1] = routeCoordinates.current[i];
            const [lat2, lng2] = routeCoordinates.current[i + 1];

            const projected = projectPointOnSegment(userLat, userLng, lat1, lng1, lat2, lng2);
            const distance = Math.sqrt(
                Math.pow(projected.lat - userLat, 2) + Math.pow(projected.lng - userLng, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
                snappedLat = projected.lat;
                snappedLng = projected.lng;
            }
        }

        return { index: closestIndex, snappedLat, snappedLng };
    };

    const projectPointOnSegment = (
        pointLat: number,
        pointLng: number,
        lat1: number,
        lng1: number,
        lat2: number,
        lng2: number
    ): { lat: number; lng: number } => {
        const dx = lng2 - lng1;
        const dy = lat2 - lat1;

        if (dx === 0 && dy === 0) {
            return { lat: lat1, lng: lng1 };
        }

        const t = Math.max(0, Math.min(1,
            ((pointLng - lng1) * dx + (pointLat - lat1) * dy) / (dx * dx + dy * dy)
        ));

        return {
            lat: lat1 + t * dy,
            lng: lng1 + t * dx
        };
    };

    const calculateRemainingStats = (routeIndex: number) => {
        if (maneuvers.current.length === 0) return;

        // Calculate remaining distance and time from current maneuver onwards
        let totalDistance = 0;
        let totalTime = 0;

        for (let i = currentManeuverIndex.current; i < maneuvers.current.length; i++) {
            const maneuver = maneuvers.current[i];

            if (i === currentManeuverIndex.current) {
                // For current maneuver, calculate only the remaining portion
                const maneuverProgress = (routeIndex - maneuver.begin_shape_index) /
                    (maneuver.end_shape_index - maneuver.begin_shape_index);
                const remainingPortion = Math.max(0, 1 - maneuverProgress);

                totalDistance += maneuver.length * remainingPortion;
                totalTime += maneuver.time * remainingPortion;
            } else {
                // For future maneuvers, add full distance and time
                totalDistance += maneuver.length;
                totalTime += maneuver.time;
            }
        }

        setRemainingDistance(totalDistance);
        setRemainingTime(totalTime);
    };

    const updateCurrentManeuver = (routeIndex: number) => {
        const currentManeuver = maneuvers.current[currentManeuverIndex.current];

        if (!currentManeuver) return;

        // Check if we've reached the end of the current maneuver
        const maneuverProgress = (routeIndex - currentManeuver.begin_shape_index) /
            (currentManeuver.end_shape_index - currentManeuver.begin_shape_index);

        // If we're at or past the end of the maneuver (95% threshold to account for GPS accuracy)
        if (maneuverProgress >= 0.95 && !maneuverCompleted.current) {
            maneuverCompleted.current = true;

            // Clear any existing timeout
            if (instructionHideTimeout.current) {
                clearTimeout(instructionHideTimeout.current);
            }

            // Hide instruction after 2 seconds
            instructionHideTimeout.current = setTimeout(() => {
                setCurrentInstruction('');
            }, 2000);
        }

        // Move to next maneuver
        if (routeIndex >= currentManeuver.end_shape_index &&
            currentManeuverIndex.current < maneuvers.current.length - 1) {
            currentManeuverIndex.current++;
            maneuverCompleted.current = false;

            // Clear any pending hide timeout
            if (instructionHideTimeout.current) {
                clearTimeout(instructionHideTimeout.current);
                instructionHideTimeout.current = null;
            }

            const nextManeuver = maneuvers.current[currentManeuverIndex.current];
            setCurrentInstruction(nextManeuver.instruction);
        } else if (!maneuverCompleted.current) {
            // Still in the middle of the maneuver, show instruction
            setCurrentInstruction(currentManeuver.instruction);
        }

        // Update remaining distance and time
        calculateRemainingStats(routeIndex);
    };

    const updateRemainingRoute = (snappedLng?: number, snappedLat?: number) => {
        if (currentRouteIndex.current >= routeCoordinates.current.length - 1) {
            return;
        }

        const remainingCoordinates = routeCoordinates.current.slice(currentRouteIndex.current);

        if (snappedLng !== undefined && snappedLat !== undefined) {
            remainingCoordinates[0] = [snappedLat, snappedLng];
        }

        if (remainingCoordinates.length > 1) {
            const routeGeoJSON = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: remainingCoordinates.map(coord => [coord[1], coord[0]])
                }
            };

            mapRef.current?.displayRoute(routeGeoJSON, {
                color: '#3B82F6',
                width: 7,
                opacity: 0.8
            });
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
                    distanceInterval: 2,
                    mayShowUserSettingsDialog: true,
                },
                (location) => {
                    const heading = location.coords.heading !== null && location.coords.heading !== undefined
                        ? location.coords.heading
                        : 0;

                    setCurrentHeading(heading);

                    const closest = findClosestPointOnRoute(
                        location.coords.latitude,
                        location.coords.longitude
                    );

                    currentRouteIndex.current = closest.index;
                    updateCurrentManeuver(closest.index);

                    const snapped = {
                        lat: closest.snappedLat,
                        lng: closest.snappedLng
                    };

                    setSnappedLocation(snapped);

                    if (setUserLocation) {
                        setUserLocation(snapped);
                    }

                    mapRef.current?.flyTo({
                        center: [closest.snappedLng, closest.snappedLat],
                        zoom: 18,
                        duration: 800,
                        pitch: 60,
                        heading: heading,
                    });

                    updateRemainingRoute(closest.snappedLng, closest.snappedLat);
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
        if (instructionHideTimeout.current) {
            clearTimeout(instructionHideTimeout.current);
            instructionHideTimeout.current = null;
        }
    };

    const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        const toDeg = (rad: number) => (rad * 180) / Math.PI;

        const dLng = toRad(lng2 - lng1);
        const y = Math.sin(dLng) * Math.cos(toRad(lat2));
        const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);

        let bearing = toDeg(Math.atan2(y, x));
        return (bearing + 360) % 360;
    };

    const startSimulation = (setUserLocation: (location: { lat: number; lng: number }) => void) => {
        currentRouteIndex.current = 0;
        currentManeuverIndex.current = 0;
        maneuverCompleted.current = false;

        if (maneuvers.current.length > 0) {
            setCurrentInstruction(maneuvers.current[0].instruction);
        }

        simulationInterval.current = setInterval(() => {
            if (currentRouteIndex.current >= routeCoordinates.current.length) {
                stopSimulation();
                showToast.success('Arrived', 'You have reached your destination!');
                handleStopNavigation();
                return;
            }

            const [lat, lng] = routeCoordinates.current[currentRouteIndex.current];

            let heading = 0;
            if (currentRouteIndex.current < routeCoordinates.current.length - 1) {
                const [nextLat, nextLng] = routeCoordinates.current[currentRouteIndex.current + 1];
                heading = calculateBearing(lat, lng, nextLat, nextLng);
            }

            const location = { lat, lng };

            setUserLocation(location);
            setSnappedLocation(location);
            setCurrentHeading(heading);
            updateCurrentManeuver(currentRouteIndex.current);

            mapRef.current?.flyTo({
                center: [lng, lat],
                zoom: 18,
                duration: 800,
                pitch: 60,
                heading: heading,
            });

            updateRemainingRoute(lng, lat);
            currentRouteIndex.current += 1;
        }, 1000);
    };

    const stopSimulation = () => {
        if (simulationInterval.current) {
            clearInterval(simulationInterval.current);
            simulationInterval.current = null;
        }
        if (instructionHideTimeout.current) {
            clearTimeout(instructionHideTimeout.current);
            instructionHideTimeout.current = null;
        }
    };

    const handleNavigate = async (setUserLocation?: (location: { lat: number; lng: number }) => void) => {
        if (!userLocation || !selectedDestination) {
            showToast.error('Navigation Error', 'User location or destination not available');
            return;
        }

        setIsNavigating(true);
        try {
            const navigationData = await navigationService.getNavigation({
                origin: [userLocation.lat, userLocation.lng],
                destination: [selectedDestination.latitude, selectedDestination.longitude]
            });

            if (navigationData?.data?.trip?.legs?.[0]) {
                const leg = navigationData.data.trip.legs[0];

                // Decode the polyline shape
                const decodedCoordinates = decodePolyline(leg.shape, 6);

                // Store maneuvers and route coordinates
                maneuvers.current = leg.maneuvers;
                routeCoordinates.current = decodedCoordinates;
                currentManeuverIndex.current = 0;
                maneuverCompleted.current = false;

                // Set initial instruction
                if (leg.maneuvers.length > 0) {
                    setCurrentInstruction(leg.maneuvers[0].instruction);
                }

                // Set route summary
                setRemainingDistance(leg.summary.length);
                setRemainingTime(leg.summary.time);

                const routeGeoJSON = {
                    type: 'Feature',
                    properties: {
                        distance: leg.summary.length,
                        duration: leg.summary.time,
                        maneuvers: leg.maneuvers
                    },
                    geometry: {
                        type: 'LineString',
                        coordinates: decodedCoordinates.map(coord => [coord[1], coord[0]])
                    }
                };

                mapRef.current?.displayRoute(routeGeoJSON, {
                    color: '#3B82F6',
                    width: 5,
                    opacity: 0.8
                });

                const distanceKm = leg.summary.length.toFixed(2);
                const durationMin = (leg.summary.time / 60).toFixed(0);
                showToast.success('Route Found', `${distanceKm} km • ${durationMin} min`);

                setNavigationMode(true);

                if (userLocation) {
                    mapRef.current?.flyTo({
                        center: [userLocation.lng, userLocation.lat],
                        zoom: 18,
                        duration: 1500,
                        pitch: 60,
                        heading: currentHeading,
                    });
                }

                if (simulateMovement && setUserLocation) {
                    startSimulation(setUserLocation);
                } else {
                    startLocationTracking();
                }
            } else {
                showToast.error('Navigation Error', 'No route data received');
            }
        } catch (error) {
            console.error('Navigation error:', error);
            showToast.error('Navigation Error', 'Could not calculate route');
        } finally {
            setIsNavigating(false);
        }
    };

    const handleStopNavigation = () => {
        setNavigationMode(false);
        stopLocationTracking();
        stopSimulation();
        mapRef.current?.clearRoute();
        setSelectedDestination(null);
        setCurrentInstruction('');
        setRemainingDistance(0);
        setRemainingTime(0);
        currentManeuverIndex.current = 0;
        maneuverCompleted.current = false;

        if (userLocation) {
            mapRef.current?.flyTo({
                center: [userLocation.lng, userLocation.lat],
                zoom: 15,
                duration: 1000,
                pitch: 0,
                heading: 0,
            });
        }
    };

    const handleClearRoute = () => {
        mapRef.current?.clearRoute();
        setSelectedDestination(null);
        setCurrentInstruction('');
        setRemainingDistance(0);
        setRemainingTime(0);
    };

    useEffect(() => {
        return () => {
            stopLocationTracking();
            stopSimulation();
        };
    }, []);

    return {
        selectedDestination,
        setSelectedDestination,
        isNavigating,
        navigationMode,
        currentHeading,
        simulateMovement,
        setSimulateMovement,
        snappedLocation,
        currentInstruction,
        remainingDistance,
        remainingTime,
        routeCoordinates: routeCoordinates.current,
        handleNavigate,
        handleStopNavigation,
        handleClearRoute,
    };
};
