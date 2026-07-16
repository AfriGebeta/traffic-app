import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PLACE_TYPES } from '../types/place.types';
import { useTranslation } from 'react-i18next';
import { getPlaceTranslationKey } from '../utils/placeTranslations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';

export default function PlaceContributionScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();

    const handlePlaceTypeSelect = (placeType: string) => {
        router.push({
            pathname: '/places/add',
            params: { type: placeType },
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
                        <Ionicons name="arrow-back" size={28} color={theme.primary} />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold" style={{ color: theme.textPrimary }}>{t('contribute-a-place')}</Text>
                </View>
                <Text className="mt-2" style={{ color: theme.textSecondary }}>{t('help-others-by-adding-useful-locations')}</Text>
            </View>

            <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
                <View className="gap-3">
                    {PLACE_TYPES.map((placeType) => {
                        const placeImageMap: Record<string, any> = {
                            'gas_station': require('../../../../assets/images/gas-station-place.png'),
                            'taxi_station': require('../../../../assets/images/taxi-station-place.png'),
                            'repair_shop': require('../../../../assets/images/repair-shop-place.png'),
                            'restaurant': require('../../../../assets/images/restaurant-place.png'),
                            'parking': require('../../../../assets/images/parking-place.png'),
                            'hospital': require('../../../../assets/images/hospital-place.png'),
                            'building': require('../../../../assets/images/building.png'),
                            'company': require('../../../../assets/images/company.png'),
                            'government': require('../../../../assets/images/government.png'),
                            'mall': require('../../../../assets/images/mall.png'),
                            'shop': require('../../../../assets/images/shop.png'),
                            'other': require('../../../../assets/images/other-place.png'),
                        };

                        const imageSource = placeImageMap[placeType.id];

                        return (
                            <TouchableOpacity
                                key={placeType.id}
                                className="rounded-2xl p-6 shadow-sm flex-row items-center"
                                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                                onPress={() => handlePlaceTypeSelect(placeType.id)}
                            >
                                <View className="w-16 h-16 items-center justify-center mr-4">
                                    <Image
                                        source={imageSource}
                                        style={{ width: 48, height: 48 }}
                                        resizeMode="contain"
                                    />
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
