import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { campaignService } from '../services/campaign.service';
import { refreshCampaigns, useCampaigns } from '../store/campaignStore';
import { getStoredUserId } from '../../register/utils/profileGate';
import { notificationService } from '../../notifications/services/notification.service';
import { pickLocalized } from '../utils/localizedText';
import { periodLabel } from '../utils/periodLabel';
import { previousWeekKey } from '../utils/previousWeekKey';
import { ordinal } from '../utils/ordinal';
import { CampaignLeaderboard, CampaignPeriodKind, CampaignTrack } from '../types/campaign.types';
import { FONT_MEDIUM, RADIUS, RADIUS_SM, SectionLabel, SkeletonBlock, tint } from './CampaignUi';

const NO_TRACKS: CampaignTrack[] = [];

const PODIUM_HEIGHTS: Record<number, number> = { 1: 100, 2: 84, 3: 70 };
const WINNER_HEIGHTS: Record<number, number> = { 1: 150, 2: 118, 3: 100 };

interface Props {
    slug: string;
    // open on that tab, e.g. 'total' from the detail screen's win card
    initialPeriod?: string;
}

export function CampaignLeaderboardView({ slug, initialPeriod }: Props) {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();
    const state = useCampaigns();

    const campaign = state.campaigns.find((c) => c.slug === slug) ?? null;
    const tracks = campaign?.tracks ?? NO_TRACKS;
    const periods = campaign?.periods ?? [];
    const periodKinds = periods.map((p) => p.kind);
    const myTrack = slug ? state.me[slug]?.enrollment?.track : undefined;
    const [myUserId, setMyUserId] = useState<string | null>(null);
    const [unreadNotifications, setUnreadNotifications] = useState(0);

    // the status card opens the notifications inbox; refreshed on return so the badge clears after reading
    useFocusEffect(
        useCallback(() => {
            notificationService
                .getUnreadCount()
                .then(setUnreadNotifications)
                .catch(() => undefined);
        }, [])
    );

    // fresh /me, so the "You" bar's rank matches the board just fetched
    useEffect(() => {
        void refreshCampaigns();
        void getStoredUserId().then(setMyUserId);
    }, []);

    const [track, setTrack] = useState<string | null>(myTrack ?? tracks[0]?.key ?? null);
    const [period, setPeriod] = useState<CampaignPeriodKind>(
        initialPeriod && periodKinds.includes(initialPeriod) ? initialPeriod : periodKinds[0] ?? 'weekly'
    );
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
    // hidden: 24 h before the period ends until review is done; data is empty on purpose, so it's not "no one yet"
    const hidden = board?.period?.hidden === true;
    const showPager = totalPages > 1 && !hidden;

    // a hidden board reads as "checking results" even while the period is technically still live
    const status = hidden ? 'auditing' : board?.period?.status;
    const prizes = Object.entries(campaign?.prizes ?? {})
        .map(([rank, amount]) => ({ rank: Number(rank), amount }))
        .filter(({ rank, amount }) => Number.isInteger(rank) && rank > 0 && typeof amount === 'number' && amount > 0)
        .sort((a, b) => a.rank - b.rank);
    const podium = [2, 1, 3].flatMap((rank) => prizes.filter((prize) => prize.rank === rank));
    const otherPrizes = prizes.filter((prize) => prize.rank > 3);
    const prizeFor = (rank: number) => prizes.find((prize) => prize.rank === rank)?.amount;

    // final: the top 3 move from the list onto a podium at the top, with their prizes; the list carries on from 4th
    const winners = status === 'final';
    const entries = board?.data ?? [];
    const topThree = winners && page === 1 ? entries.filter((entry) => entry.rank <= 3).slice(0, 3) : [];
    const listEntries = topThree.length > 0 ? entries.slice(topThree.length) : entries;
    const winnerPodium = [topThree[1], topThree[0], topThree[2]].filter((entry) => !!entry);
    const showPrizeFooter = prizes.length > 0 && !winners;

    const boardPeriod = board?.period;
    const onMyTrack = tracks.length === 0 || !board?.track || board.track === myTrack;
    const meStanding = (slug ? state.me[slug]?.periods ?? [] : []).find(
        (standing) =>
            typeof standing.period === 'object' && standing.period.kind === boardPeriod?.kind && standing.period.key === boardPeriod?.key
    );
    const meOnPage = myUserId ? entries.find((entry) => entry.userId === myUserId) : undefined;
    const myRank = meStanding?.rank ?? meOnPage?.rank ?? null;
    const myScore = meStanding?.score ?? meOnPage?.campaignScore ?? null;
    const showMe = !loading && !failed && onMyTrack && myScore !== null && !meOnPage;
    const myPage = myRank && board?.pageSize ? Math.ceil(myRank / board.pageSize) : null;

    const winnersHeader =
        winnerPodium.length > 0 ? (
            <View className="pt-1 pb-3">
                <View className="flex-row items-end gap-3">
                    {winnerPodium.map((entry) => {
                        // place on the podium, not entry.rank, so a tie can't make two blocks the tallest
                        const place = topThree.indexOf(entry) + 1;
                        const prize = prizeFor(entry.rank);
                        const first = place === 1;
                        return (
                            <View key={entry.userId} className="flex-1 items-center">
                                <View
                                    className="w-full items-center justify-center px-1.5"
                                    // only 1st gets the brand tint; 2nd and 3rd stay plain
                                    style={{
                                        height: WINNER_HEIGHTS[place],
                                        borderRadius: RADIUS,
                                        backgroundColor: first ? tint(theme.primary, '14') : theme.surface,
                                        borderWidth: 1,
                                        borderColor: first ? theme.primary : theme.border,
                                    }}
                                >
                                    <Text style={{ color: first ? theme.primary : theme.textPrimary, fontSize: 36, lineHeight: 42, fontVariant: ['tabular-nums'] }}>
                                        {place}
                                    </Text>
                                    <View className="px-2 py-0.5 mt-2" style={{ backgroundColor: theme.background, borderRadius: 4 }}>
                                        {/* prize goes in the block; without one, the score takes its place */}
                                        <Text
                                            className="text-xs"
                                            style={{ color: prize ? theme.textPrimary : theme.textSecondary, fontFamily: FONT_MEDIUM, fontVariant: ['tabular-nums'] }}
                                            numberOfLines={1}
                                        >
                                            {prize
                                                ? t('campaign-prize-amount', { amount: prize.toLocaleString('en-US') })
                                                : `${entry.campaignScore} ${t('campaign-points')}`}
                                        </Text>
                                    </View>
                                </View>
                                <Text
                                    className="text-sm mt-2"
                                    // a long name wraps; without this the second line hugs the left
                                    style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, textAlign: 'center' }}
                                    numberOfLines={2}
                                >
                                    {entry.name}
                                </Text>
                                {!!prize && (
                                    <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
                                        {entry.campaignScore} {t('campaign-points')}
                                    </Text>
                                )}
                            </View>
                        );
                    })}
                </View>
                {otherPrizes.length > 0 && (
                    <Text className="text-xs mt-3 text-center" style={{ color: theme.textSecondary }}>
                        {otherPrizes
                            .map(({ rank, amount }) => `${ordinal(rank, i18n.language)}: ${t('campaign-prize-amount', { amount: amount.toLocaleString('en-US') })}`)
                            .join('  ·  ')}
                    </Text>
                )}
            </View>
        ) : null;

    const chip = (label: string, active: boolean, onPress: () => void) => (
        <TouchableOpacity
            key={label}
            onPress={onPress}
            activeOpacity={0.7}
            className="px-3 py-1.5 mr-2"
            style={{
                borderRadius: RADIUS_SM,
                backgroundColor: active ? tint(theme.primary, '1F') : 'transparent',
                borderWidth: 1,
                borderColor: active ? theme.primary : theme.border,
            }}
        >
            <Text className="text-sm" style={{ color: active ? theme.textPrimary : theme.textSecondary, fontFamily: active ? FONT_MEDIUM : undefined }}>
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
                className="flex-row items-center px-3 py-2"
                style={{ borderRadius: RADIUS_SM, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, opacity: active ? 1 : 0.4 }}
            >
                {icon === 'chevron-back' && <Ionicons name={icon} size={16} color={color} />}
                <Text className="text-sm mx-1" style={{ color, fontFamily: FONT_MEDIUM }}>
                    {label}
                </Text>
                {icon === 'chevron-forward' && <Ionicons name={icon} size={16} color={color} />}
            </TouchableOpacity>
        );
    };

    return (
        <View className="flex-1">
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

            {!!status && (
                <TouchableOpacity
                    onPress={() => router.push('/notifications')}
                    activeOpacity={0.7}
                    className="flex-row items-start mx-4 mb-3 px-4 py-3"
                    style={
                        status === 'final'
                            ? { borderRadius: RADIUS, borderWidth: 1, borderColor: theme.primary, backgroundColor: theme.surface }
                            : {
                                  borderRadius: RADIUS,
                                  backgroundColor: status === 'live' ? theme.surface : tint(theme.primary, '14'),
                                  borderWidth: 1,
                                  borderColor: status === 'live' ? theme.border : tint(theme.primary, '4D'),
                              }
                    }
                >
                    {status === 'live' && <View className="w-1.5 h-1.5 rounded-full mt-2" style={{ backgroundColor: theme.green }} />}
                    <View className={status === 'live' ? 'flex-1 ml-2.5' : 'flex-1'}>
                        <Text className="text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>
                            {t(`campaign-status-${status}`)}
                        </Text>
                        <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                            {hidden
                                ? t('campaign-leaderboard-hidden-note')
                                : status === 'live'
                                  ? t('campaign-leaderboard-provisional')
                                  : t(`campaign-status-${status}-note`)}
                        </Text>
                    </View>
                    <View className="flex-row items-center self-center ml-3">
                        <Ionicons name="notifications-outline" size={18} color={theme.textSecondary} />
                        {unreadNotifications > 0 && (
                            <View
                                className="rounded-full items-center justify-center px-1.5 ml-1"
                                style={{ minWidth: 18, height: 18, backgroundColor: theme.primary }}
                            >
                                <Text style={{ color: '#fff', fontSize: 11, fontFamily: FONT_MEDIUM, fontVariant: ['tabular-nums'] }}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</Text>
                            </View>
                        )}
                        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} style={{ marginLeft: 2 }} />
                    </View>
                </TouchableOpacity>
            )}

            <View className="flex-1">
                {loading && (
                    // rows shaped like the list: rank, name, score
                    <View className="px-4 pt-2" style={{ gap: 14 }}>
                        {[0.7, 0.55, 0.65, 0.5, 0.6, 0.45, 0.6].map((w, i) => (
                            <View key={i} className="flex-row items-center px-3">
                                <SkeletonBlock height={12} width={24} style={{ marginRight: 16 }} />
                                <SkeletonBlock height={12} width={`${Math.round(w * 100)}%`} />
                                <View className="flex-1" />
                                <SkeletonBlock height={12} width={36} />
                            </View>
                        ))}
                    </View>
                )}
                {!loading && failed && (
                    <Text className="text-center text-sm mt-8" style={{ color: theme.textSecondary }}>
                        {t('campaign-leaderboard-failed')}
                    </Text>
                )}

                {!loading && !failed && !hidden && (
                    <FlatList
                        data={listEntries}
                        keyExtractor={(entry) => entry.userId}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: showPrizeFooter || showPager || showMe ? 16 : insets.bottom + 24 }}
                        ListHeaderComponent={winnersHeader}
                        ListEmptyComponent={
                            topThree.length > 0 ? null : (
                                <Text className="text-center text-sm mt-8" style={{ color: theme.textSecondary }}>
                                    {t('campaign-leaderboard-empty')}
                                </Text>
                            )
                        }
                        renderItem={({ item }) => (
                            // no dividers: spacing separates rows; your own row gets a soft brand tint
                            <View
                                className="flex-row items-center px-3"
                                // tall enough that a page of 10 nearly fills the screen above the pinned pager
                                style={{
                                    minHeight: 44,
                                    borderRadius: RADIUS_SM,
                                    backgroundColor: item.userId === myUserId ? tint(theme.primary, '1F') : 'transparent',
                                }}
                            >
                                <Text
                                    className="w-10 text-sm"
                                    style={{
                                        color: item.rank <= 3 ? theme.primary : theme.textSecondary,
                                        fontFamily: item.rank <= 3 ? FONT_MEDIUM : undefined,
                                        fontVariant: ['tabular-nums'],
                                    }}
                                >
                                    {item.rank}
                                </Text>
                                <Text
                                    className="flex-1 text-sm mr-3"
                                    style={{ color: theme.textPrimary, fontFamily: item.userId === myUserId ? FONT_MEDIUM : undefined }}
                                    numberOfLines={1}
                                >
                                    {item.name}
                                </Text>
                                <Text className="text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontVariant: ['tabular-nums'] }}>
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
                        paddingBottom: showPrizeFooter || showMe ? 12 : insets.bottom + 12,
                    }}
                >
                    {pageButton(t('campaign-page-previous'), 'chevron-back', page > 1, () => setPage(page - 1))}
                    <Text className="text-xs" style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
                        {t('campaign-page-of', { page, total: totalPages })}
                    </Text>
                    {pageButton(t('campaign-page-next'), 'chevron-forward', page < totalPages, () => setPage(page + 1))}
                </View>
            )}

            {showMe && (
                <View className="px-4 pt-3" style={{ paddingBottom: showPrizeFooter ? 12 : insets.bottom + 12 }}>
                    <TouchableOpacity
                        onPress={() => myPage && setPage(myPage)}
                        disabled={!myPage || myPage === page}
                        activeOpacity={0.7}
                        className="flex-row items-center px-3 py-3"
                        style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: tint(theme.primary, '66'), backgroundColor: tint(theme.primary, '1F') }}
                    >
                        <Text className="w-12 text-sm" style={{ color: theme.primary, fontFamily: FONT_MEDIUM, fontVariant: ['tabular-nums'] }}>
                            {myRank ?? '—'}
                        </Text>
                        <Text className="flex-1 text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }} numberOfLines={1}>
                            {t('campaign-you')}
                        </Text>
                        <Text className="text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontVariant: ['tabular-nums'] }}>
                            {myScore}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {showPrizeFooter && (
                <View
                    className="px-4 pt-4"
                    style={{ paddingBottom: insets.bottom + 16, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.background }}
                >
                    <SectionLabel style={{ marginBottom: 10 }}>{t('campaign-prizes')}</SectionLabel>
                    {/* podium: 2nd | 1st (taller) | 3rd */}
                    <View className="flex-row items-end gap-3">
                        {podium.map(({ rank, amount }) => {
                            const first = rank === 1;
                            return (
                                <View
                                    key={rank}
                                    className="flex-1 items-center justify-center px-2"
                                    style={{
                                        height: PODIUM_HEIGHTS[rank],
                                        borderRadius: RADIUS,
                                        backgroundColor: first ? tint(theme.primary, '14') : theme.surface,
                                        borderWidth: 1,
                                        borderColor: first ? tint(theme.primary, '66') : theme.border,
                                    }}
                                >
                                    <Text className="text-xs" style={{ color: theme.textSecondary }}>
                                        {ordinal(rank, i18n.language)}
                                    </Text>
                                    <Text
                                        className={first ? 'text-lg mt-0.5' : 'text-base mt-0.5'}
                                        style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontVariant: ['tabular-nums'] }}
                                        numberOfLines={1}
                                    >
                                        {t('campaign-prize-amount', { amount: amount.toLocaleString('en-US') })}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                    {otherPrizes.length > 0 && (
                        <Text className="text-xs mt-3 text-center" style={{ color: theme.textSecondary }}>
                            {otherPrizes
                                .map(({ rank, amount }) => `${ordinal(rank, i18n.language)}: ${t('campaign-prize-amount', { amount: amount.toLocaleString('en-US') })}`)
                                .join('  ·  ')}
                        </Text>
                    )}
                </View>
            )}
        </View>
    );
}
