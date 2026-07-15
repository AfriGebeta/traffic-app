import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import FloatingLocationIcon from '../../../../assets/images/floating-location.svg';
import FloatingLayersIcon from '../../../../assets/images/floating-layers.svg';
import FloatingTaxiIcon from '../../../../assets/images/floating-taxi.svg';
import FloatingMicIcon from '../../../../assets/images/floating-mic.svg';
import DarkLocationIcon from '../../../../assets/images/dark-target.svg';
import DarkLayersIcon from '../../../../assets/images/dark-layers.svg';
import DarkTaxiIcon from '../../../../assets/images/dark-taxi.svg';
import DarkMicIcon from '../../../../assets/images/dark-microphone.svg';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface FloatingActionsProps {
    onLocationPress?: () => void;
    onThemePress?: () => void;
    onVoicePressIn?: () => void;
    onVoicePressOut?: () => void;
    onTaxiPress?: () => void;
    isRecording?: boolean;
    isProcessingVoice?: boolean;
    isRoutePreviewActive?: boolean;
    isPlaceDetailActive?: boolean;
}

export const FloatingActions: React.FC<FloatingActionsProps> = ({
    onLocationPress,
    onThemePress,
    onVoicePressIn,
    onVoicePressOut,
    onTaxiPress,
    isRecording = false,
    isProcessingVoice = false,
    isRoutePreviewActive = false,
    isPlaceDetailActive = false,
}) => {
    const { colors: theme, isDark } = useTheme();
    const bottomPosition = useRef(new Animated.Value(110)).current;

    const LocationIcon = isDark ? DarkLocationIcon : FloatingLocationIcon;
    const LayersIcon = isDark ? DarkLayersIcon : FloatingLayersIcon;
    const TaxiIcon = isDark ? DarkTaxiIcon : FloatingTaxiIcon;
    const MicIcon = isDark ? DarkMicIcon : FloatingMicIcon;

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

            {!isPlaceDetailActive && !isRoutePreviewActive && (
                <TouchableOpacity
                    onPressIn={onVoicePressIn}
                    onPressOut={onVoicePressOut}
                    disabled={isProcessingVoice}
                    style={{
                        backgroundColor: isRecording || isProcessingVoice ? colors.primary.main : theme.surface,
                        borderWidth: 1,
                        borderColor: theme.border,
                    }}
                    className="rounded-full p-3 shadow-lg"
                    activeOpacity={0.7}
                >
                    {isProcessingVoice ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <MicIcon width={24} height={24} />
                    )}
                </TouchableOpacity>
            )}
        </Animated.View>
    );
};
