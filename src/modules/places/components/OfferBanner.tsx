import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { trackSeen } from '../../../shared/services/engagement.service';
import { FONT_MEDIUM, FONT_SEMIBOLD } from '../../campaigns/components/CampaignUi';
import { isoDate } from '../utils/businessDraft';
import { pickLabel, usePlaceCatalog } from '../services/placeCatalog';
import { useFeaturedOffers } from '../hooks/useFeaturedOffers';
import { distanceText, useSignedImages } from '../hooks/useSignedImages';
import { FeaturedOffer } from '../types/business.types';

const ROTATE_MS = 5000;
const CARD_HEIGHT = 120;
const CARD_RADIUS = 16;
const PANEL = '#FFFFFF';
const INK = '#16181D';

interface Props {
    userLocation: { lat: number; lng: number } | null;
}

export function OfferBanner({ userLocation }: Props) {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const { colors: theme } = useTheme();
    const { catalog } = usePlaceCatalog();
    const lang = i18n.language;
    const { offers } = useFeaturedOffers(userLocation);
    const images = useSignedImages(offers.map((row) => row.place.image));
    const [index, setIndex] = useState(0);
    const fade = useRef(new Animated.Value(1)).current;

    const count = offers.length;
    const current: FeaturedOffer | undefined = offers[count ? index % count : 0];

    useEffect(() => {
        if (count < 2) return;
        const timer = setInterval(() => {
            Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
                setIndex((i) => (i + 1) % count);
                Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
            });
        }, ROTATE_MS);
        return () => clearInterval(timer);
    }, [count, fade]);

    useEffect(() => {
        if (current) trackSeen(current.place.id, current.offer.id);
    }, [current]);

    if (!current) return null;

    const placeName = pickLabel(current.place.name, lang);
    const kind = pickLabel(catalog?.offerOptions.types.find((ty) => ty.key === current.offer.type)?.label, lang, current.offer.badge);
    const label =
        current.offer.endsOn === isoDate(new Date())
            ? t('offer-ends-today')
            : current.season
              ? pickLabel(current.season.label, lang)
              : kind;
    const image = current.place.image ? images[current.place.image] : undefined;
    const meta = [placeName, distanceText(current.distanceM)].filter(Boolean).join(' · ');

    const open = () =>
        router.push({ pathname: '/places/offer', params: { placeId: current.place.id, offerId: current.offer.id, name: placeName } } as any);

    const seeAll = () =>
        router.push({ pathname: '/places/offers', params: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : {} } as any);

    return (
        <View>
            <TouchableOpacity onPress={open} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={`${current.offer.text}, ${placeName}`}>
                <Animated.View className="flex-row overflow-hidden" style={{ height: CARD_HEIGHT, borderRadius: CARD_RADIUS, opacity: fade, backgroundColor: PANEL, borderWidth: 1, borderColor: theme.border }}>
                    <View style={{ width: '35%', backgroundColor: theme.surface }}>
                        {image ? (
                            <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        ) : (
                            <View className="flex-1 items-center justify-center">
                                <Ionicons name="pricetag-outline" size={28} color={theme.textSecondary} />
                            </View>
                        )}
                    </View>
                    <View className="flex-1 justify-center px-3.5">
                        <Text style={{ color: theme.primary, fontSize: 12, fontFamily: FONT_MEDIUM, marginRight: 56 }} numberOfLines={1}>
                            {current.promoted ? `${label} · ${t('promoted')}` : label}
                        </Text>
                        <Text className="mt-1" style={{ color: INK, fontSize: 17, lineHeight: 21, fontFamily: FONT_SEMIBOLD }} numberOfLines={2}>
                            {current.offer.text}
                        </Text>
                        <Text className="mt-1" style={{ color: INK, fontSize: 12, fontFamily: FONT_MEDIUM }} numberOfLines={1}>
                            {meta}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={seeAll}
                        hitSlop={8}
                        activeOpacity={0.7}
                        className="absolute flex-row items-center"
                        style={{ top: 10, right: 12 }}
                        accessibilityRole="button"
                        accessibilityLabel={t('see-all')}
                    >
                        <Text style={{ color: theme.primary, fontFamily: FONT_MEDIUM, fontSize: 12, lineHeight: 15, includeFontPadding: false, textDecorationLine: 'underline' }}>{t('see-all')}</Text>
                        <Ionicons name="chevron-forward" size={13} color={theme.primary} style={{ marginLeft: 1 }} />
                    </TouchableOpacity>
                </Animated.View>
            </TouchableOpacity>
            <View className="flex-row items-center justify-center mt-2" style={{ minHeight: 8 }} pointerEvents="none">
                <View className="flex-row" style={{ gap: 4 }} pointerEvents="none">
                    {count > 1 &&
                        offers.map((row, i) => (
                            <View
                                key={`${row.place.id}-${row.offer.id}`}
                                style={{ width: i === index % count ? 14 : 6, height: 6, borderRadius: 3, backgroundColor: i === index % count ? theme.primary : theme.border }}
                            />
                        ))}
                </View>
            </View>
        </View>
    );
}
