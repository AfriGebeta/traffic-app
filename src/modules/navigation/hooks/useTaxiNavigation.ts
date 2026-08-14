import { useState, useRef, useEffect } from 'react';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { TaxiNavigationResponse, RouteSegment, SegmentMode } from '../../taxi/types/taxi.types';
import { calculateDistance } from '../utils/navigationUtils';
import { showToast } from '../../../shared/utils/toast';
import { voiceNavigationService } from '../services/voice-navigation.service';
import { decodePolyline } from '../../../shared/utils/polyline';
import { taxiService } from '../../taxi/services/taxi.service';
import { getAppConfig } from '../../../shared/config/remoteConfigValues';

interface UseTaxiNavigationProps {
    taxiRoute: TaxiNavigationResponse;
    mapRef: React.RefObject<GebetaMapRef | null>;
    userLocation: { lat: number; lng: number } | null;
    setUserLocation?: (location: { lat: number; lng: number }) => void;
    onNavigationComplete: () => void;
    onRouteUpdate?: (newRoute: TaxiNavigationResponse) => void;
}

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

    const currentRouteRef = useRef(taxiRoute);

    const isFirstRouteRef = useRef(true);

    useEffect(() => {
        currentRouteRef.current = taxiRoute;

        if (isFirstRouteRef.current) {
            isFirstRouteRef.current = false;
            return;
        }

        setCurrentSegmentIndex(0);
        const firstSegment = taxiRoute.segments?.[0];
        if (firstSegment) {
            setIsOnTaxi(firstSegment.mode === 'auto' || firstSegment.type === 'taxi');
            announceSegmentTransition(firstSegment);
        }
    }, [taxiRoute]);

    const currentSegment = currentRouteRef.current.segments?.[currentSegmentIndex];
    const nextSegment = currentRouteRef.current.segments?.[currentSegmentIndex + 1];

    const checkSegmentTransition = () => {
        if (!userLocation || !currentSegment) return false;

        const endPoint = currentSegment.toNode || currentSegment.to;
        const distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            endPoint.lat,
            endPoint.lng
        );

        const cfg = getAppConfig();
        const threshold = currentSegment.mode === 'pedestrian' || currentSegment.type === 'walk'
            ? cfg.taxiWalkingEndThresholdM
            : cfg.taxiStationArrivalThresholdM;

        return distance < threshold;
    };

    const advanceToNextSegment = () => {
        if (currentSegmentIndex < (currentRouteRef.current.segments?.length || 0) - 1) {
            const newIndex = currentSegmentIndex + 1;
            setCurrentSegmentIndex(newIndex);

            const newSegment = currentRouteRef.current.segments?.[newIndex];
            if (newSegment) {
                announceSegmentTransition(newSegment);

                setIsOnTaxi(newSegment.mode === 'auto' || newSegment.type === 'taxi');
            }
        } else {
            onNavigationComplete();
        }
    };

    const announceSegmentTransition = (segment: RouteSegment) => {
        if (segment.mode === 'auto' || segment.type === 'taxi') {
            const message = `Board taxi at ${segment.fromNode?.name} to ${segment.toNode?.name}`;
            setCurrentInstruction(message);
            voiceNavigationService.speakInstruction(message);
            showToast(`Board Taxi: ${message}`);
        } else if (segment.mode === 'pedestrian' || segment.type === 'walk') {
            const destination = segment.toNode?.name || 'destination';
            const message = `Walk to ${destination}`;
            setCurrentInstruction(message);
            voiceNavigationService.speakInstruction(message);
            showToast(`Walking: ${message}`);
        }
    };

    const calculateRemaining = () => {
        if (!currentRouteRef.current.segments) return { distance: 0, time: 0 };

        let totalDistance = 0;
        let totalTime = 0;

        for (let i = currentSegmentIndex; i < currentRouteRef.current.segments.length; i++) {
            const segment = currentRouteRef.current.segments[i];
            totalDistance += segment.distance * 1000;
            totalTime += segment.time;
        }

        return { distance: totalDistance, time: totalTime };
    };



    useEffect(() => {
        const { distance, time } = calculateRemaining();
        setRemainingDistance(distance);
        setRemainingTime(time);
    }, [currentSegmentIndex]);

    useEffect(() => {
        if (!userLocation || !currentSegment) return;

        const shouldTransition = checkSegmentTransition();
        if (shouldTransition) {
            advanceToNextSegment();
        }

    }, [userLocation, currentSegment]);

    useEffect(() => {
        return () => {
        };
    }, []);

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
        startNode: currentRouteRef.current.startNode,
        endNode: currentRouteRef.current.endNode,
        totalFare: currentRouteRef.current.summary.estimatedFare,
        currency: currentRouteRef.current.summary.currency,
    };
};
