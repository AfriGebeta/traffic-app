import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VoiceRecordingOverlayProps {
    isRecording: boolean;
    isProcessing: boolean;
}

export const VoiceRecordingOverlay: React.FC<VoiceRecordingOverlayProps> = ({
    isRecording,
    isProcessing,
}) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isRecording) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.2,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isRecording, pulseAnim]);

    if (!isRecording && !isProcessing) {
        return null;
    }

    return (
        <View className="absolute top-32 left-0 right-0 items-center z-50">
            <View className="bg-white rounded-3xl shadow-2xl px-6 py-4 flex-row items-center space-x-3">
                {isRecording ? (
                    <>
                        <Animated.View
                            style={{
                                transform: [{ scale: pulseAnim }],
                            }}
                        >
                            <View className="bg-red-500 rounded-full p-3">
                                <Ionicons name="mic" size={24} color="#FFFFFF" />
                            </View>
                        </Animated.View>
                        <View>
                            <Text className="text-gray-900 font-semibold text-base">
                                Listening...
                            </Text>
                            <Text className="text-gray-500 text-sm">
                                Speak your destination
                            </Text>
                        </View>
                    </>
                ) : (
                    <>
                        <View className="bg-yellow-500 rounded-full p-3">
                            <Ionicons name="hourglass" size={24} color="#FFFFFF" />
                        </View>
                        <View>
                            <Text className="text-gray-900 font-semibold text-base">
                                Processing...
                            </Text>
                            <Text className="text-gray-500 text-sm">
                                Analyzing your voice
                            </Text>
                        </View>
                    </>
                )}
            </View>
        </View>
    );
};
