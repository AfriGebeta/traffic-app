import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserRegistration } from '../hooks/useUserRegistration';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPostAuthRoute } from '../../places/utils/homeOnboarding';

const GUEST_MODE_KEY = '@traffic_app_guest_mode';

export default function RegistrationScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const { register, loading, error } = useUserRegistration();

    const navigateToLogin = () => {
        router.replace('/login' as any);
    };

    const handleRegister = async () => {
        if (!phoneNumber.trim()) {
            showToast(t('phone-number-required') || 'Phone number is required');
            return;
        }

        if (!name.trim()) {
            showToast(t('name-required') || 'Name is required');
            return;
        }

        if (!password.trim()) {
            showToast(t('password-required') || 'Password is required');
            return;
        }

        if (password.length < 6) {
            showToast(t('password-too-short') || 'Password must be at least 6 characters');
            return;
        }

        const fullPhoneNumber = `+251${phoneNumber.trim()}`;

        try {
            const result = await register({
                phoneNumber: fullPhoneNumber,
                name: name.trim(),
                password: password.trim()
            });

            if (result) {
                showToast(t('registration-successful') || 'Registration successful');
                const route = await getPostAuthRoute();
                setTimeout(() => {
                    router.replace(route as any);
                }, 1000);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Registration failed';
            showToast(errorMessage);

            if (errorMessage.toLowerCase().includes('already registered') ||
                errorMessage.toLowerCase().includes('already exist')) {
                setTimeout(() => {
                    showToast(t('redirecting-to-login') || 'Redirecting to login...');
                    setTimeout(() => navigateToLogin(), 1500);
                }, 2000);
            }
        }
    };

    const handleGuestMode = async () => {
        await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
        showToast(t('entering-guest-mode') || 'Entering as guest');
        router.replace('/');
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
                    <View className="items-center mb-8 mt-4">
                        <Image
                            source={require('../../../../assets/images/favicon.png')}
                            className="w-24 h-24"
                            resizeMode="contain"
                        />
                    </View>

                    <View className="mb-8">
                        <Text className="text-3xl font-bold text-gray-900 mb-2 text-center">
                            {t('welcome')}
                        </Text>
                        <Text className="text-base text-gray-600 text-center">
                            {t('register-to-continue') || 'Register to continue'}
                        </Text>
                    </View>

                    <View className="mb-6">
                        <View className="mb-4">
                            <Text className="text-sm font-bold text-gray-900 mb-2">
                                {t('name')}
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

                        <View className="mb-5">
                            <Text className="text-sm font-bold text-gray-900 mb-2">
                                {t('phone-number')}
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

                        <View className="mb-6">
                            <Text className="text-sm font-bold text-gray-900 mb-2">
                                {t('password')}
                            </Text>
                            <TextInput
                                className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3.5 text-base text-gray-900 font-semibold"
                                placeholder={t('enter-your-password') || 'Enter your password'}
                                placeholderTextColor="#9CA3AF"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                autoCapitalize="none"
                                editable={!loading}
                            />
                        </View>

                        <TouchableOpacity
                            className="rounded-xl py-4 items-center mb-3"
                            style={{ backgroundColor: loading ? colors.primary.light : colors.primary.main }}
                            onPress={handleRegister}
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
                                    {t('register')}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="py-3 items-center mb-3"
                            onPress={navigateToLogin}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            <Text className="text-gray-600 text-sm">
                                {t('already-have-account') || 'Already have an account?'}{' '}
                                <Text className="font-bold" style={{ color: colors.primary.main }}>
                                    {t('login')}
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
                                {t('continue-as-guest')}
                            </Text>
                        </TouchableOpacity>

                        <View className="mt-6 items-center px-4">
                            <Text className="text-gray-500 text-xs text-center mb-2">
                                {t('by-continuing-you-agree')}
                            </Text>
                            <Text className="text-gray-500 text-xs text-center">
                                <Text
                                    className="text-xs font-semibold"
                                    style={{ color: colors.primary.main }}
                                    onPress={() => router.push('/privacy-policy' as any)}
                                >
                                    {t('privacy-policy') || 'Privacy Policy'}
                                </Text>
                                <Text className="text-gray-500 text-xs"> {t('and') || 'and'} </Text>
                                <Text
                                    className="text-xs font-semibold"
                                    style={{ color: colors.primary.main }}
                                    onPress={() => router.push('/terms-conditions' as any)}
                                >
                                    {t('terms-conditions') || 'Terms & Conditions'}
                                </Text>
                            </Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
