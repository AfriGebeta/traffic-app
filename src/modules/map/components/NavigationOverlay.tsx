import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../../shared/hooks/useTranslation';

interface NavigationOverlayProps {
    remainingTime?: number;
    remainingDistance?: number;
    onReportPress?: () => void;
    onVoiceReportPress?: () => void;
    isOffRoute?: boolean;
    isRecalculating?: boolean;
    onTestOffRoute?: () => void;
}

const formatDistance = (meters: number): string => {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
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
    const { t } = useTranslation();

    return (
        <View className="absolute bottom-6 left-4 right-4">
            <View
                className="rounded-3xl p-4 border border-white/10"
                style={{ backgroundColor: 'rgba(55, 65, 81, 0.75)' }}
            >
                {/*off-route*/}
                {isRecalculating && (
                    <View className="mb-3 bg-orange-500/20 border border-orange-500/50 rounded-xl p-3">
                        <View className="flex-row items-center justify-between">
                            <Text className="text-orange-300 text-sm font-semibold flex-1">
                                Recalculating route...
                            </Text>
                        </View>
                    </View>
                )}

                <View className="mb-3">
                    <Text className="text-gray-300 text-sm text-center">
                        {remainingTime ? formatTime(remainingTime) : '10 min'} •{' '}
                        {remainingDistance ? formatDistance(remainingDistance) : '2 km'}
                    </Text>
                </View>

                <TouchableOpacity
                    className="border border-white/10 rounded-2xl py-3 flex-row items-center justify-center"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                    onPress={onReportPress}
                >
                    <Ionicons name="warning-outline" size={18} color="#FFA500" />
                    <Text className="text-gray-200 text-sm font-medium ml-2">{t('share-what-you-see')}</Text>
                </TouchableOpacity>

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
