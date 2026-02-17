import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../shared/hooks/useTranslation';

export default function TermsConditionsScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    return (
        <View className="flex-1 bg-white">
            <View className="px-6 pb-4 border-b border-gray-100" style={{ paddingTop: insets.top + 12 }}>
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4">
                        <Ionicons name="arrow-back" size={24} color="#1f2937" />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold text-gray-900">
                        {t('terms-conditions') || 'Terms & Conditions'}
                    </Text>
                </View>
            </View>

            <ScrollView
                className="flex-1 px-6"
                contentContainerStyle={{ paddingTop: 24, paddingBottom: Math.max(insets.bottom + 24, 24) }}
                showsVerticalScrollIndicator={false}
            >
                <Text className="text-gray-500 text-sm mb-6">
                    Last Updated: February 17, 2026
                </Text>

                <Text className="text-base text-gray-900 font-semibold mb-3">
                    1. Acceptance of terms
                </Text>
                <Text className="text-gray-700 mb-6 leading-6">
                    By accessing and using GebetaMaps App, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these terms, please do not use our services.
                </Text>

                <Text className="text-base text-gray-900 font-semibold mb-3">
                    2. Use of service
                </Text>
                <Text className="text-gray-700 mb-6 leading-6">
                    You agree to use the service only for lawful purposes and in a way that does not infringe the rights of, restrict, or inhibit anyone else's use and enjoyment of the service.
                </Text>

                <Text className="text-base text-gray-900 font-semibold mb-3">
                    3. User Content
                </Text>
                <Text className="text-gray-700 mb-6 leading-6">
                    You are responsible for any content you submit, including incident reports and place contributions. You grant us a access to use, modify, and display your content as part of our services.
                </Text>

                <Text className="text-base text-gray-900 font-semibold mb-3">
                    4. Accuracy of information
                </Text>
                <Text className="text-gray-700 mb-6 leading-6">
                    While we strive to provide accurate information, we cannot guarantee the accuracy, completeness, or timeliness of incident reports and place information provided by users.
                </Text>

                <Text className="text-base text-gray-900 font-semibold mb-3">
                    5. Limitation of liability
                </Text>
                <Text className="text-gray-700 mb-6 leading-6">
                    GebetaMaps App shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.
                </Text>

                <Text className="text-base text-gray-900 font-semibold mb-3">
                    6. Modifications
                </Text>
                <Text className="text-gray-700 mb-6 leading-6">
                    We reserve the right to modify or replace these terms at any time. Your continued use of the service after any changes constitutes acceptance of the new terms.
                </Text>

                <Text className="text-base text-gray-900 font-semibold mb-3">
                    7. Contact Information
                </Text>
                <Text className="text-gray-700 leading-6">
                    For any questions regarding these terms, please contact us at{' '}
                    <Text
                        className="text-blue-600 underline"
                        onPress={() => Linking.openURL('https://gebeta.app')}
                    >
                        gebeta.app
                    </Text>
                </Text>
            </ScrollView>
        </View>
    );
}
