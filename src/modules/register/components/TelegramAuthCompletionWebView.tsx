import React, { useEffect, useRef } from 'react';
import {
    ActivityIndicator,
    Modal,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { TELEGRAM_WEBVIEW_INJECTED_JS } from '../../../shared/config/telegram-auth.config';
import {
    extractIdTokenFromUrl,
    extractLegacyTelegramParams,
    isTelegramAuthCompletionUrl,
} from '../../../shared/utils/telegram-auth-url';
import { telegramAuthLog } from '../../../shared/utils/telegram-auth-logger';
import { isTelegramAppUrl, openExternalAppUrl } from '../../../shared/utils/open-external-url';

interface TelegramAuthCompletionWebViewProps {
    visible: boolean;
    completionUrl: string;
    onSuccess: (idToken: string) => void;
    onError: (message: string) => void;
}

export function TelegramAuthCompletionWebView({
    visible,
    completionUrl,
    onSuccess,
    onError,
}: TelegramAuthCompletionWebViewProps) {
    const handledRef = useRef(false);

    useEffect(() => {
        handledRef.current = false;

        if (!visible) {
            return;
        }

        telegramAuthLog.info('completion webview opened', { completionUrl });

        const timeoutId = setTimeout(() => {
            if (handledRef.current) {
                return;
            }

            handledRef.current = true;
            telegramAuthLog.warn('completion webview timed out after 12s', { completionUrl });
            onError(
                'Could not finish Telegram login. The onboard page must redirect back to the app with an id_token.'
            );
        }, 12000);

        return () => clearTimeout(timeoutId);
    }, [visible, completionUrl, onError]);

    const finishWithUrl = (source: string, url: string) => {
        telegramAuthLog.url(`completion:${source}`, url);

        if (handledRef.current) {
            return;
        }

        const legacyParams = extractLegacyTelegramParams(url);
        if (legacyParams) {
            telegramAuthLog.warn(`completion:${source} legacy params only`, legacyParams);
        }

        const idToken = extractIdTokenFromUrl(url);
        if (!idToken) {
            telegramAuthLog.warn(`completion:${source} no id_token in URL`);
            return;
        }

        handledRef.current = true;
        telegramAuthLog.info(`completion:${source} id_token found, finishing login`);
        onSuccess(idToken);
    };

    const handleExternalUrl = (source: string, url: string) => {
        telegramAuthLog.url(`completion external:${source}`, url);

        if (url.startsWith('trafficapp://')) {
            finishWithUrl(`trafficapp:${source}`, url);
            if (!handledRef.current) {
                handledRef.current = true;
                telegramAuthLog.warn('trafficapp deep link had no id_token');
                onError('Telegram login completed but no id_token was returned');
            }
            return;
        }

        if (isTelegramAppUrl(url)) {
            telegramAuthLog.info('opening telegram app URL from completion webview', { url });
            void openExternalAppUrl(url);
        }
    };

    const handleMessage = (event: WebViewMessageEvent) => {
        if (handledRef.current) {
            return;
        }

        telegramAuthLog.info('completion webview message', {
            raw: event.nativeEvent.data,
        });

        try {
            const data = JSON.parse(event.nativeEvent.data) as {
                id_token?: string;
                deep_link?: string;
                external_url?: string;
                error?: string;
            };

            if (data.external_url) {
                handleExternalUrl('message', data.external_url);
                return;
            }

            if (data.deep_link) {
                finishWithUrl('deep_link message', data.deep_link);
                return;
            }

            if (data.id_token) {
                handledRef.current = true;
                telegramAuthLog.info('completion webview received id_token via postMessage');
                onSuccess(data.id_token);
                return;
            }

            if (data.error) {
                handledRef.current = true;
                telegramAuthLog.warn('completion webview received error via postMessage', { error: data.error });
                onError(data.error);
            }
        } catch (error) {
            telegramAuthLog.error('completion webview failed to parse message', error, {
                raw: event.nativeEvent.data,
            });
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <SafeAreaView style={styles.card}>
                    <ActivityIndicator size="large" color="#0088cc" />
                    <Text style={styles.title}>Finishing Telegram login...</Text>
                    <Text style={styles.subtitle}>Please wait while we sign you in.</Text>

                    <WebView
                        style={styles.hiddenWebView}
                        source={{ uri: completionUrl }}
                        onMessage={handleMessage}
                        injectedJavaScript={TELEGRAM_WEBVIEW_INJECTED_JS}
                        javaScriptEnabled
                        domStorageEnabled
                        originWhitelist={['https://*', 'http://*', 'trafficapp://*', 'tg://*', 'telegram://*', 'intent://*']}
                        onLoadStart={(event) => {
                            telegramAuthLog.url('completion webview load start', event.nativeEvent.url);
                        }}
                        onNavigationStateChange={(navigation) => {
                            telegramAuthLog.url('completion webview navigation', navigation.url);

                            if (isTelegramAuthCompletionUrl(navigation.url)) {
                                finishWithUrl('navigation', navigation.url);
                            }
                        }}
                        onShouldStartLoadWithRequest={(request) => {
                            const { url } = request;
                            telegramAuthLog.url('completion webview should load', url);

                            if (url.startsWith('trafficapp://') || isTelegramAuthCompletionUrl(url)) {
                                handleExternalUrl('shouldLoad', url);
                                finishWithUrl('shouldLoad', url);
                                return false;
                            }

                            if (url.startsWith('http://') || url.startsWith('https://')) {
                                return true;
                            }

                            handleExternalUrl('shouldLoad non-http', url);
                            return false;
                        }}
                        onLoadEnd={(event) => {
                            telegramAuthLog.url('completion webview load end', event.nativeEvent.url);
                            if (!handledRef.current) {
                                finishWithUrl('loadEnd', completionUrl);
                            }
                        }}
                        onError={(event) => {
                            const { url, code, description, domain } = event.nativeEvent;
                            telegramAuthLog.error('completion webview error', description, {
                                url,
                                code,
                                domain,
                            });
                        }}
                        onHttpError={(event) => {
                            const { url, statusCode, description } = event.nativeEvent;
                            telegramAuthLog.warn('completion webview HTTP error', {
                                url,
                                statusCode,
                                description,
                            });
                        }}
                    />
                </SafeAreaView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        paddingHorizontal: 24,
        paddingVertical: 32,
        alignItems: 'center',
        minHeight: 180,
    },
    title: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    subtitle: {
        marginTop: 8,
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
    },
    hiddenWebView: {
        width: 1,
        height: 1,
        opacity: 0,
    },
});
