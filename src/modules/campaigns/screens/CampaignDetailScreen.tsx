import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip, FONT_MEDIUM, NavRow, RADIUS, RADIUS_SM, SectionLabel, SkeletonBlock, tint } from '../components/CampaignUi';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { showToast } from '../../../shared/utils/toast';
import { ApiError, ApiErrorCode, isRestrictedError } from '../../../shared/utils/apiErrors';
import { useAuthGate } from '../../register/hooks/useAuthGate';
import { CampaignCountdown } from '../components/CampaignCountdown';
import { campaignService } from '../services/campaign.service';
import { hasCampaignEnded, isParticipating, markCampaignJoined, markCampaignLeft, refreshCampaigns, useCampaigns } from '../store/campaignStore';
import { basePoints } from '../utils/campaignPoints';
import { getLastTrackKey, setLastTrackKey } from '../utils/campaignPrefs';
import { pickLocalized } from '../utils/localizedText';
import { periodLabel } from '../utils/periodLabel';
import { ordinal } from '../utils/ordinal';
import { startCampaignTour } from '../tour/campaignTour';
import { CampaignKind, CampaignTrack } from '../types/campaign.types';
import { askForNotifications } from '../../../shared/services/notificationPermission';

const NO_TRACKS: CampaignTrack[] = [];

const KIND_LABEL_KEYS: Record<CampaignKind, string> = {
    place: 'campaign-kind-place',
    taxi_station: 'campaign-kind-taxi-station',
    traffic_rule: 'campaign-kind-traffic-rule',
    incident: 'campaign-kind-incident',
};

type SocialLink = { label: string; url: string } & (
    | { family: 'ion'; icon: React.ComponentProps<typeof Ionicons>['name'] }
    | { family: 'fa'; icon: React.ComponentProps<typeof FontAwesome>['name'] }
);

const SOCIAL_LINKS: SocialLink[] = [
    { label: 'Website', url: 'https://gebeta.app', family: 'ion', icon: 'globe-outline' },
    { label: 'LinkedIn', url: 'https://lnkd.in/dKEc5xRw', family: 'ion', icon: 'logo-linkedin' },
    { label: 'Instagram', url: 'https://www.instagram.com/gebetamaps/', family: 'ion', icon: 'logo-instagram' },
    { label: 'X', url: 'https://x.com/gebetamaps', family: 'ion', icon: 'logo-x' },
    { label: 'Telegram', url: 'https://t.me/gebetamaps', family: 'fa', icon: 'telegram' },
];

const formatDate =(iso: string | undefined, language: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(language, { dateStyle: 'medium' });
};

