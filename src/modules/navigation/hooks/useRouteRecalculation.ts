import { useRef, useCallback } from 'react';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import type { GeocodingPlace, Leg, Maneuver } from '../types/navigation.types';
import { showToast } from '../../../shared/utils/toast';
import { navigationService } from '../services/navigation.service';
import { decodePolyline } from '../../../shared/utils/polyline';
import { useTranslation } from '../../../shared/hooks/useTranslation';

interface UseRouteRecalculationProps {
    mapRef: React.RefObject<GebetaMapRef | null>;
    userLocation: { lat: number; lng: number } | null;
    currentDestination: React.MutableRefObject<GeocodingPlace | null>;
    currentCostingRef: React.MutableRefObject<'auto' | 'pedestrian'>;

    waypointsRef: React.MutableRefObject<GeocodingPlace[]>;
    routeCoordinates: React.MutableRefObject<[number, number][]>;
    routeManeuvers: React.MutableRefObject<any[]>;
    currentManeuverIndexRef: React.MutableRefObject<number>;
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
    setRouteLegs?: (legs: Leg[]) => void;
    setRouteManeuversList?: (maneuvers: Maneuver[]) => void;
    handleStopNavigation: () => void;
    onArrival?: () => void;
    startSimulation: () => void;
    resetClosestIndex: () => void;
    setUserLocation?: (location: { lat: number; lng: number }) => void;
}

export const useRouteRecalculation = ({
    mapRef,
    userLocation,
    currentDestination,

    currentCostingRef,
    waypointsRef,
    routeCoordinates,
    routeManeuvers,
    currentManeuverIndexRef,

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

    setRouteLegs,
    setRouteManeuversList,
    handleStopNavigation,
    onArrival,
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
                return;
            }

            const now = Date.now();
            const timeSinceLastReroute = now - lastRerouteTime.current;


            if (timeSinceLastReroute < 5000) {
                return;
            }

            if (rerouteTimeout.current) {
                clearTimeout(rerouteTimeout.current);
                rerouteTimeout.current = null;
            }

            setIsRecalculating(true);
            lastRerouteTime.current = now;

            try {
                const remainingWaypoints = waypointsRef.current ?? [];
                const navigationData = await navigationService.getNavigation({
                    origin: [locationToUse.lat, locationToUse.lng],
                    destination: [currentDestination.current.latitude, currentDestination.current.longitude],
                    costing: currentCostingRef.current,
                    waypoints: remainingWaypoints.length > 0
                        ? remainingWaypoints.map(wp => [wp.latitude, wp.longitude] as [number, number])
                        : undefined,
                });

                if (!navigationData?.data?.trip?.legs?.[0]) {
                    showToast(
                        `${t('reroute-failed') || 'Reroute Failed'}: ${t('could-not-calculate-new-route') || 'Could not calculate new route'}`
                    );
                    setIsRecalculating(false);
                    return;
                }

                const legs = navigationData.data.trip.legs;
                const leg = legs[0];

                const decodedCoordinates: [number, number][] = [];
                for (const legPart of legs) {
                    if (!legPart?.shape) continue;
                    const decoded = decodePolyline(legPart.shape, 6);
                    const last = decodedCoordinates[decodedCoordinates.length - 1];
                    const first = decoded[0];
                    const startAt = last && first && last[0] === first[0] && last[1] === first[1] ? 1 : 0;
                    decodedCoordinates.push(...decoded.slice(startAt));
                }

                const allManeuvers = legs.flatMap((legPart) => legPart?.maneuvers ?? []);
                routeManeuvers.current = allManeuvers;
                setRouteLegs?.(legs);
                setRouteManeuversList?.(allManeuvers);

                currentManeuverIndexRef.current =
                    allManeuvers[0]?.type === 2 && allManeuvers.length > 1 ? 1 : 0;

                const summary = navigationData.data.trip.summary ?? leg.summary;
                const newRoute = {
                    coordinates: decodedCoordinates.map(coord => [coord[1], coord[0]]) as [number, number][],
                    distance: summary.length * 1000,
                    duration: summary.time,
                    instructions: allManeuvers.map((maneuver: any) => ({
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

                const newGeoJSON = {
                    type: 'Feature' as const,
                    properties: { timestamp: Date.now() },
                    geometry: {
                        type: 'LineString' as const,
                        coordinates: newRoute.coordinates,
                    }
                };

                if (setUserLocation && locationToUse) {
                    setUserLocation({ lat: locationToUse.lat, lng: locationToUse.lng });
                }
                setRouteGeoJSON(newGeoJSON);

                setIsNavigating(true);
                isNavigatingRef.current = true;

                setIsRecalculating(false);
                setIsOffRoute(false);

                showToast(
                    `${t('route-recalculated') || 'Route Recalculated'}: ${t('following-new-route') || 'Following new route'}`
                );

                if (simulateMovement) {
                    startSimulation();
                }
            } catch (error: any) {
                showToast(
                    `${t('reroute-failed') || 'Reroute Failed'}: ${error.message || t('could-not-calculate-new-route') || 'Could not calculate new route'}`
                );
                setIsRecalculating(false);
            }
        },
        [
            userLocation,
            currentDestination,
            routeCoordinates,
            routeManeuvers,
            currentManeuverIndexRef,
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
            handleStopNavigation,
            startSimulation,
            mapRef,

            resetClosestIndex,
            setUserLocation,
        ]
    );

    return { recalculateRoute };
};
