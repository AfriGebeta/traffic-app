import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Share, ScrollView, Image, ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { colors } from '../../../shared/theme/colors';
import type { GeocodingPlace } from '../types/navigation.types';
import { SavePlaceModal } from '../../places/components/SavePlaceModal';
import { placeService } from '../../places/services/place.service';
import { showToast } from '../../../shared/utils/toast';
import type { SavedPlaceType, SavedPlace } from '../../places/types/place.types';

interface PlaceDetailPreviewProps {
    place: GeocodingPlace;
    userLocation?: { lat: number; lng: number } | null;
    onDirections: () => void;
    onStart: () => void;
    onTaxi: () => void;
    onContribute: (location: { lat: number; lng: number }) => void;
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
        style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 9,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: primary ? colors.primary.main : colors.primary.light,
            marginRight: 8,
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
                fontWeight: '600',
                color: primary ? '#FFFFFF' : colors.primary.main,
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
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [savedPlace, setSavedPlace] = useState<SavedPlace | null>(null);
    const router = useRouter();

    useEffect(() => {
        checkIfSaved();
    }, [place]);

    const checkIfSaved = async () => {
        const saved = await placeService.isPlaceSaved(place.latitude, place.longitude);
        setSavedPlace(saved);
    };

    const handleSavePlace = async (type: SavedPlaceType, label: string, isPrivate: boolean) => {
        try {
            const saved = await placeService.savePlace({
                type,
                lat: place.latitude,
                lng: place.longitude,
                label,
                isPrivate,
            });
            setSavedPlace(saved);
            showToast.success(t('place-saved-successfully'));
        } catch (error) {
            showToast.error(t('failed-to-save-place'));
        }
    };

    const handleUnsavePlace = async () => {
        if (!savedPlace) return;
        try {
            await placeService.deleteSavedPlace(savedPlace.id);
            setSavedPlace(null);
            showToast.success(t('place-removed'));
        } catch (error) {
            showToast.error(t('failed-to-remove-place'));
        }
    };

    const handleShare = async () => {
        const url = `https://maps.gebeta.app/?lat=${place.latitude}&lng=${place.longitude}&name=${encodeURIComponent(place.name)}`;
        await Share.share({
            message: `Check out ${place.name} on Gebeta Maps: ${url}`,
            url,
        });
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
        onContribute({ lat: place.latitude, lng: place.longitude });
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
    const categoryLabel = place.type || t('location');

    const getPlaceImage = () => {
        const placeType = (place.type || place.category || '').toLowerCase();


        if (placeType.includes('coffee') || placeType.includes('cafe') || placeType.includes('teahouse')) {
            return require('../../../../assets/images/coffee-shop-place-detail.png');
        }
        if (placeType.includes('restaurant') || placeType.includes('hotel') || placeType.includes('food') ) {
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

    return (
        <View
            className="absolute rounded-3xl shadow-2xl overflow-hidden self-center"
            style={{
                bottom: insets.bottom > 0 ? insets.bottom + 8 : 36,
                width: '92%',
                maxWidth: 480,
                alignSelf: 'center',
            }}
        >
            <BlurView intensity={100} tint="light" style={{ flex: 1, borderRadius: 24 }}>
                <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.4)', borderRadius: 24 }}>
                    <View className="px-5 pt-4 flex-row items-center justify-end">
                        <TouchableOpacity
                            onPress={onClose}
                            className="w-9 h-9 items-center justify-center rounded-full bg-gray-100"
                        >
                            <Ionicons name="close" size={22} color="#374151" />
                        </TouchableOpacity>
                    </View>

                    <View className="px-5 pb-2">
                        <View
                            className="rounded-2xl overflow-hidden mb-3"
                            style={{ height: 112 }}
                        >
                            <Image
                                source={getPlaceImage()}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="contain"
                            />
                            <TouchableOpacity
                                onPress={handleContribute}
                                activeOpacity={0.8}
                                style={{
                                    position: 'absolute',
                                    bottom: 16,
                                    left: 0,
                                    maxWidth: '95%',
                                    alignSelf: 'flex-start',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: colors.primary.main,
                                    borderTopLeftRadius: 0,
                                    borderBottomLeftRadius: 0,
                                    borderTopRightRadius: 6,
                                    borderBottomRightRadius: 6,
                                    paddingVertical: 5,
                                    paddingHorizontal: 11,
                                }}
                            >
                                <Text
                                    style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                >
                                    {t('contribute')}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <Text className="text-xl font-bold text-gray-900 mb-1" numberOfLines={2}>
                            {place.name}
                        </Text>

                        <Text className="text-xs text-gray-600 mb-1" numberOfLines={1}>
                            {categoryLabel}
                            {locationLine ? ` • ${locationLine}` : ''}
                        </Text>
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{
                            paddingHorizontal: 20,
                            paddingBottom: 14,
                            paddingTop: 6,
                        }}
                    >
                        <ActionPill
                            icon="navigate"
                            label={t('directions')}
                            onPress={onDirections}
                            primary
                        />
                        <ActionPill
                            icon="car-outline"
                            label={t('taxi')}
                            onPress={onTaxi}
                        />
                        <ActionPill
                            icon={savedPlace ? 'bookmark' : 'bookmark-outline'}
                            label={t('save')}
                            onPress={savedPlace ? handleUnsavePlace : () => setShowSaveModal(true)}
                        />
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

                    <SavePlaceModal
                        visible={showSaveModal}
                        onClose={() => setShowSaveModal(false)}
                        onSave={handleSavePlace}
                        placeName={place.name}
                    />
                </View>
            </BlurView>
        </View>
    );
};
