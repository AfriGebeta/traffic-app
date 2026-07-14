import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import FloatingLocationIcon from '../../../../assets/images/floating-location.svg';
import FloatingLayersIcon from '../../../../assets/images/floating-layers.svg';
import FloatingTaxiIcon from '../../../../assets/images/floating-taxi.svg';
import FloatingMicIcon from '../../../../assets/images/floating-mic.svg';
import { colors } from '../../../shared/theme/colors';

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
    const bottomPosition = useRef(new Animated.Value(110)).current;

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
                className="bg-white rounded-full p-3 shadow-lg"
                style={{ borderWidth: 1, borderColor: '#D1D5DB' }}
            >
                <FloatingLocationIcon width={24} height={24} />
            </TouchableOpacity>

            <TouchableOpacity
                onPress={onThemePress}
                className="bg-white rounded-full p-3 shadow-lg"
                style={{ borderWidth: 1, borderColor: '#D1D5DB' }}
            >
                <FloatingLayersIcon width={24} height={24} />
            </TouchableOpacity>

            {!isRoutePreviewActive && (
                <TouchableOpacity
                    onPress={onTaxiPress}
                    className="bg-white rounded-full p-3 shadow-lg"
                    style={{ borderWidth: 1, borderColor: '#D1D5DB' }}
                >
                    <FloatingTaxiIcon width={24} height={24} />
                </TouchableOpacity>
            )}

            {!isPlaceDetailActive && !isRoutePreviewActive && (
                <TouchableOpacity
                    onPressIn={onVoicePressIn}
                    onPressOut={onVoicePressOut}
                    disabled={isProcessingVoice}
                    style={{
                        backgroundColor: isRecording || isProcessingVoice ? colors.primary.main : '#FFFFFF',
                        borderWidth: 1,
                        borderColor: '#D1D5DB',
                    }}
                    className="rounded-full p-3 shadow-lg"
                    activeOpacity={0.7}
                >
                    {isProcessingVoice ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <FloatingMicIcon width={24} height={24} />
                    )}
                </TouchableOpacity>
            )}
        </Animated.View>
    );
};
