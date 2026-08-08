import {
    MOTION_ALONG_TRUST,
    MOTION_BACKWARD_DAMP,
    MOTION_CORR_TAU,
    MOTION_DT_CLAMP_S,
    MOTION_EXTRAP_GAIN,
    MOTION_EXTRAP_MAX_S,
    MOTION_HEADING_LOOKAHEAD_M,
    MOTION_HEADING_MIN_MOVE,
    MOTION_HEADING_MIN_SPEED,
    MOTION_HEADING_TAU,
    MOTION_STATIONARY_BREAK_M,
    MOTION_STOP_SPEED,
    MOTION_V_SMOOTH,
} from '../constants';
import {
    LocalFrame,
    XY,
    bearingXY,
    pointAtDistance,
    pointAtDistanceExtended,
    projectOnPolyline,
    easeAlpha,
    headingUnit,
    signedTurn,
} from './geo';
export interface MotionRoad {
    key: string;
    points: XY[];
    cum: number[];
    distanceAlong: number;
    direction: 1 | -1;
}

export interface MotionFix {
    lat: number;
    lng: number;
    speed?: number | null;
    heading?: number | null;
    roadBearing?: number | null;
    road?: MotionRoad | null;
    t?: number;
}

export interface MotionSample {
    lat: number;
    lng: number;
    heading: number;
    speed: number;
    stationary: boolean;
}

export class FreeDriveMotion {
    private frame: LocalFrame | null = null;

    private fixPos: XY = { x: 0, y: 0 };
    private fixT = 0;
    private fixHeading = 0;
    private v = 0;
    private pos: XY = { x: 0, y: 0 };
    private heading = 0;

    private stationary = false;
    private started = false;
    private prevRaw: XY | null = null;
    private lastTick = 0;
    private road: MotionRoad | null = null;
    private fixU = 0;



    reset(): void {
        this.frame = null;
        this.started = false;
        this.prevRaw = null;
        this.v = 0;
        this.stationary = false;
        this.lastTick = 0;
        this.road = null;
    }

    isStarted(): boolean {
        return this.started;
    }

    getFrame(): LocalFrame | null {
        return this.frame;
    }

    getRenderedXY(): XY {
        return this.pos;
    }

    getTravelBearing(): number | null {
        return this.v >= MOTION_HEADING_MIN_SPEED ? this.fixHeading : null;
    }

    getSpeed(): number {
        return this.v;
    }

    getRenderedHeading(): number {
        return this.heading;
    }

    onFix(fix: MotionFix): void {
        const now = fix.t ?? Date.now();

        if (!this.frame) {
            this.frame = new LocalFrame(fix.lat, fix.lng);
        } else if (this.frame.reanchorIfFar(fix.lat, fix.lng)) {
            this.road = null;
        }

        const p = this.frame.toXY(fix.lat, fix.lng);

        if (!this.started) {
            this.started = true;
            this.fixPos = p;
            this.pos = p;
            this.fixT = now;
            this.prevRaw = p;
            this.v = fix.speed != null && fix.speed >= 0 ? fix.speed : 0;
            this.fixHeading =
                fix.roadBearing ?? (fix.heading != null && fix.heading >= 0 ? fix.heading : 0);
            this.heading = this.fixHeading;
            this.adoptRoad(fix.road ?? null);
            return;
        }

        const dt = Math.max(0.001, (now - this.fixT) / 1000);
        const moved = Math.hypot(p.x - this.fixPos.x, p.y - this.fixPos.y);

        const derived = moved / dt;
        const sample =
            fix.speed != null && fix.speed >= 0 ? fix.speed : Math.min(derived, 60);

        if (sample <= MOTION_STOP_SPEED) {
            this.v = 0;
        } else if (sample < this.v) {
            this.v = sample;
        } else {
            this.v = this.v * (1 - MOTION_V_SMOOTH) + sample * MOTION_V_SMOOTH;
        }
        const wasStationary = this.stationary;
        this.stationary = this.v === 0;
        if (this.stationary && wasStationary && moved < MOTION_STATIONARY_BREAK_M) {
            this.fixT = now;
            this.prevRaw = p;
            return;
        }

        this.fixHeading = this.pickHeading(fix, p, moved);
        this.fixPos = fix.roadBearing != null ? this.filterAlongTrack(p, dt) : p;
        this.adoptRoad(fix.road ?? null, dt);
        this.fixT = now;
        this.prevRaw = p;
    }
    private adoptRoad(road: MotionRoad | null, dt = 1): void {
        if (!road || road.points.length < 2) {
            this.road = null;
            return;
        }
        const sameRoad =
            this.road?.key === road.key && this.road?.direction === road.direction;
        const measuredU = road.direction * road.distanceAlong;

        let predictedU: number;
        if (sameRoad) {
            predictedU = this.fixU + this.v * dt;
        } else {
            const u = headingUnit(this.fixHeading);
            const predictedPos: XY = {
                x: this.fixPos.x + u.x * this.v * dt,
                y: this.fixPos.y + u.y * this.v * dt,
            };
            predictedU =
                road.direction *
                projectOnPolyline(road.points, road.cum, predictedPos).distanceAlong;
        }

        this.road = road;
        this.fixU = predictedU + (measuredU - predictedU) * MOTION_ALONG_TRUST;
    }
    private roadTarget(reach: number): { pos: XY; bearing: number } {
        const { points, cum, direction } = this.road!;
        const total = cum[cum.length - 1];
        const u = this.fixU + reach;

        const pos = pointAtDistanceExtended(points, cum, direction * u);
        const aheadU = u + MOTION_HEADING_LOOKAHEAD_M;
        const here = direction * u;
        const ahead = direction * aheadU;
        const withinLine =
            Math.min(here, ahead) >= 0 && Math.max(here, ahead) <= total;

        const bearing = withinLine
            ? bearingXY(
                pointAtDistance(points, cum, here),
                pointAtDistance(points, cum, ahead)
            )
            : bearingXY(pos, pointAtDistanceExtended(points, cum, ahead));

        return { pos, bearing };
    }
    private filterAlongTrack(measured: XY, dt: number): XY {
        const u = headingUnit(this.fixHeading);
        const predicted: XY = {
            x: this.fixPos.x + u.x * this.v * dt,
            y: this.fixPos.y + u.y * this.v * dt,
        };

        const dx = measured.x - predicted.x;
        const dy = measured.y - predicted.y;
        const along = (dx * u.x + dy * u.y) * MOTION_ALONG_TRUST;
        const crossX = dx - (dx * u.x + dy * u.y) * u.x;
        const crossY = dy - (dx * u.x + dy * u.y) * u.y;

        return {
            x: predicted.x + along * u.x + crossX,
            y: predicted.y + along * u.y + crossY,
        };
    }

