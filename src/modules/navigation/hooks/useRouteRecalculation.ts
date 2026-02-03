import { useRef, useCallback } from 'react';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import type { GeocodingPlace } from '../types/navigation.types';
import { showToast } from '../../../shared/utils/toast';
import { navigationService } from '../services/navigation.service';
import { decodePolyline } from '../../../shared/utils/polyline';

interface UseRouteRecalculationProps {
    mapRef: React.RefObject<GebetaMapRef | null>;
    userLocation: { lat: number; lng: number } | null;
    currentDestination: React.MutableRefObject<GeocodingPlace | null>;
    routeCoordinates: React.MutableRefObject<[number, number][]>;
    routeManeuvers: React.MutableRefObject<any[]>;
    totalRouteDistance: React.MutableRefObject<number>;
    totalRouteDuration: React.MutableRefObject<number>;
    rerouteTimeout: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    simulateMovement: boolean;
    setFullRouteCoordinates: (coords: [number, number][]) => void;
    setRouteGeoJSON: (geoJSON: any) => void;
    setIsRecalculating: (value: boolean) => void;
    setIsOffRoute: (value: boolean) => void;
    setIsNavigating: (value: boolean) => void;
    isNavigatingRef: React.MutableRefObject<boolean>;
    setRemainingDistance: (distance: number) => void;
    setRemainingTime: (time: number) => void;
    setCurrentInstruction: (instruction: string) => void;
    handleStopNavigation: () => void;
    startSimulation: () => void;
    resetClosestIndex: () => void;
}

export const useRouteRecalculation = ({
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
    handleStopNavigation,
    startSimulation,
    resetClosestIndex,
}: UseRouteRecalculationProps) => {
    const lastRerouteTime = useRef<number>(0);

    const recalculateRoute = useCallback(
        async (fromLocation?: { lat: number; lng: number }) => {
            const locationToUse = fromLocation || userLocation;

            if (!locationToUse || !currentDestination.current) {
                return;
            }

            const now = Date.now();
            const timeSinceLastReroute = now - lastRerouteTime.current;

            if (timeSinceLastReroute < 10000) {
                return;
            }

            if (rerouteTimeout.current) {
                clearTimeout(rerouteTimeout.current);
                rerouteTimeout.current = null;
            }

            setIsRecalculating(true);
            lastRerouteTime.current = now;

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

                resetClosestIndex();

                totalRouteDistance.current = newRoute.distance;
                totalRouteDuration.current = newRoute.duration;

                if (locationToUse && newRoute.coordinates.length > 0) {
                    let minDistance = Infinity;
                    newRoute.coordinates.forEach((coord) => {
                        const [routeLng, routeLat] = coord;
                        const R = 6371000;
                        const dLat = (locationToUse.lat - routeLat) * Math.PI / 180;
                        const dLng = (locationToUse.lng - routeLng) * Math.PI / 180;
                        const a =
                            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                            Math.cos(routeLat * Math.PI / 180) *
                            Math.cos(locationToUse.lat * Math.PI / 180) *
                            Math.sin(dLng / 2) *
                            Math.sin(dLng / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        const distance = R * c;
                        if (distance < minDistance) {
                            minDistance = distance;
                        }
                    });
                    if (minDistance <= 30) {
                        let closestIndex = 0;
                        let closestDistance = Infinity;
                        newRoute.coordinates.forEach((coord, index) => {
                            const [routeLng, routeLat] = coord;
                            const R = 6371000;
                            const dLat = (locationToUse.lat - routeLat) * Math.PI / 180;
                            const dLng = (locationToUse.lng - routeLng) * Math.PI / 180;
                            const a =
                                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                Math.cos(routeLat * Math.PI / 180) *
                                Math.cos(locationToUse.lat * Math.PI / 180) *
                                Math.sin(dLng / 2) *
                                Math.sin(dLng / 2);
                            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                            const distance = R * c;
                            if (distance < closestDistance) {
                                closestDistance = distance;
                                closestIndex = index;
                            }
                        });

                        const [snappedLng, snappedLat] = newRoute.coordinates[closestIndex];

                        if (userLocation) {
                            setIsNavigating(true);
                            isNavigatingRef.current = true;
                            setTimeout(() => {
                                if (mapRef.current) {
                                    mapRef.current.updateNavigationPosition?.([snappedLng, snappedLat]);
                                }
                            }, 100);
                        }
                    }
                }

                const newGeoJSON = {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: newRoute.coordinates,
                    }
                };

                // For real GPS navigation, immediately show route starting from current position
                if (!simulateMovement && locationToUse && newRoute.coordinates.length > 0) {
                    const routeWithCurrentStart = [[locationToUse.lng, locationToUse.lat] as [number, number], ...newRoute.coordinates];
                    newGeoJSON.geometry.coordinates = routeWithCurrentStart;
                }

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
                }

                setIsRecalculating(false);
                setIsOffRoute(false);

                showToast.success('Route Recalculated', 'Following new route');

                if (simulateMovement) {
                    startSimulation();
                }
            } catch (error: any) {
                console.error('reroute failed');
                console.error('Error:', error);
                showToast.error('Reroute Failed', error.message || 'Could not calculate new route');
                setIsRecalculating(false);
            }
        },
        [
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
            handleStopNavigation,
            startSimulation,
            mapRef,
            resetClosestIndex,
        ]
    );

    return { recalculateRoute };
};
