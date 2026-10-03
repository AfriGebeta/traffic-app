import React, { useRef } from 'react';
import { TouchableOpacity, View } from 'react-native';
import FloatingLayersIcon from '../../../../assets/images/floating-layers.svg';
import DarkLayersIcon from '../../../../assets/images/dark-layers.svg';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useGlass } from '../../../shared/theme/glass';
import { GlassSheen } from '../../../shared/components/GlassSheen';

interface MapLayersButtonProps {
    // Receives the button's window-relative frame so the popup can anchor to it.
    onPress?: (anchor: { y: number; height: number }) => void;
}

export const MapLayersButton: React.FC<MapLayersButtonProps> = ({ onPress }) => {
    const { isDark } = useTheme();
    const glass = useGlass();
    const ref = useRef<View>(null);

    const LayersIcon = isDark ? DarkLayersIcon : FloatingLayersIcon;

    const handlePress = () => {
        ref.current?.measureInWindow((_x, y, _w, height) => onPress?.({ y, height }));
    };

    return (
        <View ref={ref} className="items-end" collapsable={false}>
            <TouchableOpacity
                onPress={handlePress}
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
