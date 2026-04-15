import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import TelegramAuthService from '../services/telegram-auth.service';
import { showToast } from '../utils/toast';

export function useTelegramDeepLink() {
    const router = useRouter();

    useEffect(() => {
        const handleDeepLink = async ({ url }: { url: string }) => {
            if (!url.includes('telegram-auth')) return;

            try {
                const success = await TelegramAuthService.handleCallback(url);

                if (success) {
                    showToast.success('Login successful');
                    router.replace('/');
                } else {
                    showToast.error('Telegram authentication failed');
                }
            } catch (error) {
                showToast.error('An error occurred during authentication');
            }
        };

        const subscription = Linking.addEventListener('url', handleDeepLink);

        // Handle initial URL if app was opened via deep link
        Linking.getInitialURL().then((url) => {
            if (url) {
                handleDeepLink({ url });
            }
        });

        return () => {
            subscription.remove();
        };
    }, [router]);
}
