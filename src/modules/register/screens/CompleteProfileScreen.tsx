import React, { useEffect, useState } from 'react';
import {
    BackHandler,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import { showToast } from '../../../shared/utils/toast';
import { userService } from '../services/user.service';
import { UpdateProfileRequest } from '../types/user.types';
import {
    getMissingProfileFields,
    getStoredUser,
    isProfileComplete,
    storeProfileUpdates,
    type MissingProfileFields,
} from '../utils/profileGate';
import { getPostAuthRoute } from '../../places/utils/homeOnboarding';
import { FieldError, FormError } from '../components/FormError';
import { GenderSelect } from '../components/GenderSelect';
import { toFullPhone, validateLocalPhone } from '../utils/authValidation';
import { toFriendlyAuthError } from '../utils/authErrors';

export default function CompleteProfileScreen() {
    const { t } = useTranslation();
    const router = useRouter();

    const [missing, setMissing] = useState<MissingProfileFields | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [sex, setSex] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [sexError, setSexError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        getStoredUser().then((user) => {
            if (cancelled) return;

            if (!user?.id) {
                router.replace('/telegram-login');
                return;
            }

            setUserId(user.id);
            setMissing(getMissingProfileFields(user));
        });

        return () => {
            cancelled = true;
        };
    }, [router]);

    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
        return () => subscription.remove();
    }, []);

    const continueToApp = async () => {
        const route = await getPostAuthRoute();
        router.replace(route as any);
    };

    const handleSubmit = async () => {
        if (!missing || !userId) return;

        setFormError(null);

        const phoneIssue = missing.phone ? validateLocalPhone(t, phoneNumber) : null;
        const sexIssue = missing.sex && sex === null ? t('error-select-gender') : null;

        setPhoneError(phoneIssue);
        setSexError(sexIssue);

        if (phoneIssue || sexIssue) return;

        const updates: UpdateProfileRequest = {};
        if (missing.phone) updates.phoneNumber = toFullPhone(phoneNumber);
        if (missing.sex && sex !== null) updates.sex = Number(sex);

        setLoading(true);

        try {
            const response = await userService.updateProfile(userId, updates);

            if (response.error) {
                const { code, message } = toFriendlyAuthError(t, 'profile', response.error, response.status);

                if (code === 'ALREADY_REGISTERED' && updates.phoneNumber) {
                    setPhoneError(message);
                } else {
                    setFormError(message);
                }
                return;
            }

            await storeProfileUpdates(updates);
            showToast(t('profile-updated') || 'Saved');
            await continueToApp();
        } catch (error) {
            setFormError(
                toFriendlyAuthError(t, 'profile', error instanceof Error ? error.message : undefined).message
            );
        } finally {
            setLoading(false);
        }
    };

    if (!missing) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color={colors.primary.main} />
            </View>
        );
    }

    if (isProfileComplete(missing)) {
        void continueToApp();
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color={colors.primary.main} />
            </View>
        );
    }

    const subtitle = missing.phone
        ? t('complete-profile-phone-and-gender')
        : t('complete-profile-gender-only');

    return (
        <KeyboardAvoidingView
            className="flex-1 bg-white"
            behavior="padding"
            keyboardVerticalOffset={0}
        >
            <Stack.Screen options={{ gestureEnabled: false, headerBackVisible: false }} />
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

            <ScrollView
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: 20 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                showsVerticalScrollIndicator={false}
                bounces={false}
                alwaysBounceVertical={false}
            >
                <View className="px-6 py-8">
                    <View className="items-center mb-8">
                        <Image
                            source={require('../../../../assets/images/favicon.png')}
                            className="w-24 h-24"
                            resizeMode="contain"
                        />
                    </View>

                    <View className="mb-8">
                        <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
                            {t('complete-your-profile')}
                        </Text>
                        <Text className="text-base text-gray-600 text-center">{subtitle}</Text>
                    </View>

                    <FormError message={formError} />

                    {missing.phone && (
                        <View className="mb-5">
                            <Text className="text-sm font-bold text-gray-900 mb-2">{t('phone-number')}</Text>
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
                                    autoFocus
                                />
                            </View>
                            <FieldError message={phoneError} />
                        </View>
                    )}

                    {missing.sex && (
                        <View className="mb-6">
                            <Text className="text-sm font-bold text-gray-900 mb-2">{t('gender')}</Text>
                            <GenderSelect
                                value={sex}
                                onChange={(value) => {
                                    setSex(value);
                                    setSexError(null);
                                    setFormError(null);
                                }}
                                maleLabel={t('male')}
                                femaleLabel={t('female')}
                                disabled={loading}
                                hasError={Boolean(sexError)}
                            />
                            <FieldError message={sexError} />
                        </View>
                    )}

                    <TouchableOpacity
                        className="rounded-xl py-4 items-center"
                        style={{ backgroundColor: loading ? colors.primary.light : colors.primary.main }}
                        onPress={handleSubmit}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white text-base font-semibold px-4">{t('continue')}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
