import { decodePolyline } from '../../../shared/utils/polyline';
import type { Leg, Maneuver } from '../types/navigation.types';

export interface LatLng {
    lat: number;
    lng: number;
}

export const ManeuverType = {
    None: 0,
    Start: 1,
    StartRight: 2,
    StartLeft: 3,
    Destination: 4,
    DestinationRight: 5,
    DestinationLeft: 6,
    Becomes: 7,
    Continue: 8,
    SlightRight: 9,
    Right: 10,
    SharpRight: 11,
    UturnRight: 12,
    UturnLeft: 13,
    SharpLeft: 14,
    Left: 15,
    SlightLeft: 16,
    RampStraight: 17,
    RampRight: 18,
    RampLeft: 19,
    ExitRight: 20,
    ExitLeft: 21,
    StayStraight: 22,
    StayRight: 23,
    StayLeft: 24,
    Merge: 25,
    RoundaboutEnter: 26,
    RoundaboutExit: 27,
    FerryEnter: 28,
    FerryExit: 29,
    MergeRight: 37,
    MergeLeft: 38,
} as const;

export const isDestinationManeuver = (type: number): boolean =>
    type === ManeuverType.Destination ||
    type === ManeuverType.DestinationRight ||
    type === ManeuverType.DestinationLeft;

export const isStartManeuver = (type: number): boolean =>
    type === ManeuverType.Start ||
    type === ManeuverType.StartRight ||
    type === ManeuverType.StartLeft;

export interface NavStep {
    index: number;
    type: number;
    instruction: string;
    verbalPre: string;
    verbalSuccinct: string;
    verbalPost: string;
    beginPointIndex: number;
    endPointIndex: number;
    beginDistance: number;
    endDistance: number;
    lengthM: number;
    timeS: number;
}

