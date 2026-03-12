import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { TrafficRuleReport } from '../../rules/types/rule.types';
import { RULE_TRANSLATION_MAP } from '../../rules/utils/ruleTranslations';
import { useTranslation } from 'react-i18next';

const ALERT_DISTANCE_KM = 0.2; //200m
const CLEAR_DISTANCE_KM = 0.05; //50m cleared when passed

const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const isRuleOnRouteAhead = (
    currentLat: number,
    currentLng: number,
    ruleLat: number,
    ruleLng: number,
    routeCoordinates: [number, number][] | undefined,
    maxDistanceFromRoute: number = 0.1
): boolean => {
    if (!routeCoordinates || routeCoordinates.length === 0) {
        return true;
    }

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

    for (let i = currentRouteIndex; i < routeCoordinates.length; i++) {
        const [lng, lat] = routeCoordinates[i];
        const distanceToRoutePoint = calculateDistance(ruleLat, ruleLng, lat, lng);

        if (distanceToRoutePoint <= maxDistanceFromRoute) {
            return true;
        }
    }

    return false;
};

interface ActiveRuleAlert {
    ruleId: string;
    ruleName: string;
    ruleImg: string;
    distance: string;
}

export const useRuleAlerts = (
    userLocation: { lat: number; lng: number } | null,
    rules: TrafficRuleReport[],
    navigationMode: boolean,
    routeCoordinates?: [number, number][]
) => {
    const { t } = useTranslation();
    const [activeAlert, setActiveAlert] = useState<ActiveRuleAlert | null>(null);
    const alertedRules = useRef<Set<string>>(new Set());
    const passedRules = useRef<Set<string>>(new Set());
    const previousDistances = useRef<Map<string, number>>(new Map());

    useEffect(() => {
        if (!navigationMode || !userLocation || rules.length === 0) {
            setActiveAlert(null);
            return;
        }

        let closestRule: TrafficRuleReport | null = null;
        let closestDistance = Infinity;

        for (const rule of rules) {
            if (passedRules.current.has(rule.id)) {
                continue;
            }

            const distance = calculateDistance(userLocation.lat, userLocation.lng, rule.lat, rule.lng);

            const onRouteAhead = isRuleOnRouteAhead(
                userLocation.lat,
                userLocation.lng,
                rule.lat,
                rule.lng,
                routeCoordinates
            );

            if (onRouteAhead && distance <= ALERT_DISTANCE_KM && distance < closestDistance) {
                closestRule = rule;
                closestDistance = distance;
            }
        }

        if (closestRule && closestDistance < Infinity) {
            const ruleId = closestRule.id;
            const previousDistance = previousDistances.current.get(ruleId);

            const reachedRule = closestDistance <= CLEAR_DISTANCE_KM;
            const isMovingAway = previousDistance !== undefined && closestDistance > previousDistance;

            if (reachedRule && isMovingAway) {
                passedRules.current.add(ruleId);
                setActiveAlert(null);
                alertedRules.current.delete(ruleId);
                previousDistances.current.delete(ruleId);
            } else {
                if (!alertedRules.current.has(ruleId)) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    alertedRules.current.add(ruleId);
                }

                const distanceText =
                    closestDistance < 0.1 ? t('ahead') : `${t('in')} ${(closestDistance * 1000).toFixed(0)} m`;

                const translationKeys = RULE_TRANSLATION_MAP[closestRule.type.name];
                const ruleName = translationKeys ? t(translationKeys.name) : closestRule.type.name;

                setActiveAlert({
                    ruleId,
                    ruleName,
                    ruleImg: closestRule.type.img,
                    distance: distanceText,
                });

                previousDistances.current.set(ruleId, closestDistance);
            }
        } else {
            setActiveAlert(null);
        }
    }, [userLocation, rules, navigationMode, t, routeCoordinates]);

    useEffect(() => {
        if (!navigationMode) {
            setActiveAlert(null);
            alertedRules.current.clear();
            passedRules.current.clear();
            previousDistances.current.clear();
        }
    }, [navigationMode]);

    return activeAlert;
};
