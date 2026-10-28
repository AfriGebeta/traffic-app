import { PermissionsAndroid, Platform } from 'react-native';
import {
    deleteToken,
    getMessaging,
    getToken,
    onTokenRefresh,
    setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import i18n from '../utils/localization/i18n';
import { hasPlayServices } from '../utils/playServices';
import { apiService } from './api';
import { getAccessToken, onSessionExpired, onSessionStarted } from './auth-session';

const DEVICES_PATH = '/api/notifications/devices';

const log = (...args: unknown[]) => {
    if (__DEV__) console.log('[push]', ...args);
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
        if (!supported() || !accessToken || !(await notificationsAllowed())) return;
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

    onTokenRefresh(messaging, (token) => void registerPushDevice(token));
    onSessionStarted(() => void registerPushDevice());
    onSessionExpired(() => void deleteToken(messaging).catch(() => undefined));
    i18n.on('languageChanged', () => void registerPushDevice());

    void registerPushDevice();
};
