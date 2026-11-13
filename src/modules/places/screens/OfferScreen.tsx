import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, NativeScrollEvent, NativeSyntheticEvent, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { trackEngagement } from '../../../shared/services/engagement.service';
import { getAccessToken } from '../../../shared/services/auth-session';
import { showToast } from '../../../shared/utils/toast';
import { ApiError, ApiErrorCode } from '../../../shared/utils/apiErrors';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { useAuthGate } from '../../register/hooks/useAuthGate';
import { businessService } from '../services/business.service';
import { refreshStudentCheck, useStudentCheck } from '../hooks/useStudentCheck';
import { SelectField } from '../components/FormControls';
import { FONT_MEDIUM, FONT_SEMIBOLD, RADIUS, RADIUS_SM, tint } from '../../campaigns/components/CampaignUi';
import { featuredOffer, useBusinessPlace } from '../hooks/useBusinessPlace';
import { pickLabel, usePlaceCatalog } from '../services/placeCatalog';
import { CatalogOption, PublicOffer } from '../types/business.types';
import { shortDate } from '../components/BusinessCardSections';

const optionLabel = (list: CatalogOption[] | undefined, key: string | null | undefined, lang: string) =>
    key ? pickLabel(list?.find((o) => o.key === key)?.label, lang, key) : '';

function Fact({ label, value }: { label: string; value: string }) {
    const { colors: theme } = useTheme();
    return (
        <View className="flex-1 p-3" style={{ borderRadius: RADIUS_SM, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
            <Text className="text-xs" style={{ color: theme.textSecondary }}>{label}</Text>
            <Text className="mt-0.5" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 14 }}>{value || '–'}</Text>
        </View>
    );
}

