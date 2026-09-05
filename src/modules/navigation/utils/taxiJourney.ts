import type { RouteSegment, TaxiNavigationResponse, TaxiNode } from '../../taxi/types/taxi.types';
import { calculateDistance, decodeTaxiSegmentPaths } from './navigationUtils';

export type TaxiFix = { lat: number; lng: number; accuracy?: number; speed?: number; timestamp?: number };
export type JourneyPrompt = { kind: 'board' | 'alight'; reason: 'near' | 'passed' | 'movement' | 'route' | 'manual' };
export const isTaxiRide = (segment?: RouteSegment) => segment?.type === 'taxi' || segment?.mode === 'auto';
let lastPlanId = 0;
export const nextTaxiPlanId = () => (lastPlanId = Math.max(Date.now(), lastPlanId + 1));

export const walkingLeg = (from: TaxiFix, to: TaxiFix, toNode?: TaxiNode): RouteSegment => ({
    type: 'walk', mode: 'pedestrian', from, to, toNode,
    polyline: '', distance: calculateDistance(from.lat, from.lng, to.lat, to.lng) / 1000,
    time: calculateDistance(from.lat, from.lng, to.lat, to.lng) / 1.4,
});
export const prepareTaxiJourney = (route: TaxiNavigationResponse): TaxiNavigationResponse => {
    const segments: RouteSegment[] = [];
    for (const segment of route.segments ?? []) {
        const previous = segments.at(-1);
        const sameService = previous?.routeId != null && previous.routeId === segment.routeId;
        if (isTaxiRide(previous) && isTaxiRide(segment) && sameService) {
            const paths = decodeTaxiSegmentPaths([previous!, segment]);
            segments[segments.length - 1] = {
                ...previous!, to: segment.to, toNode: segment.toNode,
                distance: previous!.distance + segment.distance, time: previous!.time + segment.time,
                fare: (previous!.fare ?? 0) + (segment.fare ?? 0),
                overrideCoords: paths.flat(),
            };
        } else segments.push({ ...segment });
    }
    if (isTaxiRide(segments[0])) {
        const first = segments[0];
        segments.unshift(walkingLeg(route.origin, first.fromNode ?? first.from, first.fromNode));
    }
    return { ...route, segments, planId: nextTaxiPlanId() };
};

export const boardTaxiJourney = (route: TaxiNavigationResponse, index: number, fix: TaxiFix) => {
    const segments = route.segments ?? [];
    const rideIndex = segments.findIndex((segment, i) => i >= index && isTaxiRide(segment));
    const remaining = rideIndex >= 0 ? segments.slice(rideIndex) : [{
        ...walkingLeg(fix, route.destination), type: 'taxi' as const, mode: 'auto' as const,
    }];
    return {
        ...route, origin: fix, planId: nextTaxiPlanId(),
        segments: [{ ...remaining[0], from: fix, fromNode: undefined }, ...remaining.slice(1)],
    };
};

export const alightTaxiJourney = (route: TaxiNavigationResponse, index: number, fix: TaxiFix) => {
    const remaining = (route.segments ?? []).slice(index + 1);
    if (!remaining.length) remaining.push(walkingLeg(fix, route.destination));
    else if (isTaxiRide(remaining[0])) {
        remaining.unshift(walkingLeg(fix, remaining[0].fromNode ?? remaining[0].from, remaining[0].fromNode));
    } else remaining[0] = { ...remaining[0], from: fix, fromNode: undefined };
    return { ...route, origin: fix, segments: remaining, planId: nextTaxiPlanId() };
};

export interface PromptEvidence {
    minDistance: number;
    since: number | null;
    reason: JourneyPrompt['reason'] | null;
    anchor: TaxiFix | null;
    lastAt: number | null;
    samples: number;
}
export const emptyPromptEvidence = (): PromptEvidence => ({ minDistance: Infinity, since: null, reason: null, anchor: null, lastAt: null, samples: 0 });

export const observeTaxiJourney = (
    previous: PromptEvidence,
    fix: TaxiFix,
    target: TaxiFix,
    riding: boolean,
    offRoute: boolean,
    radius: number,
    now: number,
): { evidence: PromptEvidence; prompt: JourneyPrompt | null } => {
    if ((fix.accuracy ?? Infinity) > 60) return { evidence: emptyPromptEvidence(), prompt: null };
    if (previous.lastAt !== null && now - previous.lastAt > 5000) previous = emptyPromptEvidence();
    if (previous.lastAt !== null && now <= previous.lastAt) return { evidence: previous, prompt: null };
    const distance = calculateDistance(fix.lat, fix.lng, target.lat, target.lng);
    const minDistance = Math.min(previous.minDistance, distance);
    const passed = minDistance < radius * 2 && distance - minDistance > Math.max(40, (fix.accuracy ?? 0) * 2);
    const near = distance <= radius;
    const suspicious = riding ? offRoute && fix.speed != null && fix.speed >= 0 && fix.speed < 2.5
        : (fix.speed ?? 0) > 4;
    const reason = passed ? 'passed' : near ? 'near' : suspicious ? 'movement'
        : riding && offRoute ? 'route' : null;
    if (!reason) return { evidence: { ...emptyPromptEvidence(), minDistance }, prompt: null };
    const since = reason === previous.reason ? previous.since ?? now : now;
    const anchor = reason === previous.reason ? previous.anchor ?? fix : fix;
    const moved = calculateDistance(anchor.lat, anchor.lng, fix.lat, fix.lng);
    const hold = reason === 'near' ? 3000 : reason === 'passed' ? 5000 : reason === 'route' ? 15000 : 10000;
    const samples = reason === previous.reason ? previous.samples + 1 : 1;
    const ready = samples >= 3 && now - since >= hold &&
        ((reason !== 'movement' && reason !== 'route') || moved >= Math.max(20, (fix.accuracy ?? 0) * 2));
    return {
        evidence: { minDistance, since, reason, anchor, lastAt: now, samples },
        prompt: ready ? { kind: riding ? 'alight' : 'board', reason } : null,
    };
};