    private pickHeading(fix: MotionFix, p: XY, moved: number): number {
        if (fix.roadBearing != null) return fix.roadBearing;

        if (
            fix.heading != null &&
            fix.heading >= 0 &&
            this.v >= MOTION_HEADING_MIN_SPEED
        ) {
            return fix.heading;
        }

        if (this.prevRaw && moved >= MOTION_HEADING_MIN_MOVE) {
            return bearingXY(this.prevRaw, p);
        }

        return this.fixHeading;
    }

    sample(now: number): MotionSample | null {
        if (!this.started || !this.frame) return null;

        const dt = this.lastTick
            ? Math.min((now - this.lastTick) / 1000, MOTION_DT_CLAMP_S)
            : 0.016;
        this.lastTick = now;

        const sinceFix = Math.min((now - this.fixT) / 1000, MOTION_EXTRAP_MAX_S);
        const reach = this.v * Math.max(0, sinceFix) * MOTION_EXTRAP_GAIN;

        let target: XY;
        let headingTarget: number;

        if (this.road) {
            target = this.roadTarget(reach).pos;
            headingTarget = this.fixHeading;
        } else {
            const fu = headingUnit(this.fixHeading);
            target = {
                x: this.fixPos.x + fu.x * reach,
                y: this.fixPos.y + fu.y * reach,
            };
            headingTarget = this.fixHeading;
        }

        const alpha = easeAlpha(dt, MOTION_CORR_TAU);
        const dx = target.x - this.pos.x;
        const dy = target.y - this.pos.y;

        if (this.road) {
            this.pos = { x: this.pos.x + dx * alpha, y: this.pos.y + dy * alpha };
        } else {
            const u = headingUnit(this.heading);
            let along = dx * u.x + dy * u.y;
            const crossX = dx - along * u.x;
            const crossY = dy - along * u.y;
            if (along < 0) along *= MOTION_BACKWARD_DAMP;
            this.pos = {
                x: this.pos.x + (along * u.x + crossX) * alpha,
                y: this.pos.y + (along * u.y + crossY) * alpha,
            };
        }

        this.heading +=
            signedTurn(this.heading, headingTarget) * easeAlpha(dt, MOTION_HEADING_TAU);
        this.heading = (this.heading + 360) % 360;

        const { lat, lng } = this.frame.toLatLng(this.pos.x, this.pos.y);
        return {
            lat,
            lng,
            heading: this.heading,
            speed: this.v,
            stationary: this.stationary,
        };
    }
}
