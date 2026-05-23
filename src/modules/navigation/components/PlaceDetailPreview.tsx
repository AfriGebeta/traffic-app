import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Share, ScrollView, Image, ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { colors } from '../../../shared/theme/colors';
import type { GeocodingPlace } from '../types/navigation.types';
import { navigationService } from '../services/navigation.service';
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

const formatDistance = (meters: number): string => {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
};

const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours} hr ${minutes} min`;
    }
    return `${minutes} min`;
};

const formatETA = (seconds: number): string => {
    const now = new Date();
    const eta = new Date(now.getTime() + seconds * 1000);
    const hours = eta.getHours();
    const minutes = eta.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

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
    const [duration, setDuration] = useState<number | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [loadingRoute, setLoadingRoute] = useState(false);

    useEffect(() => {
        checkIfSaved();
    }, [place]);

    useEffect(() => {
        fetchRouteEstimate();
    }, [place, userLocation]);

    const fetchRouteEstimate = async () => {
        if (!userLocation) return;

        setLoadingRoute(true);
        try {
            const result = await navigationService.getNavigation({
                origin: [userLocation.lat, userLocation.lng],
                destination: [place.latitude, place.longitude],
                costing: 'auto',
            });

            const leg = result?.data?.trip?.legs?.[0];
            if (leg) {
                setDistance(leg.summary.length * 1000);
                setDuration(leg.summary.time);
            }
        } catch (error) {
            console.error('Error fetching route estimate:', error);
        } finally {
            setLoadingRoute(false);
        }
    };

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
                            className="rounded-2xl bg-gray-200 items-center justify-center mb-3"
                            style={{ height: 112 }}
                        >
                            <Ionicons name="image-outline" size={40} color="#9CA3AF" />
                        </View>

                        <Text className="text-xl font-bold text-gray-900 mb-1" numberOfLines={2}>
                            {place.name}
                        </Text>

                        <Text className="text-xs text-gray-600 mb-1" numberOfLines={1}>
                            {categoryLabel}
                            {locationLine ? ` • ${locationLine}` : ''}
                        </Text>
                    </View>

                    <View className="px-5 py-2 border-t border-gray-100">
                        <View className="bg-gray-200 rounded-2xl p-3">
                            {loadingRoute ? (
                                <View className="py-2 items-center">
                                    <ActivityIndicator size="small" color={colors.primary.main} />
                                </View>
                            ) : duration != null && distance != null ? (
                                <>
                                    <View className="flex-row items-center">
                                        <Image
                                            source={require('../../../../assets/images/car-selected.png')}
                                            style={{ width: 22, height: 22, marginRight: 8 }}
                                            resizeMode="contain"
                                        />
                                        <Text className="text-2xl font-bold text-gray-900">
                                            {formatTime(duration)}
                                        </Text>
                                    </View>
                                    <Text className="text-gray-500 text-sm mt-1">
                                        {t('eta')} {formatETA(duration)} • {formatDistance(distance)}
                                    </Text>
                                </>
                            ) : (
                                <Text className="text-gray-500 text-sm">
                                    {userLocation ? t('route-unavailable') : t('please-wait-for-location')}
                                </Text>
                            )}
                        </View>
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
                            icon="play"
                            label={t('start')}
                            onPress={onStart}
                        />
                        <ActionPill
                            imageSource={require('../../../../assets/images/minibus-selected.png')}
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
