import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import TelegramAuthService from '../../../shared/services/telegram-auth.service';
import { telegramAuthLog } from '../../../shared/utils/telegram-auth-logger';
import { showToast } from '../../../shared/utils/toast';
import { resolveAfterAuthRoute } from '../utils/profileGate';

export function useTelegramLogin() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [completionUrl, setCompletionUrl] = useState<string | null>(null);
    const [showAuthWebView, setShowAuthWebView] = useState(false);

    const finishLogin = useCallback(
        async (idToken: string) => {
            telegramAuthLog.info('finishLogin started');
            setCompletionUrl(null);
            setShowAuthWebView(false);
            setIsLoading(true);

            try {
                const success = await TelegramAuthService.loginWithIdToken(idToken);

                if (success) {
                    telegramAuthLog.info('finishLogin success, navigating to home');
                    showToast('Login successful');

                    const route = await resolveAfterAuthRoute();
                    router.replace(route as any);
                    return;
                }

                telegramAuthLog.warn('finishLogin failed at backend login step');
                showToast('Telegram authentication failed');
            } catch (error) {
                telegramAuthLog.error('finishLogin threw', error);
                showToast('An error occurred during authentication');
            } finally {
                setIsLoading(false);
            }
        },
        [router]
    );

    const loginWithTelegram = useCallback(() => {
        telegramAuthLog.info('loginWithTelegram started, opening in-app webview');
        setCompletionUrl(null);
        setShowAuthWebView(true);
    }, []);

    const closeAuthWebView = useCallback(() => {
        telegramAuthLog.info('auth webview closed by user');
        setShowAuthWebView(false);
    }, []);

    const handleAuthWebViewError = useCallback((message: string) => {
        telegramAuthLog.warn('auth webview error', { message });
        setShowAuthWebView(false);
        showToast(message);
    }, []);

    const handleAuthWebViewOnboard = useCallback((url: string) => {
        telegramAuthLog.info('auth webview reached onboard without token, starting completion', {
            url,
        });
        setShowAuthWebView(false);
        setCompletionUrl(url);
    }, []);

    const handleCompletionError = useCallback((message: string) => {
        telegramAuthLog.warn('completion webview error', { message });
        setCompletionUrl(null);
        showToast(message);
    }, []);

    return {
        loginWithTelegram,
        finishLogin,
        closeAuthWebView,
        handleAuthWebViewError,
        handleAuthWebViewOnboard,
        handleCompletionError,
        completionUrl,
        showAuthWebView,
        isLoading,
    };
}
