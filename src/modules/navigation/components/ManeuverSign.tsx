import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { getManeuverDisplay } from '../utils/navigationPreviewUtils';
import type { Maneuver } from '../types/navigation.types';

interface ManeuverSignProps {
    maneuver: Maneuver;
    size?: 'large' | 'medium';
}

export const ManeuverSign: React.FC<ManeuverSignProps> = ({ maneuver, size = 'large' }) => {
    const display = getManeuverDisplay(maneuver);
    const isLarge = size === 'large';
    const boxSize = isLarge ? 88 : 56;
    const iconSize = isLarge ? 44 : 28;

    return (
        <View className="items-center">
            <View
                style={{
                    width: boxSize,
                    height: boxSize,
                    borderRadius: 16,
                    backgroundColor: colors.primary.main,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: colors.primary.main,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 8,
                }}
            >
                <View style={{ transform: [{ rotate: `${display.rotation}deg` }] }}>
                    <Ionicons
                        name={display.icon as keyof typeof Ionicons.glyphMap}
                        size={iconSize}
                        color="#FFFFFF"
                    />
                </View>
            </View>
            {isLarge && display.label && (
                <View
                    className="mt-2 px-3 py-1 rounded-full"
                    style={{ backgroundColor: colors.primary.main }}
                >
                    <Text className="text-white text-xs font-bold">{display.label}</Text>
                </View>
            )}
        </View>
    );
};
