import { useRef, useCallback } from 'react';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { showToast } from '../../../shared/utils/toast';
import { buildSegmentedRoutesFromPosition, calculateBearing, calculateDistance } from '../utils/navigationUtils';

interface UseTaxiSimulationProps {
    routeCoordinates: React.MutableRefObject<[number, number][]>;
    isNavigatingRef: React.MutableRefObject<boolean>;
    mapRef: React.RefObject<GebetaMapRef | null>;
    setUserLocation?: (location: { lat: number; lng: number }) => void;
    setCurrentHeading: (heading: number) => void;
    setRouteGeoJSON: (geoJSON: any) => void;
    setRemainingDistance: (distance: number) => void;
    setRemainingTime: (time: number) => void;
    updateInstructionBasedOnPosition: (lat: number, lng: number) => void;
    onArrival?: () => void;
    totalRouteDistance: number;
    totalRouteDuration: number;
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

export const useTaxiSimulation = ({
    routeCoordinates,
    isNavigatingRef,
    mapRef,
    setUserLocation,
    setCurrentHeading,
    setRouteGeoJSON,
    setRemainingDistance,
    setRemainingTime,
    updateInstructionBasedOnPosition,
    onArrival,
    totalRouteDistance,
    totalRouteDuration,
    taxiSegments,
    setSegmentedRoutes,
    updateNavigationState,
}: UseTaxiSimulationProps) => {
    const simulationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const smoothingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const simInterpolateFromRef = useRef<{ lat: number; lng: number } | null>(null);
    const simInterpolateToRef = useRef<{ lat: number; lng: number } | null>(null);
    const simFromIndexRef = useRef<number>(0);
    const simToIndexRef = useRef<number>(0);
    const simTickStartRef = useRef<number>(0);
    const currentRouteIndex = useRef(0);

    const stopSimulation = useCallback(() => {
        if (simulationInterval.current) {
            clearInterval(simulationInterval.current);
            simulationInterval.current = null;
        }
        if (smoothingIntervalRef.current) {
            clearInterval(smoothingIntervalRef.current);
            smoothingIntervalRef.current = null;
        }
        simInterpolateFromRef.current = null;
        simInterpolateToRef.current = null;
    }, []);

    const startSimulation = useCallback(() => {
        if (simulationInterval.current) {
            clearInterval(simulationInterval.current);
        }
        if (smoothingIntervalRef.current) {
            clearInterval(smoothingIntervalRef.current);
        }
        simInterpolateFromRef.current = null;
        simInterpolateToRef.current = null;
        simTickStartRef.current = 0;

        currentRouteIndex.current = 0;
        showToast('GPS simulation is running for testing');

        simulationInterval.current = setInterval(() => {
            if (currentRouteIndex.current >= routeCoordinates.current.length) {
                stopSimulation();
                onArrival?.();
                showToast('Simulation completed');
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
            let closestIndex = currentRouteIndex.current;

            if (routeCoordinates.current.length > 0) {
                let minDistance = Infinity;
                let snappedLat = inaccurateLat;
                let snappedLng = inaccurateLng;

                const SEARCH_WINDOW = 20;
                const startIndex = currentRouteIndex.current;
                const endIndex = Math.min(routeCoordinates.current.length - 1, currentRouteIndex.current + SEARCH_WINDOW);

                for (let i = startIndex; i < endIndex; i++) {
                    const [lng1, lat1] = routeCoordinates.current[i];
                    const [lng2, lat2] = routeCoordinates.current[i + 1];

                    const dx = lng2 - lng1;
                    const dy = lat2 - lat1;

                    if (dx === 0 && dy === 0) {
                        const dist = calculateDistance(inaccurateLat, inaccurateLng, lat1, lng1);
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

                    const dist = calculateDistance(inaccurateLat, inaccurateLng, projLat, projLng);

                    if (dist < minDistance) {
                        minDistance = dist;
                        closestIndex = i;
                        snappedLat = projLat;
                        snappedLng = projLng;
                    }
                }

                displayLat = snappedLat;
                displayLng = snappedLng;
                simFromIndexRef.current = closestIndex;
            }

            if (setUserLocation) {
                setUserLocation({ lat: displayLat, lng: displayLng });
            }

            const remainingCoords = routeCoordinates.current.slice(closestIndex + 1);
            if (remainingCoords.length > 0) {
                const routeWithSnappedStart = [[displayLng, displayLat] as [number, number], ...remainingCoords];

                if (taxiSegments && setSegmentedRoutes) {
                    const updatedSegments = buildSegmentedRoutesFromPosition(
                        taxiSegments,
                        closestIndex,
                        displayLat,
                        displayLng,
                        true
                    );

                    if (updateNavigationState) {
                        updateNavigationState({ lat: displayLat, lng: displayLng }, updatedSegments);
                    } else {
                        setSegmentedRoutes(updatedSegments);
                    }
                } else {
                    setRouteGeoJSON({
                        type: 'Feature',
                        properties: {},
                        geometry: {
                            type: 'LineString',
                            coordinates: routeWithSnappedStart,
                        },
                    });
                }

                let totalDistance = 0;
                for (let i = 0; i < routeWithSnappedStart.length - 1; i++) {
                    const [lng1, lat1] = routeWithSnappedStart[i];
                    const [lng2, lat2] = routeWithSnappedStart[i + 1];
                    totalDistance += calculateDistance(lat1, lng1, lat2, lng2);
                }

                setRemainingDistance(totalDistance);

                const averageSpeedMps = totalRouteDistance > 0 && totalRouteDuration > 0
                    ? totalRouteDistance / totalRouteDuration
                    : (25 * 1000) / 3600;
                setRemainingTime(totalDistance / averageSpeedMps);
            }

            const avgSpeedMps = totalRouteDistance > 0 && totalRouteDuration > 0
                ? totalRouteDistance / totalRouteDuration
                : 11.1; 
            const targetAdvanceMeters = avgSpeedMps * 5;

            let accumulated = 0;
            let nextIndex = currentRouteIndex.current + 1;
            while (nextIndex < routeCoordinates.current.length - 1 && accumulated < targetAdvanceMeters) {
                const [lng1, lat1] = routeCoordinates.current[nextIndex - 1];
                const [lng2, lat2] = routeCoordinates.current[nextIndex];
                accumulated += calculateDistance(lat1, lng1, lat2, lng2);
                nextIndex++;
            }
            currentRouteIndex.current = Math.min(nextIndex, routeCoordinates.current.length - 1);

            simInterpolateFromRef.current = { lat: displayLat, lng: displayLng };
            simTickStartRef.current = Date.now();

            let predAccumulated = 0;
            let predIndex = currentRouteIndex.current;
            while (predIndex < routeCoordinates.current.length - 1 && predAccumulated < targetAdvanceMeters) {
                const [lng1, lat1] = routeCoordinates.current[predIndex];
                const [lng2, lat2] = routeCoordinates.current[predIndex + 1];
                predAccumulated += calculateDistance(lat1, lng1, lat2, lng2);
                predIndex++;
            }
            const clampedPredIndex = Math.min(predIndex, routeCoordinates.current.length - 1);
            const [predLng, predLat] = routeCoordinates.current[clampedPredIndex];
            simInterpolateToRef.current = { lat: predLat, lng: predLng };
            simToIndexRef.current = clampedPredIndex;
        }, 5000);

        if (smoothingIntervalRef.current) {
            clearInterval(smoothingIntervalRef.current);
        }
        smoothingIntervalRef.current = setInterval(() => {
            if (!isNavigatingRef.current || !simInterpolateFromRef.current || !simInterpolateToRef.current) return;

            const elapsed = Date.now() - simTickStartRef.current;
            const progress = Math.min(elapsed / 5000, 1);
            const interpLat = simInterpolateFromRef.current.lat + (simInterpolateToRef.current.lat - simInterpolateFromRef.current.lat) * progress;
            const interpLng = simInterpolateFromRef.current.lng + (simInterpolateToRef.current.lng - simInterpolateFromRef.current.lng) * progress;

            //update maraker
            if (setUserLocation) {
                setUserLocation({ lat: interpLat, lng: interpLng });
            }


            const fromIdx = simFromIndexRef.current;
            const toIdx = simToIndexRef.current;
            const estimatedIdx = Math.min(
                Math.round(fromIdx + progress * (toIdx - fromIdx)),
                routeCoordinates.current.length - 2
            );

            const remainingCoords = routeCoordinates.current.slice(estimatedIdx + 1);
            if (remainingCoords.length > 0) {
                if (taxiSegments && setSegmentedRoutes) {
                    const updatedSegments = buildSegmentedRoutesFromPosition(
                        taxiSegments,
                        estimatedIdx,
                        interpLat,
                        interpLng,
                        true
                    );

                    if (updateNavigationState) {
                        updateNavigationState({ lat: interpLat, lng: interpLng }, updatedSegments);
                    } else {
                        setSegmentedRoutes(updatedSegments);
                    }
                } else {
                    setRouteGeoJSON({
                        type: 'Feature',
                        properties: {},
                        geometry: {
                            type: 'LineString',
                            coordinates: [[interpLng, interpLat] as [number, number], ...remainingCoords],
                        },
                    });
                }
            }
        }, 1000);
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
        onArrival,
        stopSimulation,
        totalRouteDistance,
        totalRouteDuration,
        taxiSegments,
        setSegmentedRoutes,
        updateNavigationState,
    ]);

    const simulateOffRoute = useCallback(() => {
        if (!simulationInterval.current || routeCoordinates.current.length === 0) {
            showToast('Start simulation first');
            return;
        }

        const currentIndex = currentRouteIndex.current;
        if (currentIndex >= routeCoordinates.current.length) return;

        const wasSimulating = simulationInterval.current !== null;
        if (wasSimulating) {
            clearInterval(simulationInterval.current);
            simulationInterval.current = null;
        }
        if (smoothingIntervalRef.current) {
            clearInterval(smoothingIntervalRef.current);
            smoothingIntervalRef.current = null;
        }

        const [currentLng, currentLat] = routeCoordinates.current[currentIndex];
        const offsetLat = currentLat + 0.00045;
        const offsetLng = currentLng + 0.00045;

        if (setUserLocation) {
            setUserLocation({ lat: offsetLat, lng: offsetLng });
        }

        showToast('Moved ~50m away. Simulation paused. Watch for detection!');
    }, [setUserLocation, routeCoordinates]);

    return {
        startSimulation,
        stopSimulation,
        simulateOffRoute,
        isSimulating: simulationInterval.current !== null,
    };
};
