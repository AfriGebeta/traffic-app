import { useRef, useCallback } from 'react';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { showToast } from '../../../shared/utils/toast';
import { calculateBearing, calculateDistance } from '../utils/navigationUtils';

interface UseSimulationProps {
    routeCoordinates: React.MutableRefObject<[number, number][]>;
    isNavigatingRef: React.MutableRefObject<boolean>;
    mapRef: React.RefObject<GebetaMapRef | null>;
    setUserLocation?: (location: { lat: number; lng: number }) => void;
    setCurrentHeading: (heading: number) => void;
    setRouteGeoJSON: (geoJSON: any) => void;
    setRemainingDistance: (distance: number) => void;
    setRemainingTime: (time: number) => void;
    updateInstructionBasedOnPosition?: (lat: number, lng: number) => void;
    onSimulationComplete?: () => void;
    onArrival?: () => void;
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
    onArrival,
    totalRouteDistance,
    totalRouteDuration,
}: UseSimulationProps) => {
    const simulationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const smoothingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const simInterpolateFromRef = useRef<{ lat: number; lng: number } | null>(null);
    const simInterpolateToRef = useRef<{ lat: number; lng: number } | null>(null);
    const simFromIndexRef = useRef<number>(0);
    const simToIndexRef = useRef<number>(0);
    const simTickStartRef = useRef<number>(0);
    const currentRouteIndex = useRef(0);
    const lastRenderedMarkerRef = useRef<{ lat: number; lng: number } | null>(null);

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

        const [initialLng, initialLat] = routeCoordinates.current[0];
        if (setUserLocation) {
            setUserLocation({ lat: initialLat, lng: initialLng });
        }

        simFromIndexRef.current = 0;
        simInterpolateFromRef.current = { lat: initialLat, lng: initialLng };
        simTickStartRef.current = Date.now();

        const avgSpeedMps = totalRouteDistance > 0 && totalRouteDuration > 0
            ? totalRouteDistance / totalRouteDuration
            : 11.1;
        const targetAdvanceMeters = avgSpeedMps * 5;

        let accumulated = 0;
        let targetIndex = 1;
        while (targetIndex < routeCoordinates.current.length - 1 && accumulated < targetAdvanceMeters) {
            const [lng1, lat1] = routeCoordinates.current[targetIndex - 1];
            const [lng2, lat2] = routeCoordinates.current[targetIndex];
            accumulated += calculateDistance(lat1, lng1, lat2, lng2);
            targetIndex++;
        }
        const initialTargetIndex = Math.min(targetIndex, routeCoordinates.current.length - 1);
        const [targetLng, targetLat] = routeCoordinates.current[initialTargetIndex];
        simInterpolateToRef.current = { lat: targetLat, lng: targetLng };
        simToIndexRef.current = initialTargetIndex;

        simulationInterval.current = setInterval(() => {
            if (currentRouteIndex.current >= routeCoordinates.current.length) {
                stopSimulation();
                onArrival?.();
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

            updateInstructionBasedOnPosition?.(inaccurateLat, inaccurateLng);

            let displayLat = lat;
            let displayLng = lng;
            let closestIndex = currentRouteIndex.current;


            if (routeCoordinates.current.length > 0) {
                let minDistance = Infinity;
                let snappedLat = lat;
                let snappedLng = lng;

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

            const fromIdx = currentRouteIndex.current;

            const fromLat = lastRenderedMarkerRef.current?.lat ?? displayLat;
            const fromLng = lastRenderedMarkerRef.current?.lng ?? displayLng;

            simFromIndexRef.current = fromIdx;
            simInterpolateFromRef.current = { lat: fromLat, lng: fromLng };
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
            if (!isNavigatingRef.current) return;

            if (!simInterpolateFromRef.current || !simInterpolateToRef.current) return;

            if (simTickStartRef.current === 0) return;

            const elapsed = Date.now() - simTickStartRef.current;
            const progress = Math.min(elapsed / 5000, 1);

            const fromIdx = simFromIndexRef.current;
            const toIdx = simToIndexRef.current;

            const fractionalIdx = fromIdx + progress * (toIdx - fromIdx);


            const estimatedIdx = Math.min(
                Math.floor(fractionalIdx),
                routeCoordinates.current.length - 2
            );

            let markerLat: number;
            let markerLng: number;

            if (estimatedIdx < routeCoordinates.current.length - 1) {
                const [lng1, lat1] = routeCoordinates.current[estimatedIdx];
                const [lng2, lat2] = routeCoordinates.current[estimatedIdx + 1];

                const indexProgress = fractionalIdx - estimatedIdx;
                const t = Math.max(0, Math.min(1, indexProgress));

                markerLat = lat1 + t * (lat2 - lat1);
                markerLng = lng1 + t * (lng2 - lng1);

            } else {
                const [lng, lat] = routeCoordinates.current[estimatedIdx];
                markerLat = lat;
                markerLng = lng;
            }

            const remainingCoords = routeCoordinates.current.slice(estimatedIdx + 1);

            if (remainingCoords.length > 0) {
                let totalDistance = 0;
                const routeWithMarker = [[markerLng, markerLat] as [number, number], ...remainingCoords];
                for (let i = 0; i < routeWithMarker.length - 1; i++) {
                    const [lng1, lat1] = routeWithMarker[i];
                    const [lng2, lat2] = routeWithMarker[i + 1];
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

                lastRenderedMarkerRef.current = { lat: markerLat, lng: markerLng };

                if (setUserLocation) {
                    setUserLocation({ lat: markerLat, lng: markerLng });
                }
                setRemainingDistance(totalDistance);

                const averageSpeedMps = totalRouteDistance > 0 && totalRouteDuration > 0
                    ? totalRouteDistance / totalRouteDuration
                    : (25 * 1000) / 3600;
                const estimatedTime = totalDistance / averageSpeedMps;
                setRemainingTime(estimatedTime);

                if (totalDistance <= 50 && totalDistance > 0) {
                    stopSimulation();
                    onArrival?.();
                    if (onSimulationComplete) {
                        onSimulationComplete();
                    }
                }
            } else {

                lastRenderedMarkerRef.current = { lat: markerLat, lng: markerLng };

                if (setUserLocation) {
                    setUserLocation({ lat: markerLat, lng: markerLng });
                }
                setRemainingDistance(0);
                setRemainingTime(0);
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
        onSimulationComplete,
        onArrival,
        stopSimulation,
        totalRouteDistance,
        totalRouteDuration,
    ]);

    const simulateOffRoute = useCallback((setUserLocation: (location: { lat: number; lng: number }) => void, navigationMode: boolean, simulateMovement: boolean, recalculateRoute: (fromLocation?: { lat: number; lng: number }) => Promise<void>, setIsOffRoute: (value: boolean) => void, rerouteTimeout: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
        if (!navigationMode || routeCoordinates.current.length === 0) {
            showToast('Error: Start navigation first');
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

        showToast(
            `Testing Off-Route: Moved ${distance.toFixed(0)}m away. ${wasSimulating ? 'Simulation paused.' : ''} Watch for detection!`
        );

        //update map position
        if (mapRef.current) {
            mapRef.current.updateNavigationPosition([offsetLng, offsetLat]);

            //manually trigger off-route detection
            setTimeout(() => {
                setIsOffRoute(true);
                showToast(`Off Route: You are ${distance.toFixed(0)}m off the planned route`);

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
