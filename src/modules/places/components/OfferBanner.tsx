import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { trackSeen } from '../../../shared/services/engagement.service';
import { FONT_MEDIUM, RADIUS, tint } from '../../campaigns/components/CampaignUi';
import { pickLabel, usePlaceCatalog } from '../services/placeCatalog';
import { useFeaturedOffers } from '../hooks/useFeaturedOffers';
import { distanceText, useSignedImages } from '../hooks/useSignedImages';
import { FeaturedOffer } from '../types/business.types';

const ROTATE_MS = 5000;

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
    const tag = current.season ? pickLabel(current.season.label, lang) : kind;
    const image = current.place.image ? images[current.place.image] : undefined;
    const meta = [placeName, distanceText(current.distanceM), current.offer.studentsOnly ? t('students-only') : null].filter(Boolean).join(' · ');

    const open = () =>
        router.push({ pathname: '/places/offer', params: { placeId: current.place.id, offerId: current.offer.id, name: placeName } } as any);

    const seeAll = () =>
        router.push({ pathname: '/places/offers', params: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : {} } as any);

    return (
        <View
            className="flex-row items-center"
            style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background, overflow: 'hidden' }}
        >
            <TouchableOpacity onPress={open} activeOpacity={0.8} className="flex-1" accessibilityRole="button" accessibilityLabel={`${current.offer.text}, ${placeName}`}>
                <Animated.View className="flex-row items-center p-2" style={{ opacity: fade }}>
                    {image ? (
                        <Image source={{ uri: image }} style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: theme.surface }} />
                    ) : (
                        <View className="items-center justify-center" style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: theme.surface }}>
                            <Ionicons name="pricetag-outline" size={18} color={theme.textSecondary} />
                        </View>
                    )}
                    <View className="flex-1 ml-2.5">
                        <View className="flex-row items-center" style={{ gap: 6 }}>
                            <View className="px-1.5" style={{ borderRadius: 4, backgroundColor: tint(theme.primary, '24') }}>
                                <Text style={{ color: theme.textPrimary, fontSize: 10.5, fontFamily: FONT_MEDIUM }} numberOfLines={1}>{tag}</Text>
                            </View>
                            {current.promoted && <Text style={{ color: theme.textSecondary, fontSize: 10.5 }}>{t('promoted')}</Text>}
                        </View>
                        <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 14 }} numberOfLines={1}>
                            {current.offer.text}
                        </Text>
                        <Text style={{ color: theme.textSecondary, fontSize: 11 }} numberOfLines={1}>
                            {meta}
                        </Text>
                    </View>
                </Animated.View>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={seeAll}
                activeOpacity={0.7}
                className="self-stretch flex-row items-center px-2.5"
                style={{ borderLeftWidth: 1, borderLeftColor: theme.border }}
                accessibilityRole="button"
                accessibilityLabel={t('see-all')}
            >
                <Text style={{ color: theme.primary, fontFamily: FONT_MEDIUM, fontSize: 12, lineHeight: 15, includeFontPadding: false }}>{t('see-all')}</Text>
                <Ionicons name="chevron-forward" size={13} color={theme.primary} style={{ marginLeft: 1 }} />
            </TouchableOpacity>
        </View>
    );
}
