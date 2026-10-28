import { getAppConfig } from '../../../shared/config/remoteConfigValues';
import type { CongestionLevel } from '../../incidents/types/incident.types';
import { calculateBearing, calculateDistance, sliceRangeDistance } from './navigationUtils';

export interface CongestionIncident {
    lat: number;
    lng: number;
    type: { name: string };
    congestionLevel?: CongestionLevel | null;
    heading?: number | null;
    expiresAt?: string;
}

export interface CongestionSpan {
    startS: number;
    endS: number;
    level: CongestionLevel;
}

export type CongestionPart = 'in' | 'solid' | 'out';

const LEVEL_RANK: Record<CongestionLevel, number> = { low: 1, medium: 2, high: 3 };
const RANK_LEVEL: CongestionLevel[] = ['low', 'low', 'medium', 'high'];

const BEHIND_FRACTION = 1 / 3;
const MAX_OFFSET_WITH_HEADING_M = 30;
const MAX_OFFSET_WITHOUT_HEADING_M = 15;
const MAX_HEADING_DIFF_DEG = 60;
const FADE_FRACTION = 0.25;
const FADE_MAX_M = 50;

const spanLength = (level: CongestionLevel) => {
    const config = getAppConfig();
    if (level === 'high') return config.congestionHighLengthM;
    if (level === 'medium') return config.congestionMediumLengthM;
    return config.congestionLowLengthM;
};

const angleDiff = (a: number, b: number) => {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
};

const projectOntoRoute = (
    coords: [number, number][],
    cum: number[],
    lat: number,
    lng: number,
    heading: number | null
): { s: number; distance: number } | null => {
    let best: { s: number; distance: number } | null = null;
    for (let i = 0; i < coords.length - 1; i++) {
        const [lng1, lat1] = coords[i];
        const [lng2, lat2] = coords[i + 1];
        if (heading !== null && angleDiff(heading, calculateBearing(coords[i], coords[i + 1])) > MAX_HEADING_DIFF_DEG) continue;
        const dx = lng2 - lng1;
        const dy = lat2 - lat1;
        let t = 0;
        if (dx !== 0 || dy !== 0) {
            t = Math.max(0, Math.min(1, ((lng - lng1) * dx + (lat - lat1) * dy) / (dx * dx + dy * dy)));
        }
        const distance = calculateDistance(lat, lng, lat1 + t * dy, lng1 + t * dx);
        if (!best || distance < best.distance) {
            best = { s: cum[i] + t * (cum[i + 1] - cum[i]), distance };
        }
    }
    return best;
};

const mergeSpans = (spans: CongestionSpan[]): CongestionSpan[] => {
    const cuts = [...new Set(spans.flatMap((span) => [span.startS, span.endS]))].sort((a, b) => a - b);
    const out: CongestionSpan[] = [];
    for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i];
        const b = cuts[i + 1];
        let rank = 0;
        for (const span of spans) {
            if (span.startS <= a && span.endS >= b) rank = Math.max(rank, LEVEL_RANK[span.level]);
        }
        if (rank === 0) continue;
        const level = RANK_LEVEL[rank];
        const last = out[out.length - 1];
        if (last && last.level === level && last.endS === a) last.endS = b;
        else out.push({ startS: a, endS: b, level });
    }
    return out;
};

export const computeCongestionSpans = (
    coords: [number, number][],
    cum: number[],
    incidents: CongestionIncident[],
    now = Date.now()
): CongestionSpan[] => {
    if (coords.length < 2) return [];
    const total = cum[cum.length - 1];
    const spans: CongestionSpan[] = [];
    for (const incident of incidents) {
        if (incident.type.name !== 'TRAFFIC_JAM' || !incident.congestionLevel) continue;
        
        if (incident.expiresAt && Date.parse(incident.expiresAt) <= now) continue;
        const heading = typeof incident.heading === 'number' ? incident.heading : null;
        const hit = projectOntoRoute(coords, cum, incident.lat, incident.lng, heading);
        const maxOffset = heading === null ? MAX_OFFSET_WITHOUT_HEADING_M : MAX_OFFSET_WITH_HEADING_M;
      
        if (!hit || hit.distance > maxOffset) continue;
        const length = spanLength(incident.congestionLevel);
        const startS = Math.max(0, hit.s - length * BEHIND_FRACTION);
        const endS = Math.min(total, hit.s + length * (1 - BEHIND_FRACTION));
      
        if (endS > startS) spans.push({ startS, endS, level: incident.congestionLevel });
    }
    return mergeSpans(spans);
};

