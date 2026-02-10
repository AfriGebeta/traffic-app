import { useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { showToast } from '../../../shared/utils/toast';
import { calculateBearing, calculateDistance } from '../utils/navigationUtils';

interface UseLocationTrackingProps {
    routeCoordinates: React.MutableRefObject<[number, number][]>;
    isNavigatingRef: React.MutableRefObject<boolean>;
    mapRef: React.RefObject<GebetaMapRef | null>;
    isOffRoute: boolean;
    setUserLocation?: (location: { lat: number; lng: number }) => void;
    setCurrentHeading: (heading: number) => void;
    setRouteGeoJSON: (geoJSON: any) => void;
    setRemainingDistance: (distance: number) => void;
    setRemainingTime: (time: number) => void;
    setIsOffRoute: (value: boolean) => void;
    setIsRecalculating: (value: boolean) => void;
    updateInstructionBasedOnPosition: (lat: number, lng: number) => void;
    recalculateRoute: (fromLocation?: { lat: number; lng: number }) => Promise<void>;
    rerouteTimeout: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    totalRouteDistance: number; //meters
    totalRouteDuration: number; //secs
}

export const useLocationTracking = ({
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
    recalculateRoute,
    rerouteTimeout,
    totalRouteDistance,
    totalRouteDuration,
}: UseLocationTrackingProps) => {
    const locationSubscription = useRef<Location.LocationSubscription | null>(null);
    const lastClosestIndex = useRef<number>(0);
    const isOffRouteRef = useRef<boolean>(false);
    const offRouteStartTime = useRef<number | null>(null);
    const lastOffRoutePosition = useRef<{ lat: number; lng: number } | null>(null);

    const stopLocationTracking = useCallback(() => {
        if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
        }
        lastClosestIndex.current = 0;
        isOffRouteRef.current = false;
        offRouteStartTime.current = null;
        lastOffRoutePosition.current = null;
    }, []);

    const startLocationTracking = useCallback(async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showToast.error('Permission Denied', 'Location permission is required for navigation');
                return;
            }

            if (locationSubscription.current) {
                locationSubscription.current.remove();
            }

            locationSubscription.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 1000,
                    distanceInterval: 5,
                    mayShowUserSettingsDialog: true,
                },
                (location) => {
                    const { latitude, longitude, heading } = location.coords;

                    let displayLat = latitude;
                    let displayLng = longitude;
                    let closestIndex = lastClosestIndex.current;
                    let distanceFromRoute = Infinity;

                    if (isNavigatingRef.current && routeCoordinates.current.length > 0) {

                        let minDistance = Infinity;
                        let snappedLat = latitude;
                        let snappedLng = longitude;

                        const SEARCH_WINDOW = 50;
                        const startIndex = Math.max(0, lastClosestIndex.current - SEARCH_WINDOW);
                        const endIndex = Math.min(routeCoordinates.current.length - 1, lastClosestIndex.current + SEARCH_WINDOW);

                        for (let i = startIndex; i < endIndex; i++) {
                            const [lng1, lat1] = routeCoordinates.current[i];
                            const [lng2, lat2] = routeCoordinates.current[i + 1];

                            const dx = lng2 - lng1;
                            const dy = lat2 - lat1;

                            if (dx === 0 && dy === 0) {
                                const dist = calculateDistance(latitude, longitude, lat1, lng1);
                                if (dist < minDistance) {
                                    minDistance = dist;
                                    closestIndex = i;
                                    snappedLat = lat1;
                                    snappedLng = lng1;
                                }

                                continue;
                            }
                            const t = Math.max(0, Math.min(1,
                                ((longitude - lng1) * dx + (latitude - lat1) * dy) / (dx * dx + dy * dy)
                            ));

                            const projLat = lat1 + t * dy;
                            const projLng = lng1 + t * dx;

                            const dist = calculateDistance(latitude, longitude, projLat, projLng);

                            if (dist < minDistance) {
                                minDistance = dist;
                                closestIndex = i;
                                snappedLat = projLat;
                                snappedLng = projLng;
                            }

                        }

                        if (minDistance > 100) {
                            for (let i = 0; i < routeCoordinates.current.length - 1; i++) {
                                if (i >= startIndex && i < endIndex) continue;

                                const [lng1, lat1] = routeCoordinates.current[i];
                                const [lng2, lat2] = routeCoordinates.current[i + 1];

                                const dx = lng2 - lng1;
                                const dy = lat2 - lat1;

                                if (dx === 0 && dy === 0) {
                                    const dist = calculateDistance(latitude, longitude, lat1, lng1);
                                    if (dist < minDistance) {
                                        minDistance = dist;
                                        closestIndex = i;
                                        snappedLat = lat1;
                                        snappedLng = lng1;
                                    }
                                    continue;
                                }

                                const t = Math.max(0, Math.min(1,
                                    ((longitude - lng1) * dx + (latitude - lat1) * dy) / (dx * dx + dy * dy)
                                ));

                                const projLat = lat1 + t * dy;
                                const projLng = lng1 + t * dx;
                                const dist = calculateDistance(latitude, longitude, projLat, projLng);

                                if (dist < minDistance) {
                                    minDistance = dist;
                                    closestIndex = i;
                                    snappedLat = projLat;
                                    snappedLng = projLng;
                                }
                            }
                        }
                        lastClosestIndex.current = closestIndex;
                        distanceFromRoute = minDistance;

                        displayLat = snappedLat;
                        displayLng = snappedLng;

                        const OFF_ROUTE_THRESHOLD = 50;
                        const OFF_ROUTE_DELAY = 3000; 

                        if (distanceFromRoute > OFF_ROUTE_THRESHOLD) {
                            lastOffRoutePosition.current = { lat: latitude, lng: longitude };

                            if (!isOffRouteRef.current) {
    
                                isOffRouteRef.current = true;
                                offRouteStartTime.current = Date.now();
                                setIsOffRoute(true);
                                showToast.info('Off Route', `You are ${distanceFromRoute.toFixed(0)}m off the planned route`);


                                if (rerouteTimeout.current) {
                                    clearTimeout(rerouteTimeout.current);
                                }
                            } else {

                                const timeOffRoute = Date.now() - (offRouteStartTime.current || 0);

                                if (timeOffRoute >= OFF_ROUTE_DELAY && !rerouteTimeout.current) {

                                    console.log('triggering recalculation - offroute for', timeOffRoute, 'ms');
                                    setIsRecalculating(true);

                                    rerouteTimeout.current = setTimeout(() => {
                                        if (isNavigatingRef.current && lastOffRoutePosition.current) {
                                            recalculateRoute(lastOffRoutePosition.current);
                                        }
                                        rerouteTimeout.current = null;
                                    }, 100);
                                }
                            }
                        } else {
                            if (isOffRouteRef.current) {

                                isOffRouteRef.current = false;
                                offRouteStartTime.current = null;
                                lastOffRoutePosition.current = null;
                                setIsOffRoute(false);
                                setIsRecalculating(false);

                                if (rerouteTimeout.current) {
                                    clearTimeout(rerouteTimeout.current);
                                    rerouteTimeout.current = null;
                                }

                                showToast.success('back on Route', 'you are back on the planned route');
                            }
                        }

                        if (closestIndex < routeCoordinates.current.length - 1) {
                            const currentPoint: [number, number] = [displayLng, displayLat];
                            const nextPoint = routeCoordinates.current[closestIndex + 1];
                            const bearing = calculateBearing(currentPoint, nextPoint);
                            setCurrentHeading(bearing);
                        } else if (heading !== null && heading !== undefined) {
                            setCurrentHeading(heading);
                        }

                        const remainingCoords = routeCoordinates.current.slice(closestIndex + 1);
                        if (remainingCoords.length > 0) {
                            const routeWithSnappedStart = [[displayLng, displayLat] as [number, number], ...remainingCoords];

                            const remainingGeoJSON = {
                                type: 'Feature',
                                properties: {},
                                geometry: {
                                    type: 'LineString',
                                    coordinates: routeWithSnappedStart,
                                }
                            };
                            setRouteGeoJSON(remainingGeoJSON);

                            let totalDistance = 0;
                            for (let i = 0; i < routeWithSnappedStart.length - 1; i++) {
                                const [lng1, lat1] = routeWithSnappedStart[i];
                                const [lng2, lat2] = routeWithSnappedStart[i + 1];

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

                            const averageSpeedMps = totalRouteDistance > 0 && totalRouteDuration > 0
                                ? totalRouteDistance / totalRouteDuration
                                : (25 * 1000) / 3600;
                            const estimatedTime = totalDistance / averageSpeedMps;
                            setRemainingTime(estimatedTime);
                        }
                    }

                    if (setUserLocation) {
                        setUserLocation({ lat: displayLat, lng: displayLng });
                    }

                    updateInstructionBasedOnPosition(displayLat, displayLng);
                }
            );
        } catch (error) {
            console.error('Error starting location tracking:', error);
            showToast.error('Location Error', 'Could not start location tracking');
        }
    }, [
        isOffRoute,
        setUserLocation,
        setCurrentHeading,
        setRouteGeoJSON,
        setRemainingDistance,
        setRemainingTime,
        setIsOffRoute,
        setIsRecalculating,
        updateInstructionBasedOnPosition,
        recalculateRoute,
        totalRouteDistance,
        totalRouteDuration,
    ]);

    return {
        startLocationTracking,
        stopLocationTracking,
        resetClosestIndex: () => {
            lastClosestIndex.current = 0;
        },
    };
};
