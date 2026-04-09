import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import { ShareLocationButton } from '../../../shared/components/ShareLocationButton';
import { SavePlaceModal } from '../../places/components/SavePlaceModal';
import { placeService } from '../../places/services/place.service';
import { showToast } from '../../../shared/utils/toast';
import type { SavedPlaceType, SavedPlace } from '../../places/types/place.types';

interface PlaceDetailsSheetProps {
    place: GeocodingPlace | null;
    onClose: () => void;
    onNavigate: (place: GeocodingPlace) => void;
}

export const PlaceDetailsSheet: React.FC<PlaceDetailsSheetProps> = ({
    place,
    onClose,
    onNavigate,
}) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [savedPlace, setSavedPlace] = useState<SavedPlace | null>(null);

    useEffect(() => {
        checkIfSaved();
    }, [place]);

    const checkIfSaved = async () => {
        if (!place) return;
        const saved = await placeService.isPlaceSaved(place.latitude, place.longitude);
        setSavedPlace(saved);
    };

    if (!place) return null;

    console.log('PlaceDetailsSheet - place data:', {
        lat: place.latitude,
        lng: place.longitude,
        name: place.name,
    });

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
        <Modal
            visible={!!place}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable
                className="flex-1 justify-end bg-black/50"
                onPress={onClose}
            >
                <Pressable
                    className="bg-white rounded-t-3xl p-6"
                    style={{ paddingBottom: insets.bottom + 24 }}
                    onPress={(e) => e.stopPropagation()}
                >
                    <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

                    <View className="flex-row items-start mb-4">
                        <View className="flex-1">
                            <Text className="text-2xl font-bold text-gray-900 mb-1">
                                {place.name}
                            </Text>
                            {(place.City || place.Country) && (
                                <Text className="text-sm text-gray-600">
                                    {[place.City, place.Country].filter(Boolean).join(', ')}
                                </Text>
                            )}
                            <View className="flex-row items-center mt-2">
                                <Ionicons name="location" size={16} color="#6B7280" />
                                <Text className="text-sm text-gray-600 ml-1">
                                    {place.type}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            className="p-2"
                        >
                            <Ionicons name="close" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        onPress={() => {
                            onNavigate(place);
                            onClose();
                        }}
                        style={{ backgroundColor: colors.primary.main }}
                        className="rounded-xl py-4 px-4 flex-row items-center justify-center"
                    >
                        <Text className="text-white font-semibold text-base" numberOfLines={1}>
                            {t('directions')}
                        </Text>
                    </TouchableOpacity>

                    <View className="flex-row gap-3 mt-3">
                        <View className="flex-1">
                            <ShareLocationButton
                                location={{
                                    lat: place.latitude,
                                    lng: place.longitude,
                                    name: place.name,
                                    city: place.City,
                                    country: place.Country,
                                    type: place.type,
                                }}
                                variant="secondary"
                                size="medium"
                            />
                        </View>
                        <TouchableOpacity
                            onPress={savedPlace ? handleUnsavePlace : () => setShowSaveModal(true)}
                            className="bg-gray-100 rounded-xl py-4 px-4 flex-row items-center justify-center"
                            style={{ minWidth: 60 }}
                        >
                            <Ionicons
                                name={savedPlace ? "bookmark" : "bookmark-outline"}
                                size={20}
                                color="#1F2937"
                            />
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>

            <SavePlaceModal
                visible={showSaveModal}
                onClose={() => setShowSaveModal(false)}
                onSave={handleSavePlace}
                placeName={place.name}
            />
        </Modal>
    );
};
