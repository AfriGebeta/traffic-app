import { useRef, useCallback } from 'react';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import type { GeocodingPlace } from '../types/navigation.types';
import { showToast } from '../../../shared/utils/toast';
import { navigationService } from '../services/navigation.service';
import { decodePolyline } from '../../../shared/utils/polyline';
import { useTranslation } from '../../../shared/hooks/useTranslation';

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
    setUserLocation?: (location: { lat: number; lng: number }) => void;
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
    setUserLocation,
}: UseRouteRecalculationProps) => {
    const { t } = useTranslation();
    const lastRerouteTime = useRef<number>(0);

    const recalculateRoute = useCallback(
        async (fromLocation?: { lat: number; lng: number }) => {
            const locationToUse = fromLocation || userLocation;

            if (!locationToUse || !currentDestination.current) {
                console.log('Recalculate skipped: missing location or destination');
                return;
            }

            const now = Date.now();
            const timeSinceLastReroute = now - lastRerouteTime.current;


            if (timeSinceLastReroute < 5000) {
                console.log(`recalculate skipped:  (${timeSinceLastReroute}ms since last reroute)`);
                return;
            }

            console.log('starting route recalculation...');

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
                    showToast.error(
                        t('reroute-failed') || 'Reroute Failed',
                        t('could-not-calculate-new-route') || 'Could not calculate new route'
                    );
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
                    properties: {
                        timestamp: Date.now(),
                    },
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

                if (setUserLocation && locationToUse) {
                    setUserLocation({ lat: locationToUse.lat, lng: locationToUse.lng });
                }

                setRouteGeoJSON(null);
                setTimeout(() => {
                    setRouteGeoJSON(newGeoJSON);
                }, 50);

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

                            //destination arrival
                            if (userLocation && currentDestination.current) {
                                const R = 6371000;
                                const dLat = (currentDestination.current.latitude - userLocation.lat) * Math.PI / 180;
                                const dLng = (currentDestination.current.longitude - userLocation.lng) * Math.PI / 180;
                                const a =
                                    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                    Math.cos(userLocation.lat * Math.PI / 180) *
                                    Math.cos(currentDestination.current.latitude * Math.PI / 180) *
                                    Math.sin(dLng / 2) *
                                    Math.sin(dLng / 2);
                                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                const distanceToDestination = R * c;

                                if (distanceToDestination <= 10) {
                                    showToast.success(
                                        t('navigation-complete') || 'Navigation Complete',
                                        t('arrived-at-destination') || 'You have arrived at your destination!'
                                    );
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
                            showToast.success(
                                t('navigation-complete') || 'Navigation Complete',
                                t('arrived-at-destination') || 'You have arrived at your destination!'
                            );
                            handleStopNavigation();
                        },
                    } as any);
                }

                setIsRecalculating(false);
                setIsOffRoute(false);


                showToast.success(
                    t('route-recalculated') || 'Route Recalculated',
                    t('following-new-route') || 'Following new route'
                );

                if (simulateMovement) {
                    startSimulation();
                }
            } catch (error: any) {
                console.error('reroute failed:', error);
                console.error('Error details:', error.message);
                showToast.error(
                    t('reroute-failed') || 'Reroute Failed',
                    error.message || t('could-not-calculate-new-route') || 'Could not calculate new route'
                );
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
            setUserLocation,
        ]
    );

    return { recalculateRoute };
};
