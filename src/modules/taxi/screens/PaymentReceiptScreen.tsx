import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { paymentService } from '../services/payment.service';
import { exploreService } from '../../map/services/exploreService';
import { PaymentSaleResponse } from '../types/payment.types';

const toCoordinate = (value?: string): number | undefined => {
    if (!value) return undefined;
    const coordinate = Number(value);
    return Number.isFinite(coordinate) ? coordinate : undefined;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;

const getSaleOrigin = (sale: PaymentSaleResponse): { lat?: number; lng?: number } => {
    const containers = [
        sale as Record<string, unknown>,
        asRecord(sale.metadata),
        asRecord(sale.trip),
        asRecord(sale.details),
    ].filter((value): value is Record<string, unknown> => value !== null);

    for (const container of containers) {
        const origin = asRecord(container.origin);
        const lat = Number(container.originLat ?? container.originLatitude ?? origin?.lat ?? origin?.latitude);
        const lng = Number(container.originLng ?? container.originLongitude ?? origin?.lng ?? origin?.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }

    return {};
};

const buildOriginReplacementScript = (placeName: string) => `
    (function () {
        var replacement = ${JSON.stringify(placeName)};
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        var node;
        while ((node = walker.nextNode())) {
            var parent = node.parentElement;
            if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') continue;
            node.nodeValue = node.nodeValue
                .replace(/current location/gi, replacement)
                .replace(/የአሁኑ አካባቢ/g, replacement);
        }
        true;
    })();
`;

export const PaymentReceiptScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{
        saleId?: string | string[];
        originLat?: string;
        originLng?: string;
    }>();
    const { t, language } = useTranslation();
    const { colors: theme } = useTheme();
    const webViewRef = useRef<WebView>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [webLoaded, setWebLoaded] = useState(false);
    const [resolvedOriginName, setResolvedOriginName] = useState<string | null>(null);
    const saleId = Array.isArray(params.saleId) ? params.saleId[0] : params.saleId;
    const receiptUrl = useMemo(
        () => saleId ? paymentService.getReceiptUrl(saleId) : null,
        [saleId]
    );

    useEffect(() => {
        let active = true;

        const resolveOriginName = async () => {
            let lat = toCoordinate(params.originLat);
            let lng = toCoordinate(params.originLng);

            if ((lat === undefined || lng === undefined) && saleId) {
                try {
                    const sale = await paymentService.getSaleStatus(saleId);
                    const storedOrigin = getSaleOrigin(sale);
                    lat = storedOrigin.lat;
                    lng = storedOrigin.lng;
                } catch {
                    return;
                }
            }

            if (lat === undefined || lng === undefined) return;

            try {
                const place = await exploreService.reverseGeocode(lat, lng);
                if (place?.name && active) {
                    setResolvedOriginName(place.name);
                    return;
                }

                const address = await exploreService.requestAddress(
                    lat,
                    lng,
                    language === 'am' ? 'AM' : 'EN'
                );
                const addressName = address?.district || address?.subCity || address?.city;
                if (addressName && active) setResolvedOriginName(addressName);
            } catch {
                // keep the original receipt text when geocoding is unavailable.
            }
        };

        void resolveOriginName();
        return () => {
            active = false;
        };
    }, [language, params.originLat, params.originLng, saleId]);

    useEffect(() => {
        if (!webLoaded || !resolvedOriginName) return;
        webViewRef.current?.injectJavaScript(buildOriginReplacementScript(resolvedOriginName));
    }, [resolvedOriginName, webLoaded]);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/payment-transactions');
        }
    };

    const retry = () => {
        setLoadFailed(false);
        setWebLoaded(false);
        setReloadKey((current) => current + 1);
    };

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <View
                className="px-5 pb-3 border-b flex-row items-center"
                style={{ paddingTop: insets.top + 10, borderBottomColor: theme.border }}
            >
                <TouchableOpacity
                    onPress={handleBack}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    className="w-10 h-10 -ml-2 mr-2 items-center justify-center"
                >
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="text-xl font-bold flex-1" style={{ color: theme.textPrimary }}>
                    {t('receipt-title')}
                </Text>
            </View>

            {!receiptUrl || loadFailed ? (
                <View className="flex-1 items-center justify-center px-8" style={{ paddingBottom: insets.bottom }}>
                    <Ionicons name="document-text-outline" size={42} color={theme.textSecondary} />
                    <Text className="text-sm text-center mt-4 mb-5" style={{ color: theme.textSecondary }}>
                        {t('receipt-load-failed')}
                    </Text>
                    {receiptUrl ? (
                        <TouchableOpacity
                            onPress={retry}
                            activeOpacity={0.8}
                            className="rounded-lg px-5 py-3"
                            style={{ backgroundColor: theme.primary }}
                        >
                            <Text className="text-white text-sm font-bold">{t('try-again')}</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : (
                <WebView
                    key={reloadKey}
                    ref={webViewRef}
                    source={{ uri: receiptUrl }}
                    originWhitelist={['https://*']}
                    startInLoadingState
                    setSupportMultipleWindows={false}
                    onLoadStart={() => {
                        setLoadFailed(false);
                        setWebLoaded(false);
                    }}
                    onLoadEnd={() => setWebLoaded(true)}
                    onError={() => setLoadFailed(true)}
                    onHttpError={(event) => {
                        if (event.nativeEvent.statusCode >= 400) setLoadFailed(true);
                    }}
                    renderLoading={() => (
                        <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: theme.background }}>
                            <ActivityIndicator color={theme.primary} />
                            <Text className="text-xs mt-3" style={{ color: theme.textSecondary }}>
                                {t('receipt-loading')}
                            </Text>
                        </View>
                    )}
                    style={{ flex: 1, backgroundColor: '#FFFFFF', marginBottom: insets.bottom }}
                />
            )}
        </View>
    );
};

export default PaymentReceiptScreen;
