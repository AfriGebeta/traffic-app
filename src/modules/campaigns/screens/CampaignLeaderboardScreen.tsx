import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { campaignService } from '../services/campaign.service';
import { useCampaigns } from '../store/campaignStore';
import { pickLocalized } from '../utils/localizedText';
import { periodLabel } from '../utils/periodLabel';
import { CampaignLeaderboard, CampaignPeriodKind, CampaignTrack } from '../types/campaign.types';

const NO_TRACKS: CampaignTrack[] = [];

// Separate from the app-wide /leaderboard: only joined users, per track, verified campaign points
export default function CampaignLeaderboardScreen() {
    const router = useRouter();
    const { slug } = useLocalSearchParams<{ slug: string }>();
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();
    const state = useCampaigns();

    const campaign = state.campaigns.find((c) => c.slug === slug) ?? null;
    const tracks = campaign?.tracks ?? NO_TRACKS;
    const periods = campaign?.periods ?? [];
    const periodKinds = periods.map((p) => p.kind);
    const myTrack = slug ? state.me[slug]?.enrollment?.track : undefined;

    const [track, setTrack] = useState<string | null>(myTrack ?? tracks[0]?.key ?? null);
    const [period, setPeriod] = useState<CampaignPeriodKind>(periodKinds[0] ?? 'weekly');
    const [board, setBoard] = useState<CampaignLeaderboard | null>(null);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!track && (myTrack || tracks[0])) setTrack(myTrack ?? tracks[0].key);
    }, [myTrack, tracks, track]);

    useEffect(() => {
        // campaigns without tracks have one board, fetched without ?track=
        if (!slug || (tracks.length > 0 && !track)) return;
        let cancelled = false;
        setLoading(true);
        setFailed(false);
        campaignService
            .getLeaderboard(slug, track, period)
            .then((data) => {
                if (!cancelled) setBoard(data);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [slug, track, period, tracks.length]);

    const status = board?.period?.status;

    const chip = (label: string, active: boolean, onPress: () => void) => (
        <TouchableOpacity
            key={label}
            onPress={onPress}
            activeOpacity={0.7}
            className="px-4 py-2 rounded-lg mr-2"
            style={{
                backgroundColor: active ? colors.primary.main : theme.surface,
                borderWidth: 1,
                borderColor: active ? colors.primary.main : theme.border,
            }}
        >
            <Text className="font-semibold" style={{ color: active ? '#fff' : theme.textPrimary }}>
                {label}
            </Text>
        </TouchableOpacity>
    );

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

            {/* track tabs only when there's a choice; otherwise the single track is implied */}
            {tracks.length > 1 && (
                <View className="flex-row px-4 mb-3">
                    {tracks.map((tr) => chip(pickLocalized(tr.name, i18n.language), track === tr.key, () => setTrack(tr.key)))}
                </View>
            )}
            {periodKinds.length > 1 && (
                <View className="flex-row px-4 mb-3">
                    {periods.map((p) => chip(periodLabel(p.current ?? p.kind, t), period === p.kind, () => setPeriod(p.kind)))}
                </View>
            )}

            {!!status && status !== 'live' && (
                <View className="mx-4 mb-3 rounded-xl px-4 py-3" style={{ backgroundColor: theme.primaryMuted }}>
                    <Text className="font-semibold" style={{ color: theme.textPrimary }}>
                        {t(status === 'auditing' ? 'campaign-status-auditing' : 'campaign-status-final')}
                    </Text>
                </View>
            )}

            {loading && <ActivityIndicator className="mt-8" color={colors.primary.main} />}
            {!loading && failed && (
                <Text className="text-center mt-8" style={{ color: theme.textSecondary }}>
                    {t('campaign-leaderboard-failed')}
                </Text>
            )}

            {!loading && !failed && (
                <FlatList
                    data={board?.data ?? []}
                    keyExtractor={(entry) => entry.userId}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
                    ListEmptyComponent={
                        <Text className="text-center mt-8" style={{ color: theme.textSecondary }}>
                            {t('campaign-leaderboard-empty')}
                        </Text>
                    }
                    renderItem={({ item }) => (
                        <View
                            className="flex-row items-center py-3"
                            style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}
                        >
                            <Text className="w-10 font-bold" style={{ color: item.rank <= 3 ? colors.primary.main : theme.textSecondary }}>
                                #{item.rank}
                            </Text>
                            <Text className="flex-1 text-base" style={{ color: theme.textPrimary }} numberOfLines={1}>
                                {item.name}
                            </Text>
                            <Text className="font-bold text-base" style={{ color: theme.textPrimary }}>
                                {item.campaignScore}
                            </Text>
                        </View>
                    )}
                />
            )}
        </View>
    );
}
