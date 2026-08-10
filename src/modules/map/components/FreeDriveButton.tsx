import React from 'react';
import { TouchableOpacity, View } from 'react-native';
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
                accessibilityRole="button"
                accessibilityLabel={t('free-drive')}
                className="rounded-full p-3 shadow-lg"
                style={{
                    backgroundColor: theme.surface,
                    borderWidth: 1,
                    borderColor: theme.border,
                }}
            >
                <Ionicons name="speedometer-outline" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
        </View>
    );
};
