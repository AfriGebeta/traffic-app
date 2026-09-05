import { useState, useRef, useEffect } from 'react';
import type { RouteSegment, TaxiNavigationResponse } from '../../taxi/types/taxi.types';
import { calculateDistance } from '../utils/navigationUtils';
import { voiceNavigationService } from '../services/voice-navigation.service';
import { getAppConfig } from '../../../shared/config/remoteConfigValues';
import {
    alightTaxiJourney, boardTaxiJourney, emptyPromptEvidence, isTaxiRide,
    nextTaxiPlanId, observeTaxiJourney, type JourneyPrompt, type TaxiFix,
} from '../utils/taxiJourney';

interface Props {
    taxiRoute: TaxiNavigationResponse;
    previewSegments?: RouteSegment[];
    userLocation: TaxiFix | null;
    isOffRoute: boolean;
    isNavigatingRef: React.MutableRefObject<boolean>;
    currentSegmentIndexRef: React.MutableRefObject<number>;
    pauseReroutingRef: React.MutableRefObject<boolean>;
    onNavigationComplete: () => void;
    onRouteUpdate: (route: TaxiNavigationResponse) => void;
}

export const useTaxiNavigation = ({ taxiRoute, previewSegments, userLocation, isOffRoute, isNavigatingRef,
    currentSegmentIndexRef, pauseReroutingRef, onNavigationComplete, onRouteUpdate }: Props) => {
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
    const [prompt, setPrompt] = useState<JourneyPrompt | null>(null);
    const [undoRoute, setUndoRoute] = useState<TaxiNavigationResponse | null>(null);
    // Keep exactly the preview itinerary, independent of reroutes and confirmations.
    const journeySegments = useRef(previewSegments ?? taxiRoute.segments ?? []).current;
    const [journeySegmentIndex, setJourneySegmentIndex] = useState(0);
    const [undoJourneyIndex, setUndoJourneyIndex] = useState(0);
    const evidence = useRef(emptyPromptEvidence());
    const snoozeUntil = useRef(0);
    const lastPlan = useRef(taxiRoute.planId);
    const completed = useRef(false);
    const asked = useRef(new Set<string>());
    const promptStage = useRef(`${taxiRoute.planId}:0`);
    const index = taxiRoute.planId === lastPlan.current ? currentSegmentIndex : 0;
    currentSegmentIndexRef.current = index;
    const currentSegment = taxiRoute.segments?.[index];
    const isOnTaxi = isTaxiRide(currentSegment);
    useEffect(() => {
        if (!currentSegment) return;
        setJourneySegmentIndex(previous => {
            const sameMode = (segment: RouteSegment) => isTaxiRide(segment) === isTaxiRide(currentSegment);
            const target = currentSegment.toNode?.id;
            const exact = target == null ? -1 : journeySegments.findIndex((segment, i) =>
                i >= previous && sameMode(segment) && segment.toNode?.id === target);
            if (exact >= 0) return exact;
            const next = journeySegments.findIndex((segment, i) => i >= previous && sameMode(segment));
            if (next >= 0) return next;
            // Switching again after the final preview step reuses an existing step.
            for (let i = journeySegments.length - 1; i >= 0; i--) {
                if (sameMode(journeySegments[i])) return i;
            }
            return previous;
        });
    }, [currentSegment, journeySegments]);
    const nextRide = taxiRoute.segments?.find((segment, i) => i >= index && isTaxiRide(segment));
    const boardingTarget = nextRide?.toNode?.name ?? 'your destination';
    const targetName = currentSegment?.toNode?.name ?? 'your destination';
    const currentInstruction = isOnTaxi ? `Stay on taxi toward ${targetName}`
        : `Walk to ${targetName}`;

    useEffect(() => {
        if (lastPlan.current !== taxiRoute.planId) {
            lastPlan.current = taxiRoute.planId;
            setCurrentSegmentIndex(0);
            evidence.current = emptyPromptEvidence();
            snoozeUntil.current = Date.now() + 30000;
            completed.current = false;
            setPrompt(null);
            pauseReroutingRef.current = false;
        }
    }, [taxiRoute.planId, pauseReroutingRef]);

    useEffect(() => {
        const stage = `${taxiRoute.planId}:${index}`;
        if (promptStage.current !== stage) {
            promptStage.current = stage;
            asked.current.clear();
        }
    }, [taxiRoute.planId, index]);

    useEffect(() => {
        if (isNavigatingRef.current) void voiceNavigationService.speakInstruction(currentInstruction);
    }, [currentInstruction, isNavigatingRef]);

    useEffect(() => {
        if (!userLocation || !currentSegment || !isNavigatingRef.current || completed.current) return;
        const target = currentSegment.toNode ?? currentSegment.to;
        const cfg = getAppConfig();
        if (!isOnTaxi && !isTaxiRide(taxiRoute.segments?.[index + 1])) {
            if ((userLocation.accuracy ?? Infinity) <= 60 && calculateDistance(
                userLocation.lat, userLocation.lng, target.lat, target.lng
            ) < cfg.taxiWalkingEndThresholdM) {
                if (index < (taxiRoute.segments?.length ?? 0) - 1) {
                    currentSegmentIndexRef.current = index + 1;
                    setCurrentSegmentIndex(index + 1);
                } else {
                    completed.current = true;
                    onNavigationComplete();
                }
            }
            return;
        }
        if (prompt || Date.now() < snoozeUntil.current) return;
        const result = observeTaxiJourney(evidence.current, userLocation, target, isOnTaxi, isOffRoute,
            isOnTaxi ? cfg.taxiDropoffPromptRadiusM : cfg.taxiBoardingPromptRadiusM,
            userLocation.timestamp ?? Date.now());
        evidence.current = result.evidence;
        const question = result.prompt?.reason === 'route' ? 'route' : result.prompt?.kind;
        if (result.prompt && question && !asked.current.has(question)) {
            asked.current.add(question);
            pauseReroutingRef.current = true;
            setPrompt(result.prompt);
        }
    }, [userLocation, currentSegment, isOnTaxi, isOffRoute, taxiRoute, index, prompt,
        currentSegmentIndexRef, isNavigatingRef, onNavigationComplete, pauseReroutingRef]);

    const requestConfirmation = () => {
        if (!isNavigatingRef.current) return;
        pauseReroutingRef.current = true;
        setPrompt({ kind: isOnTaxi ? 'alight' : 'board', reason: 'manual' });
    };
    const dismissPrompt = () => {
        snoozeUntil.current = Date.now() + getAppConfig().taxiConfirmationSnoozeMs;
        evidence.current = emptyPromptEvidence();
        pauseReroutingRef.current = false;
        setPrompt(null);
    };
    const commitJourney = (route: TaxiNavigationResponse) => {
        setUndoRoute({ ...taxiRoute, segments: taxiRoute.segments?.slice(index) });
        setUndoJourneyIndex(journeySegmentIndex);
        currentSegmentIndexRef.current = 0;
        setCurrentSegmentIndex(0);
        pauseReroutingRef.current = false;
        setPrompt(null);
        onRouteUpdate(route);
    };
    const confirmTransition = () => {
        if (!userLocation || !isNavigatingRef.current) return;
        commitJourney(isOnTaxi ? alightTaxiJourney(taxiRoute, index, userLocation)
            : boardTaxiJourney(taxiRoute, index, userLocation));
    };
    const undoTransition = () => {
        if (!undoRoute || !isNavigatingRef.current) return;
        currentSegmentIndexRef.current = 0;
        setCurrentSegmentIndex(0);
        setPrompt(null);
        pauseReroutingRef.current = false;
        setJourneySegmentIndex(undoJourneyIndex);
        onRouteUpdate({ ...undoRoute, planId: nextTaxiPlanId() });
        setUndoRoute(null);
    };

    return {
        currentSegmentIndex: index, currentSegment, isOnTaxi, currentInstruction,
        endNode: taxiRoute.endNode, totalFare: taxiRoute.summary.estimatedFare,
        currency: taxiRoute.summary.currency, prompt, boardingTarget,
        requestConfirmation, dismissPrompt, confirmTransition, undoTransition,
        canUndo: !!undoRoute, commitJourney,
        journeySegments, journeySegmentIndex,
    };
};
