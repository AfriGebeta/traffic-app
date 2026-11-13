import { AppState, NativeEventSubscription } from 'react-native';
import { apiService } from './api';
import telemetryService from './telemetry.service';

export type EngagementKind = 'seen' | 'opened' | 'offer_viewed' | 'call' | 'directions' | 'save';

interface EngagementEvent {
    placeId: string;
    kind: EngagementKind;
    offerId?: string;
}

const FLUSH_MS = 10_000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_BATCH = 200;
const MAX_QUEUE = 1000;

let queue: EngagementEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let appStateSub: NativeEventSubscription | null = null;

const flush = async (): Promise<void> => {
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }
    if (flushing || !queue.length) return;
    flushing = true;
    try {
        await send();
    } catch {
    } finally {
        flushing = false;
        if (queue.length) schedule();
    }
};

const send = async (): Promise<void> => {
    const batches: EngagementEvent[][] = [];
    while (queue.length) batches.push(queue.splice(0, MAX_BATCH));
    let deviceId: string | undefined;
    try {
        deviceId = await telemetryService.getDeviceId();
    } catch {
    }
    for (const events of batches) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await apiService.post('/api/places/engagement', { ...(deviceId && { deviceId }), events }, undefined, controller.signal);
            console.log('[engagement]', response.status, response.error ?? '', JSON.stringify(events));
        } catch {
        } finally {
            clearTimeout(timeout);
        }
    }
};

const schedule = () => {
    if (!timer) timer = setTimeout(() => void flush(), FLUSH_MS);
};

export const trackEngagement = (placeId: string | null | undefined, kind: EngagementKind, offerId?: string | null): void => {
    if (!placeId) return;
    queue.push({ placeId, kind, ...(offerId && { offerId }) });
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    if (queue.length >= MAX_BATCH) void flush();
    else schedule();
};

export const initEngagement = () => {
    appStateSub?.remove();
    appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'background' || state === 'inactive') void flush();
    });
};
