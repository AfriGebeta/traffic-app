import { useEffect } from 'react';
import * as Location from './location';
import { gpsLog } from '../utils/photoFix';

const STOP_AFTER_MS = 30_000;
// a fix older than this is no use as the camera's starting point
const SEED_MAX_AGE_MS = 30_000;

let users = 0;
let subscription: Location.LocationSubscription | null = null;
let starting = false;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let best: Location.LocationObject | null = null;

const keep = (location: Location.LocationObject) => {
    const accuracy = location.coords.accuracy ?? Infinity;
    // newer wins unless it's clearly worse than a recent one
    if (!best || accuracy <= (best.coords.accuracy ?? Infinity) || location.timestamp - best.timestamp > 5_000) best = location;
};

const start = async () => {
    if (subscription || starting) return;
    starting = true;
    try {
        // never asks: only warms up when location is already allowed and switched on
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted' || !(await Location.hasServicesEnabledAsync().catch(() => false))) return;
        const watch = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0 }, keep);
        if (users === 0) {
            watch.remove();
            return;
        }
        subscription = watch;
        gpsLog('warm-up started');
    } catch (error) {
        gpsLog('warm-up failed', error);
    } finally {
        starting = false;
    }
};

const stop = () => {
    subscription?.remove();
    if (subscription) gpsLog('warm-up stopped');
    subscription = null;
};

const acquire = () => {
    users++;
    if (stopTimer) {
        clearTimeout(stopTimer);
        stopTimer = null;
    }
    void start();
};

const release = () => {
    users = Math.max(0, users - 1);
    if (users > 0 || stopTimer) return;
    stopTimer = setTimeout(() => {
        stopTimer = null;
        if (users === 0) stop();
    }, STOP_AFTER_MS);
};

// best recent fix from the warm-up, for the camera to start from instead of waiting for a first fix
export const getWarmFix = (now = Date.now()): Location.LocationObject | null =>
    best && now - best.timestamp <= SEED_MAX_AGE_MS ? best : null;

// keeps high-accuracy GPS running while `active` (e.g. on screens that lead to a campaign photo)
export const useGpsWarmup = (active: boolean) => {
    useEffect(() => {
        if (!active) return;
        acquire();
        return release;
    }, [active]);
};
