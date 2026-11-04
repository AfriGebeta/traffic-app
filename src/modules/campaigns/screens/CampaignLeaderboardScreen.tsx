import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useCampaigns } from '../store/campaignStore';
import { pickLocalized } from '../utils/localizedText';
import { CampaignLeaderboardView } from '../components/CampaignLeaderboardView';

export default function CampaignLeaderboardScreen() {
    const router = useRouter();
    // period: open on that tab, e.g. 'total' from the detail screen's win card
    const { slug, period } = useLocalSearchParams<{ slug: string; period?: string }>();
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();
    const campaign = useCampaigns().campaigns.find((c) => c.slug === slug) ?? null;

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
            <View className="px-4 py-4 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4" activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={26} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="text-xl font-bold flex-1" style={{ color: theme.textPrimary }} numberOfLines={1}>
                    {campaign ? pickLocalized(campaign.name, i18n.language) : t('leaderboard')}
                </Text>
            </View>
            {!!slug && <CampaignLeaderboardView slug={slug} initialPeriod={period} />}
        </View>
    );
}
