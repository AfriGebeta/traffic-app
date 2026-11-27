import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, PanResponder, Text, TouchableOpacity, View } from 'react-native';
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
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

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
    const images = useSignedImages(offers.map((row) => row.offer.posterUrl || row.place.image));
    const [pos, setPos] = useState(0); 
    const [active, setActive] = useState(false); 
    const [width, setWidth] = useState(0);
    const [tick, setTick] = useState(0); 
    const track = useRef(new Animated.Value(0)).current;
    const posRef = useRef(0);
    const widthRef = useRef(0);
    const countRef = useRef(0);
    const busy = useRef(false);

    const count = offers.length;
    countRef.current = count;
    widthRef.current = width;
    const index = count ? ((pos % count) + count) % count : 0;
    const current: FeaturedOffer | undefined = offers[index];

    const settle = (target: number) => {
        Animated.timing(track, { toValue: -target * widthRef.current, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
            posRef.current = target;
            setPos(target);
            setActive(false);
            busy.current = false;
        });
    };

    useEffect(() => {
        posRef.current = 0;
        setPos(0);
        track.setValue(0);
    }, [count, track]);

    useEffect(() => {
        track.setValue(-posRef.current * width);
    }, [width, track]);

    useEffect(() => {
        if (count < 2 || !width) return;
        const timer = setInterval(() => {
            if (busy.current) return;
            busy.current = true;
            setActive(true);
            settle(posRef.current + 1);
        }, ROTATE_MS);
        return () => clearInterval(timer);
    }, [count, width, tick]);

    const pan = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponderCapture: (_, g) =>
                !busy.current && countRef.current > 1 && widthRef.current > 0 && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
            onPanResponderGrant: () => {
                busy.current = true;
                setActive(true);
            },
            onPanResponderMove: (_, g) => track.setValue(-posRef.current * widthRef.current + g.dx),
            onPanResponderTerminationRequest: () => false,
            onPanResponderRelease: (_, g) => release(g.dx, g.vx),
            onPanResponderTerminate: (_, g) => release(g.dx, g.vx),
        })
    ).current;

    function release(dx: number, vx: number) {
        const threshold = widthRef.current * 0.2;
        const step = dx < -threshold || vx < -0.5 ? 1 : dx > threshold || vx > 0.5 ? -1 : 0;
        settle(posRef.current + step);
        setTick((n) => n + 1);
    }

    useEffect(() => {
        if (current) trackSeen(current.place.id, current.offer.id);
    }, [current]);

    if (!current) return null;

    const seeAll = () =>
        router.push({ pathname: '/places/offers', params: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : {} } as any);

    const renderCard = (row: FeaturedOffer, key: string, translateX: Animated.AnimatedAddition<number>) => {
        const placeName = pickLabel(row.place.name, lang);
        const kind = pickLabel(catalog?.offerOptions.types.find((ty) => ty.key === row.offer.type)?.label, lang, row.offer.badge);
        const label =
            row.offer.endsOn === isoDate(new Date()) ? t('offer-ends-today') : row.season ? pickLabel(row.season.label, lang) : kind;
        const imageKey = row.offer.posterUrl || row.place.image;
        const image = imageKey ? images[imageKey] : undefined;
        const meta = [placeName, distanceText(row.distanceM)].filter(Boolean).join(' · ');
        const open = () =>
            router.push({ pathname: '/places/offer', params: { placeId: row.place.id, offerId: row.offer.id, name: placeName } } as any);

        return (
            <AnimatedTouchable
                key={key}
                onPress={open}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel={`${row.offer.text}, ${placeName}`}
                className="absolute flex-row"
                style={{ top: 0, bottom: 0, left: 0, right: 0, transform: [{ translateX }] }}
            >
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
                        {row.promoted ? `${label} · ${t('promoted')}` : label}
                    </Text>
                    <Text className="mt-1" style={{ color: INK, fontSize: 17, lineHeight: 21, fontFamily: FONT_SEMIBOLD }} numberOfLines={2}>
                        {row.offer.text}
                    </Text>
                    <Text className="mt-1" style={{ color: INK, fontSize: 12, fontFamily: FONT_MEDIUM }} numberOfLines={1}>
                        {meta}
                    </Text>
                </View>
            </AnimatedTouchable>
        );
    };

    const slots = active && count > 1 ? [pos - 1, pos, pos + 1] : [pos];
    const offerAt = (slot: number) => offers[((slot % count) + count) % count];

    return (
        <View>
            <View
                className="overflow-hidden"
                style={{ height: CARD_HEIGHT, borderRadius: CARD_RADIUS, backgroundColor: PANEL, borderWidth: 1, borderColor: theme.border }}
                onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
                {...pan.panHandlers}
            >
                {slots.map((slot) => renderCard(offerAt(slot), `slot-${slot}`, Animated.add(track, slot * width)))}
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
            </View>
            <View className="flex-row items-center justify-center mt-2" style={{ minHeight: 8 }} pointerEvents="none">
                <View className="flex-row" style={{ gap: 4 }} pointerEvents="none">
                    {count > 1 &&
                        offers.map((row, i) => (
                            <View
                                key={`${row.place.id}-${row.offer.id}`}
                                style={{ width: i === index ? 14 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? theme.primary : theme.border }}
                            />
                        ))}
                </View>
            </View>
        </View>
    );
}
