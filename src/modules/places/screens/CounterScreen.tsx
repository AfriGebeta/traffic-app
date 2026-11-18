import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, BackHandler, Easing, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { ApiError } from '../../../shared/utils/apiErrors';
import { FONT_MEDIUM, RADIUS, RADIUS_SM, tint } from '../../campaigns/components/CampaignUi';
import { userService } from '../../register/services/user.service';
import { businessService } from '../services/business.service';
import { LoyaltyVisit } from '../types/business.types';

const str = (value: unknown) => (typeof value === 'string' ? value : '');
const parseLoyalty = (raw: string): LoyaltyVisit | null => {
    try {
        return raw ? (JSON.parse(raw) as LoyaltyVisit) : null;
    } catch {
        return null;
    }
};

function LiveDot({ color }: { color: string }) {
    const pulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 0.25, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);
    return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: pulse }} />;
}

function LiveClock({ color }: { color: string }) {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
        <Text style={{ color, fontFamily: FONT_MEDIUM, fontSize: 30, fontVariant: ['tabular-nums'] }}>
            {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
        </Text>
    );
}

export default function CounterScreen() {
    useKeepAwake();
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();
    const params = useLocalSearchParams();
    const mode = str(params.mode) === 'code' ? 'code' : 'screen';
    const placeId = str(params.placeId);
    const placeName = str(params.placeName);
    const offerText = str(params.offerText);
    const code = str(params.code);
    const studentsOnly = str(params.studentsOnly) === '1';
    const until = new Date(str(params.until)).getTime();
    const [loyalty, setLoyalty] = useState<LoyaltyVisit | null>(() => parseLoyalty(str(params.loyalty)));
    const [studentName, setStudentName] = useState('');
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [now, setNow] = useState(Date.now());
    const finished = useRef(false);

    useEffect(() => {
        if (!studentsOnly) return;
        let cancelled = false;
        userService
            .getProfile()
            .then((response) => {
                const user = (response.data as any)?.user ?? response.data;
                const name = String(user?.name ?? '').trim();
                if (!cancelled && name) setStudentName(name);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [studentsOnly]);

    const finish = (nextLoyalty: LoyaltyVisit | null = loyalty) => {
        if (finished.current) return;
        finished.current = true;
        router.replace({
            pathname: '/places/offer-done',
            params: { placeId, placeName, code, ...(nextLoyalty && { loyalty: JSON.stringify(nextLoyalty) }) },
        } as any);
    };

    useEffect(() => {
        if (mode !== 'screen') return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            finish();
            return true;
        });
        return () => sub.remove();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    useEffect(() => {
        if (Number.isNaN(until)) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [until]);
    const secondsLeft = Number.isNaN(until) ? null : Math.max(0, Math.round((until - now) / 1000));
    useEffect(() => {
        if (mode === 'screen' && secondsLeft === 0) finish();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, secondsLeft]);
    const timeLeft = secondsLeft === null ? '' : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
    const codeExpired = mode === 'code' && secondsLeft === 0;

    const confirm = async () => {
        if (pin.length !== 4 || confirming || codeExpired) return;
        setConfirming(true);
        setPinError('');
        try {
            const result = await businessService.confirmCode(placeId, code, pin);
            if (result.confirmed) {
                const visit = result.loyalty ?? null;
                setLoyalty(visit);
                finish(visit);
            } else {
                setPinError(t('wrong-pin-or-expired'));
            }
        } catch (e) {
            const status = e instanceof ApiError ? e.status : undefined;
            setPinError(
                status === 400 ? t('wrong-pin-or-expired') : status === 409 ? t('code-already-used') : status === 429 ? t('too-many-pin-tries') : t('could-not-confirm')
            );
            setPin('');
        } finally {
            setConfirming(false);
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom + 12 }}>
            <View className="flex-row items-center justify-between px-4 py-3">
                <TouchableOpacity
                    // closing a show-the-screen use still counts it; the feedback step comes next
                    onPress={() => (mode === 'screen' ? finish() : router.back())}
                    activeOpacity={0.7}
                    className="px-4 justify-center"
                    style={{ height: 40, borderRadius: RADIUS_SM, borderWidth: 1, borderColor: theme.border }}
                >
                    <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{t('close')}</Text>
                </TouchableOpacity>
                <Text className="text-sm flex-shrink ml-3" style={{ color: theme.textSecondary }} numberOfLines={1}>
                    {t(mode === 'code' ? 'counter-hand-phone' : 'counter-turn-screen')}
                </Text>
            </View>

            <View className="mx-4 p-5" style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
                <Text className="text-sm" style={{ color: theme.textSecondary }} numberOfLines={1}>{placeName}</Text>
                <Text className="mt-1" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 26, lineHeight: 32 }}>{offerText}</Text>
                {studentsOnly && (
                    <View className="flex-row items-center mt-3">
                        <Ionicons name="shield-checkmark" size={16} color={theme.green} />
                        <Text className="ml-1.5 text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>
                            {studentName ? t('verified-student-name', { name: studentName }) : t('verified-student')}
                        </Text>
                    </View>
                )}
                {!!loyalty && (
                    <View className="self-start mt-3 px-2 py-1" style={{ borderRadius: RADIUS_SM, backgroundColor: tint(theme.primary, '24') }}>
                        <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: loyalty.isReward ? 16 : 13 }}>
                            {loyalty.isReward ? t('loyalty-reward-now', { reward: loyalty.reward }) : t('loyalty-visit', { visit: loyalty.visit, every: loyalty.every })}
                        </Text>
                    </View>
                )}
                {mode === 'screen' && !!code && (
                    <View className="flex-row items-baseline mt-3">
                        <Text className="text-sm" style={{ color: theme.textSecondary }}>{t('your-code')}</Text>
                        <Text className="ml-2" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 15, letterSpacing: 2 }} selectable>
                            {code}
                        </Text>
                    </View>
                )}
                <View className="mt-4 pt-4 flex-row items-center justify-between" style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
                    <View className="flex-row items-center">
                        <LiveDot color={theme.green} />
                        <Text className="ml-2 text-sm" style={{ color: theme.green, fontFamily: FONT_MEDIUM }}>{t('counter-live')}</Text>
                        <Text className="ml-2 text-sm" style={{ color: theme.textSecondary }}>· {t('today')}</Text>
                    </View>
                    <LiveClock color={theme.textPrimary} />
                </View>
            </View>

            {mode === 'screen' ? (
                <View className="mx-4 mt-4 gap-3">
                    <Text className="text-sm text-center" style={{ color: theme.textSecondary }}>{t('counter-not-screenshot')}</Text>
                    <TouchableOpacity
                        onPress={() => finish()}
                        activeOpacity={0.8}
                        className="items-center justify-center"
                        style={{ height: 48, borderRadius: RADIUS, backgroundColor: theme.primary }}
                    >
                        <Text style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 15 }}>{t('counter-got-offer')}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View className="mx-4 mt-4 p-4 gap-2" style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
                    <View className="flex-row items-baseline justify-between">
                        <Text className="text-xs" style={{ color: theme.textSecondary }}>{t('your-code')}</Text>
                        {!!timeLeft && (
                            <Text className="text-xs" style={{ color: codeExpired ? theme.error : theme.textSecondary, fontVariant: ['tabular-nums'] }}>
                                {codeExpired ? t('code-expired') : t('code-expires-in', { time: timeLeft })}
                            </Text>
                        )}
                    </View>
                    <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 30, letterSpacing: 4 }} selectable>{code}</Text>
                    <Text className="text-sm mt-2" style={{ color: theme.textSecondary }}>{t('cashier-pin-label')}</Text>
                    <TextInput
                        value={pin}
                        onChangeText={(text) => {
                            setPin(text.replace(/\D/g, '').slice(0, 4));
                            setPinError('');
                        }}
                        keyboardType="number-pad"
                        secureTextEntry
                        maxLength={4}
                        editable={!codeExpired}
                        accessibilityLabel={t('cashier-pin-label')}
                        style={{
                            height: 52,
                            borderRadius: RADIUS_SM,
                            borderWidth: 1,
                            borderColor: pinError ? theme.error : theme.border,
                            backgroundColor: theme.background,
                            color: theme.textPrimary,
                            fontSize: 24,
                            letterSpacing: 12,
                            paddingHorizontal: 16,
                        }}
                    />
                    {!!pinError && <Text className="text-sm" style={{ color: theme.error }}>{pinError}</Text>}
                    <TouchableOpacity
                        onPress={() => (codeExpired ? router.back() : void confirm())}
                        disabled={!codeExpired && (pin.length !== 4 || confirming)}
                        activeOpacity={0.8}
                        className="items-center justify-center mt-1"
                        style={{ height: 48, borderRadius: RADIUS, backgroundColor: theme.primary, opacity: !codeExpired && (pin.length !== 4 || confirming) ? 0.5 : 1 }}
                    >
                        {confirming ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 15 }}>{t(codeExpired ? 'get-new-code' : 'confirm-with-pin')}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}
