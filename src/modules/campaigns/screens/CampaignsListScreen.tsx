import React, { useCallback, useState } from 'react';
import { Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { hasCampaignEnded, isParticipating, refreshCampaigns, useCampaigns } from '../store/campaignStore';
import { pickLocalized } from '../utils/localizedText';
import { campaignService } from '../services/campaign.service';
import { CampaignCountdown } from '../components/CampaignCountdown';
import { Campaign } from '../types/campaign.types';
import { NotificationsOffStrip } from '../../../shared/components/NotificationsOffStrip';
import { Chip, FONT_MEDIUM, RADIUS, SectionLabel, SkeletonBlock } from '../components/CampaignUi';

const AnnouncementLight = require('../../../../assets/images/announcement-light.png');
const AnnouncementDark = require('../../../../assets/images/announcement-dark.png');

// Profile → Campaigns: always lists running campaigns, so dismissing the banner never locks anyone out
export default function CampaignsListScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();
    const state = useCampaigns();
    // undefined while loading, null when nothing is scheduled; a failed call shows nothing about it
    const [next, setNext] = useState<Campaign | null | undefined>(undefined);
    const [nextFailed, setNextFailed] = useState(false);

    const loadNext = useCallback(() => {
        campaignService
            .getNext()
            .then((campaign) => {
                setNext(campaign);
                setNextFailed(false);
            })
            .catch(() => setNextFailed(true));
    }, []);

    const reload = useCallback(() => {
        void refreshCampaigns();
        loadNext();
    }, [loadNext]);

    useFocusEffect(reload);

    const nextStart = next?.startsAt ? new Date(next.startsAt) : null;
    const nextUpcoming = !!nextStart && !Number.isNaN(nextStart.getTime()) && nextStart.getTime() > Date.now();
    const anyLive = state.campaigns.some((campaign) => !hasCampaignEnded(campaign));
    // "coming soon" only when nothing is running and nothing is scheduled
    const showComingSoon = next === null && !nextFailed && !anyLive;

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
            <View className="px-4 pt-3 pb-2 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="p-1 -ml-1" activeOpacity={0.7} hitSlop={8}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
            </View>
            <Text className="px-4 mb-4" style={{ color: theme.textPrimary, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 }}>
                {t('campaigns')}
            </Text>

            <ScrollView
                className="flex-1 px-4"
                contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                refreshControl={<RefreshControl refreshing={state.loading} onRefresh={reload} />}
            >
                <NotificationsOffStrip style={{ marginBottom: 12 }} />

                {!state.loaded && (
                    // skeleton cards shaped like the campaign rows
                    <View style={{ gap: 12 }}>
                        {[0, 1, 2].map((i) => (
                            <View
                                key={i}
                                className="flex-row items-center p-4"
                                style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}
                            >
                                <SkeletonBlock height={40} width={40} style={{ marginRight: 14 }} />
                                <View className="flex-1" style={{ gap: 8 }}>
                                    <SkeletonBlock height={14} width="60%" />
                                    <SkeletonBlock height={12} width="35%" />
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {nextUpcoming && next && nextStart && (
                    <View className="p-4 mb-3" style={{ borderRadius: RADIUS, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.primary }}>
                        <SectionLabel style={{ marginBottom: 6 }}>{t('campaign-next-title')}</SectionLabel>
                        <Text style={{ color: theme.textPrimary, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 }} numberOfLines={2}>
                            {pickLocalized(next.name, i18n.language)}
                        </Text>
                        <Text className="text-xs mt-1 mb-4" style={{ color: theme.textSecondary }}>
                            {t('campaign-starts-on', {
                                date: nextStart.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
                            })}
                        </Text>
                        {/* at zero it has started: it moves into the running list below */}
                        <CampaignCountdown endsAt={nextStart.toISOString()} label={t('campaign-starts-in')} onDone={reload} />
                    </View>
                )}

                {showComingSoon && (
                    <View className="items-center px-6 py-8 mb-3" style={{ borderRadius: RADIUS, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                        <Image source={isDark ? AnnouncementDark : AnnouncementLight} style={{ width: 64, height: 64 }} />
                        <Text className="text-base text-center mt-4" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>
                            {t('campaign-next-soon-title')}
                        </Text>
                        <Text className="text-xs text-center mt-1 leading-5" style={{ color: theme.textSecondary }}>
                            {t('campaign-next-soon-body')}
                        </Text>
                    </View>
                )}

                {state.loaded && state.campaigns.length === 0 && !nextUpcoming && !showComingSoon && (
                    <View className="items-center mt-16 px-6">
                        <Image source={isDark ? AnnouncementDark : AnnouncementLight} style={{ width: 72, height: 72, opacity: 0.6 }} />
                        <Text className="text-sm text-center mt-4" style={{ color: theme.textSecondary }}>
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
                                className="flex-row items-center p-4"
                                style={{ borderRadius: RADIUS, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                            >
                                <Image source={isDark ? AnnouncementDark : AnnouncementLight} style={{ width: 40, height: 40, marginRight: 14 }} />
                                <View className="flex-1 mr-2">
                                    <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 15 }} numberOfLines={1}>
                                        {pickLocalized(campaign.name, i18n.language)}
                                    </Text>
                                    <View className="flex-row mt-1.5">
                                        <Chip tone={participating ? 'success' : 'neutral'}>
                                            {participating
                                                ? [
                                                      t(joined ? 'campaign-joined-short' : 'campaign-open-short'),
                                                      weekly?.rank ? `#${weekly.rank}` : null,
                                                      // rank is null while the board is hidden near the period's end; the score still counts
                                                      weekly && (weekly.rank || weekly.score > 0) ? `${weekly.score} ${t('campaign-points')}` : null,
                                                  ]
                                                      .filter(Boolean)
                                                      .join(' · ')
                                                : hasCampaignEnded(campaign)
                                                  ? t(campaign.phase === 'final' ? 'campaign-phase-final-short' : campaign.phase === 'auditing' ? 'campaign-phase-auditing-short' : 'campaign-ended')
                                                  : t('campaign-not-joined')}
                                        </Chip>
                                    </View>
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
