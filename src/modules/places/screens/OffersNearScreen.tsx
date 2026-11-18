import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View, ViewToken } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import * as Location from '../../../shared/services/location';
import { trackSeen } from '../../../shared/services/engagement.service';
import { FONT_MEDIUM, RADIUS, SkeletonBlock, tint } from '../../campaigns/components/CampaignUi';
import { pickLabel, usePlaceCatalog } from '../services/placeCatalog';
import { businessService } from '../services/business.service';
import { distanceText, useSignedImages } from '../hooks/useSignedImages';
import { FeaturedOffer, NearbyOfferPlace, PublicOffer } from '../types/business.types';
import { shortDate } from '../components/BusinessCardSections';
import { isoDate } from '../utils/businessDraft';

const NEARBY_RADIUS_M = 5000;

type Audience = 'all' | 'everyone' | 'students';

interface Row {
    key: string;
    placeId: string;
    placeName: string;
    distanceM: number;
    promoted: boolean;
    offer: PublicOffer;
}

const num = (value: unknown) => (typeof value === 'string' && value !== '' ? Number(value) : NaN);

export default function OffersNearScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();
    const { catalog } = usePlaceCatalog();
    const lang = i18n.language;

    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(() => {
        const lat = num(params.lat);
        const lng = num(params.lng);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    });
    const [noLocation, setNoLocation] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [failed, setFailed] = useState(false);
    const [featured, setFeatured] = useState<FeaturedOffer[]>([]);
    const [places, setPlaces] = useState<NearbyOfferPlace[]>([]);
    const [audience, setAudience] = useState<Audience>('all');
    const [kind, setKind] = useState<string | null>(null);

    useEffect(() => {
        if (location) return;
        let cancelled = false;
        Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 })
            .then((fix) => {
                if (cancelled) return;
                if (fix) setLocation({ lat: fix.coords.latitude, lng: fix.coords.longitude });
                else {
                    setNoLocation(true);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setNoLocation(true);
                    setLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [location]);

    const fetchAll = useCallback(async () => {
        if (!location) return;
        try {
            const [top, near] = await Promise.all([
                businessService.featuredOffers(location.lat, location.lng).catch(() => [] as FeaturedOffer[]),
                businessService.nearbyOffers(location.lat, location.lng, NEARBY_RADIUS_M),
            ]);
            setFeatured(top.filter((row) => row?.place?.id && row?.offer?.id));
            setPlaces(near);
            setFailed(false);
        } catch {
            setFailed(true);
        } finally {
            setLoading(false);
        }
    }, [location]);

    useEffect(() => {
        void fetchAll();
    }, [fetchAll]);

    const refresh = async () => {
        setRefreshing(true);
        await fetchAll();
        setRefreshing(false);
    };

    const today = isoDate(new Date());
    const hero = featured[0];
    const imageByPlace = useMemo(() => Object.fromEntries(featured.map((row) => [row.place.id, row.place.image])), [featured]);
    const images = useSignedImages([hero?.place.image, ...featured.map((row) => row.place.image)]);

    const allRows: Row[] = useMemo(() => {
        const rows = places.flatMap((place) =>
            (place.offers ?? []).map((offer) => ({
                key: `${place.id}-${offer.id}`,
                placeId: place.id,
                placeName: pickLabel(place.name, lang),
                distanceM: place.distanceM,
                promoted: !!place.promoted,
                offer,
            }))
        );
        return rows.sort((a, b) => Number(b.promoted) - Number(a.promoted) || a.distanceM - b.distanceM);
    }, [places, lang]);

    const kinds = useMemo(() => Array.from(new Set(allRows.map((row) => row.offer.type))), [allRows]);
    const rows = allRows.filter(
        (row) =>
            (audience === 'all' || (audience === 'students') === !!row.offer.studentsOnly) && (!kind || row.offer.type === kind)
    );

    const kindLabel = (key: string, fallback?: string) =>
        pickLabel(catalog?.offerOptions.types.find((ty) => ty.key === key)?.label, lang, fallback ?? key);
    const areaKey = hero?.place.area;
    const areaLabel = areaKey ? pickLabel(catalog?.campusAreas.find((area) => area.key === areaKey)?.label, lang, '') : '';

    const openOffer = (placeId: string, offerId: string, name: string) =>
        router.push({ pathname: '/places/offer', params: { placeId, offerId, name } } as any);

    const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        viewableItems.forEach(({ item }) => {
            const row = item as Row | undefined;
            if (row?.placeId) trackSeen(row.placeId, row.offer.id);
        });
    }).current;

    useEffect(() => {
        if (hero) trackSeen(hero.place.id, hero.offer.id);
    }, [hero]);

    const chip = (label: string, active: boolean, onPress: () => void) => (
        <TouchableOpacity
            key={label}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityState={{ selected: active }}
            className="px-3 justify-center"
            style={{ height: 32, borderRadius: 16, borderWidth: 1, borderColor: active ? theme.primary : theme.border, backgroundColor: active ? tint(theme.primary, '14') : theme.background }}
        >
            <Text style={{ color: theme.textPrimary, fontSize: 13, fontFamily: active ? FONT_MEDIUM : undefined }}>{label}</Text>
        </TouchableOpacity>
    );

    const header = (
        <View>
            {hero && (
                <TouchableOpacity
                    onPress={() => openOffer(hero.place.id, hero.offer.id, pickLabel(hero.place.name, lang))}
                    activeOpacity={0.85}
                    className="mb-4 overflow-hidden"
                    style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background }}
                >
                    {hero.place.image && images[hero.place.image] ? (
                        <Image source={{ uri: images[hero.place.image] }} style={{ width: '100%', height: 150, backgroundColor: theme.surface }} resizeMode="cover" />
                    ) : (
                        <View className="items-center justify-center" style={{ height: 96, backgroundColor: theme.surface }}>
                            <Ionicons name="pricetag-outline" size={28} color={theme.textSecondary} />
                        </View>
                    )}
                    <View className="p-3">
                        <View className="flex-row items-center" style={{ gap: 6 }}>
                            <View className="px-1.5 py-0.5" style={{ borderRadius: 4, backgroundColor: tint(theme.primary, '24') }}>
                                <Text style={{ color: theme.textPrimary, fontSize: 11, fontFamily: FONT_MEDIUM }}>
                                    {hero.season ? pickLabel(hero.season.label, lang) : t('offer-of-the-day')}
                                </Text>
                            </View>
                            {hero.promoted && <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{t('promoted')}</Text>}
                        </View>
                        <Text className="mt-1.5" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 18, lineHeight: 24 }} numberOfLines={2}>
                            {hero.offer.text}
                        </Text>
                        <Text className="text-xs mt-1" style={{ color: theme.textSecondary }} numberOfLines={1}>
                            {[pickLabel(hero.place.name, lang), distanceText(hero.distanceM), t(hero.offer.studentsOnly ? 'students-only' : 'everyone')].filter(Boolean).join(' · ')}
                        </Text>
                    </View>
                </TouchableOpacity>
            )}

            {allRows.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 -mx-4" contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                    {chip(t('all'), audience === 'all' && !kind, () => {
                        setAudience('all');
                        setKind(null);
                    })}
                    {chip(t('everyone'), audience === 'everyone', () => setAudience(audience === 'everyone' ? 'all' : 'everyone'))}
                    {chip(t('students-only'), audience === 'students', () => setAudience(audience === 'students' ? 'all' : 'students'))}
                    {kinds.length > 1 && kinds.map((key) => chip(kindLabel(key), kind === key, () => setKind(kind === key ? null : key)))}
                </ScrollView>
            )}
        </View>
    );

    const renderRow = ({ item, index }: { item: Row; index: number }) => {
        const image = imageByPlace[item.placeId];
        const signed = image ? images[image] : undefined;
        const announcement = item.offer.type === 'announce';
        const meta = [
            item.placeName,
            t(item.offer.studentsOnly ? 'students-only' : 'everyone'),
            item.offer.endsOn === today ? t('ends-today') : item.offer.endsOn ? t('ends-on', { date: shortDate(item.offer.endsOn, lang) }) : null,
            distanceText(item.distanceM),
        ]
            .filter(Boolean)
            .join(' · ');
        return (
            <TouchableOpacity
                onPress={() => openOffer(item.placeId, item.offer.id, item.placeName)}
                activeOpacity={0.7}
                className="flex-row items-center px-3 py-3"
                // rows sit in one hairline-bordered card
                style={{
                    borderColor: theme.border,
                    borderLeftWidth: 1,
                    borderRightWidth: 1,
                    borderTopWidth: 1,
                    ...(index === 0 && { borderTopLeftRadius: RADIUS, borderTopRightRadius: RADIUS }),
                    ...(index === rows.length - 1 && { borderBottomWidth: 1, borderBottomLeftRadius: RADIUS, borderBottomRightRadius: RADIUS }),
                }}
            >
                {signed ? (
                    <Image source={{ uri: signed }} style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: theme.surface }} />
                ) : (
                    <View className="items-center justify-center" style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: theme.surface }}>
                        <Ionicons name="storefront-outline" size={20} color={theme.textSecondary} />
                    </View>
                )}
                <View className="flex-1 ml-3">
                    <View className="flex-row items-center" style={{ gap: 6 }}>
                        <Text style={{ color: theme.textSecondary, fontSize: 11, fontFamily: FONT_MEDIUM }}>{kindLabel(item.offer.type, item.offer.badge)}</Text>
                        {item.promoted && <Text style={{ color: theme.textSecondary, fontSize: 11 }}>· {t('promoted')}</Text>}
                        {!announcement && !item.offer.availableNow && <Text style={{ color: theme.textSecondary, fontSize: 11 }}>· {t('offer-not-now')}</Text>}
                    </View>
                    <Text className="mt-0.5" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 15 }} numberOfLines={2}>
                        {item.offer.text}
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }} numberOfLines={1}>
                        {meta}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
        );
    };

    const message = noLocation ? t('offers-need-location') : failed ? t('offers-load-failed') : t('offers-none-nearby');

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background, paddingTop: insets.top }}>
            <View className="px-4 pt-3 pb-3">
                <TouchableOpacity onPress={() => router.back()} className="self-start p-1 -ml-1" activeOpacity={0.7} hitSlop={8} accessibilityLabel={t('back')}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="mt-3" style={{ color: theme.textPrimary, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 }}>
                    {t('offers-near-you')}
                </Text>
                {!!areaLabel && (
                    <View className="flex-row items-center mt-1">
                        <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
                        <Text className="text-sm ml-1" style={{ color: theme.textSecondary }}>{t('around-area', { area: areaLabel })}</Text>
                    </View>
                )}
            </View>

            {loading ? (
                <View className="px-4" style={{ gap: 10 }}>
                    <SkeletonBlock height={220} style={{ borderRadius: RADIUS }} />
                    <SkeletonBlock height={32} width="70%" />
                    <SkeletonBlock height={64} style={{ borderRadius: RADIUS }} />
                    <SkeletonBlock height={64} style={{ borderRadius: RADIUS }} />
                </View>
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(row) => row.key}
                    renderItem={renderRow}
                    ListHeaderComponent={header}
                    ListEmptyComponent={
                        <Text className="text-sm text-center mt-6 px-6" style={{ color: theme.textSecondary }}>
                            {allRows.length ? t('offers-none-match') : message}
                        </Text>
                    }
                    onViewableItemsChanged={onViewable}
                    viewabilityConfig={{ itemVisiblePercentThreshold: 60, minimumViewTime: 500 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
                />
            )}
        </View>
    );
}
