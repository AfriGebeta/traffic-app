import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GeocodingPlace } from '../../navigation/services/navigation.service';

interface NavigationBarProps {
    destination: GeocodingPlace;
    onStop: () => void;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({ destination, onStop }) => {
    return (
        <View className="absolute top-12 left-4 right-4">
            <View className="bg-blue-600 rounded-2xl shadow-lg p-4">
                <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                        <Text className="text-white text-lg font-bold">Navigating...</Text>
                        <Text className="text-blue-100 text-sm">{destination.name}</Text>
                    </View>
                    <TouchableOpacity
                        className="bg-white rounded-full p-2"
                        onPress={onStop}
                    >
                        <Ionicons name="close" size={20} color="#2563EB" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};
