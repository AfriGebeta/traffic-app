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
        <View className="mt-2 bg-white rounded-2xl shadow-lg p-3 flex-row items-center justify-between">
            <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">{destination.name}</Text>
                <Text className="text-xs text-gray-500">{destination.type}</Text>
            </View>
            <View className="flex-row gap-2">
                <TouchableOpacity
                    className="bg-blue-500 rounded-full px-4 py-2 flex-row items-center gap-1.5"
                    onPress={onNavigate}
                    disabled={isNavigating}
                >
                    <Ionicons name="navigate" size={16} color="#FFFFFF" />
                    <Text className="text-xs font-medium text-white">
                        {isNavigating ? 'Loading...' : 'Navigate'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    className="bg-gray-200 rounded-full p-2"
                    onPress={onClear}
                >
                    <Ionicons name="close" size={16} color="#6B7280" />
                </TouchableOpacity>
            </View>
        </View>
    );
};
