import { useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { showToast } from '../../../shared/utils/toast';
import { buildSegmentedRoutesFromPosition, calculateBearing, calculateDistance } from '../utils/navigationUtils';
interface UseLocationTrackingProps {
    routeCoordinates: React.MutableRefObject<[number, number][]>;
    isNavigatingRef: React.MutableRefObject<boolean>;
    mapRef: React.RefObject<GebetaMapRef | null>;
    isOffRoute: boolean;
    setUserLocation?: (location: { lat: number; lng: number; accuracy?: number; speed?: number }) => void;
    setCurrentHeading: (heading: number) => void;
    setRouteGeoJSON: (geoJSON: any) => void;

    setRemainingDistance: (distance: number) => void;
    setRemainingTime: (time: number) => void;
    setIsOffRoute: (value: boolean) => void;
    setIsRecalculating: (value: boolean) => void;
    updateInstructionBasedOnPosition: (lat: number, lng: number) => void;
    recalculateRoute: (fromLocation?: { lat: number; lng: number }) => Promise<void>;
    rerouteTimeout: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    totalRouteDistance: number;
    totalRouteDuration: number;
    routeManeuversRef?: React.MutableRefObject<any[]>;
    currentManeuverIndexRef?: React.MutableRefObject<number>;
    // Taxi-specific
    taxiSegments?: Array<{
        polyline: string;
        type: string;
        mode: string;
    }>;
    setSegmentedRoutes?: (routes: Array<{
        geoJSON: any;
        isWalking: boolean;
        segmentIndex: number;
    }>) => void;
    updateNavigationState?: (
        location: { lat: number; lng: number },
        routes: Array<{
            geoJSON: any;
            isWalking: boolean;
            segmentIndex: number;
        }>
    ) => void;
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
    routeManeuversRef,

    currentManeuverIndexRef,
    taxiSegments,
    setSegmentedRoutes,
    updateNavigationState,
}: UseLocationTrackingProps) => {
    const locationSubscription = useRef<Location.LocationSubscription | null>(null);
    const lastClosestIndex = useRef<number>(0);
    const isOffRouteRef = useRef<boolean>(false);

    const offRouteStartTime = useRef<number | null>(null);
    const lastOffRoutePosition = useRef<{ lat: number; lng: number } | null>(null);
    const headingDivergeStartRef = useRef<number | null>(null);  // when heading first diverged
    const headingDivergeDistRef = useRef<number>(0);             // distance-from-route at that moment
    const currentGPSIntervalRef = useRef<number>(1000); //1s

    const locationCallbackRef = useRef<((location: Location.LocationObject) => void) | null>(null);
    const lastRenderedMarkerRef = useRef<{ lat: number; lng: number } | null>(null);

    const stopLocationTracking = useCallback(() => {
        if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
        }
        lastClosestIndex.current = 0;
        isOffRouteRef.current = false;
        offRouteStartTime.current = null;
        lastOffRoutePosition.current = null;
        headingDivergeStartRef.current = null;
        currentGPSIntervalRef.current = 1000;
        locationCallbackRef.current = null;
    }, []);

    const startLocationTracking = useCallback(async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showToast.error('Location permission is required for navigation', 'Permission Denied');
                return;
            }

            if (locationSubscription.current) {
                locationSubscription.current.remove();
            }

            locationCallbackRef.current = (location: Location.LocationObject) => {
                const { latitude, longitude, heading, speed } = location.coords;

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

                    if (closestIndex >= lastClosestIndex.current) {
                        lastClosestIndex.current = closestIndex;
                    } else {

                        closestIndex = lastClosestIndex.current;
                    }

                    distanceFromRoute = minDistance;

                    displayLat = snappedLat;
                    displayLng = snappedLng;

                    const OFF_ROUTE_THRESHOLD = 50;
                    const OFF_ROUTE_DELAY = 2000;

                    const HEADING_DIVERGE_ANGLE = 50;  
                    const HEADING_DIVERGE_TIME = 3000; 
                    const HEADING_MIN_SPEED = 3;     
                    const HEADING_MIN_DISTANCE = 20; 
                    let divergedByHeading = false;
                    if (
                        (speed ?? 0) > HEADING_MIN_SPEED &&
                        heading !== null && heading !== undefined &&
                        distanceFromRoute > HEADING_MIN_DISTANCE &&
                        closestIndex < routeCoordinates.current.length - 1
                    ) {
                        const [rLng1, rLat1] = routeCoordinates.current[closestIndex];
                        const [rLng2, rLat2] = routeCoordinates.current[closestIndex + 1];
                        const routeBearing = calculateBearing([rLng1, rLat1], [rLng2, rLat2]);
                        let angDiff = Math.abs(heading - routeBearing);
                        if (angDiff > 180) angDiff = 360 - angDiff;
                        if (angDiff > HEADING_DIVERGE_ANGLE) {
                            if (headingDivergeStartRef.current === null) {
                                headingDivergeStartRef.current = Date.now();
                                headingDivergeDistRef.current = distanceFromRoute;
                            } else if (
                                Date.now() - headingDivergeStartRef.current >= HEADING_DIVERGE_TIME &&
                                distanceFromRoute > headingDivergeDistRef.current
                            ) {
                                divergedByHeading = true;
                            }
                        } else {
                            headingDivergeStartRef.current = null;
                        }
                    } else {
                        headingDivergeStartRef.current = null;
                    }

                    const offRoute = distanceFromRoute > OFF_ROUTE_THRESHOLD || divergedByHeading;

                    if (offRoute) {
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

                    if (routeManeuversRef && currentManeuverIndexRef) {
                        const maneuvers = routeManeuversRef.current;
                        const nextManeuver = maneuvers[currentManeuverIndexRef.current];
                        if (
                            nextManeuver?.begin_shape_index !== undefined &&
                            routeCoordinates.current[nextManeuver.begin_shape_index]
                        ) {
                            const [mLng, mLat] = routeCoordinates.current[nextManeuver.begin_shape_index];
                            const distToTurn = calculateDistance(displayLat, displayLng, mLat, mLng);
                            if (distToTurn < 100 && currentGPSIntervalRef.current !== 1000) {
                                void restartAtInterval(1000);
                            }
                        }
                    }

                    const remainingCoords = routeCoordinates.current.slice(closestIndex + 1);
                    if (remainingCoords.length > 0) {
                        const routeFromMarker = [[displayLng, displayLat] as [number, number], ...remainingCoords];

                        if (taxiSegments && setSegmentedRoutes) {
                            const updatedSegments = buildSegmentedRoutesFromPosition(
                                taxiSegments,
                                closestIndex,
                                displayLat,
                                displayLng,
                                true
                            );

                            lastRenderedMarkerRef.current = { lat: displayLat, lng: displayLng };

                            if (updateNavigationState) {
                                updateNavigationState({ lat: displayLat, lng: displayLng }, updatedSegments);
                            } else {
                                setSegmentedRoutes(updatedSegments);
                                if (setUserLocation) {
                                    setUserLocation({ lat: displayLat, lng: displayLng });
                                }
                            }
                        } else {

                            lastRenderedMarkerRef.current = { lat: displayLat, lng: displayLng };

                            if (setUserLocation) {
                                setUserLocation({
                                    lat: displayLat,
                                    lng: displayLng,
                                    accuracy: location.coords.accuracy ?? undefined,
                                    speed: speed ?? undefined,
                                });
                            }
                        }

                        let totalDistance = 0;
                        for (let i = 0; i < routeFromMarker.length - 1; i++) {
                            const [lng1, lat1] = routeFromMarker[i];
                            const [lng2, lat2] = routeFromMarker[i + 1];

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
                } else {
                    if (setUserLocation) {
                        setUserLocation({ lat: displayLat, lng: displayLng });
                    }
                }

                updateInstructionBasedOnPosition(displayLat, displayLng);
            };

            const restartAtInterval = async (newInterval: number) => {
                if (currentGPSIntervalRef.current === newInterval) return;
                currentGPSIntervalRef.current = newInterval;
                if (locationSubscription.current) {
                    locationSubscription.current.remove();
                }
                try {
                    locationSubscription.current = await Location.watchPositionAsync(
                        {
                            accuracy: Location.Accuracy.BestForNavigation,
                            timeInterval: newInterval,
                            distanceInterval: 0,
                            mayShowUserSettingsDialog: true,
                        },
                        (loc) => locationCallbackRef.current?.(loc)
                    );
                } catch (error) {
                }
            };

            locationSubscription.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 1000,
                    distanceInterval: 0,
                    mayShowUserSettingsDialog: true,
                },
                (loc) => locationCallbackRef.current?.(loc)
            );
        } catch (error) {
            console.error('Error starting location tracking:', error);
            showToast.error('Could not start location tracking', 'Location Error');
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
        taxiSegments,
        setSegmentedRoutes,
        updateNavigationState,
    ]);

    return {
        startLocationTracking,
        stopLocationTracking,
        resetClosestIndex: () => {
            lastClosestIndex.current = 0;
        },
    };
};
