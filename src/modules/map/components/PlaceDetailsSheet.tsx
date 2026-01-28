import React from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';

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

    if (!place) return null;

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
                        className="rounded-xl py-4 flex-row items-center justify-center"
                    >
                        <Ionicons name="navigate" size={20} color="white" />
                        <Text className="text-white font-semibold text-lg ml-2">
                            {t('directions')}
                        </Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
};
