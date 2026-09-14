import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { paymentService } from '../services/payment.service';
import { PaymentSaleResponse, PaymentSaleStatus } from '../types/payment.types';

import TaxiDarkIcon from '../../../../assets/images/contribute-place-taxi-dark.svg';
import TaxiLightIcon from '../../../../assets/images/contribute-place-taxi-light.svg';

const PAGE_SIZE = 5;
const FILTERS: { labelKey: string; value?: PaymentSaleStatus }[] = [
    { labelKey: 'payment-transactions-all' },
    { labelKey: 'payment-transactions-completed', value: 'COMPLETED' },
    { labelKey: 'payment-transactions-pending', value: 'PENDING' },
    { labelKey: 'payment-transactions-failed', value: 'FAILED' },
];

const STATUS_COLORS: Record<PaymentSaleStatus, { background: string; text: string }> = {
    COMPLETED: { background: '#E8F5EC', text: '#237A45' },
    PENDING: { background: '#FFF3D6', text: '#9A6200' },
    FAILED: { background: '#FDE8E8', text: '#C43737' },
    EXPIRED: { background: '#ECEEF1', text: '#5F6670' },
};

const getString = (sale: PaymentSaleResponse, keys: string[]): string | undefined => {
    for (const key of keys) {
        const value = sale[key];
        if (typeof value === 'string' && value.trim()) return value;
        if (typeof value === 'number') return String(value);
    }
    return undefined;
};

interface PaymentTransactionsSectionProps {
    showHeader?: boolean;
}

