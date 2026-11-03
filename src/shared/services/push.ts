import { PermissionsAndroid, Platform } from 'react-native';
import {
    deleteToken,
    getMessaging,
    getToken,
    onTokenRefresh,
    setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import i18n from '../utils/localization/i18n';
import { hasPlayServices } from '../utils/playServices';
import { apiService } from './api';
import { getAccessToken, onSessionExpired, onSessionStarted } from './auth-session';
import { logBreadcrumb } from '../utils/crashlytics';

const DEVICES_PATH = '/api/notifications/devices';
// also set in firebase.json, so pushes shown by Firebase (app in background/closed) use it too.
// Android keeps a channel's importance from when it was first created: never reuse an old id to change it
export const PUSH_CHANNEL = 'gebeta_alerts';

const log = (...args: unknown[]) => {
    console.log('[push]', ...args);
    logBreadcrumb(`push: ${args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ')}`);
};

const supported = () => Platform.OS === 'android' && hasPlayServices();

// Android 13+ asks for POST_NOTIFICATIONS (requested at launch in _layout); older versions always allow
const notificationsAllowed = async (): Promise<boolean> => {
    if (Number(Platform.Version) < 33) return true;
    return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => false);
};

const appLanguage = (): 'am' | 'en' => (i18n.language?.startsWith('am') ? 'am' : 'en');

let lastRegistered: string | null = null;

export const registerPushDevice = async (fcmToken?: string): Promise<void> => {
    try {
        const accessToken = await getAccessToken();
        if (!supported()) return log('register skipped: no Play Services or not Android');
        if (!accessToken) return log('register skipped: not signed in');
        if (!(await notificationsAllowed())) return log('register skipped: notifications not allowed');
        const token = fcmToken ?? (await getToken(getMessaging()));
        const language = appLanguage();
        const key = `${token}|${language}|${accessToken}`;
        if (key === lastRegistered) return;
        lastRegistered = key;
        const response = await apiService.post(DEVICES_PATH, { token, platform: 'android', language });
        if (response.error) {
            lastRegistered = null;
            log('register failed', response.status, response.error);
        }
        else log('registered', response.data, `token …${token.slice(-8)}`);
    } catch (error) {
        lastRegistered = null;
        log('register error', error);
    }
};

export const unregisterPushDevice = async (): Promise<void> => {
    if (!supported()) return;
    try {
        const messaging = getMessaging();
        const token = await getToken(messaging);
        if (await getAccessToken()) {
            const response = await apiService.delete(DEVICES_PATH, undefined, { token });
            log(response.error ? `unregister failed ${response.status}` : 'unregistered');
        }
        await deleteToken(messaging);
    } catch (error) {
        log('unregister error', error);
    }
};

let initialized = false;

export const initPush = () => {
    if (initialized || !supported()) return;
    initialized = true;
    const messaging = getMessaging();

    setBackgroundMessageHandler(messaging, async () => undefined);

    // pops up as a banner, not just a quiet entry in the bar
    void Notifications.setNotificationChannelAsync(PUSH_CHANNEL, {
        name: 'Gebeta',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
    }).catch((error) => log('channel error', error));
    // pushes that arrive while the app is open are posted by us (usePushNotificationTaps); show them like any other
    Notifications.setNotificationHandler({
        handleNotification: async (notification) => (console.log('[push] handler', notification.request.identifier), { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });

    onTokenRefresh(messaging, (token) => void registerPushDevice(token));
    onSessionStarted(() => void registerPushDevice());
    onSessionExpired(() => void deleteToken(messaging).catch(() => undefined));
    i18n.on('languageChanged', () => void registerPushDevice());

    void registerPushDevice();
};
