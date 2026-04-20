import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { colors } from '../../../shared/theme/colors';
import type { GeocodingPlace } from '../types/navigation.types';
import { SavePlaceModal } from '../../places/components/SavePlaceModal';
import { placeService } from '../../places/services/place.service';
import { showToast } from '../../../shared/utils/toast';
import type { SavedPlaceType, SavedPlace } from '../../places/types/place.types';

interface RoutePreviewProps {
    distance: number;
    duration: number;
    destinationName: string;
    simulateMovement: boolean;
    onSimulateToggle: () => void;
    onStartNavigation: () => void;
    onCancel: () => void;
    destination?: GeocodingPlace | null;
}

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

export const RoutePreview: React.FC<RoutePreviewProps> = ({
    distance,
    duration,
    destinationName,
    simulateMovement,
    onSimulateToggle,
    onStartNavigation,
    onCancel,
    destination,
}) => {
    const { t } = useTranslation();
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [savedPlace, setSavedPlace] = useState<SavedPlace | null>(null);

    useEffect(() => {
        checkIfSaved();
    }, [destination]);

    const checkIfSaved = async () => {
        if (!destination) return;
        const saved = await placeService.isPlaceSaved(destination.latitude, destination.longitude);
        setSavedPlace(saved);
    };

    const handleSavePlace = async (type: SavedPlaceType, label: string, isPrivate: boolean) => {
        if (!destination) return;

        try {
            const saved = await placeService.savePlace({
                type,
                lat: destination.latitude,
                lng: destination.longitude,
                label,
                isPrivate,
            });
            setSavedPlace(saved);
            showToast.success(t('place-saved-successfully'));
        } catch (error) {
            showToast.error(t('failed-to-save-place'));
            console.error('Error saving place:', error);
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
            console.error('Error removing place:', error);
        }
    };

    return (
        <View className="absolute bottom-0 pb-11 left-0 right-0 rounded-t-3xl shadow-2xl overflow-hidden">
            <BlurView intensity={100} tint="light" style={{ flex: 1 }}>
                <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.4)' }}>
                    <View className="px-6 pt-4 border-b" style={{ borderBottomColor: 'rgba(229, 231, 235, 0.5)' }}>
                        <View className="flex-row items-center justify-between mb-2">
                            <Text className="text-2xl font-bold text-gray-900">{t('directions')}</Text>
                            <TouchableOpacity
                                onPress={onCancel}
                                className="w-10 h-10 items-center justify-center rounded-full bg-gray-100"
                            >
                                <Ionicons name="close" size={24} color="#374151" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {__DEV__ && (
                        <View className="px-6 py-3 border-b border-gray-100">
                            <TouchableOpacity
                                onPress={onSimulateToggle}
                                className="flex-row items-center justify-between"
                            >
                                <View className="flex-row items-center">
                                    <Ionicons
                                        name={simulateMovement ? "checkmark-circle" : "ellipse-outline"}
                                        size={24}
                                        color={simulateMovement ? colors.primary.main : "#9CA3AF"}
                                    />
                                    <Text className="text-gray-700 font-medium ml-3">
                                        Simulate Movement (testing)
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}
                    <ScrollView className="max-h-48">
                        <View className="px-6 py-3">
                            <View className="bg-gray-200 rounded-2xl p-4">
                                <View className="flex-row items-start mb-3">
                                    <View className="w-8 items-center pt-1">
                                        <View className="w-3 h-3 rounded-full bg-blue-500" />
                                        <View className="w-0.5 h-8 bg-gray-400 my-1" />
                                    </View>
                                    <View className="flex-1 ml-3">
                                        <Text className="text-gray-600 text-sm">{t('your-location')}</Text>
                                    </View>
                                </View>

                                <View className="flex-row items-start">
                                    <View className="w-8 items-center pt-1">
                                        <Ionicons name="location" size={20} color={colors.primary.main} />
                                    </View>
                                    <View className="flex-1 ml-3">
                                        <Text className="text-gray-900 font-semibold text-base">{destinationName}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </ScrollView>

                    <View className="px-6 py-3 border-t border-gray-100 mb-2">
                        <View className="bg-gray-200 rounded-2xl p-4 ">
                            <View className="flex-row items-start justify-between">
                                <View className="flex-1 mr-3">
                                    <Text className="text-3xl font-bold text-gray-900">
                                        {formatTime(duration)}
                                    </Text>
                                    <Text className="text-gray-500 text-sm mt-1">
                                        {t('eta')} {formatETA(duration)} • {formatDistance(distance)}
                                    </Text>
                                    <Text className="text-gray-900 font-medium mt-1" numberOfLines={2} ellipsizeMode="tail">
                                        {destinationName}
                                    </Text>
                                </View>

                                <View className="flex-row items-center flex-shrink-0">
                                    {destination && (
                                        <>
                                            <TouchableOpacity
                                                onPress={savedPlace ? handleUnsavePlace : () => setShowSaveModal(true)}
                                                className="rounded-2xl px-3 py-4 -mr-3"
                                            >
                                                <Ionicons
                                                    name={savedPlace ? "bookmark" : "bookmark-outline"}
                                                    size={24}
                                                    color={colors.primary.main}
                                                />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={async () => {
                                                    const { Share } = await import('react-native');
                                                    const url = `https://maps.gebeta.app/?lat=${destination.latitude}&lng=${destination.longitude}&name=${encodeURIComponent(destination.name)}`;
                                                    Share.share({
                                                        message: `Check out ${destination.name} on Gebeta Maps: ${url}`,
                                                        url: url,
                                                    });
                                                }}
                                                className="rounded-2xl px-3 py-4"
                                            >
                                                <Ionicons name="share-social" size={24} color={colors.primary.main} />
                                            </TouchableOpacity>
                                        </>
                                    )}

                                    <TouchableOpacity
                                        onPress={onStartNavigation}
                                        className="rounded-2xl px-8 py-4 shadow-lg"
                                        style={{
                                            backgroundColor: colors.primary.main,
                                            shadowColor: colors.primary.main,
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: 0.3,
                                            shadowRadius: 8,
                                            elevation: 8,
                                        }}
                                    >
                                        <Text className="text-white text-xl font-bold">{t('go')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>

                    {destination && (
                        <SavePlaceModal
                            visible={showSaveModal}
                            onClose={() => setShowSaveModal(false)}
                            onSave={handleSavePlace}
                            placeName={destination.name}
                        />
                    )}
                </View>
            </BlurView>
        </View>
    );
};
