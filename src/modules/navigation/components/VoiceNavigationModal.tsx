import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';

interface VoiceNavigationModalProps {
    visible: boolean;
    isRecording: boolean;
    isProcessing: boolean;
    onClose: () => void;
    onPressIn: () => void;
    onPressOut: () => void;
}

export const VoiceNavigationModal: React.FC<VoiceNavigationModalProps> = ({
    visible,
    isRecording,
    isProcessing,
    onClose,
    onPressIn,
    onPressOut,
}) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [pulseAnim] = useState(new Animated.Value(1));
    const [slideAnim] = useState(new Animated.Value(0));

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 65,
                friction: 11,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

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
    }, [isRecording]);

    const translateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [500, 0],
    });

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-end bg-black/50">
                <TouchableOpacity
                    className="flex-1"
                    activeOpacity={1}
                    onPress={onClose}
                />

                <Animated.View
                    style={{
                        transform: [{ translateY }],
                        paddingBottom: insets.bottom || 20,
                    }}
                    className="bg-white rounded-t-3xl"
                >
                    <View className="items-center pt-3 pb-2">
                        <View className="w-12 h-1 bg-gray-300 rounded-full" />
                    </View>

                    <View className="flex-row items-center justify-between px-6 pb-4">
                        <Text className="text-xl font-semibold text-gray-900 flex-1 pr-2">
                            {t('voice-navigation')}
                        </Text>
                        <TouchableOpacity
                            onPress={onClose}
                            className="p-2"
                        >
                            <Ionicons name="close" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <View className="items-center px-6 pb-6">
                        <Animated.View
                            style={{
                                transform: [{ scale: pulseAnim }],
                            }}
                        >
                            <TouchableOpacity
                                onPressIn={onPressIn}
                                onPressOut={onPressOut}
                                disabled={isProcessing}
                                className="w-32 h-32 rounded-full items-center justify-center"
                                style={{
                                    backgroundColor: isRecording
                                        ? colors.primary.main
                                        : 'transparent',
                                    borderWidth: 1.5,
                                    borderColor: isRecording ? colors.primary.main : colors.primary.light,
                                }}
                            >
                                <Ionicons
                                    name={isRecording ? "mic" : "mic-outline"}
                                    size={64}
                                    color={isRecording ? "white" : colors.primary.main}
                                />
                            </TouchableOpacity>
                        </Animated.View>

                        <Text
                            className="text-base font-medium mt-6 text-center"
                            style={{ color: colors.primary.main }}
                        >
                            {isProcessing
                                ? t('processing')
                                : isRecording
                                    ? t('listening')
                                    : t('push-to-talk')}
                        </Text>

                        {isRecording && (
                            <Text className="text-sm text-gray-500 mt-2 text-center">
                                {t('speak-your-destination')}
                            </Text>
                        )}
                    </View>

                    {isRecording && (
                        <View className="flex-row items-center justify-center h-12 px-6 mb-4">
                            {[...Array(20)].map((_, i) => (
                                <View
                                    key={i}
                                    className="w-1 mx-0.5 rounded-full"
                                    style={{
                                        height: Math.random() * 40 + 10,
                                        backgroundColor: colors.primary.main,
                                        opacity: 0.6,
                                    }}
                                />
                            ))}
                        </View>
                    )}

                    {!isRecording && !isProcessing && (
                        <View className="px-6 pb-6">
                            <Text className="text-sm text-gray-500 text-center">
                                {t('hold-to-speak-instruction')}
                            </Text>
                        </View>
                    )}
                </Animated.View>
            </View>
        </Modal>
    );
};
