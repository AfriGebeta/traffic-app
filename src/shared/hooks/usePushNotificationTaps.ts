import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
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

type RemoteMessage = FirebaseMessagingTypes.RemoteMessage;

const openForMessage = (message: RemoteMessage) => {
    const event = message.data?.event;
    logBreadcrumb(`push: opened ${event ?? 'unknown'}`);
    switch (event) {
        case 'submission.verified':
        case 'submission.rejected':
            router.push('/my-contributions');
            return;
        case 'account.restricted':
            if (message.notification?.body) showToast(message.notification.body);
            return;
        default:
            return;
    }
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
