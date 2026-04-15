import React from 'react';
import { View, Text, TouchableOpacity, Image, StatusBar, Linking } from 'react-native';
import { useRouter } from 'expo-router';
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
                        className="w-32 h-32 mb-6"
                        resizeMode="contain"
                    />
                    <Text className="text-3xl font-bold text-gray-900 mb-3 text-center">
                        GebetaMaps
                    </Text>
                    <Text className="text-base text-gray-600 text-center">
                        {t('register-to-continue') || 'Register to Continue'}
                    </Text>
                </View>

                <View className="space-y-4">
                    <TouchableOpacity
                        className="rounded-xl py-4 items-center flex-row justify-center border-2"
                        style={{ borderColor: colors.primary.main }}
                        onPress={handleTelegramLogin}
                        activeOpacity={0.8}
                    >
                        <Text className="text-lg mr-2">📱</Text>
                        <Text
                            className="text-base font-semibold"
                            style={{ color: colors.primary.main }}
                        >
                            {t('continue-with-telegram') || 'Continue with Telegram'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="rounded-xl py-4 items-center border-2 border-orange-400 mt-4"
                        onPress={handleNoTelegram}
                        activeOpacity={0.8}
                    >
                        <Text className="text-orange-600 text-base font-semibold">
                            {t('i-dont-have-telegram') || "I don't have Telegram"}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View className="mt-8 items-center">
                    <Text className="text-gray-500 text-xs text-center mb-2">
                        {t('by-continuing-you-agree') || 'By continuing, you agree to our'}
                    </Text>
                    <View className="flex-row items-center">
                        <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
                            <Text className="text-xs font-semibold" style={{ color: colors.primary.main }}>
                                {t('privacy-policy') || 'Privacy Policy'}
                            </Text>
                        </TouchableOpacity>
                        <Text className="text-gray-500 text-xs mx-1">{t('and') || 'and'}</Text>
                        <TouchableOpacity onPress={() => router.push('/terms-conditions')}>
                            <Text className="text-xs font-semibold" style={{ color: colors.primary.main }}>
                                {t('terms-conditions') || 'Terms & Conditions'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <View className="pb-8 items-center">
                <Text className="text-gray-400 text-xs">
                    {t('something-like-this-malet-new') || 'something like this malet new'}
                </Text>
            </View>
        </View>
    );
}