export default function CampaignDetailScreen() {
    const router = useRouter();
    const { slug } = useLocalSearchParams<{ slug: string }>();
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();
    const { requireAuth } = useAuthGate();
    const state = useCampaigns();
    const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        if (!state.loaded) void refreshCampaigns();
    }, [state.loaded]);

    const campaign = state.campaigns.find((c) => c.slug === slug) ?? null;
    const me = slug ? state.me[slug] : undefined;
    // /me.joined is the enrollment itself, independent of requiresJoin
    const joined = me?.joined === true;
    const participating = !!campaign && isParticipating(campaign, state);
    const tracks = campaign?.tracks ?? NO_TRACKS;

    // one track: no question, it's sent automatically; several: pre-select the last choice
    useEffect(() => {
        if (!campaign || selectedTrack) return;
        if (tracks.length === 1) {
            setSelectedTrack(tracks[0].key);
            return;
        }
        getLastTrackKey().then((key) => {
            if (key && tracks.some((track) => track.key === key)) setSelectedTrack(key);
        });
    }, [campaign, tracks, selectedTrack]);

    const scoredKinds = useMemo(
        () =>
            campaign
                ? (Object.keys(KIND_LABEL_KEYS) as CampaignKind[])
                      .map((kind) => ({ kind, points: basePoints(campaign, kind) }))
                      .filter(({ points }) => points > 0)
                : [],
        [campaign]
    );

    const needsTrack = tracks.length > 0;

    // back to the map, where the walkthrough starts; pops everything (banner → detail, or profile → list → detail)
    const showMeAround = () => {
        if (!campaign) return;
        startCampaignTour(campaign.slug);
        router.dismissTo('/');
    };

    const join = async () => {
        if (!campaign || (needsTrack && !selectedTrack) || joining) return;
        if (!(await requireAuth())) return;
        setJoining(true);
        try {
            const track = needsTrack ? selectedTrack : null;
            await campaignService.join(campaign.slug, track);
            if (track) void setLastTrackKey(track);
            markCampaignJoined(campaign.slug, track);
            showToast(t('campaign-joined'));
            void refreshCampaigns();
            showMeAround();
            void askForNotifications('campaign');
        } catch (error) {
            const code = error instanceof ApiError ? error.code : undefined;
            if (isRestrictedError(code)) return;
            if (code === ApiErrorCode.CampaignAlreadyJoined) {
                const joinedTrack = (error as ApiError).additional?.track;
                const trackName = pickLocalized(tracks.find((track) => track.key === joinedTrack)?.name, i18n.language);
                showToast(trackName ? `${t('campaign-already-joined')}: ${trackName}` : t('campaign-already-joined'));
                void refreshCampaigns();
            } else if (code === ApiErrorCode.CampaignNotOpen) {
                showToast(t('campaign-not-open'));
                void refreshCampaigns();
            } else {
                showToast(t('campaign-join-failed'));
            }
        } finally {
            setJoining(false);
        }
    };

    // dev builds only: reset enrollment to test the join flow again
    const devLeave = async () => {
        if (!campaign) return;
        try {
            await campaignService.leave(campaign.slug);
            markCampaignLeft(campaign.slug);
            setSelectedTrack(null);
            showToast('[dev] Left campaign');
            void refreshCampaigns();
        } catch (error) {
            showToast(`[dev] Leave failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    };

    if (!campaign) {
        const loading = state.loading || !state.loaded;
        return (
            <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
                <View className="px-4 pt-3 pb-2 flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1 -ml-1" activeOpacity={0.7} hitSlop={8}>
                        <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                    </TouchableOpacity>
                </View>
                {loading ? (
                    // skeleton shaped like the page: title, dates, description, countdown, points card
                    <View className="px-4" style={{ gap: 10 }}>
                        <SkeletonBlock height={12} width="25%" />
                        <SkeletonBlock height={30} width="70%" />
                        <SkeletonBlock height={12} width="45%" />
                        <SkeletonBlock height={14} style={{ marginTop: 12 }} />
                        <SkeletonBlock height={14} width="85%" />
                        <SkeletonBlock height={88} style={{ marginTop: 20, borderRadius: RADIUS }} />
                        <SkeletonBlock height={140} style={{ marginTop: 12, borderRadius: RADIUS }} />
                    </View>
                ) : (
                    <View className="flex-1 items-center justify-center">
                        <Text className="text-sm" style={{ color: theme.textSecondary }}>{t('campaign-not-found')}</Text>
                    </View>
                )}
            </View>
        );
    }

    const name = pickLocalized(campaign.name, i18n.language);
    const description = pickLocalized(campaign.description, i18n.language);
    const joinedTrack = tracks.find((track) => track.key === me?.enrollment?.track);
    const requirements = campaign.requirements ?? {};
    const formula = campaign.pointsFormula;
    const eventRules = (campaign.scoring ?? []).filter((rule) => typeof rule.points === 'number' && rule.points > 0);
    const cardStyle = { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: RADIUS };
    // open campaigns (requiresJoin false) count everyone, so only offer Join where it matters.
    // /running only lists open campaigns, and E0020 covers one that closed meanwhile
    const ended = hasCampaignEnded(campaign);
    const canJoin = campaign.requiresJoin && !joined && !ended;
    const openLeaderboard = () => router.push({ pathname: '/campaigns/[slug]/leaderboard', params: { slug: campaign.slug } });

    // grand total win, straight from /me: only once results are final and visible, and only for a prize rank
    const totalStanding = (me?.periods ?? []).find(
        (standing) => typeof standing.period !== 'string' && standing.period.kind === 'total'
    );
    const totalPeriod = typeof totalStanding?.period === 'object' ? totalStanding.period : null;
    const totalRank = totalStanding?.rank;
    const totalPrize = totalRank ? campaign.prizes?.[String(totalRank)] : undefined;
    // no joined check: open campaigns count everyone, and a rank already means they're on the board
    const wonTotal =
        totalPeriod?.status === 'final' && !totalPeriod.hidden && !!totalRank && typeof totalPrize === 'number' && totalPrize > 0;

    const bonuses = [
        !!formula?.quality?.photo && formula.quality.photo > 1 ? `${t('campaign-bonus-photo')} ×${formula.quality.photo}` : null,
        !!formula?.quality?.complete && formula.quality.complete > 1 ? `${t('campaign-bonus-complete')} ×${formula.quality.complete}` : null,
        !!formula?.priorityMultiplier && formula.priorityMultiplier > 1 ? `${t('campaign-bonus-priority')} ×${formula.priorityMultiplier}` : null,
        formula?.firstToMapBonus ? `${t('campaign-bonus-first')} +${formula.firstToMapBonus}` : null,
        formula?.dailyItemCap ? `${t('campaign-daily-cap')}: ${formula.dailyItemCap}` : null,
    ].filter((bonus): bonus is string => !!bonus);

    const rules = [
        t('campaign-rule-verified'),
        campaign.boundary ? t('campaign-rule-area') : null,
        requirements.contributorWithinM ? t('campaign-rule-be-there', { meters: requirements.contributorWithinM }) : null,
        requirements.photoMaxAgeHours ? t('campaign-rule-fresh-photo', { hours: requirements.photoMaxAgeHours }) : null,
        t('campaign-rule-camera'),
        t('campaign-rule-honest'),
    ].filter((rule): rule is string => !!rule);

    const joinDisabled = (needsTrack && !selectedTrack) || joining;
    const textPrimary = { color: theme.textPrimary };
    const textSecondary = { color: theme.textSecondary };
    const mediumPrimary = { color: theme.textPrimary, fontFamily: FONT_MEDIUM };

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
            <View className="px-4 pt-3 pb-2 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1 -ml-1" activeOpacity={0.7} hitSlop={8}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>

                <SectionLabel style={{ marginBottom: 6 }}>{t('campaigns')}</SectionLabel>
                <Text style={{ ...textPrimary, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 }}>{name}</Text>

                {(campaign.startsAt || campaign.endsAt) && (
                    <View className="flex-row items-center mt-2">
                        <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
                        <Text className="text-xs ml-1.5" style={textSecondary}>
                            {formatDate(campaign.startsAt, i18n.language)} – {formatDate(campaign.endsAt, i18n.language)}
                        </Text>
                    </View>
                )}

                {!!description && (
                    <Text className="text-sm leading-6 mt-4" style={textSecondary}>
                        {description}
                    </Text>
                )}

                <View style={{ height: 24 }} />

                {wonTotal && (
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/campaigns/[slug]/leaderboard', params: { slug: campaign.slug, period: 'total' } })}
                        activeOpacity={0.7}
                        style={{ ...cardStyle, borderColor: theme.primary, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}
                    >
                        <View className="flex-1 mr-3">
                            <Text style={mediumPrimary}>{t('campaign-you-won-title')}</Text>
                            <Text className="text-xs mt-1" style={textSecondary}>
                                {t('campaign-you-won-total', { place: ordinal(totalRank, i18n.language) })}
                            </Text>
                            <Text style={{ ...textPrimary, fontSize: 22, marginTop: 8, fontVariant: ['tabular-nums'] }}>
                                {t('campaign-prize-amount', { amount: totalPrize.toLocaleString('en-US') })}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                )}

                {!ended && !!campaign.endsAt && <CampaignCountdown endsAt={campaign.endsAt} />}

                {ended && campaign.phase === 'final' && (
                    <TouchableOpacity
                        onPress={openLeaderboard}
                        activeOpacity={0.7}
                        style={{ ...cardStyle, padding: 16, marginBottom: 24, flexDirection: 'row', alignItems: 'center' }}
                    >
                        <View className="flex-1 mr-3">
                            <Text style={mediumPrimary}>{t('campaign-status-final')}</Text>
                            <Text className="text-xs mt-1" style={textSecondary}>
                                {t('campaign-winners-note')}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                )}

                {ended && campaign.phase !== 'final' && (
                    <View style={{ ...cardStyle, padding: 16, marginBottom: 24 }}>
                        <Text style={mediumPrimary}>{t('campaign-ended')}</Text>
                        <Text className="text-xs mt-1" style={textSecondary}>
                            {t(campaign.phase === 'auditing' ? 'campaign-results-coming-note' : 'campaign-ended-description')}
                        </Text>
                    </View>
                )}

                {(participating || (ended && joined)) && (
                    <View style={{ ...cardStyle, padding: 16, marginBottom: 8 }}>
                        <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
                            <Chip tone="success">{t(joined ? 'campaign-you-joined' : 'campaign-open-to-all')}</Chip>
                            {joinedTrack && <Chip>{pickLocalized(joinedTrack.name, i18n.language)}</Chip>}
                        </View>
                        {me?.enrollment?.disqualified && (
                            <View
                                className="mt-3 px-3 py-2"
                                style={{ borderRadius: RADIUS_SM, borderWidth: 1, borderColor: tint(theme.error, '4D'), backgroundColor: tint(theme.error, '1A') }}
                            >
                                <Text className="text-sm" style={{ color: theme.error }}>
                                    {t('campaign-disqualified')}
                                    {me.enrollment.disqualifiedReason ? `: ${me.enrollment.disqualifiedReason}` : ''}
                                </Text>
                            </View>
                        )}
                        {(me?.periods ?? []).map((standing, i) => (
                            <View key={i} className="flex-row items-end justify-between mt-4">
                                <View className="flex-1 mr-3">
                                    <Text className="text-xs" style={textSecondary}>
                                        {periodLabel(standing.period, t)}
                                    </Text>
                                    <View className="flex-row items-baseline">
                                        <Text style={{ ...textPrimary, fontSize: 26, lineHeight: 34, letterSpacing: -0.3, fontVariant: ['tabular-nums'] }}>
                                            {standing.score}
                                        </Text>
                                        <Text className="text-xs ml-1" style={textSecondary}>
                                            {t('campaign-points')}
                                        </Text>
                                    </View>
                                </View>
                                {!!standing.rank && (
                                    <Text className="text-sm mb-1" style={{ ...textSecondary, fontVariant: ['tabular-nums'] }}>
                                        #{standing.rank} / {standing.participants}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {(participating || ended) && (
                    <View className="mb-6 -mx-3">
                        <NavRow title={t('leaderboard')} onPress={openLeaderboard} />
                        {(participating || (ended && joined)) && (
                            <NavRow
                                title={t('my-contributions')}
                                onPress={() => router.push({ pathname: '/my-contributions', params: { campaign: campaign.slug } })}
                            />
                        )}
                        {participating && <NavRow title={t('campaign-how-to-take-part')} onPress={showMeAround} />}
                    </View>
                )}

                {(scoredKinds.length > 0 || eventRules.length > 0) && <SectionLabel style={{ marginBottom: 8 }}>{t('campaign-how-points-work')}</SectionLabel>}

                {scoredKinds.length > 0 && (
                    <>
                        <View style={{ ...cardStyle, paddingVertical: 4, marginBottom: 12 }}>
                            {scoredKinds.map(({ kind, points }) => (
                                <View key={kind} className="flex-row items-center justify-between px-4 py-2.5">
                                    <Text className="text-sm" style={textPrimary}>
                                        {t(KIND_LABEL_KEYS[kind])}
                                    </Text>
                                    <Text className="text-sm" style={{ ...mediumPrimary, fontVariant: ['tabular-nums'] }}>
                                        {points}+ <Text style={textSecondary}>{t('campaign-points')}</Text>
                                    </Text>
                                </View>
                            ))}
                        </View>
                        {bonuses.length > 0 && (
                            <View className="flex-row flex-wrap mb-6" style={{ gap: 6 }}>
                                {bonuses.map((bonus) => (
                                    <Chip key={bonus}>{bonus}</Chip>
                                ))}
                            </View>
                        )}
                        {bonuses.length === 0 && <View style={{ height: 12 }} />}
                    </>
                )}

                {/* campaigns that don't score submissions pay per event; show those rules as sent */}
                {scoredKinds.length === 0 && eventRules.length > 0 && (
                    <View style={{ ...cardStyle, paddingVertical: 4, marginBottom: 24 }}>
                        {eventRules.map((rule, i) => (
                            <View key={`${rule.event}-${i}`} className="flex-row items-center justify-between px-4 py-2.5">
                                <Text className="flex-1 mr-3 text-sm" style={textPrimary}>
                                    {rule.description || rule.event}
                                </Text>
                                <Text className="text-sm" style={{ ...mediumPrimary, fontVariant: ['tabular-nums'] }}>
                                    +{rule.points} <Text style={textSecondary}>{t('campaign-points')}</Text>
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                <SectionLabel style={{ marginBottom: 8 }}>{t('campaign-rules')}</SectionLabel>
                <View className="mb-6" style={{ gap: 8 }}>
                    {rules.map((rule) => (
                        <View key={rule} className="flex-row">
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.textSecondary, marginTop: 8, marginRight: 10 }} />
                            <Text className="text-sm flex-1 leading-5" style={textSecondary}>
                                {rule}
                            </Text>
                        </View>
                    ))}
                </View>

                {canJoin && tracks.length > 1 && (
                    <>
                        <SectionLabel style={{ marginBottom: 4 }}>{t('campaign-choose-track')}</SectionLabel>
                        <Text className="text-xs mb-3" style={textSecondary}>
                            {t('campaign-track-locked')}
                        </Text>
                        <View className="mb-6" style={{ gap: 8 }}>
                            {tracks.map((track) => {
                                const selected = selectedTrack === track.key;
                                return (
                                    <TouchableOpacity
                                        key={track.key}
                                        onPress={() => setSelectedTrack(track.key)}
                                        activeOpacity={0.7}
                                        style={{
                                            ...cardStyle,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            paddingHorizontal: 16,
                                            paddingVertical: 14,
                                            borderColor: selected ? theme.primary : theme.border,
                                            backgroundColor: selected ? tint(theme.primary, '14') : theme.surface
                                        }}
                                    >
                                        <Ionicons
                                            name={selected ? 'radio-button-on' : 'radio-button-off'}
                                            size={20}
                                            color={selected ? theme.primary : theme.textSecondary}
                                        />
                                        <Text className="ml-3 text-sm" style={selected ? mediumPrimary : textPrimary}>
                                            {pickLocalized(track.name, i18n.language)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </>
                )}

                <SectionLabel style={{ marginBottom: 10 }}>{t('campaign-follow-us')}</SectionLabel>
                <View className="flex-row mb-6" style={{ gap: 8 }}>
                    {SOCIAL_LINKS.map((link) => (
                        <TouchableOpacity
                            key={link.label}
                            onPress={() => void Linking.openURL(link.url).catch(() => {})}
                            accessibilityRole="link"
                            accessibilityLabel={link.label}
                            activeOpacity={0.7}
                            style={{
                                ...cardStyle,
                                width: 44,
                                height: 44,
                                borderRadius: RADIUS,
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {link.family === 'ion' ? (
                                <Ionicons name={link.icon} size={20} color={theme.textSecondary} />
                            ) : (
                                <FontAwesome name={link.icon} size={20} color={theme.textSecondary} />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {__DEV__ && joined && (
                    <TouchableOpacity
                        onPress={devLeave}
                        activeOpacity={0.7}
                        className="px-4 py-3 mb-6 items-center"
                        style={{ borderRadius: RADIUS_SM, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.error }}
                    >
                        <Text className="text-sm" style={{ color: theme.error }}>
                            [dev] Leave campaign
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            {canJoin && (
                <View
                    className="absolute left-0 right-0 bottom-0 px-4 pt-3"
                    style={{ paddingBottom: insets.bottom + 12, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border }}
                >
                    <TouchableOpacity
                        onPress={join}
                        disabled={joinDisabled}
                        activeOpacity={0.7}
                        style={{
                            height: 48,
                            borderRadius: RADIUS_SM,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: theme.primary,
                            opacity: joinDisabled ? 0.5 : 1
                        }}
                    >
                        {joining ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 15 }}>{t('campaign-join')}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}
