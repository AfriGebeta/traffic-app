import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';

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
    const { colors: theme, isDark } = useTheme();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-center items-center bg-black/60 px-6">
                <View className="rounded-3xl w-full max-w-sm overflow-hidden" style={{ backgroundColor: theme.background }}>
                    <View className="items-center pt-8 pb-6 px-6" style={{ backgroundColor: isDark ? theme.surface : '#F9FAFB' }}>
                        <Text className="text-2xl font-bold text-center mb-2" style={{ color: theme.textPrimary }}>
                            {t('navigation-complete') || 'You\'ve Arrived!'}
                        </Text>
                        <Text className="text-base text-center" style={{ color: theme.textSecondary }}>
                            {t('arrived-at-destination') || 'You have reached your destination'}
                        </Text>
                    </View>

                    <View className="px-6 py-6">
                        {destinationName && (
                            <View className="flex-row items-center justify-center mb-6 p-4 rounded-xl" style={{ backgroundColor: isDark ? theme.surface : '#F9FAFB' }}>
                                <Ionicons name="location" size={20} color={colors.primary.main} />
                                <Text className="text-lg font-semibold ml-2" style={{ color: theme.textPrimary }}>
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
