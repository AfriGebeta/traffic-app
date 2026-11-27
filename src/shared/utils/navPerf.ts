const ENABLED = __DEV__;

const counts: Record<string, number> = {};
let started = false;

const flush = () => {
    if (Object.keys(counts).length > 0) {
        console.log('[navperf] ' + JSON.stringify(counts));
        for (const key of Object.keys(counts)) delete counts[key];
    }
    setTimeout(flush, 1000);
};

export const navPerf = (key: string) => {
    if (!ENABLED) return;
    if (!started) {
        started = true;
        setTimeout(flush, 1000);
    }
    counts[key] = (counts[key] ?? 0) + 1;
};