export const PaymentTransactionsSection = ({ showHeader = true }: PaymentTransactionsSectionProps) => {
    const router = useRouter();
    const { t, language } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const [sales, setSales] = useState<PaymentSaleResponse[]>([]);
    const [status, setStatus] = useState<PaymentSaleStatus | undefined>();
    const [offset, setOffset] = useState(0);
    
    const [total, setTotal] = useState<number | undefined>();
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const requestIdRef = useRef(0);

    const loadSales = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        setLoading(true);
        setError(null);
        try {
            const page = await paymentService.getSales({ limit: PAGE_SIZE, offset, status });
            if (requestId !== requestIdRef.current) return;
            setSales(page.sales);
            setTotal(page.total);
            setHasMore(page.hasMore);
        } catch (loadError) {
            if (requestId !== requestIdRef.current) return;
            setSales([]);
            setTotal(undefined);
            setHasMore(false);
            setError(loadError instanceof Error ? loadError.message : t('payment-transactions-error'));
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [offset, status, t]);

    useFocusEffect(
        useCallback(() => {
            void loadSales();
            return () => {
                requestIdRef.current += 1;
            };
        }, [loadSales])
    );

    const selectStatus = (nextStatus?: PaymentSaleStatus) => {
        setStatus(nextStatus);
        setOffset(0);
    };

    const viewReceipt = (sale: PaymentSaleResponse) => {
        router.push({
            pathname: '/payment-receipt',
            params: {
                saleId: String(sale.id),
                ...(sale.originLat !== undefined ? { originLat: String(sale.originLat) } : {}),
                ...(sale.originLng !== undefined ? { originLng: String(sale.originLng) } : {}),
            },
        });
    };

    const formatAmount = (sale: PaymentSaleResponse) => {
        const rawAmount = sale.amount ?? sale.quotedFare;
        const amount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount);
        const formatted = Number.isFinite(amount)
            ? new Intl.NumberFormat(language === 'am' ? 'am-ET' : 'en-US', { maximumFractionDigits: 2 }).format(amount)
            : '—';
        return `${formatted} ${sale.currency ?? 'ETB'}`;
    };

    const formatDate = (sale: PaymentSaleResponse) => {
        const rawDate = getString(sale, ['createdAt', 'created_at', 'paymentDate', 'date', 'updatedAt']);
        if (!rawDate) return t('payment-transactions-date-unavailable');
        const date = new Date(rawDate);
        if (Number.isNaN(date.getTime())) return rawDate;
        return new Intl.DateTimeFormat(language === 'am' ? 'am-ET' : 'en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }).format(date);
    };

    const totalPages = total === undefined ? undefined : Math.max(1, Math.ceil(total / PAGE_SIZE));
    const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
    const TaxiIcon = isDark ? TaxiDarkIcon : TaxiLightIcon;
    const cardStyle = {
        backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        borderWidth: 1,
        borderRadius: 12,
    };

    return (
        <View className="mb-8">
            {showHeader ? (
                <View className="flex-row items-center justify-between mb-3">
                    <View>
                        <Text className="font-bold text-base" style={{ color: theme.textPrimary }}>
                            {t('payment-transactions-title')}
                        </Text>
                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                            {t('payment-transactions-subtitle')}
                        </Text>
                    </View>
                    <View
                        className="w-9 h-9 rounded-full items-center justify-center"
                        style={{ backgroundColor: isDark ? '#4D3400' : '#FFF1D6' }}
                    >
                        <Ionicons name="receipt-outline" size={18} color="#FFA500" />
                    </View>
                </View>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
                {FILTERS.map((filter) => {
                    const selected = filter.value === status;
                    return (
                        <TouchableOpacity
                            key={filter.labelKey}
                            activeOpacity={0.75}
                            onPress={() => selectStatus(filter.value)}
                            className="px-3.5 py-2 rounded-md"
                            style={{
                                backgroundColor: selected ? '#FFA500' : theme.surface,
                                borderWidth: 1,
                                borderColor: selected ? '#FFA500' : theme.border,
                            }}
                        >
                            <Text className="text-xs font-semibold" style={{ color: selected ? '#FFFFFF' : theme.textSecondary }}>
                                {t(filter.labelKey)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <View style={cardStyle} className="overflow-hidden">
                {loading ? (
                    <View className="items-center justify-center py-10">
                        <ActivityIndicator color="#FFA500" />
                        <Text className="text-xs mt-3" style={{ color: theme.textSecondary }}>
                            {t('payment-transactions-loading')}
                        </Text>
                    </View>
                ) : error ? (
                    <View className="items-center px-5 py-8">
                        <Ionicons name="cloud-offline-outline" size={26} color={theme.textSecondary} />
                        <Text className="text-sm text-center mt-2 mb-4" style={{ color: theme.textSecondary }}>
                            {t('payment-transactions-error')}
                        </Text>
                        <TouchableOpacity onPress={() => void loadSales()} className="px-4 py-2.5 rounded-lg" style={{ backgroundColor: '#FFA500' }}>
                            <Text className="text-white text-xs font-bold">{t('try-again')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : sales.length === 0 ? (
                    <View className="items-center px-5 py-9">
                        <Ionicons name="receipt-outline" size={28} color={theme.textSecondary} />
                        <Text className="font-semibold text-sm mt-3" style={{ color: theme.textPrimary }}>
                            {t('payment-transactions-empty')}
                        </Text>
                        <Text className="text-xs text-center mt-1" style={{ color: theme.textSecondary }}>
                            {t('payment-transactions-empty-description')}
                        </Text>
                    </View>
                ) : (
                    sales.map((sale, index) => {
                        const palette = STATUS_COLORS[sale.status] ?? STATUS_COLORS.PENDING;
                        const reference = sale.telebirrTransactionId
                            ?? sale.reference
                            ?? getString(sale, ['transactionId', 'transaction_id']);
                        const recipient = sale.driverName
                            ?? getString(sale, ['receiverName', 'driverFullName', 'recipientName']);
                        return (
                            <View
                                key={String(sale.id)}
                                className="px-4 py-4"
                                style={index > 0 ? { borderTopWidth: 1, borderTopColor: theme.border } : undefined}
                            >
                                <View className="flex-row items-start justify-between">
                                    <View className="flex-row flex-1 mr-3">
                                        <View className="w-9 h-9 rounded-full items-center justify-center mr-3" style={{ backgroundColor: theme.surface }}>
                                            <TaxiIcon width={20} height={20} />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="font-bold text-sm" style={{ color: theme.textPrimary }}>
                                                {formatAmount(sale)}
                                            </Text>
                                            <Text className="text-xs mt-1" style={{ color: theme.textSecondary }} numberOfLines={1}>
                                                {recipient || sale.description || t('payment-transactions-taxi-payment')}
                                            </Text>
                                        </View>
                                    </View>
                                    <View className="px-2 py-1 rounded-full" style={{ backgroundColor: isDark ? `${palette.text}33` : palette.background }}>
                                        <Text className="text-xs font-bold" style={{ color: isDark ? theme.textPrimary : palette.text }}>
                                            {t(`payment-status-${sale.status.toLowerCase()}`)}
                                        </Text>
                                    </View>
                                </View>
                                <View className="flex-row items-center justify-between mt-3 ml-12">
                                    <Text className="text-xs" style={{ color: theme.textSecondary }}>{formatDate(sale)}</Text>
                                    {reference ? (
                                        <Text className="text-xs ml-2" style={{ color: theme.textSecondary }} numberOfLines={1}>
                                            #{reference}
                                        </Text>
                                    ) : null}
                                </View>
                                <TouchableOpacity
                                    onPress={() => viewReceipt(sale)}
                                    activeOpacity={0.7}
                                    className="self-start flex-row items-center ml-12 mt-3 px-3 py-2 rounded-md"
                                    style={{ borderWidth: 1, borderColor: theme.border }}
                                >
                                    <Ionicons name="receipt-outline" size={15} color={theme.textPrimary} />
                                    <Text className="text-xs font-semibold ml-1.5" style={{ color: theme.textPrimary }}>
                                        {t('view-receipt')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        );
                    })
                )}
            </View>

            {!loading && !error && (offset > 0 || hasMore) ? (
                <View className="flex-row items-center justify-between mt-3">
                    <TouchableOpacity
                        disabled={offset === 0}
                        onPress={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                        className="flex-row items-center px-3 py-2"
                        style={{ opacity: offset === 0 ? 0.35 : 1 }}
                    >
                        <Ionicons name="chevron-back" size={16} color={theme.textPrimary} />
                        <Text className="text-xs font-semibold ml-1" style={{ color: theme.textPrimary }}>{t('previous')}</Text>
                    </TouchableOpacity>
                    <Text className="text-xs" style={{ color: theme.textSecondary }}>
                        {totalPages
                            ? t('payment-transactions-page-count', { current: currentPage, total: totalPages })
                            : t('payment-transactions-page', { current: currentPage })}
                    </Text>
                    <TouchableOpacity
                        disabled={!hasMore}
                        onPress={() => setOffset(offset + PAGE_SIZE)}
                        className="flex-row items-center px-3 py-2"
                        style={{ opacity: hasMore ? 1 : 0.35 }}
                    >
                        <Text className="text-xs font-semibold mr-1" style={{ color: theme.textPrimary }}>{t('next')}</Text>
                        <Ionicons name="chevron-forward" size={16} color={theme.textPrimary} />
                    </TouchableOpacity>
                </View>
            ) : null}
        </View>
    );
};
