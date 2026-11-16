import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Animated } from 'react-native';
import FloatingLocationIcon from '../../../../assets/images/floating-location.svg';
import FloatingTaxiIcon from '../../../../assets/images/floating-taxi.svg';
import DarkLocationIcon from '../../../../assets/images/dark-target.svg';
import DarkTaxiIcon from '../../../../assets/images/dark-taxi.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useGlass } from '../../../shared/theme/glass';
import { GlassSheen } from '../../../shared/components/GlassSheen';
import { useLayout, LAYOUT_GUTTER } from '../../../shared/layout/useLayout';

export const BASE_GAP = 112;
export const ROUTE_PREVIEW_GAP = 316;
export const PLACE_DETAIL_GAP = 297;

interface FloatingActionsProps {
    onLocationPress?: () => void;
    onTaxiPress?: () => void;
    isRoutePreviewActive?: boolean;
    isPlaceDetailActive?: boolean;
    middleActions?: React.ReactNode;
    bottomActions?: React.ReactNode;
}

export const FloatingActions: React.FC<FloatingActionsProps> = ({
    onLocationPress,
    onTaxiPress,
    isRoutePreviewActive = false,
    isPlaceDetailActive = false,
    middleActions,
    bottomActions,
}) => {
    const { isDark } = useTheme();
    const glass = useGlass();
    const insets = useSafeAreaInsets();
    const { isWide, isCompact } = useLayout();
    const bottomPosition = useRef(new Animated.Value(insets.bottom + BASE_GAP)).current;

    const LocationIcon = isDark ? DarkLocationIcon : FloatingLocationIcon;
    const TaxiIcon = isDark ? DarkTaxiIcon : FloatingTaxiIcon;

    useEffect(() => {
        let targetBottom = insets.bottom + BASE_GAP;
        if (isWide) {
            // wide: no bottom bar and sheets dock left, so the buttons never need to dodge them
            targetBottom = insets.bottom + LAYOUT_GUTTER * 2;
        } else if (isRoutePreviewActive) {
            targetBottom = insets.bottom + ROUTE_PREVIEW_GAP;
        } else if (isPlaceDetailActive) {
            targetBottom = insets.bottom + PLACE_DETAIL_GAP;
        }
        Animated.timing(bottomPosition, {
            toValue: targetBottom,
            duration: 250,
            useNativeDriver: false,
        }).start();
    }, [isRoutePreviewActive, isPlaceDetailActive, insets.bottom, isWide]);

    return (
        <Animated.View className="absolute right-4 gap-3" style={[{ bottom: bottomPosition }, isWide && { right: insets.right + 16 }]}>
            <TouchableOpacity
                onPress={onLocationPress}
                className="rounded-full p-3"
                style={glass.surface}
            >
                <GlassSheen />
                <LocationIcon width={24} height={24} />
            </TouchableOpacity>
            {middleActions}

            {!isRoutePreviewActive && isCompact && (
                <TouchableOpacity
                    onPress={onTaxiPress}
                    className="rounded-full p-3"
                    style={glass.surface}
                >
                    <GlassSheen />
                    <TaxiIcon width={24} height={24} />
                </TouchableOpacity>
            )}
            {bottomActions}
        </Animated.View>
    );
};
