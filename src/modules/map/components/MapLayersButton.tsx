import React from 'react';
import { TouchableOpacity, View, LayoutChangeEvent } from 'react-native';
import FloatingLayersIcon from '../../../../assets/images/floating-layers.svg';
import DarkLayersIcon from '../../../../assets/images/dark-layers.svg';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface MapLayersButtonProps {
    onPress?: () => void;
    onLayout?: (event: LayoutChangeEvent) => void;
}

export const MapLayersButton: React.FC<MapLayersButtonProps> = ({ onPress, onLayout }) => {
    const { colors: theme, isDark } = useTheme();

    const LayersIcon = isDark ? DarkLayersIcon : FloatingLayersIcon;

    return (
        <View className="mt-3 items-end" onLayout={onLayout}>
            <TouchableOpacity
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel="Map style"
                className="rounded-full p-3 shadow-lg"
                style={{
                    backgroundColor: theme.surface,
                    borderWidth: 1,
                    borderColor: theme.border,
                }}
            >
                <LayersIcon width={24} height={24} />
            </TouchableOpacity>
        </View>
    );
};
