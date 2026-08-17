import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserRegistration } from '../hooks/useUserRegistration';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveAfterAuthRoute } from '../utils/profileGate';
import { FieldError, FormError } from '../components/FormError';
import { validateLocalPhone, validateName, validatePassword } from '../utils/authValidation';

const GUEST_MODE_KEY = '@traffic_app_guest_mode';

export default function RegistrationScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [nameError, setNameError] = useState<string | null>(null);
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const { register, loading } = useUserRegistration();

    const navigateToLogin = () => {
        router.replace('/login' as any);
    };

    const handleRegister = async () => {
        setFormError(null);

        const nameIssue = validateName(t, name);
        const phoneIssue = validateLocalPhone(t, phoneNumber);
        const passwordIssue = validatePassword(t, password);

        setNameError(nameIssue);
        setPhoneError(phoneIssue);
        setPasswordError(passwordIssue);

        if (nameIssue || phoneIssue || passwordIssue) {
            return;
        }

        const fullPhoneNumber = `+251${phoneNumber.trim()}`;
        const { data, error, code } = await register({
            phoneNumber: fullPhoneNumber,
            name: name.trim(),
            password: password.trim(),
        });

        if (data) {
            showToast(t('registration-successful') || 'Registration successful');
            const route = await resolveAfterAuthRoute();
            setTimeout(() => {
                router.replace(route as any);
            }, 1000);
            return;
        }

        if (code === 'ALREADY_REGISTERED') {
            setPhoneError(error);
            setTimeout(() => {
                showToast(t('redirecting-to-login') || 'Redirecting to login...');
                setTimeout(() => navigateToLogin(), 1500);
            }, 2000);
            return;
        }

        setFormError(error);
    };

    const handleGuestMode = async () => {
        await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
        showToast(t('entering-guest-mode') || 'Entering as guest');
        router.replace('/');
    };

    return (
        <KeyboardAvoidingView
            className="flex-1 bg-white"
            behavior="padding"
            keyboardVerticalOffset={0}
        >
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
            <View className="absolute top-12 right-6 z-50">
                <LanguageSwitcher />
            </View>

            <ScrollView
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: 20 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                showsVerticalScrollIndicator={false}
                bounces={false}
                alwaysBounceVertical={false}
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
                        <FormError message={formError} />

                        <View className="mb-4">
                            <Text className="text-sm font-bold text-gray-900 mb-2">
                                {t('name')}
                            </Text>
                            <TextInput
                                className="bg-gray-50 border rounded-xl px-4 py-3.5 text-base text-gray-900 font-semibold"
                                style={{ borderColor: nameError ? colors.error.main : '#D1D5DB' }}
                                placeholder={t('enter-your-name') || 'Enter your name'}
                                placeholderTextColor="#9CA3AF"
                                value={name}
                                onChangeText={(text) => {
                                    setName(text);
                                    setNameError(null);
                                    setFormError(null);
                                }}
                                autoCapitalize="words"
                                editable={!loading}
                            />
                            <FieldError message={nameError} />
                        </View>

                        <View className="mb-5">
                            <Text className="text-sm font-bold text-gray-900 mb-2">
                                {t('phone-number')}
                            </Text>
                            <View
                                className="flex-row items-center bg-gray-50 border rounded-xl"
                                style={{ borderColor: phoneError ? colors.error.main : '#D1D5DB' }}
                            >
                                <Text className="text-base font-semibold text-gray-900 pl-4">+251</Text>
                                <TextInput
                                    className="flex-1 px-2 py-3.5 text-base text-gray-900 font-semibold"
                                    placeholder="912345678"
                                    placeholderTextColor="#9CA3AF"
                                    value={phoneNumber}
                                    onChangeText={(text) => {
                                        setPhoneNumber(text.replace(/\D/g, ''));
                                        setPhoneError(null);
                                        setFormError(null);
                                    }}
                                    keyboardType="phone-pad"
                                    autoCapitalize="none"
                                    editable={!loading}
                                    maxLength={9}
                                />
                            </View>
                            <FieldError message={phoneError} />
                        </View>

                        <View className="mb-6">
                            <Text className="text-sm font-bold text-gray-900 mb-2">
                                {t('password')}
                            </Text>
                            <TextInput
                                className="bg-gray-50 border rounded-xl px-4 py-3.5 text-base text-gray-900 font-semibold"
                                style={{ borderColor: passwordError ? colors.error.main : '#D1D5DB' }}
                                placeholder={t('enter-your-password') || 'Enter your password'}
                                placeholderTextColor="#9CA3AF"
                                value={password}
                                onChangeText={(text) => {
                                    setPassword(text);
                                    setPasswordError(null);
                                    setFormError(null);
                                }}
                                secureTextEntry
                                autoCapitalize="none"
                                editable={!loading}
                            />
                            <FieldError message={passwordError} />
                            {!passwordError && (
                                <Text className="text-xs text-gray-500 mt-1.5 ml-1">
                                    {t('password-hint')}
                                </Text>
                            )}
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
