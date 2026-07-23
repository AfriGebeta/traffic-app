import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../shared/hooks/useTranslation';
import { useTheme } from '../shared/theme/ThemeContext';

export default function PrivacyPolicyScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <View className="px-6 pb-4" style={{ paddingTop: insets.top + 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4">
                        <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold" style={{ color: theme.textPrimary }}>
                        Privacy Policy
                    </Text>
                </View>
            </View>

            <ScrollView
                className="flex-1 px-6"
                contentContainerStyle={{ paddingTop: 24, paddingBottom: Math.max(insets.bottom + 24, 24) }}
                showsVerticalScrollIndicator={false}
            >
                <Text className="text-sm mb-6" style={{ color: theme.textSecondary }}>
                    Last Updated: February 17, 2026
                </Text>

                <Text className="text-base font-semibold mb-3" style={{ color: theme.textPrimary }}>
                    1. Information we collect
                </Text>
                <Text className="mb-6 leading-6" style={{ color: theme.textSecondary }}>
                    We collect information you provide directly to us, including your name, phone number, and location data when you use our services. We also collect incident reports, place contributions, and usage data to improve our services.
                </Text>

                <Text className="text-base font-semibold mb-3" style={{ color: theme.textPrimary }}>
                    2. How we use your information
                </Text>
                <Text className="mb-6 leading-6" style={{ color: theme.textSecondary }}>
                    We use the information we collect to provide, maintain, and improve our services, to communicate with you, to monitor and analyze trends and usage, and to personalize your experience.
                </Text>

                <Text className="text-base font-semibold mb-3" style={{ color: theme.textPrimary }}>
                    3. Information sharing
                </Text>
                <Text className="mb-6 leading-6" style={{ color: theme.textSecondary }}>
                    We may share your information with other users as part of the community features (such as leaderboards and incident reports). We do not sell your personal information to third parties.
                </Text>

                <Text className="text-base font-semibold mb-3" style={{ color: theme.textPrimary }}>
                    4. Data security
                </Text>
                <Text className="mb-6 leading-6" style={{ color: theme.textSecondary }}>
                    We take reasonable measures to help protect your personal information from loss, theft, misuse, unauthorized access, disclosure, alteration, and destruction.
                </Text>

                <Text className="text-base font-semibold mb-3" style={{ color: theme.textPrimary }}>
                    5. Contact us
                </Text>
                <Text className="leading-6" style={{ color: theme.textSecondary }}>
                    If you have any questions about this Privacy Policy, please contact us at{' '}
                    <Text
                        style={{ color: theme.blue, textDecorationLine: 'underline' }}
                        onPress={() => Linking.openURL('https://gebeta.app')}
                    >
                        gebeta.app
                    </Text>
                </Text>
            </ScrollView>
        </View>
    );
}
