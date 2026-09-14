import React from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { PaymentStage } from '../hooks/useLekfelPayment';

const ACCENT = '#F97316';

interface LekfelPaymentModalProps {
    stage: PaymentStage;
    errorMessage: string;
    amount: string;
    currency: string;
    saleId?: number | string | null;
    originLat?: number;
    originLng?: number;
    onRetry: () => void;
    onDismiss: () => void;
}

export default function LekfelPaymentModal({
    stage,
    errorMessage,
    amount,
    currency,
    saleId,
    originLat,
    originLng,
    onRetry,
    onDismiss,
}: LekfelPaymentModalProps) {
    const router = useRouter();
    const { t } = useTranslation();
    const { colors: theme } = useTheme();

    const handleViewReceipt = () => {
        if (saleId === null || saleId === undefined) return;
        const receiptSaleId = String(saleId);
        onDismiss();
        setTimeout(() => {
            router.push({
                pathname: '/payment-receipt',
                params: {
                    saleId: receiptSaleId,
                    ...(originLat !== undefined ? { originLat: String(originLat) } : {}),
                    ...(originLng !== undefined ? { originLng: String(originLng) } : {}),
                },
            });
        }, 0);
    };

    const receiptButton = saleId !== null && saleId !== undefined ? (
        <TouchableOpacity
            onPress={handleViewReceipt}
            className="rounded-lg py-3.5 items-center w-full flex-row justify-center"
            style={{ borderWidth: 1, borderColor: theme.border }}
        >
            <Ionicons name="receipt-outline" size={18} color={theme.textPrimary} />
            <Text className="font-semibold text-base ml-2" style={{ color: theme.textPrimary }}>
                {t('view-receipt')}
            </Text>
        </TouchableOpacity>
    ) : null;

    return (
        <Modal
            visible={stage !== 'idle'}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={stage === 'confirming' ? undefined : onDismiss}
        >
            <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                <View className="w-full rounded-2xl p-6" style={{ backgroundColor: theme.background }}>
                    {stage === 'confirming' && (
                        <View className="items-center py-4">
                            <ActivityIndicator size="large" color={colors.primary.main} />
                            <Text className="text-base font-semibold mt-4 text-center" style={{ color: theme.textPrimary }}>
                                {t('confirm-on-phone')}
                            </Text>
                            <Text className="text-sm text-center mt-2" style={{ color: theme.textSecondary }}>
                                {t('confirm-on-phone-desc')}
                            </Text>
                        </View>
                    )}

                    {stage === 'success' && (
                        <View className="items-center py-2">
                            <Ionicons name="checkmark-circle" size={48} color={theme.green} />
                            <Text className="text-lg font-bold mt-3 text-center" style={{ color: theme.textPrimary }}>
                                {t('payment-success')}
                            </Text>
                            <Text className="text-sm text-center mt-1" style={{ color: theme.textSecondary }}>
                                {amount} {currency}
                            </Text>
                            <View className="mt-4 w-full">{receiptButton}</View>
                            <TouchableOpacity
                                onPress={onDismiss}
                                className="rounded-lg py-3.5 items-center mt-3 w-full"
                                style={{ backgroundColor: ACCENT }}
                            >
                                <Text className="text-white font-semibold text-base">{t('ok')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {stage === 'failed' && (
                        <View className="items-center py-2">
                            <Ionicons name="close-circle" size={48} color={colors.error.main} />
                            <Text className="text-base font-semibold mt-3 text-center" style={{ color: theme.textPrimary }}>
                                {errorMessage || t('payment-failed')}
                            </Text>
                            {receiptButton ? <View className="mt-4 w-full">{receiptButton}</View> : null}
                            <View className="flex-row gap-3 mt-3 w-full">
                                <TouchableOpacity
                                    onPress={onDismiss}
                                    className="flex-1 rounded-xl py-3.5 items-center"
                                    style={{ borderWidth: 1, borderColor: theme.border }}
                                >
                                    <Text className="font-semibold text-base" style={{ color: theme.textPrimary }}>
                                        {t('cancel')}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={onRetry}
                                    className="flex-1 rounded-xl py-3.5 items-center"
                                    style={{ backgroundColor: colors.primary.main }}
                                >
                                    <Text className="text-white font-semibold text-base">{t('try-again')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}
