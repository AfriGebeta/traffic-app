import React from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';

interface FloatingActionsProps {
    onLocationPress?: () => void;
    onThemePress?: () => void;
    onVoicePressIn?: () => void;
    onVoicePressOut?: () => void;
    isRecording?: boolean;
    isProcessingVoice?: boolean;
}

export const FloatingActions: React.FC<FloatingActionsProps> = ({
    onLocationPress,
    onThemePress,
    onVoicePressIn,
    onVoicePressOut,
    isRecording = false,
    isProcessingVoice = false,
}) => {
    return (
        <View className="absolute right-4 bottom-52 gap-3">
            <TouchableOpacity
                onPress={onLocationPress}
                className="bg-white rounded-full p-3 shadow-lg"
            >
                <Ionicons name="locate" size={24} color="#F59E0B" />
            </TouchableOpacity>

            <TouchableOpacity
                onPress={onThemePress}
                className="bg-white rounded-full p-3 shadow-lg"
            >
                <Ionicons name="layers-outline" size={24} color="#6B7280" />
            </TouchableOpacity>

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
        </View>
    );
};
