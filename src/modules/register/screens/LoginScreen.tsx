import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserLogin } from '../hooks/useUserLogin';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_MODE_KEY = '@traffic_app_guest_mode';

export default function LoginScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [name, setName] = useState('');
    const { login, loading, error } = useUserLogin();

    const handleLogin = async () => {
        if (!phoneNumber.trim()) {
            showToast.error(t('phone-number-required') || 'Phone number is required');
            return;
        }

        if (!name.trim()) {
            showToast.error(t('name-required') || 'Name is required');
            return;
        }

        const fullPhoneNumber = `+251${phoneNumber.trim()}`;
        const result = await login({ phoneNumber: fullPhoneNumber, name: name.trim() });

        if (result) {
            showToast.success(t('login-successful') || 'Login successful');
            setTimeout(() => {
                router.replace('/');
            }, 1000);
        } else if (error) {
            showToast.error(error);

            if (error.toLowerCase().includes('not found') || error.toLowerCase().includes('register first')) {
                setTimeout(() => {
                    showToast.info(t('redirecting-to-registration') || 'Redirecting to registration...');
                    setTimeout(() => navigateToRegister(), 1500);
                }, 2000);
            }
        }
    };

    const handleGuestMode = async () => {
        await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
        showToast.success(t('entering-guest-mode') || 'Entering as guest');
        router.replace('/');
    };

    const navigateToRegister = () => {
        router.push('/register' as any);
    };

    return (
        <KeyboardAvoidingView
            className="flex-1 bg-white"
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
        >
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
            <View className="absolute top-12 right-6 z-50">
                <LanguageSwitcher />
            </View>

            <ScrollView
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: 20 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View className="px-6 py-8">
                    <View className="items-center mb-8">
                        <Image
                            source={require('../../../../assets/images/favicon.png')}
                            className="w-28 h-28"
                            resizeMode="contain"
                        />
                    </View>

                    <View className="mb-8">
                        <Text className="text-3xl font-bold text-gray-900 mb-2 text-center">
                            {t('welcome-back') || 'Welcome Back'}
                        </Text>
                        <Text className="text-base text-gray-600 text-center">
                            {t('login-to-continue') || 'Login to continue'}
                        </Text>
                    </View>

                    <View className="mb-6">
                        <View className="mb-4">
                            <Text className="text-sm font-bold text-gray-900 mb-2">
                                {t('name') || 'Name'}
                            </Text>
                            <TextInput
                                className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3.5 text-base text-gray-900 font-semibold"
                                placeholder={t('enter-your-name') || 'Enter your name'}
                                placeholderTextColor="#9CA3AF"
                                value={name}
                                onChangeText={setName}
                                autoCapitalize="words"
                                editable={!loading}
                            />
                        </View>

                        <View className="mb-6">
                            <Text className="text-sm font-bold text-gray-900 mb-2">
                                {t('phone-number') || 'Phone Number'}
                            </Text>
                            <View className="flex-row items-center bg-gray-50 border border-gray-300 rounded-xl">
                                <Text className="text-base font-semibold text-gray-900 pl-4">+251</Text>
                                <TextInput
                                    className="flex-1 px-2 py-3.5 text-base text-gray-900 font-semibold"
                                    placeholder="912345678"
                                    placeholderTextColor="#9CA3AF"
                                    value={phoneNumber}
                                    onChangeText={setPhoneNumber}
                                    keyboardType="phone-pad"
                                    autoCapitalize="none"
                                    editable={!loading}
                                    maxLength={9}
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            className="rounded-xl py-4 items-center mb-3"
                            style={{ backgroundColor: loading ? colors.primary.light : colors.primary.main }}
                            onPress={handleLogin}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text
                                    className="text-white text-base font-semibold px-4"
                                    numberOfLines={2}
                                    style={{ minWidth: 80 }}
                                >
                                    {t('login') || 'Login'}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="py-3 items-center mb-3"
                            onPress={navigateToRegister}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            <Text className="text-gray-600 text-sm">
                                {t('dont-have-account') || "Don't have an account?"}{' '}
                                <Text className="font-bold" style={{ color: colors.primary.main }}>
                                    {t('register') || 'Register'}
                                </Text>
                            </Text>
                        </TouchableOpacity>

                        <View className="items-center mb-2">
                            <Text className="text-gray-500">{t('or') || 'or'}</Text>
                        </View>

                        <TouchableOpacity
                            className="rounded-xl py-4 items-center border border-gray-300"
                            onPress={handleGuestMode}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            <Text className="text-gray-700 text-base font-semibold">
                                {t('continue-as-guest') || 'Continue as Guest'}
                            </Text>
                        </TouchableOpacity>

                        <View className="mt-6 items-center">
                            <Text className="text-gray-500 text-xs text-center mb-2">
                                {t('by-continuing-you-agree') || 'By continuing, you agree to our'}
                            </Text>
                            <View className="flex-row items-center">
                                <TouchableOpacity onPress={() => router.push('/privacy-policy' as any)}>
                                    <Text className="text-xs font-semibold" style={{ color: colors.primary.main }}>
                                        {t('privacy-policy') || 'Privacy Policy'}
                                    </Text>
                                </TouchableOpacity>
                                <Text className="text-gray-500 text-xs mx-1">{t('and') || 'and'}</Text>
                                <TouchableOpacity onPress={() => router.push('/terms-conditions' as any)}>
                                    <Text className="text-xs font-semibold" style={{ color: colors.primary.main }}>
                                        {t('terms-conditions') || 'Terms & Conditions'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
