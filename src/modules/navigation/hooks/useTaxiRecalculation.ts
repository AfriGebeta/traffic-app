import { useCallback, useEffect, useRef, useState } from 'react';
import { TaxiNavigationResponse, RouteSegment } from '../../taxi/types/taxi.types';
import { navigationService } from '../services/navigation.service';
import { taxiService } from '../../taxi/services/taxi.service';
import { decodePolyline } from '../../../shared/utils/polyline';
import { calculateDistance } from '../utils/navigationUtils';
import { awayTripped, costGateTripped, nextAwayState, type AwayState } from '../utils/taxiRecalcRules';
import { getAppConfig } from '../../../shared/config/remoteConfigValues';
import { showToast } from '../../../shared/utils/toast';

export type TaxiSuggestionReason = 'cost' | 'away' | 'unreachable' | 'manual';

export interface TaxiSuggestion {
    reason: TaxiSuggestionReason;
    targetName: string;
}

interface UseTaxiRecalculationProps {
    route: TaxiNavigationResponse;
    currentSegmentIndexRef: React.MutableRefObject<number>;
    isNavigatingRef: React.MutableRefObject<boolean>;
    onRoutePatched: (route: TaxiNavigationResponse, segmentIndex: number) => void;
    onReplanned: (route: TaxiNavigationResponse) => void;
    setIsRecalculating: (value: boolean) => void;
    pauseReroutingRef?: React.MutableRefObject<boolean>;
}

const segmentTarget = (segment?: RouteSegment) => {
    if (!segment) return null;
    const node = segment.toNode;
    if (node && Number.isFinite(node.lat) && Number.isFinite(node.lng)) {
        return { lat: node.lat, lng: node.lng, name: node.name };
    }
    if (segment.to && Number.isFinite(segment.to.lat) && Number.isFinite(segment.to.lng)) {
        return { lat: segment.to.lat, lng: segment.to.lng, name: 'your destination' };
    }
    return null;
};

const isAutoSegment = (segment?: RouteSegment) =>
    segment?.mode === 'auto' || segment?.type === 'taxi';

