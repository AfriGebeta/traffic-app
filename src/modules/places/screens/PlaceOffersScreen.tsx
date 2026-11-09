import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { colors } from '../../../shared/theme/colors';
import { showToast } from '../../../shared/utils/toast';
import { ApiError } from '../../../shared/utils/apiErrors';
import { FONT_MEDIUM, FONT_SEMIBOLD, RADIUS, RADIUS_SM } from '../../campaigns/components/CampaignUi';
import { useAuthGate } from '../../register/hooks/useAuthGate';
import { businessService } from '../services/business.service';
import { pickLabel, usePlaceCatalog } from '../services/placeCatalog';
import { CatalogOption, PlaceOffers, PublicOffer } from '../types/business.types';
import { OfferBadge } from '../components/OfferBadge';

interface ActiveCode {
    offerId: string;
    code: string;
    expiresAt: number;
}

// offers at one live place; code offers: get a code, the cashier types the shop PIN on this phone
export default function PlaceOffersScreen() {
    const { t, i18n } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();
    const params = useLocalSearchParams();
    const placeId = String(params.id ?? '');
    const placeName = typeof params.name === 'string' ? params.name : '';
    const { catalog } = usePlaceCatalog();
    const { requireAuth } = useAuthGate();
    const lang = i18n.language;

    const [data, setData] = useState<PlaceOffers | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [requesting, setRequesting] = useState<string | null>(null);
    const [active, setActive] = useState<ActiveCode | null>(null);
    const [pin, setPin] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [confirmed, setConfirmed] = useState<string | null>(null);
    const [now, setNow] = useState(Date.now());

    const load = useCallback(async () => {
        try {
            setData(await businessService.placeOffers(placeId));
            setError(null);
        } catch (e) {
            setError(e instanceof ApiError && e.status === 404 ? t('offers-not-found') : t('could-not-load'));
        }
    }, [placeId, t]);

    useEffect(() => {
        void load();
    }, [load]);

    // countdown while a code is open
    useEffect(() => {
        if (!active) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [active]);
    const secondsLeft = active ? Math.max(0, Math.round((active.expiresAt - now) / 1000)) : 0;

    const optionLabel = (list: CatalogOption[] | undefined, key: string | null | undefined) =>
        key ? pickLabel(list?.find((o) => o.key === key)?.label, lang, key) : '';

    const getCode = async (offer: PublicOffer) => {
        if (!(await requireAuth())) return;
        setRequesting(offer.id);
        try {
            const result = await businessService.requestCode(placeId, offer.id);
            setActive({ offerId: offer.id, code: result.code, expiresAt: new Date(result.expiresAt).getTime() || Date.now() + 15 * 60 * 1000 });
            setPin('');
            setConfirmed(null);
            setNow(Date.now());
        } catch (e) {
            const status = e instanceof ApiError ? e.status : undefined;
            showToast(status === 409 ? t('offer-already-used') : status === 400 ? t('offer-not-available-now') : e instanceof Error ? e.message : t('could-not-load'));
        } finally {
            setRequesting(null);
        }
    };

    const confirm = async () => {
        if (!active || pin.length !== 4) return;
        setConfirming(true);
        try {
            const result = await businessService.confirmCode(placeId, active.code, pin);
            if (result.confirmed) {
                setConfirmed(result.offer?.text ?? '');
                setActive(null);
                setPin('');
            }
        } catch (e) {
            const status = e instanceof ApiError ? e.status : undefined;
            showToast(
                status === 400 ? t('wrong-pin-or-expired') : status === 409 ? t('code-already-used') : status === 429 ? t('too-many-pin-tries') : e instanceof Error ? e.message : t('could-not-confirm')
            );
        } finally {
            setConfirming(false);
        }
    };

    const options = catalog?.offerOptions;

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background, paddingTop: insets.top }}>
            <View className="px-4 pt-3 pb-2">
                <TouchableOpacity onPress={() => router.back()} className="self-start p-1 -ml-1" activeOpacity={0.7} hitSlop={8}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="mt-3" style={{ color: theme.textPrimary, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 }} numberOfLines={2}>
                    {placeName || t('offers')}
                </Text>
                {!!data?.month && (
                    <Text className="text-sm mt-1" style={{ color: theme.textSecondary }}>
                        {pickLabel(catalog?.trialMonths.find((m) => m.key === data.month)?.label, lang, data.month)}
                    </Text>
                )}
            </View>

            <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 24, gap: 12 }} keyboardShouldPersistTaps="handled">
                {!data && !error && <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />}
                {!!error && <Text className="text-sm text-center mt-6" style={{ color: theme.error }}>{error}</Text>}
                {data && data.offers.length === 0 && (
                    <Text className="text-sm text-center mt-6" style={{ color: theme.textSecondary }}>{t('no-offers-here')}</Text>
                )}

                {!!confirmed && (
                    <View className="p-4 flex-row items-center" style={{ borderRadius: RADIUS, backgroundColor: theme.greenMuted }}>
                        <Ionicons name="checkmark-circle" size={22} color={theme.green} />
                        <View className="ml-3 flex-1">
                            <Text style={{ color: theme.green, fontFamily: FONT_SEMIBOLD, fontSize: 15 }}>{t('offer-confirmed')}</Text>
                            {!!confirmed && <Text className="text-sm mt-0.5" style={{ color: theme.textPrimary }}>{confirmed}</Text>}
                        </View>
                    </View>
                )}

                {data?.offers.map((offer) => {
                    const isCode = offer.redeem === 'code-with-pin';
                    const open = active?.offerId === offer.id;
                    return (
                        <View key={offer.id} className="p-4" style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: open ? theme.primary : theme.border, backgroundColor: theme.surface }}>
                            <View className="flex-row items-center gap-2">
                                <OfferBadge badge={offer.badge} />
                                {offer.audience === 'students' && <Text className="text-xs" style={{ color: theme.textSecondary }}>{optionLabel(options?.audience, offer.audience)}</Text>}
                            </View>
                            <Text className="mt-2" style={{ color: theme.textPrimary, fontFamily: FONT_SEMIBOLD, fontSize: 17 }}>{offer.text}</Text>
                            <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                                {[optionLabel(options?.days, offer.days), optionLabel(options?.time, offer.time), optionLabel(options?.limit, offer.limit)].filter(Boolean).join(' · ')}
                            </Text>

                            {!offer.availableNow && (
                                <Text className="text-xs mt-2" style={{ color: theme.error }}>{t('offer-not-available-now')}</Text>
                            )}

                            {offer.type !== 'announce' && offer.availableNow && !isCode && (
                                <Text className="text-sm mt-3" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{t('show-this-screen')}</Text>
                            )}

                            {isCode && offer.availableNow && !open && (
                                <TouchableOpacity
                                    onPress={() => void getCode(offer)}
                                    disabled={requesting === offer.id}
                                    className="mt-3 flex-row items-center justify-center"
                                    style={{ height: 44, borderRadius: RADIUS_SM, backgroundColor: theme.primary, opacity: requesting === offer.id ? 0.6 : 1 }}
                                >
                                    {requesting === offer.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 15 }}>{t('get-code')}</Text>}
                                </TouchableOpacity>
                            )}

                            {open && active && (
                                <View className="mt-4 items-center">
                                    <Text className="text-xs" style={{ color: theme.textSecondary }}>{t('your-code')}</Text>
                                    <Text style={{ color: theme.textPrimary, fontFamily: FONT_SEMIBOLD, fontSize: 34, letterSpacing: 6, marginTop: 2 }}>{active.code}</Text>
                                    <Text className="text-xs" style={{ color: secondsLeft > 0 ? theme.textSecondary : theme.error, fontVariant: ['tabular-nums'] }}>
                                        {secondsLeft > 0
                                            ? t('code-expires-in', { time: `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}` })
                                            : t('code-expired')}
                                    </Text>

                                    <Text className="text-sm mt-4 text-center" style={{ color: theme.textPrimary }}>{t('cashier-enters-pin')}</Text>
                                    <View className="flex-row items-center gap-2 mt-2 self-stretch">
                                        <TextInput
                                            style={{
                                                flex: 1,
                                                minHeight: 48,
                                                borderRadius: RADIUS_SM,
                                                borderWidth: 1,
                                                borderColor: theme.border,
                                                backgroundColor: isDark ? theme.background : colors.gray[50],
                                                color: theme.textPrimary,
                                                fontSize: 22,
                                                letterSpacing: 8,
                                                textAlign: 'center',
                                            }}
                                            value={pin}
                                            onChangeText={(text) => setPin(text.replace(/\D/g, '').slice(0, 4))}
                                            keyboardType="number-pad"
                                            secureTextEntry
                                            maxLength={4}
                                            placeholder="••••"
                                            placeholderTextColor={theme.textSecondary}
                                        />
                                        <TouchableOpacity
                                            onPress={() => void confirm()}
                                            disabled={pin.length !== 4 || confirming || secondsLeft === 0}
                                            className="items-center justify-center px-5"
                                            style={{ height: 48, borderRadius: RADIUS_SM, backgroundColor: theme.primary, opacity: pin.length === 4 && secondsLeft > 0 ? 1 : 0.5 }}
                                        >
                                            {confirming ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 15 }}>{t('confirm')}</Text>}
                                        </TouchableOpacity>
                                    </View>
                                    {secondsLeft === 0 && (
                                        <TouchableOpacity onPress={() => void getCode(offer)} className="mt-3" hitSlop={6}>
                                            <Text className="text-sm" style={{ color: theme.primary, fontFamily: FONT_MEDIUM }}>{t('get-new-code')}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}
