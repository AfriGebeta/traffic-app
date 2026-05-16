import { useRef, useCallback } from 'react';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { showToast } from '../../../shared/utils/toast';
import { calculateBearing, calculateDistance } from '../utils/navigationUtils';
import { decodePolyline } from '../../../shared/utils/polyline';
import { TaxiNavigationResponse } from '../../taxi/types/taxi.types';

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
}: UseTaxiSimulationProps) => {
    const simulationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const currentRouteIndex = useRef(0);

    const stopSimulation = useCallback(() => {
        if (simulationInterval.current) {
            clearInterval(simulationInterval.current);
            simulationInterval.current = null;
        }
        console.log('[Taxi Simulation] Stopped');
    }, []);

    const startSimulation = useCallback(() => {
        if (simulationInterval.current) {
            clearInterval(simulationInterval.current);
        }

        currentRouteIndex.current = 0;
        console.log('[Taxi Simulation] Starting with', routeCoordinates.current.length, 'points');
        showToast.info('Simulation Started', 'GPS simulation is running for testing');

        simulationInterval.current = setInterval(() => {
            if (currentRouteIndex.current >= routeCoordinates.current.length) {
                stopSimulation();
                onArrival?.();
                showToast.success('Arrived', 'Simulation completed');
                return;
            }

            const [lng, lat] = routeCoordinates.current[currentRouteIndex.current];

            console.log('[Taxi Simulation] Step', currentRouteIndex.current, '/', routeCoordinates.current.length, 'at', { lat, lng });

            const offsetMeters = 3 + Math.random() * 5;
            const offsetAngle = Math.random() * 2 * Math.PI;
            const offsetLat = (offsetMeters / 111320) * Math.cos(offsetAngle);
            const offsetLng = (offsetMeters / (111320 * Math.cos(lat * Math.PI / 180))) * Math.sin(offsetAngle);

            const inaccurateLat = lat + offsetLat;
            const inaccurateLng = lng + offsetLng;

            console.log('[Taxi Simulation] Inaccurate GPS:', { lat: inaccurateLat, lng: inaccurateLng }, 'offset:', offsetMeters.toFixed(1), 'm');

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
                    let minDistance = Infinity;
                    let snappedLat = inaccurateLat;
                    let snappedLng = inaccurateLng;

                    const SEARCH_WINDOW = 50;
                    const startIndex = Math.max(0, currentRouteIndex.current - SEARCH_WINDOW);
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
                            snappedLat = projLat;
                            snappedLng = projLng;
                        }
                    }

                    displayLat = snappedLat;
                    displayLng = snappedLng;

                    console.log('[Taxi Simulation] Snapped:', { lat: snappedLat, lng: snappedLng }, 'distance from route:', minDistance.toFixed(2), 'm');
                }
            }

            const remainingCoords = routeCoordinates.current.slice(currentRouteIndex.current + 1);
            if (remainingCoords.length > 0) {
                const routeWithSnappedStart = [[displayLng, displayLat] as [number, number], ...remainingCoords];

                if (taxiSegments && setSegmentedRoutes) {
                    let coordCount = 0;
                    let currentSegIdx = 0;
                    let positionInSegment = currentRouteIndex.current;

                    for (let i = 0; i < taxiSegments.length; i++) {
                        const decoded = decodePolyline(taxiSegments[i].polyline, 6);
                        if (currentRouteIndex.current < coordCount + decoded.length) {
                            currentSegIdx = i;
                            positionInSegment = currentRouteIndex.current - coordCount;
                            break;
                        }
                        coordCount += decoded.length;
                    }

                    const updatedSegments = taxiSegments.map((seg, idx) => {
                        const decoded = decodePolyline(seg.polyline, 6);
                        let coordinates = decoded.map(([lat, lng]: [number, number]) => [lng, lat] as [number, number]);

                        if (idx === currentSegIdx) {
                            const remaining = coordinates.slice(positionInSegment + 1);
                           
                            coordinates = [[displayLng, displayLat], ...remaining];
                        } else if (idx < currentSegIdx) {
                            coordinates = [];
                        }

                        return {
                            geoJSON: {
                                type: 'Feature' as const,
                                properties: {
                                    segmentIndex: idx,
                                    markerLat: displayLat,
                                    markerLng: displayLng,
                                },
                                geometry: {
                                    type: 'LineString' as const,
                                    coordinates
                                }
                            },
                            isWalking: seg.type === 'walk' || seg.mode === 'pedestrian',
                            segmentIndex: idx
                        };
                    });

                    setSegmentedRoutes(updatedSegments);
                    if (setUserLocation) {
                        console.log('[Taxi Simulation] Setting user location:', { lat: displayLat, lng: displayLng });
                        setUserLocation({ lat: displayLat, lng: displayLng });
                    }

                    console.log('[Taxi Simulation] Updated segments:', {
                        currentSegIdx,
                        positionInSegment,
                        currentRouteIndex: currentRouteIndex.current,
                        markerPos: { lat: displayLat, lng: displayLng },
                        routeStart: updatedSegments[currentSegIdx]?.geoJSON.geometry.coordinates[0]
                    });
                } else {
                    const remainingGeoJSON = {
                        type: 'Feature',
                        properties: {},
                        geometry: {
                            type: 'LineString',
                            coordinates: routeWithSnappedStart,
                        }
                    };
                    if (setUserLocation) {
                        console.log('[Taxi Simulation] Setting user location:', { lat: displayLat, lng: displayLng });
                        setUserLocation({ lat: displayLat, lng: displayLng });
                    }
                    if (setRouteGeoJSON) {
                        setRouteGeoJSON(remainingGeoJSON);
                    }
                }

                let totalDistance = 0;
                for (let i = 0; i < routeWithSnappedStart.length - 1; i++) {
                    const [lng1, lat1] = routeWithSnappedStart[i];
                    const [lng2, lat2] = routeWithSnappedStart[i + 1];
                    const dist = calculateDistance(lat1, lng1, lat2, lng2);
                    totalDistance += dist;
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
        onArrival,
        stopSimulation,
        totalRouteDistance,
        totalRouteDuration,
    ]);

    const simulateOffRoute = useCallback(() => {
        if (!simulationInterval.current || routeCoordinates.current.length === 0) {
            showToast.error('Error', 'Start simulation first');
            return;
        }

        const currentIndex = currentRouteIndex.current;
        if (currentIndex >= routeCoordinates.current.length) return;

        const wasSimulating = simulationInterval.current !== null;
        if (wasSimulating) {
            clearInterval(simulationInterval.current);
            simulationInterval.current = null;
        }

        const [currentLng, currentLat] = routeCoordinates.current[currentIndex];
        const offsetLat = currentLat + 0.00045;
        const offsetLng = currentLng + 0.00045;

        if (setUserLocation) {
            setUserLocation({ lat: offsetLat, lng: offsetLng });
        }

        showToast.info(
            'Testing Off-Route',
            'Moved ~50m away. Simulation paused. Watch for detection!'
        );

        console.log('[Taxi Simulation] Simulated off-route');
    }, [setUserLocation, simulationInterval, routeCoordinates, currentRouteIndex]);

    return {
        startSimulation,
        stopSimulation,
        simulateOffRoute,
        isSimulating: simulationInterval.current !== null,
    };
};
