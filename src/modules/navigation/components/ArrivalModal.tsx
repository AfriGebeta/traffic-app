import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';

interface ArrivalModalProps {
    visible: boolean;
    destinationName?: string;
    onClose: () => void;
}

export const ArrivalModal: React.FC<ArrivalModalProps> = ({
    visible,
    destinationName,
    onClose,
}) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-center items-center bg-black/60 px-6">
                <View className="bg-white rounded-3xl w-full max-w-sm overflow-hidden">
                    <View className="items-center pt-8 pb-6 px-6 bg-gray-50">
                        <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
                            {t('navigation-complete') || 'You\'ve Arrived!'}
                        </Text>
                        <Text className="text-base text-gray-600 text-center">
                            {t('arrived-at-destination') || 'You have reached your destination'}
                        </Text>
                    </View>

                    <View className="px-6 py-6">
                        {destinationName && (
                            <View className="flex-row items-center justify-center mb-6 bg-gray-50 p-4 rounded-xl">
                                <Ionicons name="location" size={20} color={colors.primary.main} />
                                <Text className="text-lg font-semibold text-gray-900 ml-2">
                                    {destinationName}
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            onPress={onClose}
                            className="py-4 rounded-xl"
                            style={{ backgroundColor: colors.primary.main }}
                        >
                            <Text className="text-white text-center font-semibold text-base">
                                {t('done') || 'Done'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
