import React from 'react';
import { TouchableOpacity, View, LayoutChangeEvent } from 'react-native';
import FloatingLayersIcon from '../../../../assets/images/floating-layers.svg';
import DarkLayersIcon from '../../../../assets/images/dark-layers.svg';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useGlass } from '../../../shared/theme/glass';
import { GlassSheen } from '../../../shared/components/GlassSheen';

interface MapLayersButtonProps {
    onPress?: () => void;
    onLayout?: (event: LayoutChangeEvent) => void;
}

export const MapLayersButton: React.FC<MapLayersButtonProps> = ({ onPress, onLayout }) => {
    const { isDark } = useTheme();
    const glass = useGlass();

    const LayersIcon = isDark ? DarkLayersIcon : FloatingLayersIcon;

    return (
        <View className="mt-3 items-end" onLayout={onLayout}>
            <TouchableOpacity
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel="Map style"
                className="rounded-full p-3"
                style={glass.surface}
            >
                <GlassSheen />
                <LayersIcon width={24} height={24} />
            </TouchableOpacity>
        </View>
    );
};
