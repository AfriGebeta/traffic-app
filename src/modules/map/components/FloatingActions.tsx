import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FloatingActionsProps {
    onLocationPress?: () => void;
    onOverlayPress?: () => void;
}

export const FloatingActions: React.FC<FloatingActionsProps> = ({
    onLocationPress,
    onOverlayPress,
}) => {
    return (
        <View className="absolute right-4 bottom-44 gap-3">
            <TouchableOpacity
                onPress={onLocationPress}
                className="bg-white rounded-full p-3 shadow-lg"
            >
                <Ionicons name="locate" size={24} color="#F59E0B" />
            </TouchableOpacity>

            <TouchableOpacity
                onPress={onOverlayPress}
                className="bg-white rounded-full p-3 shadow-lg"
            >
                <Ionicons name="layers-outline" size={24} color="#6B7280" />
            </TouchableOpacity>
        </View>
    );
};
