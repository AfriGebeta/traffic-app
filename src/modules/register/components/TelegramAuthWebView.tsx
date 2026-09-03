import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,
    Modal,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import {
    buildTelegramPushFetchJs,
    getTelegramAuthConfig,
    getTelegramWebViewStartUrl,
    TELEGRAM_DIAG_JS,
    TELEGRAM_EARLY_JS,
    TELEGRAM_WEBVIEW_INJECTED_JS,
} from '../../../shared/config/telegram-auth.config';
import {
    extractIdTokenFromUrl,
    extractTelegramAuthErrorFromUrl,
    isTelegramAuthCompletionUrl,
    parseTelegramAuthMessage,
    TELEGRAM_AUTH_SCAN_JS,
} from '../../../shared/utils/telegram-auth-url';
import { isTelegramAppUrl, openExternalAppUrl } from '../../../shared/utils/open-external-url';
import { telegramAuthLog } from '../../../shared/utils/telegram-auth-logger';
import { useTranslation } from 'react-i18next';

interface TelegramAuthWebViewProps {
    visible: boolean;
    onSuccess: (idToken: string) => void;
    onError: (message: string) => void;
    onClose: () => void;
    onOnboardRedirect?: (url: string) => void;
}

const WEBVIEW_USER_AGENT =
    'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

