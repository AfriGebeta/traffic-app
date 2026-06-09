import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Share, ScrollView, Image, ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    onClose,
}) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [savedPlace, setSavedPlace] = useState<SavedPlace | null>(null);

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

    const locationLine = [place.City, place.Country].filter(Boolean).join(', ');
    const categoryLabel = place.type || t('location');

    const getPlaceImage = () => {
        const placeType = (place.type || place.category || '').toLowerCase();


        if (placeType.includes('restaurant') || placeType.includes('hotel') || placeType.includes('cafe') || placeType.includes('food') || placeType.includes('coffee') || placeType.includes('teahouse')) {
            return require('../../../../assets/images/restaurant-detail.png');
        }
        if (placeType.includes('bank')) {
            return require('../../../../assets/images/bank-detail.png');
        }
        if (placeType.includes('atm')) {
            return require('../../../../assets/images/atm-detail.png');
        }
        if (placeType.includes('gas') || placeType.includes('fuel') || placeType.includes('petrol')) {
            return require('../../../../assets/images/gas-detail.png');
        }
        if (placeType.includes('parking')) {
            return require('../../../../assets/images/parking-detail.png');
        }
        if (placeType.includes('repair') || placeType.includes('garage') || placeType.includes('mechanic')) {
            return require('../../../../assets/images/repair-detail.png');
        }
        if (placeType.includes('taxi')) {
            return require('../../../../assets/images/taxi-detail.png');
        }

        return require('../../../../assets/images/random-detail.png');
    };

    return (
        <View
            className="absolute left-4 right-4 rounded-3xl shadow-2xl overflow-hidden"
            style={{ bottom: insets.bottom > 0 ? insets.bottom + 8 : 36 }}
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
                                resizeMode="cover"
                            />
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
