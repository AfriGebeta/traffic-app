import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, BackHandler, Easing, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { ApiError } from '../../../shared/utils/apiErrors';
import { FONT_MEDIUM, RADIUS, RADIUS_SM } from '../../campaigns/components/CampaignUi';
import { userService } from '../../register/services/user.service';
import { businessService } from '../services/business.service';
import { LoyaltyVisit } from '../types/business.types';

const INK = '#16181D';

const str = (value: unknown) => (typeof value === 'string' ? value : '');
const parseLoyalty = (raw: string): LoyaltyVisit | null => {
    try {
        return raw ? (JSON.parse(raw) as LoyaltyVisit) : null;
    } catch {
        return null;
    }
};

function MovingStripe() {
    const shift = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const loop = Animated.loop(Animated.timing(shift, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true }));
        loop.start();
        return () => loop.stop();
    }, [shift]);
    const translateX = shift.interpolate({ inputRange: [0, 1], outputRange: [0, 24] });
    return (
        <View style={{ height: 18, overflow: 'hidden', borderRadius: 4 }}>
            <Animated.View style={{ flexDirection: 'row', marginLeft: -24, transform: [{ translateX }] }}>
                {Array.from({ length: 30 }, (_, i) => (
                    <View key={i} style={{ width: 12, height: 18, marginRight: 12, backgroundColor: INK }} />
                ))}
            </Animated.View>
        </View>
    );
}

function LiveClock() {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
        <Text style={{ color: INK, fontFamily: FONT_MEDIUM, fontSize: 34, fontVariant: ['tabular-nums'] }}>
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

            <View className="mx-4 p-5 gap-3" style={{ borderRadius: RADIUS, backgroundColor: theme.primary }}>
                <Text style={{ color: INK, fontFamily: FONT_MEDIUM, fontSize: 15 }} numberOfLines={1}>{placeName}</Text>
                <Text style={{ color: INK, fontFamily: FONT_MEDIUM, fontSize: 26, lineHeight: 31 }}>{offerText}</Text>
                {studentsOnly && (
                    <Text style={{ color: INK, fontFamily: FONT_MEDIUM, fontSize: 14 }}>
                        {studentName ? t('verified-student-name', { name: studentName }) : t('verified-student')}
                    </Text>
                )}
                {!!loyalty && (
                    <Text style={{ color: INK, fontFamily: FONT_MEDIUM, fontSize: loyalty.isReward ? 20 : 14 }}>
                        {loyalty.isReward ? t('loyalty-reward-now', { reward: loyalty.reward }) : t('loyalty-visit', { visit: loyalty.visit, every: loyalty.every })}
                    </Text>
                )}
                <MovingStripe />
                <View className="flex-row items-baseline justify-between">
                    <LiveClock />
                    <Text style={{ color: INK, fontFamily: FONT_MEDIUM, fontSize: 13 }}>{t('today')}</Text>
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