type CongestionFeature = {
    type: 'Feature';
    properties: { part: CongestionPart };
    geometry: { type: 'LineString'; coordinates: [number, number][] };
};

type CongestionCollection = { type: 'FeatureCollection'; features: CongestionFeature[] };

export type CongestionShapes = Record<CongestionLevel, CongestionCollection>;

export interface CongestionPiece {
    level: CongestionLevel;
    part: CongestionPart;
    startS: number;
    endS: number;
}

export const buildCongestionPieces = (spans: CongestionSpan[]): CongestionPiece[] => {
    const pieces: CongestionPiece[] = [];
    const fadeOf = (span: CongestionSpan) => Math.min(FADE_MAX_M, (span.endS - span.startS) * FADE_FRACTION);
    const push = (level: CongestionLevel, part: CongestionPart, startS: number, endS: number) => {
        if (endS > startS) pieces.push({ level, part, startS, endS });
    };

    spans.forEach((span, i) => {
        const prev = spans[i - 1];
        const next = spans[i + 1];
        const prevTouches = !!prev && prev.endS === span.startS;
        const nextTouches = !!next && next.startS === span.endS;
        const fade = fadeOf(span);
        let solidStart = span.startS;
        let solidEnd = span.endS;

        if (prevTouches && LEVEL_RANK[prev.level] > LEVEL_RANK[span.level]) {
            solidStart = span.startS - fadeOf(prev);
        } else {
            push(span.level, 'in', span.startS, span.startS + fade);
            solidStart = span.startS + fade;
        }
        if (nextTouches && LEVEL_RANK[next.level] > LEVEL_RANK[span.level]) {
            solidEnd = span.endS + fadeOf(next);
        } else {
            push(span.level, 'out', span.endS - fade, span.endS);
            solidEnd = span.endS - fade;
        }
        push(span.level, 'solid', solidStart, solidEnd);
    });
    return pieces;
};

// pieces of one level from fromS on; a fade piece the puck is inside is clipped, so its gradient
// squeezes into what is left of it instead of popping
export const congestionShapeAt = (
    coords: [number, number][],
    cum: number[],
    pieces: CongestionPiece[],
    level: CongestionLevel,
    fromS = 0
): CongestionCollection => {
    const features: CongestionFeature[] = [];
    for (const piece of pieces) {
        if (piece.level !== level || piece.endS <= fromS) continue;
        const line = sliceRangeDistance(coords, cum, Math.max(piece.startS, fromS), piece.endS);
        if (line.length < 2) continue;
        features.push({
            type: 'Feature',
            properties: { part: piece.part },
            geometry: { type: 'LineString', coordinates: line },
        });
    }
    return { type: 'FeatureCollection', features };
};

export const congestionShapesAt = (
    coords: [number, number][],
    cum: number[],
    pieces: CongestionPiece[],
    fromS = 0
): CongestionShapes => ({
    low: congestionShapeAt(coords, cum, pieces, 'low', fromS),
    medium: congestionShapeAt(coords, cum, pieces, 'medium', fromS),
    high: congestionShapeAt(coords, cum, pieces, 'high', fromS),
});

export const buildCongestionShapes = (
    coords: [number, number][],
    cum: number[],
    spans: CongestionSpan[]
): CongestionShapes => congestionShapesAt(coords, cum, buildCongestionPieces(spans));

// changes only when the level's shape at fromS would change: a piece is passed, or the puck is inside one
export const congestionClipKey = (pieces: CongestionPiece[], level: CongestionLevel, fromS: number): string => {
    let ahead = 0;
    let clipping = false;
    for (const piece of pieces) {
        if (piece.level !== level || piece.endS <= fromS) continue;
        ahead++;
        if (piece.startS < fromS) clipping = true;
    }
    return clipping ? `${ahead}@${fromS.toFixed(1)}` : `${ahead}`;
};
