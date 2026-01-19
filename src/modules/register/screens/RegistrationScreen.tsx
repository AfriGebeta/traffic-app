import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserRegistration } from '../hooks/useUserRegistration';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from 'react-i18next';
import * as Device from 'expo-device';
import { colors } from '../../../shared/theme/colors';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_MODE_KEY = '@traffic_app_guest_mode';

export default function RegistrationScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [name, setName] = useState('');
    const { register, loading } = useUserRegistration();

    const handleRegister = async () => {
        if (!phoneNumber.trim()) {
            showToast.error(t('phone-number-required') || 'Phone number is required');
            return;
        }

        if (!name.trim()) {
            showToast.error(t('name-required') || 'Name is required');
            return;
        }

        const deviceId = Device.modelId || Device.osInternalBuildId || 'unknown-device';
        const fullPhoneNumber = `+251${phoneNumber.trim()}`;
        const result = await register({ phoneNumber: fullPhoneNumber, name: name.trim(), deviceId });

        if (result) {
            showToast.success(t('registration-successful') || 'Registration successful');
            setTimeout(() => {
                router.replace('/');
            }, 1000);
        }
    };

    const handleGuestMode = async () => {
        await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
        showToast.success(t('entering-guest-mode') || 'Entering as guest');
        router.replace('/');
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-white"
        >
            <View className="absolute top-12 right-6 z-50">
                <LanguageSwitcher />
            </View>

            <ScrollView
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
                keyboardShouldPersistTaps="handled"
            >
                <View className="flex-1 px-6 py-8 justify-center">
                    <View className="items-center mb-8">
                        <Image
                            source={require('../../../../assets/images/favicon.png')}
                            className="w-28 h-28"
                            resizeMode="contain"
                        />
                    </View>

                    <View className="mb-8">
                        <Text className="text-3xl font-bold text-gray-900 mb-2 text-center">
                            {t('welcome') || 'Welcome'}
                        </Text>
                        <Text className="text-base text-gray-600 text-center">
                            {t('register-to-continue') || 'Register to continue'}
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
                                    {t('register') || 'Register'}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <View className='items-center  mb-2'>
                            <Text>{t('or')}</Text>
                        </View>

                        <TouchableOpacity
                            className="rounded-xl py-4 items-center border border-gray-300"
                            onPress={handleGuestMode}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            <Text className="text-gray-700 text-base font-semibold text-center px-4" numberOfLines={2}>
                                {t('continue-as-guest') || 'Continue as Guest'}
                            </Text>
                        </TouchableOpacity>
                    </View>


                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
