import { useRef, useCallback } from 'react';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { showToast } from '../../../shared/utils/toast';
import { calculateBearing } from '../utils/navigationUtils';
import { decodePolyline } from '../../../shared/utils/polyline';
import { TaxiNavigationResponse } from '../../taxi/types/taxi.types';

interface UseTaxiSimulationProps {
    taxiRoute: TaxiNavigationResponse;
    mapRef: React.RefObject<GebetaMapRef | null>;
    setUserLocation?: (location: { lat: number; lng: number }) => void;
    setCurrentHeading: (heading: number) => void;
    onSegmentChange?: (segmentIndex: number) => void;
    onArrival?: () => void;
}

export const useTaxiSimulation = ({
    taxiRoute,
    mapRef,
    setUserLocation,
    setCurrentHeading,
    onSegmentChange,
    onArrival,
}: UseTaxiSimulationProps) => {
    const simulationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const currentSegmentIndex = useRef(0);
    const currentPointIndex = useRef(0);
    const allRoutePoints = useRef<Array<{ lat: number; lng: number; segmentIndex: number }>>([]);

    // Build complete route from all segments
    const buildCompleteRoute = useCallback(() => {
        const points: Array<{ lat: number; lng: number; segmentIndex: number }> = [];

        taxiRoute.segments?.forEach((segment, segmentIdx) => {
            try {
                const coords = decodePolyline(segment.polyline, 6);
                coords.forEach(([lat, lng]) => {
                    points.push({ lat, lng, segmentIndex: segmentIdx });
                });
            } catch (error) {
                console.error(`Error decoding segment ${segmentIdx}:`, error);
            }
        });

        allRoutePoints.current = points;
        console.log(`[Taxi Simulation] Built route with ${points.length} points across ${taxiRoute.segments?.length} segments`);
    }, [taxiRoute]);

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

        buildCompleteRoute();
        currentPointIndex.current = 0;
        currentSegmentIndex.current = 0;

        console.log('[Taxi Simulation] Starting with', allRoutePoints.current.length, 'points');
        showToast.info('Simulation Started', 'GPS simulation is running for testing');

        simulationInterval.current = setInterval(() => {
            if (currentPointIndex.current >= allRoutePoints.current.length) {
                stopSimulation();
                onArrival?.();
                showToast.success('Arrived', 'Simulation completed');
                return;
            }

            const currentPoint = allRoutePoints.current[currentPointIndex.current];
            const { lat, lng, segmentIndex } = currentPoint;

            // Check if we've moved to a new segment
            if (segmentIndex !== currentSegmentIndex.current) {
                currentSegmentIndex.current = segmentIndex;
                onSegmentChange?.(segmentIndex);

                const segment = taxiRoute.segments?.[segmentIndex];
                const segmentType = segment?.mode === 'pedestrian' || segment?.type === 'walk' ? 'Walking' : 'On Taxi';
                console.log(`[Taxi Simulation] Segment ${segmentIndex}: ${segmentType}`);
            }

            // Add GPS inaccuracy (3-8 meters)
            const offsetMeters = 3 + Math.random() * 5;
            const offsetAngle = Math.random() * 2 * Math.PI;
            const offsetLat = (offsetMeters / 111320) * Math.cos(offsetAngle);
            const offsetLng = (offsetMeters / (111320 * Math.cos(lat * Math.PI / 180))) * Math.sin(offsetAngle);

            const inaccurateLat = lat + offsetLat;
            const inaccurateLng = lng + offsetLng;

            // Calculate bearing
            if (currentPointIndex.current < allRoutePoints.current.length - 1) {
                const nextPoint = allRoutePoints.current[currentPointIndex.current + 1];
                const bearing = calculateBearing(
                    [lng, lat],
                    [nextPoint.lng, nextPoint.lat]
                );
                setCurrentHeading(bearing);
            }

            // Update location
            if (setUserLocation) {
                setUserLocation({ lat: inaccurateLat, lng: inaccurateLng });
            }

            // Update camera
            if (mapRef.current) {
                mapRef.current.flyTo({
                    center: [inaccurateLng, inaccurateLat],
                    zoom: 17,
                    pitch: 60,
                    duration: 500,
                });
            }

            currentPointIndex.current += 1;
        }, 2000); // Move every 2 seconds
    }, [
        buildCompleteRoute,
        taxiRoute,
        mapRef,
        setUserLocation,
        setCurrentHeading,
        onSegmentChange,
        onArrival,
        stopSimulation,
    ]);

    const simulateOffRoute = useCallback(() => {
        if (!simulationInterval.current || allRoutePoints.current.length === 0) {
            showToast.error('Error', 'Start simulation first');
            return;
        }

        const currentPoint = allRoutePoints.current[currentPointIndex.current];
        if (!currentPoint) return;

        // Pause simulation
        const wasSimulating = simulationInterval.current !== null;
        if (wasSimulating) {
            clearInterval(simulationInterval.current);
            simulationInterval.current = null;
        }

        // Move 50m off route
        const offsetLat = currentPoint.lat + 0.00045;
        const offsetLng = currentPoint.lng + 0.00045;

        if (setUserLocation) {
            setUserLocation({ lat: offsetLat, lng: offsetLng });
        }

        showToast.info(
            'Testing Off-Route',
            'Moved ~50m away. Simulation paused. Watch for detection!'
        );

        console.log('[Taxi Simulation] Simulated off-route at segment', currentSegmentIndex.current);
    }, [setUserLocation, simulationInterval, allRoutePoints, currentPointIndex, currentSegmentIndex]);

    return {
        startSimulation,
        stopSimulation,
        simulateOffRoute,
        isSimulating: simulationInterval.current !== null,
    };
};
