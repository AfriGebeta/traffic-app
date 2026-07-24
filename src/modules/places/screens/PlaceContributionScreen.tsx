import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PLACE_TYPES } from '../types/place.types';
import { useTranslation } from 'react-i18next';
import { getPlaceTranslationKey } from '../utils/placeTranslations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';

import GasStationLight from '../../../../assets/images/contribute-place-gas-station-light.svg';
import GasStationDark from '../../../../assets/images/contribute-place-gas-station-dark.svg';
import TaxiLight from '../../../../assets/images/contribute-place-taxi-light.svg';
import TaxiDark from '../../../../assets/images/contribute-place-taxi-dark.svg';
import RestaurantLight from '../../../../assets/images/contribute-place-restaurant-light.svg';
import RestaurantDark from '../../../../assets/images/contribute-place-restaurant-dark.svg';
import ParkingLight from '../../../../assets/images/contribute-place-parking-light.svg';
import ParkingDark from '../../../../assets/images/contribute-place-parking-dark.svg';
import HospitalLight from '../../../../assets/images/contribute-place-hospital-light.svg';
import HospitalDark from '../../../../assets/images/contribute-place-hospital-dark.svg';
import BuildingLight from '../../../../assets/images/contribute-place-building-light.svg';
import BuildingDark from '../../../../assets/images/contribute-place-building-dark.svg';
import CompanyLight from '../../../../assets/images/contribute-place-company-light.svg';
import CompanyDark from '../../../../assets/images/contribute-place-company-dark.svg';
import GovernmentLight from '../../../../assets/images/contribute-place-government-light.svg';
import GovernmentDark from '../../../../assets/images/contribute-place-government-dark.svg';
import MallLight from '../../../../assets/images/contribute-place-mall-light.svg';
import MallDark from '../../../../assets/images/contribute-place-mall-dark.svg';
import ShopLight from '../../../../assets/images/contribute-place-shop-light.svg';
import ShopDark from '../../../../assets/images/contribute-place-shop-dark.svg';
import MoreLight from '../../../../assets/images/contribute-place-more-light.svg';
import MoreDark from '../../../../assets/images/contribute-place-more-dark.svg';

export default function PlaceContributionScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();

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
                        const placeIconMap: Record<string, React.FC<{ width?: number; height?: number }>> = {
                            'gas_station': isDark ? GasStationDark : GasStationLight,
                            'taxi_station': isDark ? TaxiDark : TaxiLight,
                            'restaurant': isDark ? RestaurantDark : RestaurantLight,
                            'parking': isDark ? ParkingDark : ParkingLight,
                            'hospital': isDark ? HospitalDark : HospitalLight,
                            'building': isDark ? BuildingDark : BuildingLight,
                            'company': isDark ? CompanyDark : CompanyLight,
                            'government': isDark ? GovernmentDark : GovernmentLight,
                            'mall': isDark ? MallDark : MallLight,
                            'shop': isDark ? ShopDark : ShopLight,
                            'other': isDark ? MoreDark : MoreLight,
                        };

                        const Icon = placeIconMap[placeType.id] ?? (isDark ? MoreDark : MoreLight);

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
