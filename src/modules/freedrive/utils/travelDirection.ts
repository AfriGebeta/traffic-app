import { XY, bearingXY } from './geo';

const WINDOW_M = 25;
const MIN_DISPLACEMENT_M = 10;
const MAX_AGE_MS = 20000;

interface Sample {
    p: XY;
    t: number;
}

export class TravelDirection {
    private samples: Sample[] = [];

    reset(): void {
        this.samples = [];
    }

    push(p: XY, t: number): void {
        this.samples.push({ p, t });
        while (this.samples.length > 2) {
            const oldest = this.samples[0];
            const newest = this.samples[this.samples.length - 1];
            const spanStale = newest.t - oldest.t > MAX_AGE_MS;
            const spanLong =
                Math.hypot(newest.p.x - this.samples[1].p.x, newest.p.y - this.samples[1].p.y) >
                WINDOW_M;
            if (!spanStale && !spanLong) break;
            this.samples.shift();
        }
    }
    get(): number | null {
        if (this.samples.length < 2) return null;

        const newest = this.samples[this.samples.length - 1];
        for (let i = 0; i < this.samples.length - 1; i++) {
            const candidate = this.samples[i];
            if (newest.t - candidate.t > MAX_AGE_MS) continue;
            const moved = Math.hypot(
                newest.p.x - candidate.p.x,
                newest.p.y - candidate.p.y
            );
            if (moved >= MIN_DISPLACEMENT_M) return bearingXY(candidate.p, newest.p);
        }
        return null;
    }
}
