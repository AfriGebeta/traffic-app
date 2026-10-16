import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { showToast } from '../../../shared/utils/toast';
import { ApiError, ApiErrorCode, isRestrictedError } from '../../../shared/utils/apiErrors';
import { useAuthGate } from '../../register/hooks/useAuthGate';
import { campaignService } from '../services/campaign.service';
import { hasCampaignEnded, isParticipating, markCampaignJoined, markCampaignLeft, refreshCampaigns, useCampaigns } from '../store/campaignStore';
import { basePoints } from '../utils/campaignPoints';
import { getLastTrackKey, setLastTrackKey } from '../utils/campaignPrefs';
import { pickLocalized } from '../utils/localizedText';
import { periodLabel } from '../utils/periodLabel';
import { CampaignKind, CampaignTrack } from '../types/campaign.types';

const NO_TRACKS: CampaignTrack[] = [];

const KIND_LABEL_KEYS: Record<CampaignKind, string> = {
    place: 'campaign-kind-place',
    taxi_station: 'campaign-kind-taxi-station',
    traffic_rule: 'campaign-kind-traffic-rule',
    incident: 'campaign-kind-incident',
};

const formatDate = (iso: string | undefined, language: string) => {
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
            // back to the map to start contributing; pops everything (banner → detail, or profile → list → detail)
            if (router.canDismiss()) router.dismissAll();
            else router.replace('/');
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
        return (
            <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
                {state.loading || !state.loaded ? (
                    <ActivityIndicator color={colors.primary.main} />
                ) : (
                    <Text style={{ color: theme.textSecondary }}>{t('campaign-not-found')}</Text>
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
    const cardStyle = { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border };
    // open campaigns (requiresJoin false) count everyone, so only offer Join where it matters.
    // /running only lists open campaigns, and E0020 covers one that closed meanwhile
    const ended = hasCampaignEnded(campaign);
    const canJoin = campaign.requiresJoin && !joined && !ended;

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
            <View className="px-4 py-4 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4" activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={26} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="text-xl font-bold flex-1" style={{ color: theme.textPrimary }} numberOfLines={1}>
                    {name}
                </Text>
            </View>

            <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
                {!!description && (
                    <Text className="text-base leading-6 mb-4" style={{ color: theme.textSecondary }}>
                        {description}
                    </Text>
                )}

                {(campaign.startsAt || campaign.endsAt) && (
                    <View className="flex-row items-center mb-6">
                        <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
                        <Text className="text-sm ml-2" style={{ color: theme.textSecondary }}>
                            {formatDate(campaign.startsAt, i18n.language)} – {formatDate(campaign.endsAt, i18n.language)}
                        </Text>
                    </View>
                )}

                {ended && (
                    <View className="rounded-2xl p-4 mb-6" style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                        <Text className="font-bold text-base" style={{ color: theme.textPrimary }}>
                            {t('campaign-ended')}
                        </Text>
                        <Text className="text-sm mt-1" style={{ color: theme.textSecondary }}>
                            {t('campaign-ended-description')}
                        </Text>
                    </View>
                )}

                {participating && (
                    <View className="rounded-2xl p-4 mb-6" style={{ backgroundColor: theme.primaryMuted }}>
                        <Text className="font-bold text-base" style={{ color: theme.textPrimary }}>
                            {t(joined ? 'campaign-you-joined' : 'campaign-open-to-all')}
                            {joinedTrack ? ` · ${pickLocalized(joinedTrack.name, i18n.language)}` : ''}
                        </Text>
                        {me?.enrollment?.disqualified && (
                            <Text className="text-sm mt-1" style={{ color: colors.error.main }}>
                                {t('campaign-disqualified')}
                                {me.enrollment.disqualifiedReason ? `: ${me.enrollment.disqualifiedReason}` : ''}
                            </Text>
                        )}
                        {(me?.periods ?? []).map((standing, i) => {
                            return (
                                <Text key={i} className="text-sm mt-1" style={{ color: theme.textSecondary }}>
                                    {periodLabel(standing.period, t)}: {standing.score} {t('campaign-points')}
                                    {standing.rank ? ` · #${standing.rank} / ${standing.participants}` : ''}
                                </Text>
                            );
                        })}
                    </View>
                )}

                {scoredKinds.length > 0 && (
                    <>
                        <Text className="font-bold text-base mb-3" style={{ color: theme.textPrimary }}>
                            {t('campaign-how-points-work')}
                        </Text>
                        <View className="rounded-2xl mb-3 overflow-hidden" style={cardStyle}>
                            {scoredKinds.map(({ kind, points }, i) => (
                                <View
                                    key={kind}
                                    className="flex-row items-center justify-between px-4 py-3"
                                    style={i > 0 ? { borderTopWidth: 1, borderTopColor: theme.border } : undefined}
                                >
                                    <Text style={{ color: theme.textPrimary }}>{t(KIND_LABEL_KEYS[kind])}</Text>
                                    <Text className="font-bold" style={{ color: theme.textPrimary }}>
                                        {points}+ {t('campaign-points')}
                                    </Text>
                                </View>
                            ))}
                        </View>
                        <View className="mb-6 gap-1">
                            {!!formula?.quality?.photo && formula.quality.photo > 1 && (
                                <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                    • {t('campaign-bonus-photo')} ×{formula.quality.photo}
                                </Text>
                            )}
                            {!!formula?.quality?.complete && formula.quality.complete > 1 && (
                                <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                    • {t('campaign-bonus-complete')} ×{formula.quality.complete}
                                </Text>
                            )}
                            {!!formula?.priorityMultiplier && formula.priorityMultiplier > 1 && (
                                <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                    • {t('campaign-bonus-priority')} ×{formula.priorityMultiplier}
                                </Text>
                            )}
                            {!!formula?.firstToMapBonus && (
                                <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                    • {t('campaign-bonus-first')} +{formula.firstToMapBonus}
                                </Text>
                            )}
                            {!!formula?.dailyItemCap && (
                                <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                    • {t('campaign-daily-cap')}: {formula.dailyItemCap}
                                </Text>
                            )}
                        </View>
                    </>
                )}

                {/* campaigns that don't score submissions pay per event; show those rules as sent */}
                {scoredKinds.length === 0 && eventRules.length > 0 && (
                    <>
                        <Text className="font-bold text-base mb-3" style={{ color: theme.textPrimary }}>
                            {t('campaign-how-points-work')}
                        </Text>
                        <View className="rounded-2xl mb-6 overflow-hidden" style={cardStyle}>
                            {eventRules.map((rule, i) => (
                                <View
                                    key={`${rule.event}-${i}`}
                                    className="flex-row items-center justify-between px-4 py-3"
                                    style={i > 0 ? { borderTopWidth: 1, borderTopColor: theme.border } : undefined}
                                >
                                    <Text className="flex-1 mr-3" style={{ color: theme.textPrimary }}>
                                        {rule.description || rule.event}
                                    </Text>
                                    <Text className="font-bold" style={{ color: theme.textPrimary }}>
                                        +{rule.points} {t('campaign-points')}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </>
                )}

                <Text className="font-bold text-base mb-3" style={{ color: theme.textPrimary }}>
                    {t('campaign-rules')}
                </Text>
                <View className="mb-6 gap-1">
                    <Text className="text-sm" style={{ color: theme.textSecondary }}>• {t('campaign-rule-verified')}</Text>
                    {campaign.boundary && (
                        <Text className="text-sm" style={{ color: theme.textSecondary }}>• {t('campaign-rule-area')}</Text>
                    )}
                    {!!requirements.contributorWithinM && (
                        <Text className="text-sm" style={{ color: theme.textSecondary }}>
                            • {t('campaign-rule-be-there', { meters: requirements.contributorWithinM })}
                        </Text>
                    )}
                    {!!requirements.photoMaxAgeHours && (
                        <Text className="text-sm" style={{ color: theme.textSecondary }}>
                            • {t('campaign-rule-fresh-photo', { hours: requirements.photoMaxAgeHours })}
                        </Text>
                    )}
                    <Text className="text-sm" style={{ color: theme.textSecondary }}>• {t('campaign-rule-camera')}</Text>
                    <Text className="text-sm" style={{ color: theme.textSecondary }}>• {t('campaign-rule-honest')}</Text>
                </View>

                {canJoin && tracks.length > 1 && (
                    <>
                        <Text className="font-bold text-base mb-1" style={{ color: theme.textPrimary }}>
                            {t('campaign-choose-track')}
                        </Text>
                        <Text className="text-sm mb-3" style={{ color: theme.textSecondary }}>
                            {t('campaign-track-locked')}
                        </Text>
                        <View className="gap-3 mb-6">
                            {tracks.map((track) => {
                                const selected = selectedTrack === track.key;
                                return (
                                    <TouchableOpacity
                                        key={track.key}
                                        onPress={() => setSelectedTrack(track.key)}
                                        activeOpacity={0.7}
                                        className="flex-row items-center rounded-2xl px-4 py-4"
                                        style={{
                                            ...cardStyle,
                                            borderColor: selected ? colors.primary.main : theme.border,
                                            borderWidth: selected ? 2 : 1,
                                        }}
                                    >
                                        <Ionicons
                                            name={selected ? 'radio-button-on' : 'radio-button-off'}
                                            size={22}
                                            color={selected ? colors.primary.main : theme.textSecondary}
                                        />
                                        <Text className="ml-3 text-base font-semibold" style={{ color: theme.textPrimary }}>
                                            {pickLocalized(track.name, i18n.language)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </>
                )}

                {(participating || (ended && joined)) && (
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/campaigns/[slug]/leaderboard', params: { slug: campaign.slug } })}
                        activeOpacity={0.7}
                        className="flex-row items-center justify-between rounded-2xl px-4 py-4 mb-6"
                        style={cardStyle}
                    >
                        <Text className="font-semibold text-base" style={{ color: theme.textPrimary }}>
                            {t('leaderboard')}
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                )}

                {(participating || (ended && joined)) && (
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/my-contributions', params: { campaign: campaign.slug } })}
                        activeOpacity={0.7}
                        className="flex-row items-center justify-between rounded-2xl px-4 py-4 mb-6"
                        style={cardStyle}
                    >
                        <Text className="font-semibold text-base" style={{ color: theme.textPrimary }}>
                            {t('my-contributions')}
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                )}

                {__DEV__ && joined && (
                    <TouchableOpacity
                        onPress={devLeave}
                        activeOpacity={0.7}
                        className="rounded-2xl px-4 py-4 mb-6 items-center"
                        style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: colors.error.main }}
                    >
                        <Text className="font-semibold" style={{ color: colors.error.main }}>
                            [dev] Leave campaign
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            {canJoin && (
                <View
                    className="absolute left-0 right-0 bottom-0 px-4 pt-4"
                    style={{ paddingBottom: insets.bottom + 16, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border }}
                >
                    <TouchableOpacity
                        onPress={join}
                        disabled={(needsTrack && !selectedTrack) || joining}
                        className="rounded-xl py-4 items-center"
                        style={{ backgroundColor: colors.primary.main, opacity: (needsTrack && !selectedTrack) || joining ? 0.5 : 1 }}
                    >
                        {joining ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text className="text-white font-bold text-base">{t('campaign-join')}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}
