import React, { useCallback } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { isParticipating, refreshCampaigns, useCampaigns } from '../store/campaignStore';
import { pickLocalized } from '../utils/localizedText';

const AnnouncementLight = require('../../../../assets/images/announcement-light.png');
const AnnouncementDark = require('../../../../assets/images/announcement-dark.png');

// Profile → Campaigns: always lists running campaigns, so dismissing the banner never locks anyone out
export default function CampaignsListScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();
    const state = useCampaigns();

    useFocusEffect(
        useCallback(() => {
            void refreshCampaigns();
        }, [])
    );

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
            <View className="px-4 py-4 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4" activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={26} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="text-xl font-bold" style={{ color: theme.textPrimary }}>
                    {t('campaigns')}
                </Text>
            </View>

            <ScrollView
                className="flex-1 px-4"
                contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                refreshControl={<RefreshControl refreshing={state.loading} onRefresh={() => void refreshCampaigns()} />}
            >
                {!state.loaded && <ActivityIndicator className="mt-8" color={colors.primary.main} />}

                {state.loaded && state.campaigns.length === 0 && (
                    <View className="items-center mt-16 px-6">
                        <Image source={isDark ? AnnouncementDark : AnnouncementLight} style={{ width: 72, height: 72, opacity: 0.6 }} />
                        <Text className="text-center mt-4" style={{ color: theme.textSecondary }}>
                            {t('campaigns-none')}
                        </Text>
                    </View>
                )}

                <View className="gap-3">
                    {state.campaigns.map((campaign) => {
                        const joined = state.me[campaign.slug]?.joined === true;
                        const participating = isParticipating(campaign, state);
                        // first period the backend lists (weekly, or the single "total" one)
                        const weekly = state.me[campaign.slug]?.periods?.[0];
                        return (
                            <TouchableOpacity
                                key={campaign.slug}
                                activeOpacity={0.7}
                                onPress={() => router.push({ pathname: '/campaigns/[slug]', params: { slug: campaign.slug } })}
                                className="flex-row items-center rounded-2xl p-4"
                                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                            >
                                <Image source={isDark ? AnnouncementDark : AnnouncementLight} style={{ width: 44, height: 44, marginRight: 14 }} />
                                <View className="flex-1">
                                    <Text className="text-base font-semibold" style={{ color: theme.textPrimary }} numberOfLines={1}>
                                        {pickLocalized(campaign.name, i18n.language)}
                                    </Text>
                                    <Text className="text-sm mt-0.5" style={{ color: participating ? theme.green : theme.textSecondary }}>
                                        {participating
                                            ? [
                                                  t(joined ? 'campaign-joined-short' : 'campaign-open-short'),
                                                  weekly?.rank ? `#${weekly.rank}` : null,
                                                  weekly?.rank ? `${weekly.score} ${t('campaign-points')}` : null,
                                              ]
                                                  .filter(Boolean)
                                                  .join(' · ')
                                            : t('campaign-not-joined')}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
}