export function TelegramAuthWebView({
    visible,
    onSuccess,
    onError,
    onClose,
    onOnboardRedirect,
}: TelegramAuthWebViewProps) {
    const { i18n } = useTranslation();
    const handledRef = useRef(false);
    const webViewRef = useRef<WebView>(null);
    const onboardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isCompletingLogin, setIsCompletingLogin] = useState(false);
    const [attempt, setAttempt] = useState(0);

    const startUrl = useMemo(
        () => getTelegramWebViewStartUrl(i18n.language?.slice(0, 2) || 'en'),
        [i18n.language]
    );

    useEffect(() => {
        if (!visible) {
            return;
        }

        telegramAuthLog.info('auth webview opened', { startUrl });

        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState !== 'active' || handledRef.current) {
                return;
            }

            telegramAuthLog.info('app returned to foreground, rescanning auth webview');
            scanCurrentPage();
        });

        return () => {
            subscription.remove();
            if (onboardTimeoutRef.current) {
                clearTimeout(onboardTimeoutRef.current);
                onboardTimeoutRef.current = null;
            }
        };
    }, [visible, startUrl]);

    const resetHandledState = () => {
        handledRef.current = false;
        setIsCompletingLogin(false);
        setAttempt((n) => n + 1);
    };

    const finishWithIdToken = (idToken: string, source: string) => {
        if (handledRef.current) {
            return true;
        }

        handledRef.current = true;
        setIsCompletingLogin(true);
        telegramAuthLog.info('auth webview id_token received', { source });
        onSuccess(idToken);
        return true;
    };

    const completeWithUrl = (url: string, source: string): boolean => {
        if (handledRef.current) {
            return true;
        }

        telegramAuthLog.url(`auth webview:${source}`, url);

        const idToken = extractIdTokenFromUrl(url);
        if (idToken) {
            return finishWithIdToken(idToken, source);
        }

        const authError = extractTelegramAuthErrorFromUrl(url);
        if (authError) {
            handledRef.current = true;
            telegramAuthLog.warn('auth webview auth error in URL', { authError, source });
            onError(authError);
            return true;
        }

        return false;
    };

    const handleAuthResult = (url: string, source: string) => {
        if (!isTelegramAuthCompletionUrl(url)) {
            return false;
        }

        return completeWithUrl(url, source);
    };

    const scheduleOnboardFallback = (url: string) => {
        if (onboardTimeoutRef.current) {
            clearTimeout(onboardTimeoutRef.current);
        }

        onboardTimeoutRef.current = setTimeout(() => {
            onboardTimeoutRef.current = null;

            if (handledRef.current || !onOnboardRedirect) {
                return;
            }

            telegramAuthLog.warn('auth webview onboard page had no token after 3s, handing off to completion');
            onOnboardRedirect(url);
        }, 3000);
    };

    const handleOnboardNavigation = (url: string, source: string) => {
        if (!url.includes('maps.gebeta.app/onboard')) {
            return;
        }

        if (completeWithUrl(url, source)) {
            return;
        }

        scanCurrentPage();
        scheduleOnboardFallback(url);
    };

    const scanCurrentPage = () => {
        if (handledRef.current) {
            return;
        }

        webViewRef.current?.injectJavaScript(TELEGRAM_AUTH_SCAN_JS);
    };

    const handleExternalUrl = (source: string, url: string) => {
        telegramAuthLog.url(`auth webview external:${source}`, url);

        if (url.startsWith('trafficapp://')) {
            if (!completeWithUrl(url, source)) {
                telegramAuthLog.warn('trafficapp deep link had no id_token');
                onError('Telegram login completed but no id_token was returned');
            }
            return;
        }

        if (isTelegramAppUrl(url)) {
            telegramAuthLog.info('opening telegram app from auth webview', { url });
            void openExternalAppUrl(url);
        }
    };

    const handleNavigation = (navigation: WebViewNavigation) => {
        if (isTelegramAppUrl(navigation.url)) {
            handleExternalUrl('navigation', navigation.url);
            return;
        }

        if (handleAuthResult(navigation.url, 'navigation')) {
            return;
        }

        handleOnboardNavigation(navigation.url, 'navigation');
    };

    const handleMessage = (event: WebViewMessageEvent) => {
        try {
            const probe = JSON.parse(event.nativeEvent.data) as {
                diag?: { event?: string };
                tg_auth_result?: string;
            };

            if (probe?.diag) {
                const { event: name, ...rest } = probe.diag;
                telegramAuthLog.diag(`page:${name ?? 'unknown'}`, rest);
                return;
            }

            if (probe?.tg_auth_result) {
                const recoveredUrl = `${getTelegramAuthConfig().webRedirectUri}#tgAuthResult=${probe.tg_auth_result}`;
                telegramAuthLog.url('recovered tgAuthResult from /auth/push', recoveredUrl);

                if (!completeWithUrl(recoveredUrl, 'push fetch')) {
                    telegramAuthLog.warn('recovered tgAuthResult had no usable id_token');
                }
                return;
            }
        } catch {
        }

        if (handledRef.current) {
            return;
        }

        telegramAuthLog.info('auth webview message', {
            raw: event.nativeEvent.data,
        });

        try {
            const data = JSON.parse(event.nativeEvent.data) as {
                id_token?: string;
                error?: string;
                deep_link?: string;
                external_url?: string;
            };

            if (data.external_url) {
                handleExternalUrl('message', data.external_url);
                return;
            }

            if (data.id_token && finishWithIdToken(data.id_token, 'postMessage')) {
                return;
            }

            if (data.deep_link && completeWithUrl(data.deep_link, 'deep_link message')) {
                return;
            }

            const parsed = parseTelegramAuthMessage(event.nativeEvent.data);
            if (!parsed) {
                return;
            }

            if (parsed.id_token) {
                finishWithIdToken(parsed.id_token, 'parsed message');
                return;
            }

            if (parsed.error) {
                handledRef.current = true;
                telegramAuthLog.warn('auth webview error via message', { error: parsed.error });
                onError(parsed.error);
            }
        } catch (error) {
            telegramAuthLog.error('auth webview failed to parse message', error, {
                raw: event.nativeEvent.data,
            });
        }
    };

    const shouldAllowHttpNavigation = (url: string) => {
        if (handledRef.current || isCompletingLogin) {
            return false;
        }

        return url.startsWith('http://') || url.startsWith('https://');
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
            onShow={resetHandledState}
        >
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Continue with Telegram</Text>
                    {!isCompletingLogin ? (
                        <TouchableOpacity onPress={onClose} hitSlop={8}>
                            <Text style={styles.closeButton}>Close</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>

                {isCompletingLogin ? (
                    <View style={styles.completingContainer}>
                        <ActivityIndicator size="large" color="#0088cc" />
                        <Text style={styles.completingText}>Logging you in...</Text>
                    </View>
                ) : (
                    <WebView
                        ref={webViewRef}
                        key={`${startUrl}-${attempt}`}
                        style={styles.webview}
                        source={{ uri: startUrl }}
                        userAgent={WEBVIEW_USER_AGENT}
                        onMessage={handleMessage}
                        injectedJavaScriptBeforeContentLoaded={TELEGRAM_EARLY_JS}
                        injectedJavaScript={TELEGRAM_WEBVIEW_INJECTED_JS + TELEGRAM_DIAG_JS}
                        javaScriptEnabled
                        domStorageEnabled
                        thirdPartyCookiesEnabled
                        sharedCookiesEnabled
                        setSupportMultipleWindows={false}
                        originWhitelist={['https://*', 'http://*', 'trafficapp://*', 'tg://*', 'telegram://*', 'intent://*']}
                        startInLoadingState
                        renderLoading={() => (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#0088cc" />
                                <Text style={styles.loadingText}>Loading Telegram login...</Text>
                            </View>
                        )}
                        onLoadStart={(event) => {
                            telegramAuthLog.url('auth webview load start', event.nativeEvent.url);
                        }}
                        onNavigationStateChange={handleNavigation}
                        onLoadEnd={(event) => {
                            telegramAuthLog.url('auth webview load end', event.nativeEvent.url);
                            scanCurrentPage();
                            handleOnboardNavigation(event.nativeEvent.url, 'loadEnd');
                        }}
                        onShouldStartLoadWithRequest={(request) => {
                            const { url } = request;
                            telegramAuthLog.url('auth webview should load', url);

                            if (url.includes('/auth/push') && !handledRef.current) {
                                telegramAuthLog.info('intercepting /auth/push, fetching same-origin');
                                webViewRef.current?.injectJavaScript(
                                    buildTelegramPushFetchJs(url)
                                );
                                return false;
                            }

                            if (url.startsWith('trafficapp://')) {
                                handleExternalUrl('shouldLoad', url);
                                return false;
                            }

                            if (isTelegramAuthCompletionUrl(url) && completeWithUrl(url, 'shouldLoad')) {
                                return false;
                            }

                            if (url.startsWith('http://') || url.startsWith('https://')) {
                                return shouldAllowHttpNavigation(url);
                            }

                            handleExternalUrl('shouldLoad non-http', url);
                            return false;
                        }}
                        onError={(event) => {
                            const { url, code, description, domain } = event.nativeEvent;
                            telegramAuthLog.error('auth webview error', description, {
                                url,
                                code,
                                domain,
                            });
                            if (!handledRef.current) {
                                onError('Failed to load Telegram login');
                            }
                        }}
                        onHttpError={(event) => {
                            const { url, statusCode, description } = event.nativeEvent;
                            telegramAuthLog.warn('auth webview HTTP error', {
                                url,
                                statusCode,
                                description,
                            });
                            if (!handledRef.current) {
                                onError('Failed to load Telegram login');
                            }
                        }}
                    />
                )}
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e5e7eb',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    closeButton: {
        fontSize: 14,
        fontWeight: '500',
        color: '#0088cc',
    },
    webview: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6b7280',
    },
    completingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
    },
    completingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#111827',
    },
});
