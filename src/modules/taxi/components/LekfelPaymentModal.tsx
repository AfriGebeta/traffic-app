import React from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    onRetry: () => void;
    onDismiss: () => void;
}

export default function LekfelPaymentModal({
    stage,
    errorMessage,
    amount,
    currency,
    onRetry,
    onDismiss,
}: LekfelPaymentModalProps) {
    const { t } = useTranslation();
    const { colors: theme } = useTheme();

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
                            <TouchableOpacity
                                onPress={onDismiss}
                                className="rounded-xl py-3.5 items-center mt-4 w-full"
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
                            <View className="flex-row gap-3 mt-4 w-full">
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
