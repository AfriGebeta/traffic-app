import React from 'react';
import { View, Text, TouchableOpacity, Image, StatusBar, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';

const TELEGRAM_LOGIN_URL = process.env.EXPO_PUBLIC_TELEGRAM_LOGIN_URL!;

export default function TelegramLoginChoiceScreen() {
    const { t } = useTranslation();
    const router = useRouter();

    const handleTelegramLogin = async () => {
        if (!TELEGRAM_LOGIN_URL) {
            console.error('TELEGRAM_LOGIN_URL is not configured');
            return;
        }

        try {

            await Linking.openURL(TELEGRAM_LOGIN_URL);
        } catch (error) {
            console.error('Error opening Telegram login:', error);
        }
    };

    const handleNoTelegram = () => {
        router.push('/login');
    };

    return (
        <View className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

            <View className="absolute top-12 right-6 z-50">
                <LanguageSwitcher />
            </View>

            <View className="flex-1 justify-center px-6">
                <View className="items-center mb-12">
                    <Image
                        source={require('../../../../assets/images/favicon.png')}
                        className="w-24 h-24 mb-6"
                        resizeMode="contain"
                    />
                    <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
                        GebetaMaps
                    </Text>
                    <Text className="text-sm text-gray-400 text-center">
                        {t('register-to-continue') || 'Register to Continue'}
                    </Text>
                </View>

                <View className="space-y-4">
                    <TouchableOpacity
                        className="rounded-xl py-4 items-center flex-row justify-center border-2"
                        style={{ borderColor: '#0088cc' }}
                        onPress={handleTelegramLogin}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="paper-plane-outline" size={20} color="#0088cc" style={{ marginRight: 8 }} />
                        <Text
                            className="text-base font-medium"
                            style={{ color: '#0088cc' }}
                        >
                            {t('continue-with-telegram') || 'Continue with Telegram'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="rounded-xl py-4 items-center border-2 mt-4"
                        style={{ borderColor: colors.primary.main }}
                        onPress={handleNoTelegram}
                        activeOpacity={0.8}
                    >
                        <Text className="text-base font-medium" style={{ color: colors.primary.main }}>
                            {t('i-dont-have-telegram') || "I don't have Telegram"}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View className="mt-8 items-center px-4">
                    <Text className="text-gray-500 text-xs text-center mb-2">
                        {t('by-continuing-you-agree')}
                    </Text>
                    <Text className="text-gray-500 text-xs text-center">
                        <Text
                            className="text-xs font-semibold"
                            style={{ color: colors.primary.main }}
                            onPress={() => router.push('/privacy-policy')}
                        >
                            {t('privacy-policy') || 'Privacy Policy'}
                        </Text>
                        <Text className="text-gray-500 text-xs"> {t('and') || 'and'} </Text>
                        <Text
                            className="text-xs font-semibold"
                            style={{ color: colors.primary.main }}
                            onPress={() => router.push('/terms-conditions')}
                        >
                            {t('terms-conditions') || 'Terms & Conditions'}
                        </Text>
                    </Text>
                </View>
            </View>
        </View>
    );
}
