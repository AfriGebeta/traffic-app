import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../shared/theme/colors';
import { useTheme } from '../../shared/theme/ThemeContext';

interface Props {
    retrying: boolean;
    onRetry: () => void;
}

// Shown over the map when its style couldn't be downloaded (usually no internet); replaces the raw system alert
export function MapLoadError({ retrying, onRetry }: Props) {
    const { t } = useTranslation();
    const { colors: theme } = useTheme();

    return (
        <View pointerEvents="box-none" className="absolute inset-0 items-center justify-center px-8">
            <View
                className="w-full items-center rounded-2xl p-6"
                style={{ maxWidth: 360, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }}
            >
                <Ionicons name="cloud-offline-outline" size={40} color={theme.textSecondary} />
                <Text className="text-lg font-bold text-center mt-3" style={{ color: theme.textPrimary }}>
                    {t('map-load-failed-title')}
                </Text>
                <Text className="text-sm text-center mt-1" style={{ color: theme.textSecondary }}>
                    {t('map-load-failed-body')}
                </Text>
                <TouchableOpacity
                    onPress={onRetry}
                    disabled={retrying}
                    activeOpacity={0.8}
                    className="w-full rounded-xl py-3 items-center mt-5"
                    style={{ backgroundColor: colors.primary.main, opacity: retrying ? 0.7 : 1 }}
                >
                    {retrying ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold text-base">{t('try-again')}</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
}
