import { useState, useRef, useEffect } from 'react';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { TaxiNavigationResponse, RouteSegment, SegmentMode } from '../../taxi/types/taxi.types';
import { calculateDistance } from '../utils/navigationUtils';
import { showToast } from '../../../shared/utils/toast';
import { voiceNavigationService } from '../services/voice-navigation.service';
import { decodePolyline } from '../../../shared/utils/polyline';
import { taxiService } from '../../taxi/services/taxi.service';

interface UseTaxiNavigationProps {
    taxiRoute: TaxiNavigationResponse;
    mapRef: React.RefObject<GebetaMapRef | null>;
    userLocation: { lat: number; lng: number } | null;
    setUserLocation?: (location: { lat: number; lng: number }) => void;
    onNavigationComplete: () => void;
    onRouteUpdate?: (newRoute: TaxiNavigationResponse) => void;
}

const STATION_ARRIVAL_THRESHOLD = 50; // 50 meters
const WALKING_END_THRESHOLD = 20; // 20 meters
const OFF_ROUTE_THRESHOLD = 50; // 50 meters for taxi routes

export const useTaxiNavigation = ({
    taxiRoute,
    mapRef,
    userLocation,
    setUserLocation,
    onNavigationComplete,
    onRouteUpdate,
}: UseTaxiNavigationProps) => {
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
    const [currentInstruction, setCurrentInstruction] = useState<string>('');
    const [remainingDistance, setRemainingDistance] = useState<number>(0);
    const [remainingTime, setRemainingTime] = useState<number>(0);
    const [isOnTaxi, setIsOnTaxi] = useState(false);
    const [isOffRoute, setIsOffRoute] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);

    const rerouteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentRouteRef = useRef(taxiRoute);

    // Update route ref when route changes
    useEffect(() => {
        currentRouteRef.current = taxiRoute;
    }, [taxiRoute]);

    const currentSegment = currentRouteRef.current.segments?.[currentSegmentIndex];
    const nextSegment = currentRouteRef.current.segments?.[currentSegmentIndex + 1];

    // Check if user has reached the end of current segment
    const checkSegmentTransition = () => {
        if (!userLocation || !currentSegment) return false;

        const endPoint = currentSegment.toNode || currentSegment.to;
        const distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            endPoint.lat,
            endPoint.lng
        );

        const threshold = currentSegment.mode === 'pedestrian' || currentSegment.type === 'walk'
            ? WALKING_END_THRESHOLD
            : STATION_ARRIVAL_THRESHOLD;

        return distance < threshold;
    };

    // Advance to next segment
    const advanceToNextSegment = () => {
        if (currentSegmentIndex < (currentRouteRef.current.segments?.length || 0) - 1) {
            const newIndex = currentSegmentIndex + 1;
            setCurrentSegmentIndex(newIndex);

            const newSegment = currentRouteRef.current.segments?.[newIndex];
            if (newSegment) {
                announceSegmentTransition(newSegment);

                // Update taxi status
                setIsOnTaxi(newSegment.mode === 'auto' || newSegment.type === 'taxi');
            }
        } else {
            // Reached final destination
            onNavigationComplete();
        }
    };

    // Announce segment transitions
    const announceSegmentTransition = (segment: RouteSegment) => {
        if (segment.mode === 'auto' || segment.type === 'taxi') {
            const message = `Board taxi at ${segment.fromNode?.name} to ${segment.toNode?.name}`;
            setCurrentInstruction(message);
            voiceNavigationService.speakInstruction(message);
            showToast.info('Board Taxi', message);
        } else if (segment.mode === 'pedestrian' || segment.type === 'walk') {
            const destination = segment.toNode?.name || 'destination';
            const message = `Walk to ${destination}`;
            setCurrentInstruction(message);
            voiceNavigationService.speakInstruction(message);
            showToast.info('Walking', message);
        }
    };

    // Calculate remaining distance and time
    const calculateRemaining = () => {
        if (!currentRouteRef.current.segments) return { distance: 0, time: 0 };

        let totalDistance = 0;
        let totalTime = 0;

        for (let i = currentSegmentIndex; i < currentRouteRef.current.segments.length; i++) {
            const segment = currentRouteRef.current.segments[i];
            totalDistance += segment.distance * 1000; // Convert to meters
            totalTime += segment.time;
        }

        return { distance: totalDistance, time: totalTime };
    };

    // Check if user is off route
    const checkOffRoute = () => {
        if (!userLocation || !currentSegment) return false;

        // Decode current segment polyline
        try {
            const coords = decodePolyline(currentSegment.polyline, 6);

            // Find closest point on route
            let minDistance = Infinity;
            for (const [lat, lng] of coords) {
                const distance = calculateDistance(
                    userLocation.lat,
                    userLocation.lng,
                    lat,
                    lng
                );
                minDistance = Math.min(minDistance, distance);
            }

            return minDistance > OFF_ROUTE_THRESHOLD;
        } catch (error) {
            console.error('Error checking off route:', error);
            return false;
        }
    };

    // Recalculate route
    const recalculateRoute = async () => {
        if (!userLocation || isRecalculating) return;

        setIsRecalculating(true);
        showToast.info('Recalculating', 'Finding new route...');

        try {
            const newRoute = await taxiService.requestTaxiNavigation({
                origin: [userLocation.lat, userLocation.lng],
                destination: [
                    currentRouteRef.current.destination.lat,
                    currentRouteRef.current.destination.lng,
                ],
            });

            if (newRoute.success && newRoute.segments) {
                currentRouteRef.current = newRoute;
                setCurrentSegmentIndex(0);
                setIsOffRoute(false);
                showToast.success('Route Updated', 'New route calculated');

                if (onRouteUpdate) {
                    onRouteUpdate(newRoute);
                }
            } else {
                showToast.error('Recalculation Failed', 'Could not find alternative route');
            }
        } catch (error) {
            console.error('Recalculation error:', error);
            showToast.error('Error', 'Failed to recalculate route');
        } finally {
            setIsRecalculating(false);
        }
    };

    // Update remaining stats
    useEffect(() => {
        const { distance, time } = calculateRemaining();
        setRemainingDistance(distance);
        setRemainingTime(time);
    }, [currentSegmentIndex]);

    // Check for segment transitions
    useEffect(() => {
        if (!userLocation || !currentSegment) return;

        const shouldTransition = checkSegmentTransition();
        if (shouldTransition) {
            advanceToNextSegment();
        }

        // Check if off route (only for walking segments)
        if (currentSegment.mode === 'pedestrian' || currentSegment.type === 'walk') {
            const offRoute = checkOffRoute();
            if (offRoute && !isOffRoute) {
                setIsOffRoute(true);
                showToast.info('Off Route', 'You are off the planned route');

                // Schedule recalculation
                if (rerouteTimeout.current) {
                    clearTimeout(rerouteTimeout.current);
                }
                rerouteTimeout.current = setTimeout(() => {
                    recalculateRoute();
                }, 3000);
            } else if (!offRoute && isOffRoute) {
                setIsOffRoute(false);
                if (rerouteTimeout.current) {
                    clearTimeout(rerouteTimeout.current);
                    rerouteTimeout.current = null;
                }
                showToast.success('Back on Route', 'You are back on the planned route');
            }
        }
    }, [userLocation, currentSegment]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (rerouteTimeout.current) {
                clearTimeout(rerouteTimeout.current);
            }
        };
    }, []);

    // Initial instruction
    useEffect(() => {
        if (currentSegment) {
            announceSegmentTransition(currentSegment);
        }
    }, []);

    return {
        currentSegmentIndex,
        totalSegments: currentRouteRef.current.segments?.length || 0,
        currentSegment,
        nextSegment,
        isOnTaxi,
        currentInstruction,
        remainingDistance,
        remainingTime,
        isOffRoute,
        isRecalculating,
        startNode: currentRouteRef.current.startNode,
        endNode: currentRouteRef.current.endNode,
        totalFare: currentRouteRef.current.summary.estimatedFare,
        currency: currentRouteRef.current.summary.currency,
        recalculateRoute,
    };
};
