import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Animated } from 'react-native';
import FloatingLocationIcon from '../../../../assets/images/floating-location.svg';
import FloatingTaxiIcon from '../../../../assets/images/floating-taxi.svg';
import DarkLocationIcon from '../../../../assets/images/dark-target.svg';
import DarkTaxiIcon from '../../../../assets/images/dark-taxi.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';

export const BASE_GAP = 112;
export const ROUTE_PREVIEW_GAP = 292;
export const PLACE_DETAIL_GAP = 297;

interface FloatingActionsProps {
    onLocationPress?: () => void;
    onTaxiPress?: () => void;
    isRoutePreviewActive?: boolean;
    isPlaceDetailActive?: boolean;
}

export const FloatingActions: React.FC<FloatingActionsProps> = ({
    onLocationPress,
    onTaxiPress,
    isRoutePreviewActive = false,
    isPlaceDetailActive = false,
}) => {
    const { colors: theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const bottomPosition = useRef(new Animated.Value(insets.bottom + BASE_GAP)).current;

    const LocationIcon = isDark ? DarkLocationIcon : FloatingLocationIcon;
    const TaxiIcon = isDark ? DarkTaxiIcon : FloatingTaxiIcon;

    useEffect(() => {
        let targetBottom = insets.bottom + BASE_GAP;
        if (isRoutePreviewActive) {
            targetBottom = insets.bottom + ROUTE_PREVIEW_GAP;
        } else if (isPlaceDetailActive) {
            targetBottom = insets.bottom + PLACE_DETAIL_GAP;
        }
        Animated.timing(bottomPosition, {
            toValue: targetBottom,
            duration: 250,
            useNativeDriver: false,
        }).start();
    }, [isRoutePreviewActive, isPlaceDetailActive, insets.bottom]);

    return (
        <Animated.View className="absolute right-4 gap-3" style={{ bottom: bottomPosition }}>
            <TouchableOpacity
                onPress={onLocationPress}
                className="rounded-full p-3 shadow-lg"
                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
            >
                <LocationIcon width={24} height={24} />
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
