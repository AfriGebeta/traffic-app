import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PLACE_TYPES, PlaceType } from '../types/place.types';
import { useTranslation } from 'react-i18next';
import { getPlaceTranslationKey } from '../utils/placeTranslations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { getPlaceIcon } from '../utils/placeIcons';
import { useCampaignGpsWarmup } from '../../campaigns/hooks/useCampaignGpsWarmup';
import { isTypeAvailable, slugForType, usePlaceCategories } from '../services/placeCategories';
import { useSpecialPoints } from '../../campaigns/hooks/useSpecialPoints';
import { FONT_MEDIUM, RADIUS } from '../../campaigns/components/CampaignUi';

export default function PlaceContributionScreen() {
    const router = useRouter();
    // GPS starts here so the camera's location is ready when the photo is taken
    useCampaignGpsWarmup(['place']);
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();
    const params = useLocalSearchParams();
    // only types the backend has an active category for
    const categories = usePlaceCategories();
    const placeTypes = PLACE_TYPES.filter((placeType) => isTypeAvailable(placeType.id as PlaceType, categories));
    // types with a campaign bonus get a badge (joined, running campaigns only)
    const { visible: specialPoints } = useSpecialPoints();

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
            <View className="px-4 pt-3 pb-2">
                <TouchableOpacity onPress={() => router.back()} className="self-start p-1 -ml-1" activeOpacity={0.7} hitSlop={8}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="mt-3" style={{ color: theme.textPrimary, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 }}>
                    {t('contribute-a-place')}
                </Text>
                <Text className="text-sm mt-1" style={{ color: theme.textSecondary }}>{t('help-others-by-adding-useful-locations')}</Text>
            </View>

            <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 20 }}>
                <View className="gap-3">
                    {placeTypes.map((placeType) => {
                        const Icon = getPlaceIcon(placeType.id, isDark);
                        const special = specialPoints.find((row) => row.kind === 'place' && row.key === slugForType(placeType.id));

                        return (
                            <TouchableOpacity
                                key={placeType.id}
                                className="px-5 py-5 flex-row items-center"
                                style={{ borderRadius: RADIUS, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                                onPress={() => handlePlaceTypeSelect(placeType.id)}
                                activeOpacity={0.7}
                            >
                                <View className="w-12 h-12 items-center justify-center mr-4">
                                    <Icon width={40} height={40} />
                                </View>
                                <View className="flex-1">
                                    <View className="flex-row items-center">
                                        <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 16 }}>
                                            {t(getPlaceTranslationKey(placeType.id))}
                                        </Text>
                                        {special && <Ionicons name="flash" size={16} color={theme.primary} style={{ marginLeft: 6 }} />}
                                    </View>
                                    <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                                        {t('add-new')} {t(getPlaceTranslationKey(placeType.id)).toLowerCase()}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
}