export const useTaxiRecalculation = ({
    route,
    currentSegmentIndexRef: segmentIndexRef,
    isNavigatingRef,
    onRoutePatched,
    onReplanned,
    setIsRecalculating,
    pauseReroutingRef,
}: UseTaxiRecalculationProps) => {
    const routeRef = useRef(route);
    routeRef.current = route;

    const inFlightRef = useRef(false);
    const requestControllerRef = useRef<AbortController | null>(null);
    useEffect(() => () => { requestControllerRef.current?.abort(); }, []);
    const generationRef = useRef(0);
    const lastAttemptAtRef = useRef(0);
    const lastFixRef = useRef<{ lat: number; lng: number } | null>(null);

    // per off-route episode
    const dRefRef = useRef<number | null>(null);
    const gateStreakRef = useRef(0);
    const failStreakRef = useRef(0);
    const awayRef = useRef<AwayState>({ streak: 0, anchor: null });
    const lastDirectRef = useRef<number | null>(null);

    // suggestion lifecycle
    const snoozeUntilRef = useRef(0);
    const dismissedAtDistanceRef = useRef<number | null>(null);
    const lastDNewRef = useRef<number | null>(null);

    const [suggestion, setSuggestion] = useState<TaxiSuggestion | null>(null);
    const [isReplanning, setIsReplanning] = useState(false);
    const [routeError, setRouteError] = useState<string | null>(null);

    const offRouteProfileRef = useRef<{
        thresholdM: number;
        delayMs: number;
        headingDiverge: boolean;
        minRetriggerMs: number;
    } | null>(null);
    const cfg = getAppConfig();
    const onAuto = isAutoSegment(route.segments?.[segmentIndexRef.current]);
    offRouteProfileRef.current = {
        thresholdM: onAuto ? cfg.taxiAutoOffRouteThresholdM : cfg.taxiOffRouteThresholdM,
        delayMs: onAuto ? cfg.taxiAutoOffRouteDelayMs : cfg.taxiWalkOffRouteDelayMs,
        headingDiverge: !onAuto,
        minRetriggerMs: cfg.taxiRerouteCooldownMs,
    };

    const resetEpisode = useCallback(() => {
        dRefRef.current = null;
        gateStreakRef.current = 0;
        failStreakRef.current = 0;
        awayRef.current = { streak: 0, anchor: null };
        lastDirectRef.current = null;
        lastDNewRef.current = null;
    }, []);

    const raiseSuggestion = useCallback((reason: TaxiSuggestionReason, targetName: string) => {
        const now = Date.now();
        if (now < snoozeUntilRef.current) {
            // Snoozed, but re-arm early if the situation degraded materially.
            const dismissedAt = dismissedAtDistanceRef.current;
            const dNew = lastDNewRef.current;
            const growth = getAppConfig().taxiSuggestRearmGrowth;
            if (!(dismissedAt && dNew && dNew > dismissedAt * growth)) return;
        }
        snoozeUntilRef.current = 0;
        dismissedAtDistanceRef.current = null;
        setSuggestion((prev) => (prev && prev.reason === reason ? prev : { reason, targetName }));
    }, []);

    const resetForJourneyChange = useCallback(() => {
        generationRef.current += 1;
        requestControllerRef.current?.abort();
        requestControllerRef.current = null;
        inFlightRef.current = false;
        lastAttemptAtRef.current = 0;
        resetEpisode();
        setSuggestion(null);
        setIsReplanning(false);
        setRouteError(null);
        setIsRecalculating(false);
    }, [resetEpisode, setIsRecalculating]);

    const recalculateRoute = useCallback(async (fromLocation?: { lat: number; lng: number }, force = false) => {
        const from = fromLocation ?? lastFixRef.current;
        const currentRoute = routeRef.current;
        const index = segmentIndexRef.current;
        const segment = currentRoute.segments?.[index];
        const target = segmentTarget(segment);

        if (!from || !segment || !target || !isNavigatingRef.current) {
            setIsRecalculating(false);
            return;
        }

        const config = getAppConfig();
        const now = Date.now();
        if (inFlightRef.current || (!force && now - lastAttemptAtRef.current < config.taxiRerouteCooldownMs)) {
            if (!inFlightRef.current) setIsRecalculating(false);
            return;
        }

        const generation = generationRef.current;
        const controller = new AbortController();
        requestControllerRef.current = controller;
        inFlightRef.current = true;
        lastAttemptAtRef.current = now;
        setRouteError(null);
        setIsRecalculating(true);

        const auto = isAutoSegment(segment);
        const isFinalSegment = index === (currentRoute.segments?.length ?? 1) - 1;

        try {
            const navigationData = await navigationService.getNavigation({
                origin: [from.lat, from.lng],
                destination: [target.lat, target.lng],
                costing: auto ? 'auto' : 'pedestrian',
            }, { timeoutMs: 12000, signal: controller.signal });

            if (generation !== generationRef.current ||
                !isNavigatingRef.current || routeRef.current !== currentRoute ||
                segmentIndexRef.current !== index) return;

            const legs = navigationData?.data?.trip?.legs;
            if (!legs || legs.length === 0) {
                setRouteError("No road returned");
                failStreakRef.current += 1;
                if (failStreakRef.current >= config.taxiRerouteFailStreak) {
                    raiseSuggestion('unreachable', target.name);
                }
                return;
            }

            const coords: [number, number][] = [];
            for (const leg of legs) {
                if (!leg?.shape) continue;
                const decoded = decodePolyline(leg.shape, 6) as [number, number][];
                const last = coords[coords.length - 1];
                const first = decoded[0];
                const startAt = last && first && last[0] === first[0] && last[1] === first[1] ? 1 : 0;
                coords.push(...decoded.slice(startAt));
            }

            if (coords.length < 2) {
                setRouteError("No road returned");
                failStreakRef.current += 1;
                if (failStreakRef.current >= config.taxiRerouteFailStreak) {
                    raiseSuggestion('unreachable', target.name);
                }
                return;
            }

            failStreakRef.current = 0;

            const summary = navigationData.data.trip.summary ?? legs[0].summary;
            const dNew = summary.length * 1000;
            lastDNewRef.current = dNew;

            const segments = currentRoute.segments!.map((seg, idx) =>
                idx === index
                    ? { ...seg, overrideCoords: coords, distance: summary.length, time: summary.time }
                    : seg
            );

            onRoutePatched({ ...currentRoute, segments }, index);

            if (dRefRef.current === null) {
                dRefRef.current = dNew;
                return;
            }

            if (isFinalSegment) return;

            const tripped = costGateTripped({
                dNew,
                dRef: dRefRef.current,
                floorM: auto ? config.taxiReplanFloorAutoM : config.taxiReplanFloorWalkM,
                ratio: auto ? config.taxiReplanRatioAuto : config.taxiReplanRatioWalk,
            });

            if (tripped) {
                gateStreakRef.current += 1;
                if (gateStreakRef.current >= config.taxiReplanGateStreak) {
                    raiseSuggestion('cost', target.name);
                }
            } else {
                gateStreakRef.current = 0;
            }
        } catch (error) {
            if (generation !== generationRef.current ||
                !isNavigatingRef.current || routeRef.current !== currentRoute || segmentIndexRef.current !== index) return;
            setRouteError('Could not update route');
            console.error('[TaxiRecalc] in-leg reroute failed:', error);
            failStreakRef.current += 1;
            if (failStreakRef.current >= getAppConfig().taxiRerouteFailStreak) {
                raiseSuggestion('unreachable', target.name);
            }
        } finally {
            if (generation === generationRef.current) {
                inFlightRef.current = false;
                requestControllerRef.current = null;
                setIsRecalculating(false);
            }
        }
    }, [isNavigatingRef, onRoutePatched, raiseSuggestion, segmentIndexRef, setIsRecalculating]);

    const observeFix = useCallback((
        location: { lat: number; lng: number },
        isOffRoute: boolean
    ) => {
        lastFixRef.current = location;
        if (pauseReroutingRef?.current) return;

        if (!isOffRoute) {
            if (dRefRef.current !== null || awayRef.current.streak > 0) resetEpisode();
            if (suggestion) setSuggestion(null);
            return;
        }

        const currentRoute = routeRef.current;
        const index = segmentIndexRef.current;
        const segment = currentRoute.segments?.[index];
        const target = segmentTarget(segment);
        if (!segment || !target) return;

        const isFinalSegment = index === (currentRoute.segments?.length ?? 1) - 1;
        if (isFinalSegment) return;

        const direct = calculateDistance(location.lat, location.lng, target.lat, target.lng);
        const previous = lastDirectRef.current;
        lastDirectRef.current = direct;

        awayRef.current = nextAwayState(awayRef.current, direct, previous);

        const config = getAppConfig();
        const gainLimit = isAutoSegment(segment)
            ? config.taxiAwayNetGainAutoM
            : config.taxiAwayNetGainWalkM;

        if (awayTripped(awayRef.current, direct, config.taxiAwayFixCount, gainLimit)) {
            raiseSuggestion('away', target.name);
        }
    }, [raiseSuggestion, resetEpisode, segmentIndexRef, suggestion, pauseReroutingRef]);

    const acceptSuggestion = useCallback(async () => {
        const from = lastFixRef.current;
        const currentRoute = routeRef.current;
        if (!from || pauseReroutingRef?.current || !isNavigatingRef.current) return;
        const generation = generationRef.current;
        const index = segmentIndexRef.current;

        setSuggestion(null);
        setIsReplanning(true);
        try {
            const newRoute = await taxiService.requestTaxiNavigation({
                origin: [from.lat, from.lng],
                destination: [currentRoute.destination.lat, currentRoute.destination.lng],
            });

            if (generation !== generationRef.current || pauseReroutingRef?.current ||
                !isNavigatingRef.current || routeRef.current !== currentRoute || segmentIndexRef.current !== index) return;

            if (!newRoute.success || !newRoute.segments?.length) {
                showToast('Could not find a new route');
                return;
            }

            resetEpisode();
            lastAttemptAtRef.current = 0;
            snoozeUntilRef.current = 0;
            dismissedAtDistanceRef.current = null;
            onReplanned({ ...newRoute, planId: Date.now() });
        } catch (error) {
            if (generation !== generationRef.current || !isNavigatingRef.current) return;
            console.error('[TaxiRecalc] full replan failed:', error);
            showToast('Could not find a new route');
        } finally {
            if (generation === generationRef.current) setIsReplanning(false);
        }
    }, [onReplanned, resetEpisode, isNavigatingRef, pauseReroutingRef, segmentIndexRef]);

    const dismissSuggestion = useCallback(() => {
        snoozeUntilRef.current = Date.now() + getAppConfig().taxiSuggestSnoozeMs;
        dismissedAtDistanceRef.current = lastDNewRef.current;
        gateStreakRef.current = 0;
        awayRef.current = { streak: 0, anchor: lastDirectRef.current };
        setSuggestion(null);
    }, []);

    const requestNewStation = useCallback(() => {
        snoozeUntilRef.current = 0;
        dismissedAtDistanceRef.current = null;
        return acceptSuggestion();
    }, [acceptSuggestion]);

    return {
        recalculateRoute,
        routeError,
        observeFix,
        offRouteProfileRef,
        suggestion,
        isReplanning,
        acceptSuggestion,
        dismissSuggestion,
        requestNewStation,
        resetForJourneyChange,
    };
};
