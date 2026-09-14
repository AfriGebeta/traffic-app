import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { TrafficRuleReport } from '../../rules/types/rule.types';
import { RULE_TRANSLATION_MAP } from '../../rules/utils/ruleTranslations';
import { useTranslation } from 'react-i18next';
import { roadIntersections, trafficLightIntersection, reachedIntersection, type Coordinate } from '../utils/trafficLightIntersections';
import { getAppConfig } from '../../../shared/config/remoteConfigValues';

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
    punishment: string;
}

export const useRuleAlerts = (
    userLocation: { lat: number; lng: number } | null,
    rules: TrafficRuleReport[],
    navigationMode: boolean,
    routeCoordinates?: [number, number][],
    queryRoadFeatures?: () => Promise<GeoJSON.Feature[]>
) => {
    const { t } = useTranslation();
    const [activeAlert, setActiveAlert] = useState<ActiveRuleAlert | null>(null);
    const alertedRules = useRef<Set<string>>(new Set());
    const passedRules = useRef<Set<string>>(new Set());
    const previousDistances = useRef<Map<string, number>>(new Map());

    const pinnedLight = useRef<{ rule: TrafficRuleReport; activation: Coordinate; target: Coordinate | null } | null>(null);
    const lastRoute = useRef(routeCoordinates);
    const [intersectionRevision, setIntersectionRevision] = useState(0);

    useEffect(() => {
        if (lastRoute.current !== routeCoordinates) {
            pinnedLight.current = null;
            lastRoute.current = routeCoordinates;
        }
        if (!navigationMode || !userLocation || (rules.length === 0 && !pinnedLight.current)) {
            setActiveAlert(null);
            return;
        }

        let closestRule: TrafficRuleReport | null = null;
        let closestDistance = Infinity;

        for (const rule of pinnedLight.current ? [] : rules) {
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

            if (onRouteAhead && distance <= getAppConfig().ruleAlertDistanceKm && distance < closestDistance) {
                closestRule = rule;
                closestDistance = distance;
            }
        }

        if (pinnedLight.current) {
            closestRule = pinnedLight.current.rule;
            closestDistance = calculateDistance(userLocation.lat, userLocation.lng, closestRule.lat, closestRule.lng);
        }

        if (closestRule && closestDistance < Infinity) {
            const ruleId = closestRule.id;
            const previousDistance = previousDistances.current.get(ruleId);

            const reachedRule = closestDistance <= getAppConfig().ruleClearDistanceKm;
            const isMovingAway = previousDistance !== undefined && closestDistance > previousDistance;

            const isPersistentLight = closestRule.type.name === 'Traffic Light' && !!queryRoadFeatures;
            if (isPersistentLight && !pinnedLight.current) {
                pinnedLight.current = { rule: closestRule, activation: [userLocation.lng, userLocation.lat], target: null };
            }
            const target = pinnedLight.current?.target;
            const reachedLightJunction = !!target && !!routeCoordinates && reachedIntersection(
                routeCoordinates, target, [userLocation.lng, userLocation.lat]
            );

            if (isPersistentLight ? reachedLightJunction : reachedRule && isMovingAway) {
                pinnedLight.current = null;
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
                    punishment: closestRule.punishment,
                });

                previousDistances.current.set(ruleId, closestDistance);
            }
        } else {
            setActiveAlert(null);
        }
    }, [userLocation, rules, navigationMode, t, routeCoordinates, queryRoadFeatures, intersectionRevision]);

    useEffect(() => {
        if (!navigationMode || !queryRoadFeatures || !routeCoordinates || !pinnedLight.current) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const light = pinnedLight.current;
        const findJunction = async () => {
            if (cancelled || light !== pinnedLight.current || light.target) return;
            try {
                const features = await queryRoadFeatures();
                if (cancelled || light !== pinnedLight.current) return;
                light.target = trafficLightIntersection(routeCoordinates, roadIntersections(features),
                    [light.rule.lng, light.rule.lat], light.activation);
                if (light.target) {
                    setIntersectionRevision(value => value + 1);
                    return;
                }
            } catch {
            }
            if (!cancelled) timer = setTimeout(findJunction, 1500);
        };
        void findJunction();
        return () => { cancelled = true; if (timer) clearTimeout(timer); };
    }, [activeAlert?.ruleId, navigationMode, queryRoadFeatures, routeCoordinates]);

    useEffect(() => {
        if (!navigationMode) {
            pinnedLight.current = null;
            setActiveAlert(null);
            alertedRules.current.clear();
            passedRules.current.clear();
            previousDistances.current.clear();
        }
    }, [navigationMode]);

    return activeAlert;
};
