import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { colors } from '../../../shared/theme/colors';

interface NavigationOverlayProps {
    remainingTime?: number;
    remainingDistance?: number;
    destination?: string;
    onReportPress?: () => void;
    onVoiceReportPress?: () => void;
    onExitPress?: () => void;
    isOffRoute?: boolean;
    isRecalculating?: boolean;
    onTestOffRoute?: () => void;
    showRecenterButton?: boolean;
    onRecenter?: () => void;
}

const formatDistance = (meters: number): string => {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
};

const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 1) {
        return '< 1 min';
    }
    return `${minutes} min`;
};

export const NavigationOverlay: React.FC<NavigationOverlayProps> = ({
    remainingTime,
    remainingDistance,
    destination,
    onReportPress,
    onVoiceReportPress,
    onExitPress,
    isOffRoute,
    isRecalculating,
    onTestOffRoute,
    showRecenterButton,
    onRecenter,
}) => {
    useKeepAwake();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    const getETA = () => {
        if (!remainingTime) return '';
        const now = new Date();
        const eta = new Date(now.getTime() + remainingTime * 1000);
        return eta.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    return (
        <View className="absolute left-4 right-4" style={{ bottom: insets.bottom + 24 }}>
            <View
                className="rounded-3xl p-4"
                style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.75)',
                }}
            >
                {isRecalculating && (
                    <View className="mb-3 bg-orange-50 border border-orange-200 rounded-xl p-3">
                        <View className="flex-row items-center justify-between">
                            <Text className="text-orange-600 text-sm font-semibold flex-1">
                                Recalculating route...
                            </Text>
                        </View>
                    </View>
                )}

                {showRecenterButton && onRecenter && (
                    <TouchableOpacity
                        className="mb-3 border rounded-2xl py-3 flex-row items-center justify-center"
                        style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', borderColor: '#FFA500' }}
                        onPress={onRecenter}
                    >
                        <Text className="text-orange-600 text-sm font-bold ml-2">{t('recenter') || 'Re-center'}</Text>
                    </TouchableOpacity>
                )}

                <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                        <Text className="text-gray-900 text-2xl font-bold">
                            {remainingTime ? formatTime(remainingTime) : '-- min'}
                        </Text>
                        <Text className="text-gray-500 text-xs mt-0.5">
                            ETA {getETA()}
                        </Text>
                        <Text className="text-gray-900 text-sm font-semibold mt-1" numberOfLines={1}>
                            {destination || 'Destination'}
                        </Text>
                    </View>

                    <View className="flex-row gap-2">
                        <TouchableOpacity
                            className="rounded-xl px-4 py-3"
                            style={{ backgroundColor: '#F3F4F6' }}
                            onPress={onReportPress}
                        >
                            <Text className="text-gray-700 text-xs font-semibold">
                                {t('share-what-you-see')}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="rounded-xl px-6 py-3"
                            style={{ backgroundColor: colors.primary.main }}
                            onPress={onExitPress}
                        >
                            <Text className="text-white text-sm font-bold">
                                {t('exit') || 'Exit'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
};
