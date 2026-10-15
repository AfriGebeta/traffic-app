import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import PlaceLightIcon from '../../../../assets/images/contribute-place-light.svg';
import PlaceDarkIcon from '../../../../assets/images/contribute-place-dark.svg';
import NeighborhoodLightIcon from '../../../../assets/images/contribute-neighborhood-light.svg';
import NeighborhoodDarkIcon from '../../../../assets/images/contribute-neighborhood-dark.svg';
import TrafficLightIcon from '../../../../assets/images/contribute-traffic-light.svg';
import TrafficDarkIcon from '../../../../assets/images/contribute-traffic-dark.svg';
import TaxiLightIcon from '../../../../assets/images/contribute-taxi-light.svg';
import TaxiDarkIcon from '../../../../assets/images/contribute-taxi-dark.svg';
import { CampaignPointsBadge } from '../../campaigns/components/CampaignPointsBadge';
import { CampaignKind } from '../../campaigns/types/campaign.types';

export default function ContributionScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();

    const contributionOptions = [
        {
            id: 'places',
            titleKey: 'contribute-place',
            descriptionKey: 'contribute-place-description',
            Icon: isDark ? PlaceDarkIcon : PlaceLightIcon,
            route: '/places/contribute',
            campaignKind: 'place' as CampaignKind,
        },
        {
            id: 'neighborhoods',
            titleKey: 'contribute-neighborhood',
            descriptionKey: 'contribute-neighborhood-description',
            Icon: isDark ? NeighborhoodDarkIcon : NeighborhoodLightIcon,
            route: '/neighborhoods/contribute',
            // neighborhoods aren't campaign contributions, so no points badge
            campaignKind: null,
        },
        {
            id: 'rules',
            titleKey: 'report-traffic-rule',
            descriptionKey: 'report-traffic-rule-description',
            Icon: isDark ? TrafficDarkIcon : TrafficLightIcon,
            route: '/rules/contribute',
            campaignKind: 'traffic_rule' as CampaignKind,
        },
        {
            id: 'taxi',
            titleKey: 'contribute-taxi-info',
            descriptionKey: 'contribute-taxi-info-description',
            Icon: isDark ? TaxiDarkIcon : TaxiLightIcon,
            route: '/taxi/contribute',
            campaignKind: 'taxi_station' as CampaignKind,
        },
    ];

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: theme.background }}>
            <View className="px-4 py-6" style={{ borderBottomWidth: 1, borderBottomColor: theme.background }}>
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="mr-4"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={28} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold" style={{ color: theme.textPrimary }}>{t('contribute')}</Text>
                </View>
                <Text className="mt-2" style={{ color: theme.textSecondary }}>{t('choose-what-to-contribute')}</Text>
            </View>

            <ScrollView className="flex-1 p-4">
                <View className="gap-4">
                    {contributionOptions.map((option) => (
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
                                    <View className="flex-row items-center flex-wrap mb-1">
                                        <Text className="text-xl font-semibold mr-2" style={{ color: theme.textPrimary }}>
                                            {t(option.titleKey)}
                                        </Text>
                                        {option.campaignKind && <CampaignPointsBadge kind={option.campaignKind} />}
                                    </View>
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
