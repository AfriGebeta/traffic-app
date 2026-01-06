import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';

interface DestinationCardProps {
    destination: GeocodingPlace;
    isNavigating: boolean;
    onNavigate: () => void;
    onClear: () => void;
}

export const DestinationCard: React.FC<DestinationCardProps> = ({
    destination,
    isNavigating,
    onNavigate,
    onClear,
}) => {
    return (
        <View className="mt-3 bg-white rounded-3xl shadow-lg p-4 flex-row items-center justify-between">
            <View className="flex-1 mr-3">
                <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                    {destination.name}
                </Text>
                <Text className="text-sm text-gray-500 mt-0.5">{destination.type}</Text>
            </View>
            <View className="flex-row gap-2">
                <TouchableOpacity
                    className="bg-yellow-400 rounded-full px-5 py-3 flex-row items-center gap-2"
                    onPress={onNavigate}
                    disabled={isNavigating}
                >
                    <Ionicons name="navigate" size={18} color="#78350F" />
                    <Text className="text-sm font-semibold text-yellow-900">
                        {isNavigating ? 'Loading...' : 'Go'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    className="bg-gray-100 rounded-full p-3"
                    onPress={onClear}
                >
                    <Ionicons name="close" size={18} color="#6B7280" />
                </TouchableOpacity>
            </View>
        </View>
    );
};
