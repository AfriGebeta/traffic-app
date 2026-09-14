import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { PaymentTransactionsSection } from '../components/PaymentTransactionsSection';

export const PaymentTransactionsScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { colors: theme } = useTheme();

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/profile');
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <View
                className="px-5 pb-4 border-b"
                style={{ paddingTop: insets.top + 12, borderBottomColor: theme.border }}
            >
                <View className="flex-row items-center">
                    <TouchableOpacity
                        onPress={handleBack}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        className="w-10 h-10 -ml-2 mr-2 items-center justify-center"
                    >
                        <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <View className="flex-1">
                        <Text className="text-xl font-bold" style={{ color: theme.textPrimary }}>
                            {t('payment-transactions-title')}
                        </Text>
                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                            {t('payment-transactions-subtitle')}
                        </Text>
                    </View>
                </View>
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingTop: 20,
                    paddingBottom: Math.max(insets.bottom, 16) + 16,
                }}
            >
                <PaymentTransactionsSection showHeader={false} />
            </ScrollView>
        </View>
    );
};

export default PaymentTransactionsScreen;
