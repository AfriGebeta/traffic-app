import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { hasPlayServices } from '../utils/playServices';
import { registerPushDevice } from './push';

export type NotificationAskReason = 'home' | 'contribution' | 'campaign';

export interface NotificationStatus {
    enabled: boolean;
    // false once Android stops showing its dialog (denied twice); then only Settings can turn them on
    canAsk: boolean;
}

const PROMPT_KEY = '@notification_prompt';
const DAY_MS = 86_400_000;
const HOME_GAPS_DAYS = [2, 4, 7, 12, 20, 30];
const CONTEXT_COOLDOWN_MS = DAY_MS;

interface PromptRecord {
    homeCount: number;
    homeLastAt: number;
    lastShownAt: number;
}

// push only works on Android with Play Services, so nobody else is asked
const pushSupported = () => Platform.OS === 'android' && hasPlayServices();

export const getNotificationStatus = async (): Promise<NotificationStatus> => {
    if (!pushSupported()) return { enabled: true, canAsk: false };
    try {
        const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
        // below Android 13 there is no dialog; notifications are switched on in Settings
        return { enabled: granted, canAsk: canAskAgain && Number(Platform.Version) >= 33 };
    } catch {
        return { enabled: true, canAsk: false };
    }
};

let lastEnabled: boolean | null = null;
const statusListeners = new Set<(status: NotificationStatus) => void>();

// re-reads the status and tells every strip; registers the device the moment they get turned on
export const refreshNotificationStatus = async (): Promise<NotificationStatus> => {
    const status = await getNotificationStatus();
    if (status.enabled && lastEnabled === false) void registerPushDevice();
    lastEnabled = status.enabled;
    statusListeners.forEach((listener) => listener(status));
    return status;
};

// the system dialog while Android still shows it, otherwise the app's notification settings
export const enableNotifications = async (): Promise<void> => {
    const { enabled, canAsk } = await getNotificationStatus();
    if (enabled) return;
    if (canAsk) {
        await Notifications.requestPermissionsAsync().catch(() => undefined);
        await refreshNotificationStatus();
    } else {
        // the status is re-read when the app comes back to the foreground
        await Linking.openSettings().catch(() => undefined);
    }
};

// null until the first check; strips render nothing until then
export const useNotificationStatus = (): NotificationStatus | null => {
    const [status, setStatus] = useState<NotificationStatus | null>(null);
    useEffect(() => {
        statusListeners.add(setStatus);
        void refreshNotificationStatus();
        // back from Settings
        const subscription = AppState.addEventListener('change', (next) => {
            if (next === 'active') void refreshNotificationStatus();
        });
        return () => {
            statusListeners.delete(setStatus);
            subscription.remove();
        };
    }, []);
    return status;
};

const readRecord = async (): Promise<PromptRecord> => {
    try {
        const raw = await AsyncStorage.getItem(PROMPT_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return {
            homeCount: Number(parsed?.homeCount) || 0,
            homeLastAt: Number(parsed?.homeLastAt) || 0,
            lastShownAt: Number(parsed?.lastShownAt) || 0,
        };
    } catch {
        return { homeCount: 0, homeLastAt: 0, lastShownAt: 0 };
    }
};

const isDue = (record: PromptRecord, reason: NotificationAskReason, now: number): boolean => {
    if (reason !== 'home') return now - record.lastShownAt >= CONTEXT_COOLDOWN_MS;
    if (record.homeCount === 0) return true;
    const gap = HOME_GAPS_DAYS[record.homeCount - 1];
    return gap !== undefined && now - record.homeLastAt >= gap * DAY_MS;
};

const markShown = async (reason: NotificationAskReason, now: number): Promise<void> => {
    const record = await readRecord();
    const next: PromptRecord =
        reason === 'home'
            ? { homeCount: record.homeCount + 1, homeLastAt: now, lastShownAt: now }
            : { ...record, lastShownAt: now };
    await AsyncStorage.setItem(PROMPT_KEY, JSON.stringify(next)).catch(() => undefined);
};

// the ask card (NotificationPromptHost) shows whatever is set here
let pendingReason: NotificationAskReason | null = null;
const promptListeners = new Set<() => void>();
const setPending = (reason: NotificationAskReason | null) => {
    pendingReason = reason;
    promptListeners.forEach((listener) => listener());
};

export const usePendingNotificationAsk = () =>
    useSyncExternalStore(
        (listener) => {
            promptListeners.add(listener);
            return () => {
                promptListeners.delete(listener);
            };
        },
        () => pendingReason
    );

// shows the ask card when notifications are off and this reason is due; counted as shown right away
export const askForNotifications = async (reason: NotificationAskReason): Promise<void> => {
    if (pendingReason) return;
    const { enabled, canAsk } = await getNotificationStatus();
    if (enabled) return;
    // while Android still shows its own dialog, _layout asks with it at every launch; home's card is for after that
    if (reason === 'home' && canAsk) return;
    const now = Date.now();
    if (!isDue(await readRecord(), reason, now)) return;
    await markShown(reason, now);
    setPending(reason);
};

export const dismissNotificationAsk = () => setPending(null);

// "don't allow" on the launch dialog counts as a home ask, so home's card waits for the next gap (2 days).
// contribution/join asks are left alone: a "no" at launch doesn't stop the ask right after joining
export const recordLaunchDenial = async (): Promise<void> => {
    const record = await readRecord();
    const next: PromptRecord = { ...record, homeCount: record.homeCount + 1, homeLastAt: Date.now() };
    await AsyncStorage.setItem(PROMPT_KEY, JSON.stringify(next)).catch(() => undefined);
};
