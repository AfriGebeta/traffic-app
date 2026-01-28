import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
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
            className="bg-white rounded-xl py-8 px-4 mr-3 border border-gray-200 w-64 min-h-[80px]"
        >
            <View className="flex-row items-start">
                
                <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900 mb-1" numberOfLines={1}>
                        {place.name}
                    </Text>
                    {(place.City || place.Country) && (
                        <Text className="text-sm text-gray-600" numberOfLines={1}>
                            {[place.City, place.Country].filter(Boolean).join(', ')}
                        </Text>
                    )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </View>
        </TouchableOpacity>
    );
};
