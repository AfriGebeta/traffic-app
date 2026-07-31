import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useTranslation } from 'react-i18next';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import { maneuverIcon } from '../../navigation/utils/instructionEngine';

interface NavigationBarProps {
    destination: GeocodingPlace;
    onStop: () => void;
    onMinimize?: () => void;
    simulateMovement?: boolean;
    userLocation?: { lat: number; lng: number } | null;
    currentInstruction?: string;
    nextInstruction?: string;
    remainingDistance?: number;
    remainingTime?: number;
    hasIncidentAlert?: boolean;
    maneuverType?: number;
    maneuverDistance?: number;
    nextManeuverType?: number;
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
    nextInstruction,
    remainingDistance,
    remainingTime,
    hasIncidentAlert = false,
    maneuverType,
    maneuverDistance,
    nextManeuverType,
}) => {
    const [distance, setDistance] = useState<number>(0);
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { colors: theme } = useTheme();

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

    const directionIcon = (maneuverType !== undefined
        ? maneuverIcon(maneuverType)
        : getDirectionIcon(currentInstruction)) as keyof typeof Ionicons.glyphMap;

    const nextDirectionIcon = (nextManeuverType !== undefined
        ? maneuverIcon(nextManeuverType)
        : getDirectionIcon(nextInstruction)) as keyof typeof Ionicons.glyphMap;

    return (
        <View className="absolute left-4 right-4" style={{ top: insets.top + (hasIncidentAlert ? 112 : 18) }}>
            <View
                style={{
                    backgroundColor: '#0F9D58',
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    borderBottomLeftRadius: 20,
                    borderBottomRightRadius: 20,
                    padding: 20,
                }}
            >
                <Text className="text-white text-3xl font-bold mb-1">
                    {currentInstruction || 'Go straight ahead'}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>
                    for {formatDistance(
                        maneuverDistance ?? remainingDistance ?? distance * 1000
                    )}
                </Text>
            </View>

            {nextInstruction && (
                <View className="absolute -right-0.5" style={{ top: '100%' }}>
                    <View
                        style={{
                            backgroundColor: theme.surface,
                            borderTopLeftRadius: 0,
                            borderTopRightRadius: 0,
                            borderBottomLeftRadius: 12,
                            borderBottomRightRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <Ionicons name={nextDirectionIcon} size={12} color="#0F9D58" />
                        <Text style={{ color: '#0F9D58', fontSize: 12 }} numberOfLines={1}>
                            then {nextInstruction.toLowerCase()}
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
};
