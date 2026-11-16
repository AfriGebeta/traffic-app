import { AppState, AppStateStatus, NativeEventSubscription } from 'react-native';
import { apiService } from './api';
import { getAccessToken } from './auth-session';
import * as Location from './location';

const INTERVAL_MS = 2 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const LOCATION_TIMEOUT_MS = 3_000;
const LOCATION_MAX_AGE_MS = 5 * 60 * 1000;
const MOVING_MPS = 3;

let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;
let appStateSub: NativeEventSubscription | null = null;

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> => {
    let handle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
        handle = setTimeout(() => resolve(null), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(handle));
};

const ping = async () => {
    if (inFlight) return;
    inFlight = true;
    const controller = new AbortController();
    const abort = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        if (!(await getAccessToken())) return;
        const fix = await withTimeout(Location.getLastKnownPositionAsync({ maxAge: LOCATION_MAX_AGE_MS }), LOCATION_TIMEOUT_MS);
        if (!fix) return;
        const { latitude, longitude, speed } = fix.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        if (typeof speed === 'number' && speed > MOVING_MPS) return;
        await apiService.post('/api/places/offers/presence', { lat: latitude, lng: longitude }, undefined, controller.signal);
    } catch {
    } finally {
        clearTimeout(abort);
        inFlight = false;
    }
};

const start = () => {
    if (timer) return;
    void ping();
    timer = setInterval(() => void ping(), INTERVAL_MS);
};

const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
};

const onAppState = (state: AppStateStatus) => {
    if (state === 'active') start();
    else stop();
};

export const initOfferPresence = () => {
    appStateSub?.remove();
    appStateSub = AppState.addEventListener('change', onAppState);
    if (AppState.currentState === 'active') start();
};
