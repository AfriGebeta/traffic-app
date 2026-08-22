import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface ArrivalModalProps {
    visible: boolean;
    stage?: 'approaching' | 'arrived';
    destinationName?: string;
    onClose: () => void;
}

export const ArrivalModal: React.FC<ArrivalModalProps> = ({
    visible,
    stage = 'arrived',
    destinationName,
    onClose,
}) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();

    const isApproaching = stage === 'approaching';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View
                className={`flex-1 items-center px-6 ${isApproaching ? 'justify-start bg-black/20' : 'justify-center bg-black/60'}`}
                style={isApproaching ? { paddingTop: insets.top + 130 } : undefined}
            >
                <View
                    className="rounded-3xl overflow-hidden w-full max-w-sm"
                    style={{ backgroundColor: theme.background }}
                >
                    <View
                        className={`items-center px-6 ${isApproaching ? 'pt-5 pb-4' : 'pt-8 pb-6'}`}
                        style={{ backgroundColor: isDark ? theme.surface : '#F9FAFB' }}
                    >
                        <Text
                            className={`font-bold text-center mb-2 ${isApproaching ? 'text-lg' : 'text-2xl'}`}
                            style={{ color: theme.textPrimary }}
                        >
                            {isApproaching
                                ? (t('almost-there') || 'Almost There')
                                : (t('navigation-complete') || 'You\'ve Arrived!')}
                        </Text>
                        <Text
                            className={`text-center ${isApproaching ? 'text-sm' : 'text-base'}`}
                            style={{ color: theme.textSecondary }}
                        >
                            {isApproaching
                                ? (t('approaching-destination') || 'You\'re approaching your destination')
                                : (t('arrived-at-destination') || 'You have reached your destination')}
                        </Text>
                    </View>

                    <View className={isApproaching ? 'px-5 py-4' : 'px-6 py-6'}>
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
                                {t('ok') || 'OK'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
