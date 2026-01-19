import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NavigationOverlayProps {
    remainingTime?: number;
    remainingDistance?: number;
    onReportPress?: () => void;
    onVoiceReportPress?: () => void;
    isOffRoute?: boolean;
    isRecalculating?: boolean;
    onTestOffRoute?: () => void;
}

const formatDistance = (km: number): string => {
    if (km < 1) {
        return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1)} km`;
};

const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
};

export const NavigationOverlay: React.FC<NavigationOverlayProps> = ({
    remainingTime,
    remainingDistance,
    onReportPress,
    onVoiceReportPress,
    isOffRoute,
    isRecalculating,
    onTestOffRoute,
}) => {
    return (
        <View className="absolute bottom-6 left-4 right-4">
            <View
                className="rounded-3xl p-4 border border-white/10"
                style={{ backgroundColor: 'rgba(55, 65, 81, 0.75)' }}
            >
                {/*off-route*/}
                {(isOffRoute || isRecalculating) && (
                    <View className="mb-3 bg-orange-500/20 border border-orange-500/50 rounded-xl p-2">
                        <Text className="text-orange-300 text-sm text-center font-semibold">
                            {isRecalculating ? ' Recalculating route...' : ' Off route'}
                        </Text>
                    </View>
                )}

                <View className="mb-3">
                    <Text className="text-gray-300 text-sm text-center">
                        {remainingTime ? formatTime(remainingTime) : '10 min'} •{' '}
                        {remainingDistance ? formatDistance(remainingDistance) : '2 km'}
                    </Text>
                </View>

                <View className="flex-row gap-2">
                    <TouchableOpacity
                        className="flex-1 border border-white/10 rounded-2xl py-3 flex-row items-center justify-center"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                        onPress={onReportPress}
                    >
                        <Ionicons name="warning-outline" size={18} color="#FFA500" />
                        <Text className="text-gray-200 text-sm font-medium ml-2">Share What You See</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="border border-white/10 rounded-2xl p-3"
                        style={{ backgroundColor: 'rgba(255, 165, 0, 0.15)' }}
                        onPress={onVoiceReportPress}
                    >
                        <Ionicons name="mic" size={20} color="#FFA500" />
                    </TouchableOpacity>
                </View>

                {/*test button REMOVE IT LATER*/}
                {__DEV__ && onTestOffRoute && (
                    <TouchableOpacity
                        className="mt-3 bg-purple-500/20 border border-purple-500/50 rounded-xl py-2"
                        onPress={onTestOffRoute}
                    >
                        <Text className="text-purple-300 text-xs text-center font-semibold">
                             Test Off-Route Detection
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};
