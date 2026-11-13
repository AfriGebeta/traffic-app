import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ImageSourcePropType, Linking, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useLayout, PANEL_WIDTH } from '../../../shared/layout/useLayout';
import type { GeocodingPlace } from '../types/navigation.types';
import { placeService } from '../../places/services/place.service';
import { showToast } from '../../../shared/utils/toast';
import { shareLocation } from '../../../shared/utils/shareLocation';
import type { SavedPlace } from '../../places/types/place.types';
import { trackEngagement } from '../../../shared/services/engagement.service';
import { featuredOffer, useBusinessPlace } from '../../places/hooks/useBusinessPlace';
import { pickLabel, usePlaceCatalog } from '../../places/services/placeCatalog';
import { CardDetails, CardOffer, OpenLine } from '../../places/components/BusinessCardSections';
import { openState, telUrl } from '../../places/utils/businessPlace';
import { useAuthGate } from '../../register/hooks/useAuthGate';

interface PlaceDetailPreviewProps {
    place: GeocodingPlace;
    userLocation?: { lat: number; lng: number } | null;
    onDirections: () => void;
    onStart: () => void;
    onTaxi: () => void;
    onContribute: (place: GeocodingPlace) => void;
    onClose: () => void;
}

interface ActionPillProps {
    icon?: keyof typeof Ionicons.glyphMap;
    imageSource?: ImageSourcePropType;
    label: string;
    onPress: () => void;
    primary?: boolean;
}

const ActionPill: React.FC<ActionPillProps> = ({ icon, imageSource, label, onPress, primary = false }) => (
    <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 10,
            backgroundColor: primary ? colors.primary.main : colors.primary.light,
            marginRight: 8,
            paddingVertical: 9,
            paddingHorizontal: 12,
        }}
    >
        {imageSource ? (
            <Image source={imageSource} style={{ width: 16, height: 16 }} resizeMode="contain" />
        ) : (
            <Ionicons
                name={icon!}
                size={15}
                color={primary ? '#FFFFFF' : colors.primary.main}
            />
        )}
        <Text
            style={{
                marginLeft: 6,
                fontSize: 13,
                lineHeight: 18,
                fontWeight: '600',
                // Android pads text above the glyphs, which drops it below the icon's center
                includeFontPadding: false,
                textAlignVertical: 'center',
                // pill bg is light peach in both themes, so black stays readable in dark mode too
                color: primary ? '#FFFFFF' : '#000000',
            }}
        >
            {label}
        </Text>
    </TouchableOpacity>
);

