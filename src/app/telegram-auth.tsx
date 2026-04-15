import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import TelegramAuthService from '../shared/services/telegram-auth.service';
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
            const url = `trafficapp://telegram-auth?${queryString}`;

            console.log('Telegram Auth - URL:', url);
            console.log('Telegram Auth - Params:', params);

            const success = await TelegramAuthService.handleCallback(url);

            if (success) {
                showToast.success('Login successful');
                router.replace('/');
            } else {
                console.error('Telegram authentication failed - success was false');
                showToast.error('Telegram authentication failed');
                router.replace('/telegram-login');
            }
        } catch (error) {
            console.error('Telegram authentication error:', error);
            showToast.error('An error occurred during authentication');
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
