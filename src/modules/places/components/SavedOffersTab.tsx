import React, { useCallback, useState } from 'react';
import { Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { isAuthenticated } from '../../register/utils/authGate';
import { useAuthGate } from '../../register/hooks/useAuthGate';
import { showToast } from '../../../shared/utils/toast';
import { FONT_MEDIUM, RADIUS, SectionLabel, SkeletonBlock } from '../../campaigns/components/CampaignUi';
import { pickLabel } from '../services/placeCatalog';
import { businessService } from '../services/business.service';
import { FollowedPlace, SavedOffer, UsedOffer } from '../types/business.types';
import { USED_PAGE_SIZE, UsedOffersSection } from './UsedOffersSection';
import { parseIsoDate } from '../utils/businessDraft';
import { shortDate } from './BusinessCardSections';
import { useSignedImages } from '../hooks/useSignedImages';

type Load = 'loading' | 'signed-out' | 'ready' | 'failed';

const hasEnded = (offer: SavedOffer) => {
    if (offer.status?.toLowerCase() === 'ended') return true;
    const end = parseIsoDate(offer.endsOn);
    if (!end) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return end.getTime() < today.getTime();
};

export function SavedOffersTab() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();
    const { requireAuth } = useAuthGate();
    const lang = i18n.language;
    const [load, setLoad] = useState<Load>('loading');
    const [refreshing, setRefreshing] = useState(false);
    const [offers, setOffers] = useState<SavedOffer[]>([]);
    const [following, setFollowing] = useState<FollowedPlace[]>([]);
    const [used, setUsed] = useState<UsedOffer[]>([]);
    const [usedHasMore, setUsedHasMore] = useState(false);
    const [loadingMoreUsed, setLoadingMoreUsed] = useState(false);
    const images = useSignedImages([
        ...used.map((u) => u.posterUrl || u.place.image),
        ...offers.map((o) => o.posterUrl || o.place.image),
        ...following.map((p) => p.image),
    ]);

    const fetchAll = useCallback(async () => {
        if (!(await isAuthenticated())) {
            setLoad('signed-out');
            return;
        }
        try {
            const [saved, followed, usedPage] = await Promise.all([
                businessService.savedOffers(),
                businessService.following(),
                businessService.usedOffers().catch(() => [] as UsedOffer[]),
            ]);
            setUsed(usedPage);
            setUsedHasMore(usedPage.length >= USED_PAGE_SIZE);
            // live first, newest saved first; ended ones sink to the bottom
            saved.sort((a, b) => Number(hasEnded(a)) - Number(hasEnded(b)) || (b.savedAt ?? '').localeCompare(a.savedAt ?? ''));
            setOffers(saved);
            setFollowing(followed);
            setLoad('ready');
        } catch {
            setLoad((prev) => (prev === 'ready' ? prev : 'failed'));
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void fetchAll();
        }, [fetchAll])
    );

    const refresh = async () => {
        setRefreshing(true);
        await fetchAll();
        setRefreshing(false);
    };

    const unsave = async (offer: SavedOffer) => {
        setOffers((prev) => prev.filter((o) => o.offerId !== offer.offerId));
        try {
            await businessService.setOfferSaved(offer.place.id, offer.offerId, false);
            showToast(t('offer-unsaved'));
        } catch {
            setOffers((prev) => [offer, ...prev]);
            showToast(t('could-not-update'));
        }
    };

    const loadMoreUsed = async () => {
        const last = used[used.length - 1];
        if (!last || loadingMoreUsed) return;
        setLoadingMoreUsed(true);
        try {
            const next = await businessService.usedOffers(last.usedAt);
            const seen = new Set(used.map((u) => u.code));
            setUsed((prev) => [...prev, ...next.filter((u) => !seen.has(u.code))]);
            setUsedHasMore(next.length >= USED_PAGE_SIZE);
        } catch {
            showToast(t('could-not-update'));
        } finally {
            setLoadingMoreUsed(false);
        }
    };

    const answerUsed = (code: string, feedback: 'given' | 'refused') =>
        setUsed((prev) => prev.map((u) => (u.code === code ? { ...u, feedback } : u)));

    const openUsed = (row: UsedOffer) =>
        row.text
            ? router.push({ pathname: '/places/offer', params: { placeId: row.place.id, offerId: row.offerId, name: pickLabel(row.place.name, lang) } } as any)
            : router.push({ pathname: '/', params: { lat: row.place.lat, lng: row.place.lng, name: pickLabel(row.place.name, lang), businessId: row.place.id } } as any);

    const openOffer = (offer: SavedOffer) =>
        router.push({ pathname: '/places/offer', params: { placeId: offer.place.id, offerId: offer.offerId, name: pickLabel(offer.place.name, lang) } } as any);

    const openPlace = (place: FollowedPlace) =>
        router.push({ pathname: '/', params: { lat: place.lat, lng: place.lng, name: pickLabel(place.name, lang), businessId: place.id } } as any);

    if (load === 'loading') {
        return (
            <View className="px-4" style={{ gap: 10 }}>
                <SkeletonBlock height={12} width="30%" />
                <SkeletonBlock height={72} style={{ borderRadius: RADIUS }} />
                <SkeletonBlock height={72} style={{ borderRadius: RADIUS }} />
                <SkeletonBlock height={12} width="35%" style={{ marginTop: 16 }} />
                <SkeletonBlock height={56} style={{ borderRadius: RADIUS }} />
            </View>
        );
    }

    if (load === 'signed-out' || load === 'failed') {
        return (
            <View className="flex-1 items-center justify-center px-8" style={{ gap: 12 }}>
                <Text className="text-sm text-center" style={{ color: theme.textSecondary }}>
                    {t(load === 'signed-out' ? 'saved-offers-sign-in' : 'saved-offers-failed')}
                </Text>
                <TouchableOpacity
                    onPress={() => (load === 'signed-out' ? void requireAuth() : void refresh())}
                    activeOpacity={0.7}
                    className="px-4 justify-center"
                    style={{ height: 40, borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border }}
                >
                    <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{t(load === 'signed-out' ? 'login' : 'try-again')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const thumb = (uri?: string | null) => {
        const signed = uri ? images[uri] : undefined;
        return signed ? (
            <Image source={{ uri: signed }} style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: theme.surface }} />
        ) : (
            <View className="items-center justify-center" style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: theme.surface }}>
                <Ionicons name="storefront-outline" size={20} color={theme.textSecondary} />
            </View>
        );
    };

    return (
        <ScrollView
            className="flex-1 px-4"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        >
            <UsedOffersSection
                rows={used}
                hasMore={usedHasMore}
                loadingMore={loadingMoreUsed}
                onLoadMore={() => void loadMoreUsed()}
                thumb={thumb}
                onOpen={openUsed}
                onAnswered={answerUsed}
            />

            <SectionLabel style={{ marginBottom: 8 }}>{t('saved-offers')}</SectionLabel>
            {offers.length === 0 ? (
                <Text className="text-sm mb-6" style={{ color: theme.textSecondary }}>{t('saved-offers-empty')}</Text>
            ) : (
                <View className="mb-6" style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
                    {offers.map((offer, i) => {
                        const ended = hasEnded(offer);
                        const meta = [
                            pickLabel(offer.place.name, lang),
                            ended ? t('offer-ended') : offer.endsOn ? t('ends-on', { date: shortDate(offer.endsOn, lang) }) : null,
                            offer.studentsOnly ? t('students-only') : null,
                        ]
                            .filter(Boolean)
                            .join(' · ');
                        return (
                            <View
                                key={offer.offerId}
                                className="flex-row items-center px-3 py-3"
                                style={{ borderTopWidth: i ? 1 : 0, borderTopColor: theme.border, opacity: ended ? 0.5 : 1 }}
                            >
                                {/* an ended offer has no page to open any more */}
                                <TouchableOpacity onPress={() => openOffer(offer)} disabled={ended} activeOpacity={0.7} className="flex-1 flex-row items-center">
                                    {thumb(offer.posterUrl || offer.place.image)}
                                    <View className="flex-1 ml-3">
                                        <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 15 }} numberOfLines={2}>
                                            {offer.text}
                                        </Text>
                                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }} numberOfLines={1}>
                                            {meta}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => void unsave(offer)} hitSlop={8} className="pl-3" accessibilityLabel={t('offer-unsaved')}>
                                    <Ionicons name="bookmark" size={20} color={theme.primary} />
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>
            )}

            <SectionLabel style={{ marginBottom: 8 }}>{t('places-you-follow')}</SectionLabel>
            {following.length === 0 ? (
                <Text className="text-sm" style={{ color: theme.textSecondary }}>{t('following-empty')}</Text>
            ) : (
                <View style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
                    {following.map((place, i) => (
                        <TouchableOpacity
                            key={place.id}
                            onPress={() => openPlace(place)}
                            activeOpacity={0.7}
                            className="flex-row items-center px-3 py-3"
                            style={{ borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}
                        >
                            {thumb(place.image)}
                            <Text className="flex-1 ml-3" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 15 }} numberOfLines={1}>
                                {pickLabel(place.name, lang)}
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </ScrollView>
    );
}
