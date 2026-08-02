import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import TelegramAuthService from '../shared/services/telegram-auth.service';
import { getTelegramAuthConfig } from '../shared/config/telegram-auth.config';
import { getPostAuthRoute } from '../modules/places/utils/homeOnboarding';
import { showToast } from '../shared/utils/toast';

export default function TelegramAuth() {
    const router = useRouter();
    const params = useLocalSearchParams();

    useEffect(() => {
        handleAuth();
    }, []);

    const handleAuth = async () => {
        try {
            const queryString = new URLSearchParams(params as Record<string, string>).toString();
            const config = getTelegramAuthConfig();
            const url = params.id_token
                ? `${config.redirectUri}?${queryString}`
                : `trafficapp://telegram-auth?${queryString}`;

            const success = await TelegramAuthService.handleCallback(url);

            if (success) {
                showToast('Login successful');
                const route = await getPostAuthRoute();
                router.replace(route as any);
            } else {
                showToast('Telegram authentication failed');
                router.replace('/telegram-login');
            }
        } catch (error) {
            console.error('Telegram authentication error:', error);
            showToast('An error occurred during authentication');
            router.replace('/telegram-login');
        }
    };

    return (
        <View className="flex-1 items-center justify-center bg-white">
            <ActivityIndicator size="large" color="#da9f1f" />
            <Text className="mt-4 text-gray-600">Authenticating with Telegram...</Text>
        </View>
    );
}
