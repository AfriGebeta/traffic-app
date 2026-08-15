import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import RouteLightIcon from '../../../../assets/images/taxi-route-light.svg';
import RouteDarkIcon from '../../../../assets/images/taxi-route-dark.svg';
import StationLightIcon from '../../../../assets/images/taxi-station-light.svg';
import StationDarkIcon from '../../../../assets/images/taxi-station-dark.svg';

export default function TaxiContributionChoiceScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();

    const options = [
        {
            id: 'route',
            titleKey: 'contribute-taxi-route',
            descriptionKey: 'contribute-taxi-route-description',
            Icon: isDark ? RouteDarkIcon : RouteLightIcon,
            route: '/taxi/build-route',
        },
        {
            id: 'station',
            titleKey: 'contribute-taxi-station',
            descriptionKey: 'contribute-taxi-station-description',
            Icon: isDark ? StationDarkIcon : StationLightIcon,
            route: '/taxi/add-station',
        },
    ];

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: theme.background }}>
            <View className="px-4 py-6" style={{ borderBottomWidth: 1, borderBottomColor: theme.background }}>
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4" activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={28} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold" style={{ color: theme.textPrimary }}>{t('contribute-taxi-info')}</Text>
                </View>
                <Text className="mt-2" style={{ color: theme.textSecondary }}>{t('choose-taxi-contribution-type')}</Text>
            </View>

            <ScrollView className="flex-1 p-4">
                <View className="gap-4">
                    {options.map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            className="rounded-2xl p-6 shadow-sm"
                            style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                            onPress={() => router.push(option.route as any)}
                            activeOpacity={0.7}
                        >
                            <View className="flex-row items-center">
                                <View className="w-12 h-12 items-center justify-center mr-4">
                                    <option.Icon width={40} height={40} />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-xl font-semibold mb-1" style={{ color: theme.textPrimary }}>
                                        {t(option.titleKey)}
                                    </Text>
                                    <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                        {t(option.descriptionKey)}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={24} color={theme.textSecondary} />
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
