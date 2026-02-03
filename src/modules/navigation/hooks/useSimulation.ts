import { useRef, useCallback } from 'react';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { showToast } from '../../../shared/utils/toast';
import { calculateBearing } from '../utils/navigationUtils';

interface UseSimulationProps {
    routeCoordinates: React.MutableRefObject<[number, number][]>;
    isNavigatingRef: React.MutableRefObject<boolean>;
    mapRef: React.RefObject<GebetaMapRef | null>;
    setUserLocation?: (location: { lat: number; lng: number }) => void;
    setCurrentHeading: (heading: number) => void;
    setRouteGeoJSON: (geoJSON: any) => void;
    setRemainingDistance: (distance: number) => void;
    setRemainingTime: (time: number) => void;
    updateInstructionBasedOnPosition: (lat: number, lng: number) => void;
    onSimulationComplete?: () => void;
    totalRouteDistance: number; //in meters
    totalRouteDuration: number; // in seconds
}

export const useSimulation = ({
    routeCoordinates,
    isNavigatingRef,
    mapRef,
    setUserLocation,
    setCurrentHeading,
    setRouteGeoJSON,
    setRemainingDistance,
    setRemainingTime,
    updateInstructionBasedOnPosition,
    onSimulationComplete,
    totalRouteDistance,
    totalRouteDuration,
}: UseSimulationProps) => {
    const simulationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const currentRouteIndex = useRef(0);

    const stopSimulation = useCallback(() => {
        if (simulationInterval.current) {
            clearInterval(simulationInterval.current);
            simulationInterval.current = null;
        }
    }, []);

    const startSimulation = useCallback(() => {
        if (simulationInterval.current) {
            clearInterval(simulationInterval.current);
        }

        currentRouteIndex.current = 0;

        simulationInterval.current = setInterval(() => {
            if (currentRouteIndex.current >= routeCoordinates.current.length) {
                stopSimulation();
                showToast.success('Arrived', 'You have reached your destination!');
                if (onSimulationComplete) {
                    onSimulationComplete();
                }
                return;
            }

            const [lng, lat] = routeCoordinates.current[currentRouteIndex.current];

            const offsetMeters = 3 + Math.random() * 5;
            const offsetAngle = Math.random() * 2 * Math.PI;
            const offsetLat = (offsetMeters / 111320) * Math.cos(offsetAngle);
            const offsetLng = (offsetMeters / (111320 * Math.cos(lat * Math.PI / 180))) * Math.sin(offsetAngle);

            const inaccurateLat = lat + offsetLat;
            const inaccurateLng = lng + offsetLng;

            let bearing = 0;
            if (currentRouteIndex.current < routeCoordinates.current.length - 1) {
                const currentPoint = routeCoordinates.current[currentRouteIndex.current];
                const nextPoint = routeCoordinates.current[currentRouteIndex.current + 1];
                bearing = calculateBearing(currentPoint, nextPoint);
                setCurrentHeading(bearing);
            }

            updateInstructionBasedOnPosition(inaccurateLat, inaccurateLng);

            let displayLat = inaccurateLat;
            let displayLng = inaccurateLng;

            if (setUserLocation) {
                if (routeCoordinates.current.length > 0) {
                    let closestIndex = currentRouteIndex.current;
                    let minDistance = Infinity;
                    let snappedLat = inaccurateLat;
                    let snappedLng = inaccurateLng;

                    const SEARCH_WINDOW = 20;
                    const startIndex = Math.max(0, currentRouteIndex.current - SEARCH_WINDOW);
                    const endIndex = Math.min(routeCoordinates.current.length - 1, currentRouteIndex.current + SEARCH_WINDOW);

                    for (let i = startIndex; i < endIndex; i++) {
                        const [lng1, lat1] = routeCoordinates.current[i];
                        const [lng2, lat2] = routeCoordinates.current[i + 1];
                        const dx = lng2 - lng1;
                        const dy = lat2 - lat1;

                        if (dx === 0 && dy === 0) {
                            const R = 6371000;
                            const dLat = (inaccurateLat - lat1) * Math.PI / 180;
                            const dLng = (inaccurateLng - lng1) * Math.PI / 180;
                            const a =
                                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                Math.cos(lat1 * Math.PI / 180) *
                                Math.cos(inaccurateLat * Math.PI / 180) *
                                Math.sin(dLng / 2) *
                                Math.sin(dLng / 2);
                            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                            const dist = R * c;
                            if (dist < minDistance) {
                                minDistance = dist;
                                closestIndex = i;
                                snappedLat = lat1;
                                snappedLng = lng1;
                            }
                            continue;
                        }

                        const t = Math.max(0, Math.min(1,
                            ((inaccurateLng - lng1) * dx + (inaccurateLat - lat1) * dy) / (dx * dx + dy * dy)
                        ));

                        const projLat = lat1 + t * dy;
                        const projLng = lng1 + t * dx;

                        //haversine formula
                        const R = 6371000;
                        const dLat = (inaccurateLat - projLat) * Math.PI / 180;
                        const dLng = (inaccurateLng - projLng) * Math.PI / 180;
                        const a =
                            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                            Math.cos(projLat * Math.PI / 180) *
                            Math.cos(inaccurateLat * Math.PI / 180) *
                            Math.sin(dLng / 2) *
                            Math.sin(dLng / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        const dist = R * c;

                        if (dist < minDistance) {
                            minDistance = dist;
                            closestIndex = i;
                            snappedLat = projLat;
                            snappedLng = projLng;
                        }
                    }

                    displayLat = snappedLat;
                    displayLng = snappedLng;
                }

                setUserLocation({ lat: displayLat, lng: displayLng });
            }

            const remainingCoords = routeCoordinates.current.slice(currentRouteIndex.current + 1);
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

            currentRouteIndex.current += 1;
        }, 2000);
    }, [
        routeCoordinates,
        isNavigatingRef,
        mapRef,
        setUserLocation,
        setCurrentHeading,
        setRouteGeoJSON,
        setRemainingDistance,
        setRemainingTime,
        updateInstructionBasedOnPosition,
        onSimulationComplete,
        stopSimulation,
        totalRouteDistance,
        totalRouteDuration,
    ]);

    const simulateOffRoute = useCallback((setUserLocation: (location: { lat: number; lng: number }) => void, navigationMode: boolean, simulateMovement: boolean, recalculateRoute: (fromLocation?: { lat: number; lng: number }) => Promise<void>, setIsOffRoute: (value: boolean) => void, rerouteTimeout: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
        if (!navigationMode || routeCoordinates.current.length === 0) {
            showToast.error('Error', 'Start navigation first');
            return;
        }

        const currentIndex = currentRouteIndex.current;
        if (currentIndex >= routeCoordinates.current.length) return;

        const wasSimulating = simulateMovement && simulationInterval.current !== null;
        if (wasSimulating) {
            if (simulationInterval.current) {
                clearInterval(simulationInterval.current);
                simulationInterval.current = null;
            }
        }


        //50m off route 
        const [currentLng, currentLat] = routeCoordinates.current[currentIndex];
        const offsetLat = currentLat + 0.00045;
        const offsetLng = currentLng + 0.00045;

        const offRouteLocation = { lat: offsetLat, lng: offsetLng };
        setUserLocation(offRouteLocation);

        // calculate distance moved
        const R = 6371000; // earth in m
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

        showToast.info(
            'Testing Off-Route',
            `Moved ${distance.toFixed(0)}m away. ${wasSimulating ? 'Simulation paused.' : ''} Watch for detection!`
        );

        //update map position
        if (mapRef.current) {
            mapRef.current.updateNavigationPosition([offsetLng, offsetLat]);

            //manually trigger off-route detection
            setTimeout(() => {
                setIsOffRoute(true);
                showToast.info('Off Route', `You are ${distance.toFixed(0)}m off the planned route`);

                //start reroute countdown
                if (rerouteTimeout.current) {
                    clearTimeout(rerouteTimeout.current);
                }
                rerouteTimeout.current = setTimeout(() => {
                    recalculateRoute(offRouteLocation);
                }, 3000);
            }, 500);

        }
    }, [mapRef, routeCoordinates, simulationInterval]);

    return {
        startSimulation,
        stopSimulation,
        simulateOffRoute,
        currentRouteIndex,
    };
};
