import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import type { NavigationOption } from '../types/voice-navigation.types';

interface NavigationOptionsModalProps {
    visible: boolean;
    options: NavigationOption[];
    transcription?: string;
    onSelectOption: (optionId: number) => void;
    onClose: () => void;
}

export const NavigationOptionsModal: React.FC<NavigationOptionsModalProps> = ({
    visible,
    options,
    transcription,
    onSelectOption,
    onClose,
}) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-end bg-black/50">
                <TouchableOpacity
                    className="flex-1"
                    activeOpacity={1}
                    onPress={onClose}
                />

                <View
                    className="bg-white rounded-t-3xl max-h-[70%]"
                    style={{ paddingBottom: insets.bottom || 20 }}
                >
                    <View className="items-center pt-3 pb-2">
                        <View className="w-12 h-1 bg-gray-300 rounded-full" />
                    </View>

                    <View className="flex-row items-center justify-between px-4 pb-4 border-b border-gray-200">
                        <Text className="text-lg font-semibold text-gray-900">
                            {t('choose-destination')}
                        </Text>
                        <TouchableOpacity
                            onPress={onClose}
                            className="p-2"
                        >
                            <Ionicons name="close" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    {transcription && (
                        <View className="px-4 py-4 bg-orange-50 border-b border-orange-100">
                            <Text className="text-xs font-medium mb-2 text-center" style={{ color: colors.primary.main }}>
                                {t('you-said')}
                            </Text>
                            <Text className="text-lg font-medium text-center text-gray-800">
                                {transcription}
                            </Text>
                        </View>
                    )}

                    <ScrollView className="px-4 pb-4">
                        {options.map((option) => (
                            <TouchableOpacity
                                key={option.id}
                                onPress={() => onSelectOption(option.id)}
                                className="flex-row items-center p-4 mb-2 bg-gray-50 rounded-xl active:bg-gray-100"
                            >
                                <View
                                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                                    style={{ backgroundColor: colors.primary.main }}
                                >
                                    <Ionicons name="location" size={20} color="white" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-base font-medium text-gray-900">
                                        {option.name}
                                    </Text>
                                    {option.lat != null && option.lng != null && (
                                        <Text className="text-sm text-gray-500 mt-1">
                                            {option.lat.toFixed(6)}, {option.lng.toFixed(6)}
                                        </Text>
                                    )}
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};
