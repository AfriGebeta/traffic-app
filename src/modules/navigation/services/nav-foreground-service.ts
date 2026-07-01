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
    try {
        lastBody = initialBody;

        const already = await Location
            .hasStartedLocationUpdatesAsync(NAV_TASK)
            .catch(() => false);
        if (already) {
            running = true;
            return;
        }

        await Location.startLocationUpdatesAsync(NAV_TASK, buildOptions(initialBody));
        running = true;
    } catch (e) {
        console.warn('nav-foreground-service: failed to start', e);
        running = false;
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
