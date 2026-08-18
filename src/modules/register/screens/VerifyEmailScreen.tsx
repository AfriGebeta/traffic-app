import React, { useEffect, useRef, useState } from 'react';
import {
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import { showToast } from '../../../shared/utils/toast';
import { useEmailVerification } from '../hooks/useEmailVerification';
import { resolveAfterAuthRoute } from '../utils/profileGate';
import { FieldError, FormError } from '../components/FormError';
import { VERIFICATION_CODE_LENGTH, validateEmail } from '../utils/authValidation';

const EMPTY_CODE = Array(VERIFICATION_CODE_LENGTH).fill('');

export default function VerifyEmailScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const params = useLocalSearchParams<{
        userId?: string;
        email?: string;
        phoneNumber?: string;
        hasEmail?: string;
    }>();

    const paramUserId = typeof params.userId === 'string' ? params.userId : '';
    const knownEmail = typeof params.email === 'string' ? params.email : '';
    const phoneNumber = typeof params.phoneNumber === 'string' ? params.phoneNumber : '';
    const hasEmail = params.hasEmail !== '0';

    const [step, setStep] = useState<'email' | 'code'>(hasEmail ? 'code' : 'email');
    const [email, setEmail] = useState(knownEmail);
    const [userId, setUserId] = useState(paramUserId);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [digits, setDigits] = useState<string[]>(EMPTY_CODE);
    const [formError, setFormError] = useState<string | null>(null);
    const inputRefs = useRef<(TextInput | null)[]>([]);
    const submittedRef = useRef(false);

    const { verify, resend, submitEmail, startCooldown, verifying, resending, cooldown } =
        useEmailVerification();

    const code = digits.join('');

    useEffect(() => {
        if (!paramUserId && hasEmail) {
            router.replace('/register' as any);
            return;
        }

        if (hasEmail) {
            startCooldown();
        }
    }, [hasEmail, paramUserId, router, startCooldown]);

    const focusInput = (index: number) => {
        inputRefs.current[index]?.focus();
    };

    const submit = async (value: string) => {
        if (verifying || submittedRef.current) return;

        if (value.length !== VERIFICATION_CODE_LENGTH) {
            setFormError(t('error-enter-full-code'));
            return;
        }

        submittedRef.current = true;
        setFormError(null);

        const { data, error } = await verify(userId, value);

        if (data) {
            showToast(t('email-verified'));
            const route = await resolveAfterAuthRoute();
            router.replace(route as any);
            return;
        }

        submittedRef.current = false;
        setFormError(error);
        setDigits(EMPTY_CODE);
        focusInput(0);
    };

    const handleChange = (text: string, index: number) => {
        const clean = text.replace(/\D/g, '');
        setFormError(null);

        if (!clean) {
            setDigits((current) => {
                const next = [...current];
                next[index] = '';
                return next;
            });
            return;
        }

        const next = [...digits];

        clean.split('').forEach((char, offset) => {
            const target = index + offset;
            if (target < VERIFICATION_CODE_LENGTH) next[target] = char;
        });

        setDigits(next);

        const filledTo = Math.min(index + clean.length, VERIFICATION_CODE_LENGTH - 1);
        focusInput(filledTo);

        const joined = next.join('');
        if (joined.length === VERIFICATION_CODE_LENGTH) {
            inputRefs.current[filledTo]?.blur();
            submit(joined);
        }
    };

    const handleKeyPress = (key: string, index: number) => {
        if (key !== 'Backspace') return;
        if (digits[index]) return;
        if (index === 0) return;

        setDigits((current) => {
            const next = [...current];
            next[index - 1] = '';
            return next;
        });
        focusInput(index - 1);
    };

    const handleSendToEmail = async () => {
        setFormError(null);

        const emailIssue = validateEmail(t, email);
        setEmailError(emailIssue);

        if (emailIssue) return;

        const { userId: verifiedUserId, error } = await submitEmail(phoneNumber, email.trim());

        if (verifiedUserId) {
            setUserId(verifiedUserId);
            showToast(t('verification-code-sent'));
            setDigits(EMPTY_CODE);
            setStep('code');
            return;
        }

        setFormError(error);
    };

    const handleResend = async () => {
        const { sent, error } = await resend(userId);

        if (sent) {
            showToast(t('verification-code-sent'));
            setDigits(EMPTY_CODE);
            setFormError(null);
            focusInput(0);
            return;
        }

        if (error) setFormError(error);
    };

    return (
        <KeyboardAvoidingView className="flex-1 bg-white" behavior="padding" keyboardVerticalOffset={0}>
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
                            {t('verify-your-email')}
                        </Text>
                        {step === 'email' ? (
                            <Text className="text-base text-gray-600 text-center">
                                {t('add-email-to-verify')}
                            </Text>
                        ) : email ? (
                            <>
                                <Text className="text-base text-gray-600 text-center">
                                    {t('verification-code-sent-to')}
                                </Text>
                                <Text className="text-base font-bold text-gray-900 text-center mt-1">
                                    {email}
                                </Text>
                            </>
                        ) : (
                            <Text className="text-base text-gray-600 text-center">
                                {t('check-email-for-code')}
                            </Text>
                        )}
                        {step === 'code' && (
                            <Text className="text-sm text-gray-500 text-center mt-3">
                                {t('check-spam-folder')}
                            </Text>
                        )}
                    </View>

                    <FormError message={formError} />

                    {step === 'email' ? (
                        <>
                            <View className="mb-6">
                                <Text className="text-sm font-bold text-gray-900 mb-2">{t('email')}</Text>
                                <TextInput
                                    className="bg-gray-50 border rounded-xl px-4 py-3.5 text-base text-gray-900 font-semibold"
                                    style={{ borderColor: emailError ? colors.error.main : '#D1D5DB' }}
                                    placeholder={t('enter-your-email')}
                                    placeholderTextColor="#9CA3AF"
                                    value={email}
                                    onChangeText={(text) => {
                                        setEmail(text);
                                        setEmailError(null);
                                        setFormError(null);
                                    }}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    autoComplete="email"
                                    editable={!resending}
                                    autoFocus
                                />
                                <FieldError message={emailError} />
                            </View>

                            <TouchableOpacity
                                className="rounded-xl py-4 items-center mb-3"
                                style={{
                                    backgroundColor: resending ? colors.primary.light : colors.primary.main,
                                }}
                                onPress={handleSendToEmail}
                                disabled={resending}
                                activeOpacity={0.8}
                            >
                                {resending ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white text-base font-semibold px-4">
                                        {t('send-code')}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <View className="flex-row justify-between mb-6">
                                {digits.map((digit, index) => (
                                    <TextInput
                                        key={index}
                                        ref={(ref) => {
                                            inputRefs.current[index] = ref;
                                        }}
                                        className="bg-gray-50 border rounded-xl text-center text-xl text-gray-900 font-bold"
                                        style={{
                                            borderColor: formError ? colors.error.main : digit ? colors.primary.main : '#D1D5DB',
                                            width: 48,
                                            height: 56,
                                        }}
                                        value={digit}
                                        onChangeText={(text) => handleChange(text, index)}
                                        onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                                        keyboardType="number-pad"
                                        textContentType="oneTimeCode"
                                        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                                        maxLength={VERIFICATION_CODE_LENGTH}
                                        selectTextOnFocus
                                        editable={!verifying}
                                        autoFocus={index === 0}
                                    />
                                ))}
                            </View>

                            <TouchableOpacity
                                className="rounded-xl py-4 items-center mb-3"
                                style={{
                                    backgroundColor:
                                        verifying || code.length !== VERIFICATION_CODE_LENGTH
                                            ? colors.primary.light
                                            : colors.primary.main,
                                }}
                                onPress={() => submit(code)}
                                disabled={verifying || code.length !== VERIFICATION_CODE_LENGTH}
                                activeOpacity={0.8}
                            >
                                {verifying ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white text-base font-semibold px-4">{t('verify')}</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                className="py-3 items-center mb-3"
                                onPress={handleResend}
                                disabled={resending || cooldown > 0 || verifying}
                                activeOpacity={0.8}
                            >
                                {resending ? (
                                    <ActivityIndicator color={colors.primary.main} />
                                ) : (
                                    <Text className="text-gray-600 text-sm">
                                        {t('didnt-get-code')}{' '}
                                        <Text
                                            className="font-bold"
                                            style={{ color: cooldown > 0 ? '#9CA3AF' : colors.primary.main }}
                                        >
                                            {cooldown > 0
                                                ? `${t('resend-in')} ${cooldown}s`
                                                : t('resend-code')}
                                        </Text>
                                    </Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                className="py-3 items-center"
                                onPress={() => {
                                    if (hasEmail) {
                                        router.replace('/register' as any);
                                        return;
                                    }

                                    setStep('email');
                                    setDigits(EMPTY_CODE);
                                    setFormError(null);
                                }}
                                disabled={verifying}
                                activeOpacity={0.8}
                            >
                                <Text className="text-gray-600 text-sm">
                                    {t('wrong-email')}{' '}
                                    <Text className="font-bold" style={{ color: colors.primary.main }}>
                                        {hasEmail ? t('go-back') : t('change-email')}
                                    </Text>
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
