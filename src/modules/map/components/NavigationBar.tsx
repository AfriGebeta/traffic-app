import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { useTranslation } from 'react-i18next';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';

interface NavigationBarProps {
    destination: GeocodingPlace;
    onStop: () => void;
    onMinimize?: () => void;
    simulateMovement?: boolean;
    userLocation?: { lat: number; lng: number } | null;
    currentInstruction?: string;
    remainingDistance?: number;
    remainingTime?: number;
    hasIncidentAlert?: boolean;
}

const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const formatDistance = (meters: number): string => {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
};

const getDirectionIcon = (instruction?: string): keyof typeof Ionicons.glyphMap => {
    if (!instruction) return 'arrow-up';

    const lowerInstruction = instruction.toLowerCase();

    if (lowerInstruction.includes('left')) return 'arrow-back';
    if (lowerInstruction.includes('right')) return 'arrow-forward';
    if (lowerInstruction.includes('straight') || lowerInstruction.includes('continue')) return 'arrow-up';
    if (lowerInstruction.includes('u-turn') || lowerInstruction.includes('uturn')) return 'return-down-back';

    return 'arrow-up';
};

export const NavigationBar: React.FC<NavigationBarProps> = ({
    destination,
    onStop,
    onMinimize,
    simulateMovement,
    userLocation,
    currentInstruction,
    remainingDistance,
    remainingTime,
    hasIncidentAlert = false,
}) => {
    const [distance, setDistance] = useState<number>(0);
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();

    useEffect(() => {
        if (userLocation) {
            const dist = calculateDistance(
                userLocation.lat,
                userLocation.lng,
                destination.latitude,
                destination.longitude
            );
            setDistance(dist);
        }
    }, [userLocation, destination]);

    const formatTime = (seconds: number): string => {
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
            return `${minutes} min`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    };

    const directionIcon = getDirectionIcon(currentInstruction);

    return (
        <View className="absolute left-4 right-4" style={{ top: insets.top + (hasIncidentAlert ? 112 : 18) }}>
            <View
                className="border border-white/10"
                style={{
                    backgroundColor: 'rgba(55, 65, 81, 0.75)',
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    borderBottomLeftRadius: 24,
                    borderBottomRightRadius: 0,
                    padding: 16,
                }}
            >
                <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                        <View className="flex-row items-baseline gap-2 mb-1">
                            <Text className="text-white text-2xl font-extrabold">
                                {remainingDistance !== undefined ? formatDistance(remainingDistance) : formatDistance(distance * 1000)}
                            </Text>
                            {remainingTime !== undefined && (
                                <Text className="text-gray-300 text-base font-bold">
                                    • {formatTime(remainingTime)}
                                </Text>
                            )}
                        </View>
                        <Text className="text-gray-300 text-sm font-semibold mb-2" numberOfLines={1}>
                            {destination.name}
                        </Text>
                        {onMinimize && (
                            <TouchableOpacity
                                onPress={onMinimize}
                                className="self-start mt-1 px-3 py-1.5 rounded-lg"
                                style={{
                                    backgroundColor: 'transparent',
                                    borderWidth: 1.5,
                                    borderColor: colors.primary.main
                                }}
                            >
                                <Text className="text-sm font-bold" style={{ color: colors.primary.main }}>
                                    {t('minimize') || 'Minimize'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity
                        className="bg-white/10 rounded-full p-3"
                        onPress={onStop}
                        style={{ borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)' }}
                    >
                        <Ionicons name="close" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

                {currentInstruction && (
                    <View className="absolute -bottom-10 -right-0.5">
                        <View
                            className="px-3 py-2 flex-row items-center gap-2 border border-white/10"
                            style={{
                                backgroundColor: 'rgba(55, 65, 81, 0.75)',
                                borderTopLeftRadius: 0,
                                borderTopRightRadius: 0,
                                borderBottomLeftRadius: 12,
                                borderBottomRightRadius: 12,
                            }}
                        >
                            <Ionicons name={directionIcon} size={18} color="#FFA500" />
                            <Text className="text-white text-xs font-bold" numberOfLines={1} style={{ maxWidth: 150 }}>
                                {currentInstruction}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
};
