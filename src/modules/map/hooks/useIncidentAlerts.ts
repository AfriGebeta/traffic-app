import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Incident } from '../../incidents/types/incident.types';
import { getIncidentTranslationKey } from '../../incidents/utils/incidentTranslations';
import { useTranslation } from 'react-i18next';

const ALERT_DISTANCE_KM = 1;
const CLEAR_DISTANCE_KM = 0.2;

const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;

    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
        Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
};

const isIncidentOnRouteAhead = (
    currentLat: number,
    currentLng: number,
    incidentLat: number,
    incidentLng: number,
    routeCoordinates: [number, number][] | undefined,
    maxDistanceFromRoute: number = 0.15
): boolean => {
    //no route , fallback
    if (!routeCoordinates || routeCoordinates.length === 0) {
        console.log('No route coordinates, showing all incidents');
        return true;
    }

    //current position
    let currentRouteIndex = 0;
    let minDistanceToRoute = Infinity;

    for (let i = 0; i < routeCoordinates.length; i++) {
        const [lng, lat] = routeCoordinates[i];
        const distance = calculateDistance(currentLat, currentLng, lat, lng);
        if (distance < minDistanceToRoute) {
            minDistanceToRoute = distance;
            currentRouteIndex = i;
        }
    }

    let minIncidentDistance = Infinity;
    for (let i = currentRouteIndex; i < routeCoordinates.length; i++) {
        const [lng, lat] = routeCoordinates[i];
        const distanceToRoutePoint = calculateDistance(incidentLat, incidentLng, lat, lng);

        if (distanceToRoutePoint < minIncidentDistance) {
            minIncidentDistance = distanceToRoutePoint;
        }

        if (distanceToRoutePoint <= maxDistanceFromRoute) {
            return true;
        }
    }

    return false;
};

interface ActiveAlert {
    incidentId: string;
    incidentName: string;
    distance: string;
    incidentType: Incident['type'];
}

export const useIncidentAlerts = (
    userLocation: { lat: number; lng: number } | null,
    incidents: Incident[],
    navigationMode: boolean,
    routeCoordinates?: [number, number][]
) => {
    const { t } = useTranslation();
    const [activeAlert, setActiveAlert] = useState<ActiveAlert | null>(null);
    const alertedIncidents = useRef<Set<string>>(new Set());
    const passedIncidents = useRef<Set<string>>(new Set());
    const previousDistances = useRef<Map<string, number>>(new Map());
    const previousLocation = useRef<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        console.log('useIncidentAlerts:', {
            navigationMode,
            hasUserLocation: !!userLocation,
            incidentsCount: incidents.length,
            hasRouteCoordinates: !!routeCoordinates,
            routeCoordinatesLength: routeCoordinates?.length || 0
        });

        if (!navigationMode || !userLocation || incidents.length === 0) {
            setActiveAlert(null);
            return;
        }

        let closestIncident: Incident | null = null;
        let closestDistance = Infinity;

        for (const incident of incidents) {
            if (passedIncidents.current.has(incident.id)) {
                continue;
            }

            const distance = calculateDistance(
                userLocation.lat,
                userLocation.lng,
                incident.lat,
                incident.lng
            );

            const onRouteAhead = isIncidentOnRouteAhead(
                userLocation.lat,
                userLocation.lng,
                incident.lat,
                incident.lng,
                routeCoordinates
            );

            console.log(`incident ${incident.type.name}:`, {
                distance: distance.toFixed(3),
                onRouteAhead,
                withinAlertDistance: distance <= ALERT_DISTANCE_KM
            });

            if (onRouteAhead && distance <= ALERT_DISTANCE_KM && distance < closestDistance) {
                closestIncident = incident;
                closestDistance = distance;
            }
        }

        if (closestIncident && closestDistance < Infinity) {
            console.log('found closest incident:', { type: closestIncident.type.name, distance: closestDistance.toFixed(3) });

            const incidentId = closestIncident.id;
            const previousDistance = previousDistances.current.get(incidentId);

            const reachedIncident = closestDistance <= CLEAR_DISTANCE_KM;
            const isMovingAway = previousDistance !== undefined && closestDistance > previousDistance;

            if (reachedIncident && isMovingAway) {
                passedIncidents.current.add(incidentId);
                setActiveAlert(null);
                alertedIncidents.current.delete(incidentId);
                previousDistances.current.delete(incidentId);
            } else {
                //alert for ahead
                if (!alertedIncidents.current.has(incidentId)) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    alertedIncidents.current.add(incidentId);
                }

                const distanceText = closestDistance < 0.1
                    ? t('ahead')
                    : `${t('in')} ${(closestDistance * 1000).toFixed(0)} m`;

                const incidentName = t(getIncidentTranslationKey(closestIncident.type));

                setActiveAlert({
                    incidentId,
                    incidentName,
                    distance: distanceText,
                    incidentType: closestIncident.type,
                });

                previousDistances.current.set(incidentId, closestDistance);
            }
        } else {
            setActiveAlert(null);
        }

        //update prev location
        previousLocation.current = userLocation;
    }, [userLocation, incidents, navigationMode, t]);

    //track clearing
    useEffect(() => {
        if (!navigationMode) {
            setActiveAlert(null);
            alertedIncidents.current.clear();
            passedIncidents.current.clear();
            previousDistances.current.clear();
            previousLocation.current = null;
        }
    }, [navigationMode]);

    return activeAlert;
};