export interface InstructionPlan {
    points: LatLng[];
    cumulative: number[];
    steps: NavStep[];
    totalDistance: number;
}

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: LatLng, b: LatLng): number {
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function buildInstructionPlan(legs: Leg[] | undefined | null): InstructionPlan | null {
    if (!legs || legs.length === 0) return null;

    const points: LatLng[] = [];
    const rawSteps: Array<Omit<NavStep, 'index' | 'beginDistance' | 'endDistance' | 'lengthM'>> = [];

    for (const leg of legs) {
        if (!leg?.shape) continue;

        const decoded = decodePolyline(leg.shape, 6);
        if (decoded.length === 0) continue;

        let offset = points.length;
        let legPoints = decoded.map(([lat, lng]) => ({ lat, lng }));

        if (points.length > 0) {
            const prev = points[points.length - 1];
            const first = legPoints[0];
            if (haversine(prev, first) < 1) {
                legPoints = legPoints.slice(1);
                offset = points.length - 1;
            }
        }

        points.push(...legPoints);

        const maneuvers: Maneuver[] = leg.maneuvers || [];
        for (const m of maneuvers) {
            const begin = Math.min(offset + m.begin_shape_index, points.length - 1);
            const end = Math.min(offset + m.end_shape_index, points.length - 1);

            const last = rawSteps[rawSteps.length - 1];
            if (last && isDestinationManeuver(last.type) && isStartManeuver(m.type) && last.beginPointIndex === begin) {
                rawSteps.pop();
            }

            rawSteps.push({
                type: m.type,
                instruction: m.instruction || '',
                verbalPre: m.verbal_pre_transition_instruction || m.instruction || '',
                verbalSuccinct: m.verbal_succinct_transition_instruction || m.verbal_pre_transition_instruction || m.instruction || '',
                verbalPost: m.verbal_post_transition_instruction || '',
                beginPointIndex: begin,
                endPointIndex: end,
                timeS: m.time || 0,
            });
        }
    }

    if (points.length < 2 || rawSteps.length === 0) return null;

    const cumulative: number[] = new Array(points.length);
    cumulative[0] = 0;
    for (let i = 1; i < points.length; i++) {
        cumulative[i] = cumulative[i - 1] + haversine(points[i - 1], points[i]);
    }

    const totalDistance = cumulative[cumulative.length - 1];

    const steps: NavStep[] = rawSteps.map((s, i) => {
        const beginDistance = cumulative[s.beginPointIndex];
        const next = rawSteps[i + 1];
        const endDistance = next ? cumulative[next.beginPointIndex] : totalDistance;
        return {
            ...s,
            index: i,
            beginDistance,
            endDistance,
            lengthM: Math.max(0, endDistance - beginDistance),
        };
    });

    return { points, cumulative, steps, totalDistance };
}

export interface SnapResult {
    alongDistance: number;
    offsetDistance: number;
    segmentIndex: number;
    snapped: LatLng;
}

export function snapToRoute(
    plan: InstructionPlan,
    location: LatLng,
    fromAlong: number = 0,
    backwardWindowM: number = 60,
): SnapResult {
    const { points, cumulative } = plan;

    const mPerLat = 111320;
    const mPerLng = 111320 * Math.cos(toRad(location.lat));
    const px = location.lng * mPerLng;
    const py = location.lat * mPerLat;

    const lowerBound = Math.max(0, fromAlong - backwardWindowM);

    let best: SnapResult = {
        alongDistance: fromAlong,
        offsetDistance: Number.POSITIVE_INFINITY,
        segmentIndex: 0,
        snapped: location,
    };

    for (let i = 0; i < points.length - 1; i++) {
        if (cumulative[i + 1] < lowerBound) continue;

        const a = points[i];
        const b = points[i + 1];
        const ax = a.lng * mPerLng;
        const ay = a.lat * mPerLat;
        const bx = b.lng * mPerLng;
        const by = b.lat * mPerLat;

        const dx = bx - ax;
        const dy = by - ay;
        const segLenSq = dx * dx + dy * dy;

        let t = 0;
        if (segLenSq > 0) {
            t = ((px - ax) * dx + (py - ay) * dy) / segLenSq;
            t = Math.max(0, Math.min(1, t));
        }

        const cx = ax + t * dx;
        const cy = ay + t * dy;
        const offset = Math.hypot(px - cx, py - cy);

        if (offset < best.offsetDistance) {
            const segLen = cumulative[i + 1] - cumulative[i];
            best = {
                alongDistance: cumulative[i] + t * segLen,
                offsetDistance: offset,
                segmentIndex: i,
                snapped: { lat: cy / mPerLat, lng: cx / mPerLng },
            };
        }
    }

    if (!Number.isFinite(best.offsetDistance) && lowerBound > 0) {
        return snapToRoute(plan, location, 0, 0);
    }

    return best;
}

export interface InstructionState {
    currentStep: NavStep;
    upcomingStep: NavStep | null;
    followingStep: NavStep | null;
    distanceToManeuver: number;
    distanceRemaining: number;
    timeRemaining: number;
    alongDistance: number;
    offsetDistance: number;
    isOffRoute: boolean;
    hasArrived: boolean;
    primaryText: string;
    primaryManeuverType: number;
    thenStep: NavStep | null;
    distanceText: string;
    thenText: string | null;
}

export const CONTINUE_AHEAD_TEXT = 'Continue ahead';
export const OFF_ROUTE_THRESHOLD_M = 45;

export const BANNER_TIMING = {
    leadSeconds: 10,
    minM: 70,
    maxM: 200,
    thenVisibleFromM: 100,
    thenGapM: 150,
} as const;

export interface BannerOptions {
    speedMps?: number;
    alwaysShowManeuver?: boolean;
}

export function bannerLeadDistance(speedMps: number = 0): number {
    const { leadSeconds, minM, maxM } = BANNER_TIMING;
    return Math.max(minM, Math.min(maxM, speedMps * leadSeconds));
}
const ARRIVAL_THRESHOLD_M = 25;

export function formatDistance(metres: number): string {
    if (!Number.isFinite(metres) || metres < 0) return '';
    if (metres < 20) return 'Now';
    if (metres < 1000) {
        const step = metres < 200 ? 10 : 50;
        return `${Math.round(metres / step) * step} m`;
    }
    const km = metres / 1000;
    return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

function bannerText(step: NavStep | null): string {
    if (!step) return '';
    return step.instruction || step.verbalPre || '';
}

function findStepIndexAt(steps: NavStep[], along: number): number {
    let lo = 0;
    let hi = steps.length - 1;
    let result = 0;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (steps[mid].beginDistance <= along + 0.5) {
            result = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return result;
}

export function resolveInstructionState(
    plan: InstructionPlan,
    location: LatLng,
    previousAlong: number = 0,
    banner: BannerOptions = {},
): InstructionState {
    const snap = snapToRoute(plan, location, previousAlong);
    const along = Math.max(previousAlong - 60, snap.alongDistance);

    const steps = plan.steps;
    const currentIndex = findStepIndexAt(steps, along);
    const currentStep = steps[currentIndex];
    const upcomingStep = steps[currentIndex + 1] ?? (isDestinationManeuver(currentStep.type) ? null : currentStep);
    const followingStep = steps[currentIndex + 2] ?? null;

    const distanceToManeuver = upcomingStep
        ? Math.max(0, upcomingStep.beginDistance - along)
        : 0;
    const distanceRemaining = Math.max(0, plan.totalDistance - along);

    let timeRemaining = 0;
    for (let i = currentIndex + 1; i < steps.length; i++) timeRemaining += steps[i].timeS;
    if (currentStep.lengthM > 0) {
        const leftInStep = Math.max(0, currentStep.endDistance - along) / currentStep.lengthM;
        timeRemaining += currentStep.timeS * leftInStep;
    }

    const hasArrived = distanceRemaining <= ARRIVAL_THRESHOLD_M;

    const leadDistance = bannerLeadDistance(banner.speedMps);
    const withinLead = banner.alwaysShowManeuver || distanceToManeuver <= leadDistance;
    const upcomingText = bannerText(upcomingStep) || bannerText(currentStep);
    const showManeuver = withinLead && !!upcomingText;

    const primaryText = hasArrived
        ? 'You have arrived'
        : showManeuver
            ? upcomingText
            : CONTINUE_AHEAD_TEXT;
    const primaryManeuverType = hasArrived
        ? ManeuverType.Destination
        : showManeuver
            ? upcomingStep?.type ?? currentStep.type
            : ManeuverType.Continue;
    const thenVisible = !hasArrived && distanceToManeuver <= BANNER_TIMING.thenVisibleFromM;
    const thenStep = !thenVisible
        ? null
        : showManeuver
            ? followingStep &&
                followingStep.beginDistance - (upcomingStep?.beginDistance ?? along) <= BANNER_TIMING.thenGapM
                ? followingStep
                : null
            : upcomingStep;

    const thenText = thenStep ? bannerText(thenStep) : null;

    return {
        currentStep,
        upcomingStep,
        followingStep,
        distanceToManeuver,
        distanceRemaining,
        timeRemaining,
        alongDistance: along,
        offsetDistance: snap.offsetDistance,
        isOffRoute: snap.offsetDistance > OFF_ROUTE_THRESHOLD_M,
        hasArrived,
        primaryText,
        primaryManeuverType,
        distanceText: hasArrived ? '' : formatDistance(distanceToManeuver),
        thenStep,
        thenText,
    };
}


export type VoiceTier = 'post' | 'approach' | 'final';

export interface VoiceCue {
    key: string;
    tier: VoiceTier;
    text: string;
    suppresses?: string[];
}

export const ARRIVAL_CUE_TEXT = 'You have arrived at your destination.';

export const VOICE_TIMING = {
    finalSeconds: 8,
    finalMinM: 25,
    finalMaxM: 40,
    approachSeconds: 60,
    approachMinM: 400,
    approachMaxM: 2000,
    multiCueGapM: 250,
    continueMinStepM: 800,
    continueClearanceM: 400,
} as const;

export interface VoiceOptions {
    leadDistanceM?: number;
    enableApproach?: boolean;
    enableContinue?: boolean;
}

export function finalTriggerDistance(speedMps: number, options: VoiceOptions = {}): number {
    if (options.leadDistanceM != null) return options.leadDistanceM;
    const { finalSeconds, finalMinM, finalMaxM } = VOICE_TIMING;
    return Math.max(finalMinM, Math.min(finalMaxM, speedMps * finalSeconds));
}

export function approachTriggerDistance(
    speedMps: number,
    stepLengthM: number,
    options: VoiceOptions = {},
): number {
    const { approachSeconds, approachMinM, approachMaxM } = VOICE_TIMING;
    const bySpeed = Math.max(approachMinM, Math.min(approachMaxM, speedMps * approachSeconds));
    const finalAt = finalTriggerDistance(speedMps, options);
    if (bySpeed > stepLengthM * 0.8 || bySpeed <= finalAt) return 0;
    return bySpeed;
}
export function isChainedWithPrevious(plan: InstructionPlan, index: number): boolean {
    const step = plan.steps[index];
    const previous = plan.steps[index - 1];
    if (!step || !previous) return false;
    if (isDestinationManeuver(step.type)) return false;
    return step.beginDistance - previous.beginDistance <= VOICE_TIMING.multiCueGapM;
}
export function cueTextForStep(plan: InstructionPlan, index: number): string {
    const step = plan.steps[index];
    if (!step) return '';

    const base = isDestinationManeuver(step.type)
        ? step.verbalPre || ARRIVAL_CUE_TEXT
        : step.verbalSuccinct;

    const next = plan.steps[index + 1];
    if (next && isChainedWithPrevious(plan, index + 1)) {
        const nextText = isDestinationManeuver(next.type)
            ? next.verbalPre || ARRIVAL_CUE_TEXT
            : next.verbalSuccinct;
        if (nextText) return `${stripTrailingPeriod(base)}, then ${lowerFirst(nextText)}`;
    }

    return base;
}

export function allCueTexts(plan: InstructionPlan, options: VoiceOptions = {}): string[] {
    const texts: string[] = [];

    for (let i = 1; i < plan.steps.length; i++) {
        if (i > 1 && isChainedWithPrevious(plan, i)) continue;
        const text = cueTextForStep(plan, i);
        if (text) texts.push(text);

        if (options.enableContinue !== false) {
            const previous = plan.steps[i - 1];
            if (previous.verbalPost && previous.lengthM >= VOICE_TIMING.continueMinStepM) {
                texts.push(previous.verbalPost);
            }
        }
    }
    texts.push(ARRIVAL_CUE_TEXT);

    return [...new Set(texts.filter(Boolean))];
}
export function nextVoiceCue(
    plan: InstructionPlan,
    state: InstructionState,
    speedMps: number,
    fired: Set<string>,
    options: VoiceOptions = {},
): VoiceCue | null {
    if (state.hasArrived) {
        const key = 'arrived';
        if (!fired.has(key)) return { key, tier: 'final', text: ARRIVAL_CUE_TEXT };
        return null;
    }

    const upcoming = state.upcomingStep;
    if (!upcoming) return null;

    const finalAt = finalTriggerDistance(speedMps, options);
    const finalKey = isDestinationManeuver(upcoming.type) ? 'arrived' : `${upcoming.index}:final`;
    if (state.distanceToManeuver <= finalAt && !fired.has(finalKey)) {
        const text = cueTextForStep(plan, upcoming.index);
        const chainedNext = plan.steps[upcoming.index + 1];
        return {
            key: finalKey,
            tier: 'final',
            text,
            suppresses:
                chainedNext && isChainedWithPrevious(plan, upcoming.index + 1)
                    ? [`${chainedNext.index}:final`, `${chainedNext.index}:approach`]
                    : undefined,
        };
    }

    if (options.enableApproach) {
        const approachAt = approachTriggerDistance(speedMps, state.currentStep.lengthM, options);
        const approachKey = `${upcoming.index}:approach`;
        if (
            approachAt > 0 &&
            state.distanceToManeuver <= approachAt &&
            state.distanceToManeuver > finalAt &&
            !fired.has(approachKey)
        ) {
            return {
                key: approachKey,
                tier: 'approach',
                text: `In ${formatDistance(state.distanceToManeuver)}, ${lowerFirst(upcoming.verbalPre)}`,
            };
        }
    }

    if (options.enableContinue !== false) {
        const postKey = `${state.currentStep.index}:post`;
        if (
            state.currentStep.verbalPost &&
            !fired.has(postKey) &&
            state.currentStep.lengthM >= VOICE_TIMING.continueMinStepM &&
            state.distanceToManeuver > Math.max(finalAt, VOICE_TIMING.continueClearanceM)
        ) {
            return { key: postKey, tier: 'post', text: state.currentStep.verbalPost };
        }
    }

    return null;
}

function stripTrailingPeriod(text: string): string {
    return text.replace(/\.\s*$/, '');
}

function lowerFirst(text: string): string {
    if (!text) return '';
    const first = text.split(' ')[0];
    if (first.length > 1 && first === first.toUpperCase()) return text;
    return text.charAt(0).toLowerCase() + text.slice(1);
}

export function maneuverIcon(type: number): string {
    switch (type) {
        case ManeuverType.SlightRight:
        case ManeuverType.RampRight:
        case ManeuverType.ExitRight:
        case ManeuverType.StayRight:
        case ManeuverType.MergeRight:
            return 'arrow-forward-outline';
        case ManeuverType.Right:
        case ManeuverType.SharpRight:
            return 'arrow-forward';
        case ManeuverType.SlightLeft:
        case ManeuverType.RampLeft:
        case ManeuverType.ExitLeft:
        case ManeuverType.StayLeft:
        case ManeuverType.MergeLeft:
            return 'arrow-back-outline';
        case ManeuverType.Left:
        case ManeuverType.SharpLeft:
            return 'arrow-back';
        case ManeuverType.UturnLeft:
        case ManeuverType.UturnRight:
            return 'return-down-back';
        case ManeuverType.RoundaboutEnter:
        case ManeuverType.RoundaboutExit:
            return 'refresh';
        case ManeuverType.Destination:
        case ManeuverType.DestinationRight:
        case ManeuverType.DestinationLeft:
            return 'flag';
        default:
            return 'arrow-up';
    }
}
