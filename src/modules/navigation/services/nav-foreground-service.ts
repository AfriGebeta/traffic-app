import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { updateNativeNavNotification } from '../../../../modules/nav-notification';
import { colors } from '../../../shared/theme/colors';


const NAV_TASK = 'gebeta-nav-location-task';
const TITLE = 'Gebeta Maps';

TaskManager.defineTask(NAV_TASK, async () => { });

export function registerNavForegroundService(): void { }

let running = false;
let lastBody = '';
let lastUpdateAt = 0;
const MIN_UPDATE_INTERVAL_MS = 3000;
const START_RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000];

let startToken = 0;

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForActiveAppState(): Promise<void> {
    if (AppState.currentState === 'active') return Promise.resolve();
    return new Promise((resolve) => {
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                sub.remove();
                resolve();
            }
        });
    });
}

function buildOptions(body: string): Location.LocationTaskOptions {
    return {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 0,
        pausesUpdatesAutomatically: false,
        foregroundService: {
            notificationTitle: TITLE,
            notificationBody: body,
            notificationColor: colors.primary.main,
        },
    };
}

export async function startNavService(initialBody = 'Navigating…'): Promise<void> {
    const token = ++startToken;
    lastBody = initialBody;

    const already = await Location
        .hasStartedLocationUpdatesAsync(NAV_TASK)
        .catch(() => false);
    if (already) {
        running = true;
        void attachExitAction(token);
        return;
    }

    for (let attempt = 0; ; attempt++) {
        await waitForActiveAppState();
        if (token !== startToken) return;
        try {
            await Location.startLocationUpdatesAsync(NAV_TASK, buildOptions(lastBody));
            running = true;
            void attachExitAction(token);
            return;
        } catch (e) {
            if (attempt >= START_RETRY_DELAYS_MS.length) {
                console.warn('nav-foreground-service: failed to start', e);
                running = false;
                return;
            }
            await delay(START_RETRY_DELAYS_MS[attempt]);
            if (token !== startToken) return;
        }
    }
}
async function attachExitAction(token: number): Promise<void> {
    if (Platform.OS !== 'android') return;
    for (let i = 0; i < 5; i++) {
        await delay(500);
        if (token !== startToken || !running) return;
        if (await updateNativeNavNotification(lastBody)) return;
    }
}

export async function updateNavNotification(body: string): Promise<void> {
    if (!running || !body || body === lastBody) return;
    const now = Date.now();
    if (now - lastUpdateAt < MIN_UPDATE_INTERVAL_MS) return;
    lastBody = body;
    lastUpdateAt = now;
    if (Platform.OS === 'android') {
        const ok = await updateNativeNavNotification(body);
        if (ok) return;
    }
    if (AppState.currentState !== 'active') return;
    try {
        await Location.startLocationUpdatesAsync(NAV_TASK, buildOptions(body));
    } catch (e) {
        console.warn('nav-foreground-service: failed to update notification', e);
    }
}

export async function stopNavService(): Promise<void> {
    startToken++;
    running = false;
    lastBody = '';
    lastUpdateAt = 0;
    try {
        const started = await Location
            .hasStartedLocationUpdatesAsync(NAV_TASK)
            .catch(() => false);
        if (started) {
            await Location.stopLocationUpdatesAsync(NAV_TASK);
        }
    } catch (e) {
        console.warn('nav-foreground-service: failed to stop', e);
    }
}
