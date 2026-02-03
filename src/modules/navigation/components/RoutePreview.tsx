import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { colors } from '../../../shared/theme/colors';

interface RoutePreviewProps {
    distance: number;
    duration: number;
    destinationName: string;
    simulateMovement: boolean;
    onSimulateToggle: () => void;
    onStartNavigation: () => void;
    onCancel: () => void;
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
}) => {
    const { t } = useTranslation();

    return (
        <View className="absolute bottom-0 pb-8 left-0 right-0 bg-white rounded-t-3xl shadow-2xl">
            <View className="px-6 pt-4  border-b border-gray-100">
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
            <ScrollView className="max-h-48">
                <View className="px-6 py-4">
                    <View className="flex-row items-start mb-4">
                        <View className="w-8 items-center pt-1">
                            <View className="w-3 h-3 rounded-full bg-blue-500" />
                            <View className="w-0.5 h-8 bg-gray-300 my-1" />
                        </View>
                        <View className="flex-1 ml-3">
                            <Text className="text-gray-500 text-sm">{t('your-location')}</Text>
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
            </ScrollView>

            <View className="px-6 py-4 border-t border-gray-100">
                <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                        <Text className="text-3xl font-bold text-gray-900">
                            {formatTime(duration)}
                        </Text>
                        <Text className="text-gray-500 text-sm mt-1">
                            {t('eta')} {formatETA(duration)} • {formatDistance(distance)}
                        </Text>
                        <Text className="text-gray-900 font-medium mt-1">{destinationName}</Text>
                    </View>
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
    );
};
