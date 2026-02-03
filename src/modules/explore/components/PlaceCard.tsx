import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';

interface PlaceCardProps {
    place: GeocodingPlace;
    onPress: (place: GeocodingPlace) => void;
}

export const PlaceCard: React.FC<PlaceCardProps> = ({ place, onPress }) => {
    return (
        <TouchableOpacity
            onPress={() => onPress(place)}
            className="bg-white rounded-xl mr-3 border border-gray-200 w-52 overflow-hidden"
        >
            {place.image ? (
                <Image
                    source={{ uri: place.image }}
                    className="w-full h-24 bg-gray-200"
                    resizeMode="cover"
                />
            ) : (
                <View className="w-full h-24 bg-gray-200 items-center justify-center">
                    <Ionicons name="image-outline" size={32} color="#9CA3AF" />
                </View>
            )}

            <View className="p-3">
                <Text className="text-sm font-semibold text-gray-900 mb-1" numberOfLines={2}>
                    {place.name}
                </Text>
                {(place.City || place.Country) && (
                    <Text className="text-xs text-gray-600" numberOfLines={1}>
                        {[place.City, place.Country].filter(Boolean).join(', ')}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );
};
