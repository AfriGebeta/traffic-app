import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
export const FreeDriveButton: React.FC = () => {
    const router = useRouter();
    const { t } = useTranslation();
    const { colors: theme } = useTheme();

    return (
        <View className="mt-1 items-end">
            <TouchableOpacity
                onPress={() => router.push('/free-drive')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('free-drive')}
            >
                <View
                    className="px-4 py-2 flex-row items-center"
                    style={{
                        backgroundColor: theme.surface,
                        borderWidth: 0.5,
                        borderColor: theme.border,
                        borderRadius: 9999,
                    }}
                >
                    <Ionicons name="speedometer-outline" size={16} color={theme.primary} />
                    <Text
                        className="text-sm font-medium ml-1.5"
                        style={{ color: theme.textPrimary }}
                    >
                        {t('free-drive')}
                    </Text>
                </View>
            </TouchableOpacity>
        </View>
    );
};
