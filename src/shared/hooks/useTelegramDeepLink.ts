import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import TelegramAuthService from '../services/telegram-auth.service';
import { isTelegramAuthCallbackUrl } from '../config/telegram-auth.config';
import { telegramAuthLog } from '../utils/telegram-auth-logger';
import { showToast } from '../utils/toast';

export function useTelegramDeepLink() {
    const router = useRouter();

    useEffect(() => {
        const handleDeepLink = async ({ url }: { url: string }) => {
            telegramAuthLog.url('deep link received', url);

            if (!isTelegramAuthCallbackUrl(url)) {
                telegramAuthLog.info('deep link ignored (not telegram auth)', { url });
                return;
            }

            try {
                const result = await TelegramAuthService.handleAuthRedirect(url);
                telegramAuthLog.info('deep link auth result', result);

                if (result.success) {
                    showToast.success('Login successful');
                    router.replace('/');
                    return;
                }

                if (result.error) {
                    showToast.error(result.error);
                    return;
                }

                showToast.error('Telegram login completed but no id_token was returned');
            } catch (error) {
                telegramAuthLog.error('deep link handler failed', error);
                showToast.error('An error occurred during authentication');
            }
        };

        const subscription = Linking.addEventListener('url', handleDeepLink);

        Linking.getInitialURL().then((url) => {
            if (url) {
                telegramAuthLog.url('initial deep link', url);
                handleDeepLink({ url });
            }
        });

        return () => {
            subscription.remove();
        };
    }, [router]);
}
