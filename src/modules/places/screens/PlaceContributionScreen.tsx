import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PLACE_TYPES } from '../types/place.types';
import { useTranslation } from 'react-i18next';
import { getPlaceTranslationKey } from '../utils/placeTranslations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { getPlaceIcon } from '../utils/placeIcons';

export default function PlaceContributionScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();
    const params = useLocalSearchParams();

    const prefillParams = Object.fromEntries(
        Object.entries(params).filter(([key, value]) => key.startsWith('prefill') && typeof value === 'string')
    );

    const handlePlaceTypeSelect = (placeType: string) => {
        router.push({
            pathname: '/places/add',
            params: { ...prefillParams, type: placeType, backSteps: '2' },
        });
    };

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background, paddingTop: insets.top }}>
            <View className="px-4 py-6" style={{ borderBottomWidth: 1, borderBottomColor: theme.background }}>
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="mr-4"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={28} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold" style={{ color: theme.textPrimary }}>{t('contribute-a-place')}</Text>
                </View>
                <Text className="mt-2" style={{ color: theme.textSecondary }}>{t('help-others-by-adding-useful-locations')}</Text>
            </View>

            <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
                <View className="gap-3">
                    {PLACE_TYPES.map((placeType) => {
                        const Icon = getPlaceIcon(placeType.id, isDark);

                        return (
                            <TouchableOpacity
                                key={placeType.id}
                                className="rounded-2xl p-6 shadow-sm flex-row items-center"
                                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                                onPress={() => handlePlaceTypeSelect(placeType.id)}
                            >
                                <View className="w-12 h-12 items-center justify-center mr-4">
                                    <Icon width={40} height={40} />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-lg font-semibold" style={{ color: theme.textPrimary }}>
                                        {t(getPlaceTranslationKey(placeType.id))}
                                    </Text>
                                    <Text className="text-sm mt-1" style={{ color: theme.textSecondary }}>
                                        {t('add-new')} {t(getPlaceTranslationKey(placeType.id)).toLowerCase()}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={24} color={theme.textSecondary} />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
}
