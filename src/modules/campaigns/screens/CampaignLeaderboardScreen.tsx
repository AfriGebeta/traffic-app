import React, { useEffect, useRef, useState } from 'react';
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
import { previousWeekKey } from '../utils/previousWeekKey';
import { CampaignLeaderboard, CampaignPeriodKind, CampaignTrack } from '../types/campaign.types';

const NO_TRACKS: CampaignTrack[] = [];

// 1st/2nd/3rd/11th/22nd…; Amharic uses ኛ for every rank
const ordinal = (rank: number, language: string): string => {
    if (language.startsWith('am')) return `${rank}ኛ`;
    const lastTwo = rank % 100;
    if (lastTwo >= 11 && lastTwo <= 13) return `${rank}th`;
    return `${rank}${['th', 'st', 'nd', 'rd'][rank % 10] ?? 'th'}`;
};

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
    const [page, setPage] = useState(1);
    // weekly board of the week before the current one, as its own tab
    const [showLastWeek, setShowLastWeek] = useState(false);
    // bumped on every request so a slow response for an older tab/page is dropped
    const requestId = useRef(0);

    useEffect(() => {
        if (!track && (myTrack || tracks[0])) setTrack(myTrack ?? tracks[0].key);
    }, [myTrack, tracks, track]);

    const lastWeekKey = previousWeekKey(periods.find((p) => p.kind === 'weekly')?.current, campaign?.startsAt);
    const lastWeekActive = showLastWeek && !!lastWeekKey;

    useEffect(() => {
        // campaigns without tracks have one board, fetched without ?track=
        if (!slug || (tracks.length > 0 && !track)) return;
        const id = ++requestId.current;
        setLoading(true);
        setFailed(false);
        campaignService
            .getLeaderboard(slug, track, lastWeekActive ? 'weekly' : period, { page, key: lastWeekActive ? lastWeekKey : undefined })
            .then((data) => {
                if (id === requestId.current) setBoard(data);
            })
            .catch(() => {
                if (id === requestId.current) setFailed(true);
            })
            .finally(() => {
                if (id === requestId.current) setLoading(false);
            });
    }, [slug, track, period, page, lastWeekActive, lastWeekKey, tracks.length]);

    // switching board starts again at page 1
    const selectTrack = (key: string) => {
        setTrack(key);
        setPage(1);
    };
    const selectPeriod = (kind: CampaignPeriodKind, lastWeek = false) => {
        setPeriod(kind);
        setShowLastWeek(lastWeek);
        setPage(1);
    };

    const totalPages = board?.totalPages ?? 1;
    const showPager = totalPages > 1;

    const status = board?.period?.status;
    const prizes = Object.entries(campaign?.prizes ?? {})
        .map(([rank, amount]) => ({ rank: Number(rank), amount }))
        .filter(({ rank, amount }) => Number.isInteger(rank) && rank > 0 && typeof amount === 'number' && amount > 0)
        .sort((a, b) => a.rank - b.rank);

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

    const pageButton = (label: string, icon: 'chevron-back' | 'chevron-forward', enabled: boolean, onPress: () => void) => {
        const active = enabled && !loading;
        const color = active ? theme.textPrimary : theme.textSecondary;
        return (
            <TouchableOpacity
                onPress={onPress}
                disabled={!active}
                activeOpacity={0.7}
                className="flex-row items-center px-3 py-2 rounded-lg"
                style={{ borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, opacity: active ? 1 : 0.4 }}
            >
                {icon === 'chevron-back' && <Ionicons name={icon} size={16} color={color} />}
                <Text className="font-semibold mx-1" style={{ color }}>
                    {label}
                </Text>
                {icon === 'chevron-forward' && <Ionicons name={icon} size={16} color={color} />}
            </TouchableOpacity>
        );
    };

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
                    {tracks.map((tr) => chip(pickLocalized(tr.name, i18n.language), track === tr.key, () => selectTrack(tr.key)))}
                </View>
            )}
            {(periodKinds.length > 1 || !!lastWeekKey) && (
                <View className="flex-row flex-wrap px-4 mb-3 gap-y-2">
                    {periods.map((p) => (
                        <React.Fragment key={p.kind}>
                            {chip(periodLabel(p.current ?? p.kind, t), period === p.kind && !lastWeekActive, () => selectPeriod(p.kind))}
                            {p.kind === 'weekly' &&
                                !!lastWeekKey &&
                                chip(t('campaign-last-week'), lastWeekActive, () => selectPeriod('weekly', true))}
                        </React.Fragment>
                    ))}
                </View>
            )}

            {!!status && status !== 'live' && (
                <View className="mx-4 mb-3 rounded-xl px-4 py-3" style={{ backgroundColor: theme.primaryMuted }}>
                    <Text className="font-semibold" style={{ color: theme.textPrimary }}>
                        {t(status === 'auditing' ? 'campaign-status-auditing' : 'campaign-status-final')}
                    </Text>
                </View>
            )}

            <View className="flex-1">
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
                        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: prizes.length > 0 || showPager ? 16 : insets.bottom + 24 }}
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

            {showPager && (
                <View
                    className="flex-row items-center justify-between px-4 py-3"
                    style={{
                        borderTopWidth: 1,
                        borderTopColor: theme.border,
                        paddingBottom: prizes.length > 0 ? 12 : insets.bottom + 12,
                    }}
                >
                    {pageButton(t('campaign-page-previous'), 'chevron-back', page > 1, () => setPage(page - 1))}
                    <Text className="text-sm" style={{ color: theme.textSecondary }}>
                        {t('campaign-page-of', { page, total: totalPages })}
                    </Text>
                    {pageButton(t('campaign-page-next'), 'chevron-forward', page < totalPages, () => setPage(page + 1))}
                </View>
            )}

            {prizes.length > 0 && (
                <View
                    className="px-4 pt-4"
                    style={{ paddingBottom: insets.bottom + 16, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.background }}
                >
                    <Text className="font-bold text-base mb-3" style={{ color: theme.textPrimary }}>
                        {t('campaign-prizes')}
                    </Text>
                    <View className="flex-row gap-3">
                        {prizes.map(({ rank, amount }) => (
                            <View
                                key={rank}
                                className="flex-1 items-center rounded-2xl py-3"
                                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                            >
                                <Text className="font-semibold" style={{ color: theme.textSecondary }}>
                                    {ordinal(rank, i18n.language)}
                                </Text>
                                <Text className="font-bold text-base" style={{ color: theme.textPrimary }} numberOfLines={1} adjustsFontSizeToFit>
                                    {t('campaign-prize-amount', { amount: amount.toLocaleString('en-US') })}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
}
