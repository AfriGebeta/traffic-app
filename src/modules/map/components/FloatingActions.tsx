import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { ShareLocationButton } from '../../../shared/components/ShareLocationButton';

interface FloatingActionsProps {
    onLocationPress?: () => void;
    onThemePress?: () => void;
    onVoicePressIn?: () => void;
    onVoicePressOut?: () => void;
    onTaxiPress?: () => void;
    isRecording?: boolean;
    isProcessingVoice?: boolean;
    userLocation?: { lat: number; lng: number } | null;
    isRoutePreviewActive?: boolean;
    isPlaceDetailActive?: boolean;
    isCenteredOnUser?: boolean;
}

export const FloatingActions: React.FC<FloatingActionsProps> = ({
    onLocationPress,
    onThemePress,
    onVoicePressIn,
    onVoicePressOut,
    onTaxiPress,
    isRecording = false,
    isProcessingVoice = false,
    userLocation,
    isRoutePreviewActive = false,
    isPlaceDetailActive = false,
    isCenteredOnUser = false,
}) => {
    const bottomPosition = useRef(new Animated.Value(180)).current;

    useEffect(() => {
        let targetBottom = 180;
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
            >
                <Ionicons name="locate" size={24} color="#F59E0B" />
            </TouchableOpacity>

            {!isPlaceDetailActive && !isRoutePreviewActive && isCenteredOnUser && userLocation && (
                <ShareLocationButton
                    location={{
                        lat: userLocation.lat,
                        lng: userLocation.lng,
                        name: 'My Current Location',
                    }}
                    variant="icon"
                    size="medium"
                />
            )}

            <TouchableOpacity
                onPress={onThemePress}
                className="bg-white rounded-full p-3 shadow-lg"
            >
                <Ionicons name="layers-outline" size={24} color="#6B7280" />
            </TouchableOpacity>

            {!isRoutePreviewActive && (
                <TouchableOpacity
                    onPress={onTaxiPress}
                    className="bg-white rounded-full p-3 shadow-lg"
                >
                    <Image
                        source={require('../../../../assets/images/minibus-unselected.png')}
                        style={{ width: 24, height: 24 }}
                        resizeMode="contain"
                    />
                </TouchableOpacity>
            )}

            {!isPlaceDetailActive && !isRoutePreviewActive && (
                <TouchableOpacity
                    onPressIn={onVoicePressIn}
                    onPressOut={onVoicePressOut}
                    disabled={isProcessingVoice}
                    style={{
                        backgroundColor: isRecording || isProcessingVoice ? colors.primary.main : '#FFFFFF',
                    }}
                    className="rounded-full p-3 shadow-lg"
                    activeOpacity={0.7}
                >
                    {isProcessingVoice ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Ionicons
                            name={isRecording ? 'mic' : 'mic-outline'}
                            size={24}
                            color={isRecording ? '#FFFFFF' : '#6B7280'}
                        />
                    )}
                </TouchableOpacity>
            )}
        </Animated.View>
    );
};