export const PlaceDetailPreview: React.FC<PlaceDetailPreviewProps> = ({
    place,
    userLocation,
    onDirections,
    onStart,
    onTaxi,
    onContribute,
    onClose,
}) => {
    const { t, language } = useTranslation();
    const insets = useSafeAreaInsets();
    const { isWide, panelLeft } = useLayout();
    const { colors: theme, isDark } = useTheme();
    const [savedPlace, setSavedPlace] = useState<SavedPlace | null>(null);
    const [imageBoxWidth, setImageBoxWidth] = useState(0);
    // which video asset has rendered its first frame; image shows until then
    const [readyVideo, setReadyVideo] = useState<number | null>(null);
    const router = useRouter();
    const { height: windowHeight } = useWindowDimensions();
    const { requireAuth } = useAuthGate();
    const { catalog } = usePlaceCatalog();
    const business = useBusinessPlace(place.businessId);
    const [photo, setPhoto] = useState(0);
    const [showDetails, setShowDetails] = useState(false);
    const firstOffer = featuredOffer(business.offers);
    const photos = business.photos;
    const openNow = openState(business.place?.openingHours);
    const phoneUrl = telUrl(business.place?.phone);

    useEffect(() => {
        checkIfSaved();
    }, [place]);

    useEffect(() => {
        setPhoto(0);
        setShowDetails(false);
    }, [place.businessId]);

    const openedFor = useRef<string | null>(null);
    useEffect(() => {
        if (!place.businessId || !business.loaded || openedFor.current === place.businessId) return;
        openedFor.current = place.businessId;
        trackEngagement(place.businessId, 'opened', firstOffer?.id);
    }, [place.businessId, business.loaded, firstOffer?.id]);

    const routeTo = (start: () => void) => () => {
        trackEngagement(place.businessId, 'directions', firstOffer?.id);
        start();
    };

    const call = (url: string) => {
        trackEngagement(place.businessId, 'call', firstOffer?.id);
        void Linking.openURL(url).catch(() => showToast(t('could-not-open-dialer')));
    };

    const openOffer = (offerId?: string) => {
        if (!place.businessId) return;
        router.push({ pathname: '/places/offer', params: { placeId: place.businessId, ...(offerId && { offerId }), name: place.name } } as any);
    };

    const toggleFollow = () =>
        void requireAuth(async () => {
            const next = !business.following;
            const ok = await business.setFollowing(next);
            showToast(ok ? t(next ? 'following-place' : 'unfollowed-place', { name: place.name }) : t('could-not-update'));
        });

    useFocusEffect(
        React.useCallback(() => {
            checkIfSaved();
        }, [place])
    );

    const checkIfSaved = async () => {
        const saved = await placeService.isPlaceSaved(place.latitude, place.longitude);
        setSavedPlace(saved);
    };

    const handleUnsavePlace = async () => {
        if (!savedPlace) return;
        try {
            await placeService.deleteSavedPlace(savedPlace.id);
            setSavedPlace(null);
            showToast(t('place-removed'));
        } catch (error) {
            showToast(t('failed-to-remove-place'));
        }
    };

    const handleShare = async () => {
        await shareLocation({ lat: place.latitude, lng: place.longitude, name: place.name });
    };

    const handleClaimBusiness = () => {
        router.push({
            pathname: '/places/claim',
            params: {
                placeId: place.id || `${place.latitude},${place.longitude}`,
                placeName: place.name
            },
        });
    };

    const handleContribute = () => {
        onContribute(place);
    };

    const isClaimableBusiness = () => {
        const type = (place.type || '').toLowerCase();
        const category = (place.category || '').toLowerCase();

        const claimableKeywords = [
            'restaurant', 'cafe', 'shop', 'store', 'mall', 'gas', 'fuel',
            'repair', 'hotel', 'bank', 'pharmacy', 'company', 'business'
        ];

        return claimableKeywords.some(keyword =>
            type.includes(keyword) || category.includes(keyword)
        );
    };

    const locationLine = [place.City, place.Country].filter(Boolean).join(', ');
    const businessGroup = catalog?.businessGroups.find((g) => g.key === business.place?.business?.group);
    const businessKind = businessGroup?.kinds.find((k) => k.key === business.place?.business?.kind);
    const categoryLabel =
        place.type === 'coordinates'
            ? `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`
            : businessKind
              ? pickLabel(businessKind.label, language, businessKind.key)
              : place.type || t('location');

    const getPlaceImage = () => {
        const placeType = (place.type || place.category || '').toLowerCase();


        if (placeType.includes('coffee') || placeType.includes('cafe') || placeType.includes('teahouse')) {
            return require('../../../../assets/images/coffee-shop-place-detail.png');
        }
        if (placeType.includes('restaurant') || placeType.includes('hotel') || placeType.includes('food')) {
            return require('../../../../assets/images/restaurant-place-detail.png');
        }
        if (placeType.includes('bank')) {
            return require('../../../../assets/images/bank-place-detail.png');
        }
        if (placeType.includes('atm')) {
            return require('../../../../assets/images/atm-place-detail.png');
        }
        if (placeType.includes('gas') || placeType.includes('fuel') || placeType.includes('petrol')) {
            return require('../../../../assets/images/gas-station-place-detail.png');
        }
        if (placeType.includes('parking')) {
            return require('../../../../assets/images/parking-place-detail.png');
        }
        if (placeType.includes('repair') || placeType.includes('garage') || placeType.includes('mechanic')) {
            return require('../../../../assets/images/repair-place-detail.png');
        }
        if (placeType.includes('taxi')) {
            return require('../../../../assets/images/taxi-place-detail.png');
        }
        if (placeType.includes('hospital') || placeType.includes('clinic') || placeType.includes('medical') || placeType.includes('health')) {
            return require('../../../../assets/images/hospital-place-detail.png');
        }
        if (placeType.includes('school') || placeType.includes('university') || placeType.includes('college')) {
            return require('../../../../assets/images/school-place-detail.png');
        }
        if (placeType.includes('shop') || placeType.includes('store')) {
            return require('../../../../assets/images/shop-place-detail.png');
        }

        return require('../../../../assets/images/establishment-place-detail.png');
    };

    // Animated header for types that have one; same match order as getPlaceImage
    const getPlaceVideo = () => {
        const placeType = (place.type || place.category || '').toLowerCase();

        if (placeType.includes('coffee') || placeType.includes('cafe') || placeType.includes('teahouse')) {
            return require('../../../../assets/videos/0.3--d1-Gebeta-coffeeshop-vector-anim-gif 2.mp4');
        }
        if (placeType.includes('restaurant') || placeType.includes('hotel') || placeType.includes('food')) {
            return require('../../../../assets/videos/d2-Gebeta-restaurant-vector-anim-gif.mp4');
        }
        if (placeType.includes('bank')) return null;
        if (placeType.includes('atm')) {
            return require('../../../../assets/videos/0.2----d6-Gebeta-ATM-vecotr-anim---1200x400_1.mp4');
        }
        if (placeType.includes('gas') || placeType.includes('fuel') || placeType.includes('petrol')) {
            return require('../../../../assets/videos/0.3----d6--B-Fuel station-bro--1200x400_1.mp4');
        }
        if (placeType.includes('parking')) return null;
        if (placeType.includes('repair') || placeType.includes('garage') || placeType.includes('mechanic')) {
            return require('../../../../assets/videos/0_2_d6_RED_Gebeta_repair_shop_vector_anim_gif_1200x400_1.mp4');
        }
        if (placeType.includes('taxi')) {
            return require('../../../../assets/videos/0.2----Gebeta-Taxi-vector-anim-gif-1200x400_1.mp4');
        }
        if (placeType.includes('hospital') || placeType.includes('clinic') || placeType.includes('medical') || placeType.includes('health')) {
            return require('../../../../assets/videos/0.2-mbps----Gebeta-hospital-vector-anim-gif---1200X400_1.mp4');
        }
        if (placeType.includes('school') || placeType.includes('university') || placeType.includes('college')) {
            return require('../../../../assets/videos/0.2---d6-Gebeta-school-vector-anim-gif-1200x400_1.mp4');
        }
        return null;
    };

    const placeVideo = getPlaceVideo();
    const placeImage = getPlaceImage();
    const imageBoxHeight = 112;
    const { width: imageWidth, height: imageHeight } = Image.resolveAssetSource(placeImage);
    const imageScale = Math.max(imageBoxWidth / imageWidth, imageBoxHeight / imageHeight);
    const displayedImageHeight = imageHeight * imageScale;

    return (
        <View
            className="absolute rounded-3xl shadow-2xl overflow-hidden self-center"
            style={{
                bottom: insets.bottom > 0 ? insets.bottom + 4 : 34,
                width: '92%',
                maxWidth: 480,
                alignSelf: 'center',
                // wide: dock under the search panel instead of centering over the map
                ...(isWide ? { left: panelLeft(), width: PANEL_WIDTH, maxWidth: PANEL_WIDTH, alignSelf: 'flex-start' } : null),
            }}
        >
            <BlurView intensity={100} tint={isDark ? 'dark' : 'light'} style={{ flex: 1, borderRadius: 24 }}>
                <View style={{ backgroundColor: isDark ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.4)', borderRadius: 24 }}>
                    <View className="px-5 pt-3 pb-1 flex-row items-center justify-end">
                        <TouchableOpacity
                            onPress={onClose}
                            className="w-8 h-8 items-center justify-center rounded-full"
                            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#F3F4F6' }}
                        >
                            <Ionicons name="close" size={20} color={theme.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ maxHeight: windowHeight * 0.72 }} bounces={false} showsVerticalScrollIndicator={false}>
                    <View className="px-5 pb-1">
                        {photos.length > 0 ? (
                            <View className="mb-2">
                                <Image
                                    source={{ uri: photos[Math.min(photo, photos.length - 1)] }}
                                    className="rounded-2xl"
                                    style={{ width: '100%', height: 150, borderRadius: 16, backgroundColor: theme.surface }}
                                    resizeMode="cover"
                                />
                                {photos.length > 1 && (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 6 }}>
                                        {photos.map((uri, index) => (
                                            <TouchableOpacity key={uri} onPress={() => setPhoto(index)} activeOpacity={0.8}>
                                                <Image
                                                    source={{ uri }}
                                                    style={{ width: 44, height: 44, borderRadius: 6, borderWidth: 2, borderColor: index === photo ? theme.primary : 'transparent' }}
                                                />
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                            </View>
                        ) : (
                        <View
                            className="rounded-2xl overflow-hidden mb-2"
                            style={{ height: imageBoxHeight }}
                            onLayout={({ nativeEvent }) => setImageBoxWidth(nativeEvent.layout.width)}
                        >
                            <Image
                                source={placeImage}
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: (imageBoxHeight - displayedImageHeight) / 2,
                                    width: imageWidth * imageScale,
                                    height: displayedImageHeight,
                                }}
                                resizeMode="contain"
                            />
                            {placeVideo ? (
                                <Video
                                    // remount per asset so a source swap never reuses a stale player
                                    key={placeVideo}
                                    source={placeVideo}
                                    style={{
                                        position: 'absolute', left: 0, top: 0, right: 0, bottom: 0,
                                        opacity: readyVideo === placeVideo ? 1 : 0,
                                    }}
                                    resizeMode={ResizeMode.COVER}
                                    shouldPlay
                                    isLooping
                                    isMuted
                                    onReadyForDisplay={() => setReadyVideo(placeVideo)}
                                    onError={(e) => console.warn('[PlaceDetailPreview] video error', e)}
                                />
                            ) : null}
                        </View>
                        )}

                        <Text className="text-xl font-bold mb-0.5" style={{ color: theme.textPrimary }} numberOfLines={2}>
                            {place.name}
                        </Text>

                        <Text className="text-xs mb-1" style={{ color: theme.textSecondary }} numberOfLines={1}>
                            {categoryLabel}
                            {locationLine ? ` • ${locationLine}` : ''}
                        </Text>
                        {!!place.businessId && <OpenLine state={openNow} />}

                        {!!firstOffer && (
                            <View className="mt-2 mb-1">
                                <CardOffer
                                    offer={firstOffer}
                                    moreCount={business.offers.length - 1}
                                    image={photos[0]}
                                    catalog={catalog}
                                    onUse={() => openOffer(firstOffer.id)}
                                />
                            </View>
                        )}
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{
                            paddingHorizontal: 20,
                            paddingBottom: 8,
                            paddingTop: 4,
                        }}
                    >
                        <ActionPill
                            icon="navigate"
                            label={t('directions')}
                            onPress={routeTo(onDirections)}
                            primary
                        />
                        {!!phoneUrl && <ActionPill icon="call-outline" label={t('call')} onPress={() => call(phoneUrl)} />}
                        <ActionPill
                            icon="car-outline"
                            label={t('taxi')}
                            onPress={routeTo(onTaxi)}
                        />
                        <ActionPill
                            icon={savedPlace ? 'bookmark' : 'bookmark-outline'}
                            label={t('save')}
                            onPress={savedPlace ? handleUnsavePlace : () => router.push({
                                pathname: '/places/save',
                                // counted as a save only once the save screen succeeds
                                params: { lat: place.latitude, lng: place.longitude, name: place.name, ...(place.businessId && { businessId: place.businessId }) },
                            } as any)}
                        />
                        {!!place.businessId && (
                            <ActionPill
                                icon={business.following ? 'notifications' : 'notifications-outline'}
                                label={t(business.following ? 'following' : 'follow')}
                                onPress={toggleFollow}
                            />
                        )}
                        {/* {isClaimableBusiness() && (
                            <ActionPill
                                icon="briefcase-outline"
                                label={t('claim')}
                                onPress={handleClaimBusiness}
                            />
                        )} */}
                        <ActionPill
                            icon="share-social-outline"
                            label={t('share')}
                            onPress={handleShare}
                        />
                    </ScrollView>

                    {!!business.place && (
                        <View style={{ marginHorizontal: 20, paddingBottom: 4 }}>
                            <TouchableOpacity
                                onPress={() => setShowDetails((v) => !v)}
                                activeOpacity={0.7}
                                className="flex-row items-center py-2"
                                accessibilityRole="button"
                                accessibilityState={{ expanded: showDetails }}
                            >
                                <Ionicons name="information-circle-outline" size={17} color={theme.textSecondary} style={{ marginRight: 10 }} />
                                <Text className="flex-1" style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '600' }}>
                                    {t(showDetails ? 'hide-details' : 'business-details-toggle')}
                                </Text>
                                <Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={17} color={theme.textSecondary} />
                            </TouchableOpacity>
                            {showDetails && <CardDetails place={business.place} openNow={openNow} catalog={catalog} onCall={call} />}
                        </View>
                    )}
                    </ScrollView>

                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginHorizontal: 20,
                            paddingTop: 8,
                            paddingBottom: 10,
                            borderTopWidth: 1,
                            borderTopColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                        }}
                    >
                        <Text
                            style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18, includeFontPadding: false, flexShrink: 1, marginRight: 12 }}
                            numberOfLines={1}
                        >
                            {t('know-this-place')}
                        </Text>
                        <TouchableOpacity
                            onPress={handleContribute}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={t('suggest-an-edit')}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={{ flexDirection: 'row', alignItems: 'center' }}
                        >
                            <Ionicons name="create-outline" size={16} color={colors.primary.main} />
                            <Text
                                style={{ marginLeft: 6, color: colors.primary.main, fontSize: 13, lineHeight: 18, fontWeight: '600', includeFontPadding: false, textAlignVertical: 'center' }}
                                numberOfLines={1}
                            >
                                {t('suggest-an-edit')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </BlurView>
        </View>
    );
};