export default function OfferScreen() {
    const { t, i18n } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();
    const lang = i18n.language;
    const params = useLocalSearchParams();
    const placeId = typeof params.placeId === 'string' ? params.placeId : null;
    const placeName = typeof params.name === 'string' ? params.name : '';
    const { catalog } = usePlaceCatalog();
    const business = useBusinessPlace(placeId);
    const { requireAuth } = useAuthGate();
    const student = useStudentCheck();
    const [busy, setBusy] = useState(false);
    const [confirmUse, setConfirmUse] = useState(false);
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
    const [selectedId, setSelectedId] = useState<string | null>(typeof params.offerId === 'string' ? params.offerId : null);

    const offer: PublicOffer | undefined = business.offers.find((o) => o.id === selectedId) ?? featuredOffer(business.offers) ?? undefined;
    const others = business.offers.filter((o) => o.id !== offer?.id);
    const options = catalog?.offerOptions;
    const photos = business.photos;
    const { width } = useWindowDimensions();
    const [photoIndex, setPhotoIndex] = useState(0);
    const onPhotoScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const page = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width));
        if (page !== photoIndex) setPhotoIndex(page);
    };
    const address = [business.place?.business?.landmark, business.place?.formattedAddress].filter(Boolean).join(', ');

    const viewed = useRef(new Set<string>());
    useEffect(() => {
        if (!placeId || !offer || viewed.current.has(offer.id)) return;
        viewed.current.add(offer.id);
        trackEngagement(placeId, 'offer_viewed', offer.id);
    }, [placeId, offer]);

    const usable = !!offer && offer.availableNow && offer.type !== 'announce';
    const needsCheck = !!offer?.studentsOnly && !student.verified;
    const saved = !!offer && savedIds.has(offer.id);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            if (!(await getAccessToken())) return;
            const rows = await businessService.savedOffers().catch(() => null);
            if (!cancelled && rows) setSavedIds(new Set(rows.map((row) => row.offerId)));
        })();
        return () => {
            cancelled = true;
        };
    }, [placeId]);

    const openCheck = () => void requireAuth(() => router.push('/student-check' as any));

    const counterParams = (extra: Record<string, string>) => ({
        placeId: placeId ?? '',
        placeName: placeName || pickLabel(business.place?.name as any, lang, ''),
        offerText: offer?.text ?? '',
        ...(offer?.studentsOnly && { studentsOnly: '1' }),
        ...extra,
    });

    const failed = (e: unknown) => {
        const status = e instanceof ApiError ? e.status : undefined;
        if (status === 403 && (e as ApiError).code === ApiErrorCode.Forbidden) {
            // the server says not a verified student: refresh what we know and open the check
            void refreshStudentCheck();
            showToast(t('verify-to-use-toast'));
            openCheck();
            return;
        }
        if (status === 409) showToast(t('offer-already-used'));
        else showToast(e instanceof Error && e.message ? e.message : t('could-not-load'));
    };

    // show-the-screen: counts as a use the moment it's called, so it waits for the "at the counter" confirm
    const redeemNow = async () => {
        if (!offer || !placeId || busy) return;
        setConfirmUse(false);
        setBusy(true);
        try {
            const use = await businessService.useOffer(placeId, offer.id);
            router.push({
                pathname: '/places/counter',
                params: counterParams({ mode: 'screen', code: use.code, until: use.showUntil, ...(use.loyalty && { loyalty: JSON.stringify(use.loyalty) }) }),
            } as any);
        } catch (e) {
            failed(e);
        } finally {
            setBusy(false);
        }
    };

    const getCode = async () => {
        if (!offer || !placeId || busy) return;
        setBusy(true);
        try {
            const result = await businessService.requestCode(placeId, offer.id);
            router.push({ pathname: '/places/counter', params: counterParams({ mode: 'code', code: result.code, until: result.expiresAt }) } as any);
        } catch (e) {
            failed(e);
        } finally {
            setBusy(false);
        }
    };

    const onPrimary = () =>
        void requireAuth(() => {
            if (!offer) return;
            if (needsCheck) return openCheck();
            if (offer.redeem === 'code-with-pin') return void getCode();
            setConfirmUse(true);
        });

    const toggleSave = () =>
        void requireAuth(async () => {
            if (!offer || !placeId) return;
            const next = !saved;
            try {
                const result = await businessService.setOfferSaved(placeId, offer.id, next);
                setSavedIds((prev) => {
                    const copy = new Set(prev);
                    if (result) copy.add(offer.id);
                    else copy.delete(offer.id);
                    return copy;
                });
                showToast(t(result ? 'offer-saved' : 'offer-unsaved'));
            } catch {
                showToast(t('could-not-update'));
            }
        });

    const reminderTimes = (() => {
        const now = new Date();
        const minutesNow = now.getHours() * 60 + now.getMinutes() + 10;
        return ['12:00', '13:00', '17:00', '18:00', '19:00'].filter((time) => {
            const [h, m] = time.split(':').map(Number);
            return h * 60 + m >= minutesNow;
        });
    })();

    const remind = (at: string | null) => {
        if (!at) return;
        void requireAuth(async () => {
            if (!offer || !placeId) return;
            try {
                await businessService.remindOffer(placeId, offer.id, at);
                showToast(t('reminder-set', { time: at }));
            } catch (e) {
                showToast(e instanceof Error && e.message ? e.message : t('could-not-update'));
            }
        });
    };
    const hasFooter = !!offer && offer.type !== 'announce';
    const kindLabel = offer ? pickLabel(options?.types.find((ty) => ty.key === offer.type)?.label, lang, offer.badge) : '';
    const when = offer ? [optionLabel(options?.days, offer.days, lang), optionLabel(options?.time, offer.time, lang)].filter(Boolean).join(', ') : '';

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <ScrollView contentContainerStyle={{ paddingBottom: hasFooter ? 24 : insets.bottom + 24 }}>
                <View style={{ height: 210 + insets.top, backgroundColor: theme.surface }}>
                    {photos.length > 0 && (
                        // swipe through the business's photos; one photo looks like a plain header
                        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onPhotoScroll} bounces={false}>
                            {photos.map((uri, index) => (
                                <Image key={`${index}-${uri}`} source={{ uri }} style={{ width, height: 210 + insets.top }} resizeMode="cover" />
                            ))}
                        </ScrollView>
                    )}
                    {photos.length > 1 && (
                        <View className="absolute flex-row self-center gap-1.5 px-2 py-1" style={{ bottom: 10, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.35)' }} pointerEvents="none">
                            {photos.map((uri, index) => (
                                <View key={`${index}-${uri}`} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: index === photoIndex ? '#fff' : 'rgba(255,255,255,0.5)' }} />
                            ))}
                        </View>
                    )}
                    <TouchableOpacity
                        onPress={() => router.back()}
                        hitSlop={8}
                        className="absolute items-center justify-center"
                        style={{ top: insets.top + 12, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }}
                        accessibilityLabel={t('back')}
                    >
                        <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
                    </TouchableOpacity>
                </View>

                {!business.loaded && <ActivityIndicator color={theme.primary} style={{ marginTop: 32 }} />}
                {business.loaded && !offer && (
                    <Text className="text-sm text-center mt-8 px-6" style={{ color: theme.textSecondary }}>{t('no-offers-here')}</Text>
                )}

                {!!offer && (
                    <View className="px-4 pt-4 gap-3">
                        <View className="flex-row gap-1.5">
                            <View className="px-2 py-0.5" style={{ borderRadius: 4, backgroundColor: tint(theme.primary, '26') }}>
                                <Text style={{ color: theme.textPrimary, fontSize: 11, fontFamily: FONT_MEDIUM }}>{kindLabel}</Text>
                            </View>
                            <View className="px-2 py-0.5" style={{ borderRadius: 4, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                                <Text style={{ color: theme.textSecondary, fontSize: 11, fontFamily: FONT_MEDIUM }}>
                                    {t(offer.studentsOnly ? 'students-only' : 'everyone')}
                                </Text>
                            </View>
                        </View>

                        <Text style={{ color: theme.textPrimary, fontFamily: FONT_SEMIBOLD, fontSize: 24, lineHeight: 29, letterSpacing: -0.4 }}>{offer.text}</Text>
                        <Text className="text-sm" style={{ color: theme.textSecondary }}>
                            {[placeName || pickLabel(business.place?.name as any, lang, ''), address].filter(Boolean).join(' · ')}
                        </Text>

                        <View className="flex-row gap-2">
                            <Fact label={t('offer-when')} value={when} />
                            <Fact label={t('offer-limit')} value={optionLabel(options?.limit, offer.limit, lang)} />
                        </View>
                        <View className="flex-row gap-2">
                            <Fact label={t('offer-ends')} value={shortDate(offer.endsOn, lang)} />
                            <Fact label={t('offer-claim-by')} value={optionLabel(options?.redeem, offer.redeem, lang)} />
                        </View>

                        {!!offer.loyalty && (
                            <View className="p-3" style={{ borderRadius: RADIUS_SM, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
                                <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 14 }}>
                                    {offer.loyalty.nextIsReward ? t('loyalty-next-free') : t('loyalty-progress', { stamps: offer.loyalty.stamps, every: offer.loyalty.every })}
                                </Text>
                                <View className="flex-row flex-wrap gap-1.5 mt-2">
                                    {Array.from({ length: offer.loyalty.every }, (_, i) => (
                                        <View
                                            key={i}
                                            style={{
                                                width: 22,
                                                height: 22,
                                                borderRadius: 11,
                                                borderWidth: 1,
                                                borderColor: i < offer.loyalty!.stamps ? theme.primary : theme.border,
                                                backgroundColor: i < offer.loyalty!.stamps ? theme.primary : 'transparent',
                                            }}
                                        />
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* verified students don't need the reminder; everyone else gets a way in */}
                        {needsCheck && (
                            <TouchableOpacity
                                onPress={openCheck}
                                activeOpacity={0.7}
                                className="flex-row items-center p-3"
                                style={{ borderRadius: RADIUS_SM, backgroundColor: theme.primaryMuted }}
                            >
                                <Ionicons name="shield-checkmark-outline" size={18} color={theme.textPrimary} />
                                <Text className="text-sm ml-2 flex-1" style={{ color: theme.textPrimary }}>
                                    {t(student.check?.status === 'PENDING' ? 'student-check-pending-note' : 'offer-students-note')}
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                            </TouchableOpacity>
                        )}

                        {usable && reminderTimes.length > 0 && (
                            <View>
                                <SelectField
                                    title={t('remind-me-title')}
                                    placeholder={t('remind-me')}
                                    options={reminderTimes.map((time) => ({ value: time, label: t('remind-at', { time }) }))}
                                    value={null}
                                    onChange={remind}
                                />
                            </View>
                        )}
                        {!offer.availableNow && (
                            <Text className="text-sm" style={{ color: theme.textSecondary }}>{t('offer-not-available-now')}</Text>
                        )}

                        {others.length > 0 && (
                            <View className="mt-2">
                                <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 15 }}>{t('more-offers-here')}</Text>
                                {others.map((other) => (
                                    <TouchableOpacity
                                        key={other.id}
                                        onPress={() => setSelectedId(other.id)}
                                        activeOpacity={0.7}
                                        className="flex-row items-center py-3"
                                        style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}
                                    >
                                        <Ionicons name="pricetag-outline" size={16} color={theme.primary} style={{ marginRight: 10 }} />
                                        <View className="flex-1">
                                            <Text style={{ color: theme.textPrimary, fontSize: 14 }} numberOfLines={1}>{other.text}</Text>
                                            <Text className="text-xs" style={{ color: theme.textSecondary }}>
                                                {[t(other.studentsOnly ? 'students-only' : 'everyone'), other.endsOn ? t('ends-on', { date: shortDate(other.endsOn, lang) }) : null].filter(Boolean).join(' · ')}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {hasFooter && (
                <View className="px-4 pt-3" style={{ paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.background }}>
                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={toggleSave}
                            activeOpacity={0.7}
                            accessibilityLabel={t(saved ? 'saved' : 'save')}
                            className="flex-row items-center justify-center px-4"
                            style={{ height: 48, borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border }}
                        >
                            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={theme.textPrimary} />
                            <Text className="ml-1.5" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{t(saved ? 'saved' : 'save')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={onPrimary}
                            disabled={!usable || busy}
                            activeOpacity={0.8}
                            className="flex-1 items-center justify-center"
                            style={{ height: 48, borderRadius: RADIUS, backgroundColor: theme.primary, opacity: usable && !busy ? 1 : 0.5 }}
                        >
                            {busy ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 15 }}>
                                    {t(!usable ? 'offer-not-now' : needsCheck ? 'verify-to-use' : 'use-at-counter')}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <ConfirmDialog
                visible={confirmUse}
                title={t('use-offer-confirm-title')}
                message={t('use-offer-confirm-message')}
                confirmLabel={t('use-offer-confirm-yes')}
                cancelLabel={t('cancel')}
                onConfirm={() => void redeemNow()}
                onCancel={() => setConfirmUse(false)}
            />
        </View>
    );
}
