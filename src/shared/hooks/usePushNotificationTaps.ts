import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
    getInitialNotification,
    getMessaging,
    onMessage,
    onNotificationOpenedApp,
    type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { hasPlayServices } from '../utils/playServices';
import { showToast } from '../utils/toast';
import { logBreadcrumb } from '../utils/crashlytics';
import { PUSH_CHANNEL } from '../services/push';
import { notificationService } from '../../modules/notifications/services/notification.service';
import { openNotificationTarget } from '../../modules/notifications/utils/notificationTarget';
import { NotificationData } from '../../modules/notifications/types/notification.types';

type RemoteMessage = FirebaseMessagingTypes.RemoteMessage;

// Where a tap goes, by data.event (see push-events.md and openNotificationTarget)
const openForMessage = (message: RemoteMessage) => {
    const data = message.data as NotificationData | undefined;
    logBreadcrumb(`push: opened ${typeof data?.event === 'string' ? data.event : 'unknown'}`);
    openNotificationTarget(data, 'push', typeof data?.deliveryId === 'string' ? data.deliveryId : undefined);
    if (data?.event === 'account.restricted' && message.notification?.body) showToast(message.notification.body);
};

// tells the backend the push was opened (its delivery tracker); fire and forget
const markOpened = (message: RemoteMessage) => {
    const deliveryId = message.data?.deliveryId;
    if (typeof deliveryId !== 'string' || !deliveryId) return;
    // the service logs the result in dev builds
    void notificationService.markRead(deliveryId, 'push').catch(() => undefined);
};

const toastText = ({ notification }: RemoteMessage): string | null => {
    if (!notification?.body) return notification?.title ?? null;
    return notification.title ? `${notification.title}: ${notification.body}` : notification.body;
};

// Firebase doesn't show pushes while the app is open, so post the same notification ourselves
const showWhileOpen = (message: RemoteMessage) => {
    const { title, body } = message.notification ?? {};
    console.log('[push] show while open', JSON.stringify({ notification: message.notification ?? null, dataKeys: Object.keys(message.data ?? {}) }));
    if (!title && !body) return;
    Notifications.scheduleNotificationAsync({
        content: { title: title ?? undefined, body: body ?? undefined, data: message.data ?? {} },
        trigger: { channelId: PUSH_CHANNEL },
    }).then((id) => console.log('[push] posted', id)).catch((error) => {
        console.log('[push] post failed', String(error));
        const text = toastText(message);
        if (text) showToast(text);
    });
};

// a tap on one of those, shaped like the push it came from
const fromResponse = (response: Notifications.NotificationResponse): RemoteMessage => {
    const { title, body, data } = response.notification.request.content;
    return { data, notification: { title: title ?? undefined, body: body ?? undefined } } as RemoteMessage;
};

export const usePushNotificationTaps = (pathname: string, isNavigationPath: (path: string) => boolean) => {
    const pendingRef = useRef<RemoteMessage | null>(null);
    const pathnameRef = useRef(pathname);
    pathnameRef.current = pathname;

    useEffect(() => {
        if (Platform.OS !== 'android' || !hasPlayServices()) return;
        const messaging = getMessaging();

        const open = (message: RemoteMessage | null) => {
            if (!message) return;
            console.log('[push] opened', message.data?.event ?? 'no event', message.data?.deliveryId ?? '');
            // counted as opened even if routing waits for navigation to end
            markOpened(message);
            if (isNavigationPath(pathnameRef.current)) {
                pendingRef.current = message;
                return;
            }
            openForMessage(message);
        };

        // closed app started by a tap: wait for the first screen to settle before routing
        void getInitialNotification(messaging).then((message) => {
            if (message) setTimeout(() => open(message), 800);
        });

        // taps on notifications we posted while open; the listener and the cold-start lookup can both see the same one
        let lastTapped: string | null = null;
        const openTapped = (response: Notifications.NotificationResponse | null) => {
            if (!response || response.notification.request.identifier === lastTapped) return;
            lastTapped = response.notification.request.identifier;
            void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
            open(fromResponse(response));
        };
        void Notifications.getLastNotificationResponseAsync().then((response) => {
            if (response) setTimeout(() => openTapped(response), 800);
        });
        const tapSubscription = Notifications.addNotificationResponseReceivedListener(openTapped);

        const unsubscribeOpened = onNotificationOpenedApp(messaging, open);
        const unsubscribeForeground = onMessage(messaging, (message) => {
            console.log('[push] received while open', message.data?.event ?? 'no event', message.data?.deliveryId ?? '');
            showWhileOpen(message);
        });

        return () => {
            unsubscribeOpened();
            unsubscribeForeground();
            tapSubscription.remove();
        };
    }, []);

    useEffect(() => {
        if (pendingRef.current && !isNavigationPath(pathname)) {
            const message = pendingRef.current;
            pendingRef.current = null;
            openForMessage(message);
        }
    }, [pathname, isNavigationPath]);
};
