import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
    getInitialNotification,
    getMessaging,
    onMessage,
    onNotificationOpenedApp,
    type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import { hasPlayServices } from '../utils/playServices';
import { showToast } from '../utils/toast';
import { logBreadcrumb } from '../utils/crashlytics';
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

export const usePushNotificationTaps = (pathname: string, isNavigationPath: (path: string) => boolean) => {
    const pendingRef = useRef<RemoteMessage | null>(null);
    const pathnameRef = useRef(pathname);
    pathnameRef.current = pathname;

    useEffect(() => {
        if (Platform.OS !== 'android' || !hasPlayServices()) return;
        const messaging = getMessaging();

        const open = (message: RemoteMessage | null) => {
            if (!message) return;
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

        const unsubscribeOpened = onNotificationOpenedApp(messaging, open);
        const unsubscribeForeground = onMessage(messaging, (message) => {
            const text = toastText(message);
            if (text) showToast(text);
        });

        return () => {
            unsubscribeOpened();
            unsubscribeForeground();
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
