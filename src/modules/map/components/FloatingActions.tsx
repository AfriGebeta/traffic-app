import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Animated } from 'react-native';
import FloatingLocationIcon from '../../../../assets/images/floating-location.svg';
import FloatingLayersIcon from '../../../../assets/images/floating-layers.svg';
import FloatingTaxiIcon from '../../../../assets/images/floating-taxi.svg';
import DarkLocationIcon from '../../../../assets/images/dark-target.svg';
import DarkLayersIcon from '../../../../assets/images/dark-layers.svg';
import DarkTaxiIcon from '../../../../assets/images/dark-taxi.svg';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface FloatingActionsProps {
    onLocationPress?: () => void;
    onThemePress?: () => void;
    onTaxiPress?: () => void;
    isRoutePreviewActive?: boolean;
    isPlaceDetailActive?: boolean;
}

export const FloatingActions: React.FC<FloatingActionsProps> = ({
    onLocationPress,
    onThemePress,
    onTaxiPress,
    isRoutePreviewActive = false,
    isPlaceDetailActive = false,
}) => {
    const { colors: theme, isDark } = useTheme();
    const bottomPosition = useRef(new Animated.Value(110)).current;

    const LocationIcon = isDark ? DarkLocationIcon : FloatingLocationIcon;
    const LayersIcon = isDark ? DarkLayersIcon : FloatingLayersIcon;
    const TaxiIcon = isDark ? DarkTaxiIcon : FloatingTaxiIcon;

    useEffect(() => {
        let targetBottom = 160;
        if (isRoutePreviewActive) {
            targetBottom = 340;
        } else if (isPlaceDetailActive) {
            targetBottom = 345;
        }
        Animated.timing(bottomPosition, {
            toValue: targetBottom,
            duration: 250,
            useNativeDriver: false,
        }).start();
    }, [isRoutePreviewActive, isPlaceDetailActive]);

    return (
        <Animated.View className="absolute right-4 gap-3" style={{ bottom: bottomPosition }}>
            <TouchableOpacity
                onPress={onLocationPress}
                className="rounded-full p-3 shadow-lg"
                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
            >
                <LocationIcon width={24} height={24} />
            </TouchableOpacity>

            <TouchableOpacity
                onPress={onThemePress}
                className="rounded-full p-3 shadow-lg"
                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
            >
                <LayersIcon width={24} height={24} />
            </TouchableOpacity>

            {!isRoutePreviewActive && (
                <TouchableOpacity
                    onPress={onTaxiPress}
                    className="rounded-full p-3 shadow-lg"
                    style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                >
                    <TaxiIcon width={24} height={24} />
                </TouchableOpacity>
            )}
        </Animated.View>
    );
};
