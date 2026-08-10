const EARTH_R = 6371000;
const M_PER_DEG_LAT = 111320;

export interface XY {
    x: number;
    y: number;
}

export interface LatLng {
    lat: number;
    lng: number;
}

export class LocalFrame {
    private originLat: number;
    private originLng: number;
    private mPerDegLng: number;

    constructor(lat: number, lng: number) {
        this.originLat = lat;
        this.originLng = lng;
        this.mPerDegLng = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
    }
    reanchorIfFar(lat: number, lng: number, thresholdM = 5000): boolean {
        const { x, y } = this.toXY(lat, lng);
        if (Math.hypot(x, y) <= thresholdM) return false;

        this.originLat = lat;
        this.originLng = lng;
        this.mPerDegLng = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
        return true;
    }

    toXY(lat: number, lng: number): XY {
        return {
            x: (lng - this.originLng) * this.mPerDegLng,
            y: (lat - this.originLat) * M_PER_DEG_LAT,
        };
    }

    toLatLng(x: number, y: number): LatLng {
        return {
            lat: this.originLat + y / M_PER_DEG_LAT,
            lng: this.originLng + x / this.mPerDegLng,
        };
    }
}

export const haversine = (a: LatLng, b: LatLng): number => {
    const p1 = (a.lat * Math.PI) / 180;
    const p2 = (b.lat * Math.PI) / 180;
    const dp = p2 - p1;
    const dl = ((b.lng - a.lng) * Math.PI) / 180;
    const h =
        Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const bearingXY = (from: XY, to: XY): number => {
    const deg = (Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI;
    return (deg + 360) % 360;
};

export const headingUnit = (bearingDeg: number): XY => {
    const r = (bearingDeg * Math.PI) / 180;
    return { x: Math.sin(r), y: Math.cos(r) };
};

export const angleDelta = (a: number, b: number): number => {
    let d = Math.abs(a - b) % 360;
    if (d > 180) d = 360 - d;
    return d;
};

export const signedTurn = (from: number, to: number): number => {
    let d = to - from;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
};

export interface Projection {
    dist: number;
    foot: XY;
    t: number;
}

export const projectOnSegment = (p: XY, a: XY, b: XY): Projection => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) {
        return { dist: Math.hypot(p.x - a.x, p.y - a.y), foot: a, t: 0 };
    }
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const foot = { x: a.x + t * dx, y: a.y + t * dy };
    return { dist: Math.hypot(p.x - foot.x, p.y - foot.y), foot, t };
};

export const easeAlpha = (dt: number, tau: number): number => 1 - Math.exp(-dt / tau);
export const buildCumulative = (points: XY[]): number[] => {
    const cum = new Array<number>(points.length);
    cum[0] = 0;
    for (let i = 1; i < points.length; i++) {
        cum[i] = cum[i - 1] + Math.hypot(
            points[i].x - points[i - 1].x,
            points[i].y - points[i - 1].y
        );
    }
    return cum;
};

const segmentAt = (cum: number[], d: number): number => {
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= d) lo = mid;
        else hi = mid;
    }
    return lo;
};

export const pointAtDistance = (points: XY[], cum: number[], d: number): XY => {
    const total = cum[cum.length - 1];
    if (d <= 0) return points[0];
    if (d >= total) return points[points.length - 1];
    const i = segmentAt(cum, d);
    const span = cum[i + 1] - cum[i];
    const t = span > 0 ? (d - cum[i]) / span : 0;
    return {
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t,
    };
};

export const bearingAtDistance = (points: XY[], cum: number[], d: number): number => {
    const total = cum[cum.length - 1];
    const clamped = Math.max(0, Math.min(d, total));
    const i = Math.min(segmentAt(cum, clamped), points.length - 2);
    return bearingXY(points[i], points[i + 1]);
};
export const pointAtDistanceExtended = (
    points: XY[],
    cum: number[],
    d: number
): XY => {
    const total = cum[cum.length - 1];
    if (d >= 0 && d <= total) return pointAtDistance(points, cum, d);

    const beyondEnd = d > total;
    const anchor = beyondEnd ? points[points.length - 1] : points[0];
    const prev = beyondEnd ? points[points.length - 2] : points[1];
    const dx = anchor.x - prev.x;
    const dy = anchor.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return anchor;

    const overshoot = beyondEnd ? d - total : d;
    return { x: anchor.x + (dx / len) * overshoot, y: anchor.y + (dy / len) * overshoot };
};

export interface AlongProjection {
    distanceAlong: number;
    offset: number;
}

export const projectOnPolyline = (
    points: XY[],
    cum: number[],
    p: XY
): AlongProjection => {
    let best: AlongProjection = { distanceAlong: 0, offset: Infinity };
    for (let i = 0; i < points.length - 1; i++) {
        const proj = projectOnSegment(p, points[i], points[i + 1]);
        if (proj.dist < best.offset) {
            const span = cum[i + 1] - cum[i];
            best = { distanceAlong: cum[i] + span * proj.t, offset: proj.dist };
        }
    }
    return best;
};
