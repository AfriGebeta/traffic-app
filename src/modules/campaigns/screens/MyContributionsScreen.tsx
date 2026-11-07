import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { resolveStorageUri } from '../../../shared/utils/storage';
import { campaignService } from '../services/campaign.service';
import { pickLocalized } from '../utils/localizedText';
import { useCampaigns } from '../store/campaignStore';
import { getIncidentTranslationKey } from '../../incidents/utils/incidentTranslations';
import { RULE_TRANSLATION_MAP } from '../../rules/utils/ruleTranslations';
import { CampaignKind, MySubmissions, Submission, SubmissionStatus } from '../types/campaign.types';
import { Chip, ChipTone, FONT_MEDIUM, RADIUS_SM, SkeletonBlock, tint } from '../components/CampaignUi';

const THUMB_STYLE = { width: 44, height: 44, borderRadius: RADIUS_SM, marginRight: 12 };

function SubmissionThumb({ photo }: { photo?: string }) {
    const { colors: theme } = useTheme();
    const [uri, setUri] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        setUri(null);
        setFailed(false);
        if (!photo) return;
        resolveStorageUri(photo)
            .then((signed) => {
                if (alive) setUri(signed);
            })
            .catch(() => {
                if (alive) setFailed(true);
            });
        return () => {
            alive = false;
        };
    }, [photo]);

    if (uri && !failed) return <Image source={{ uri }} style={THUMB_STYLE} onError={() => setFailed(true)} />;
    return (
        <View
            className="items-center justify-center"
            style={[THUMB_STYLE, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}
        >
            <Ionicons name="image-outline" size={18} color={theme.textSecondary} />
        </View>
    );
}

const KINDS: CampaignKind[] = ['place', 'taxi_station', 'traffic_rule', 'incident'];

const KIND_LABEL_KEYS: Record<CampaignKind, string> = {
    place: 'campaign-kind-place',
    taxi_station: 'campaign-kind-taxi-station',
    traffic_rule: 'campaign-kind-traffic-rule',
    incident: 'campaign-kind-incident',
};

const STATUS_LABEL_KEYS: Record<SubmissionStatus, string> = {
    PENDING: 'submission-status-pending',
    NEEDS_REVIEW: 'submission-status-review',
    VERIFIED: 'submission-status-verified',
    REJECTED: 'submission-status-rejected',
    EXPIRED: 'submission-status-expired',
    REVOKED: 'submission-status-revoked',
};

// backend decisionNote codes we can explain; anything else is shown as sent
const KNOWN_REASONS = ['duplicate', 'photo_reused', 'mock_location', 'high_risk', 'disputed', 'required_fields', 'photo_missing'];

// decisionNote can hold several comma-separated codes, sometimes repeated ("photo_reused,photo_reused")
const formatReasons = (note: string, t: (key: string) => string): string =>
    [...new Set(note.split(',').map((code) => code.trim()).filter(Boolean))]
        .map((code) => (KNOWN_REASONS.includes(code) ? t(`submission-reason-${code.replace(/_/g, '-')}`) : code))
        .join(', ');

type Translate = (key: string) => string;

// places/stations carry a name; incidents and rules only a type code (ACCIDENT, …), shown translated
const itemTitle = (item: Submission, language: string, t: Translate): string => {
    const fields = item.fields ?? {};
    const name =
        pickLocalized(fields.name, language) || pickLocalized({ en: fields.nameEn, am: fields.nameAm }, language);
    if (name) return name;
    if (typeof fields.type !== 'string') return '';
    if (item.kind === 'incident') return t(getIncidentTranslationKey(fields.type));
    if (item.kind === 'traffic_rule') {
        const keys = RULE_TRANSLATION_MAP[fields.type];
        return keys ? t(keys.name) : fields.type;
    }
    return fields.type;
};

// Real results for each contribution: status after verification and the points actually paid.
// Optional ?campaign=<slug> scopes the list and totals to one campaign.
export default function MyContributionsScreen() {
    const router = useRouter();
    const { campaign } = useLocalSearchParams<{ campaign?: string }>();
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();
    const campaignState = useCampaigns();
    const scopedCampaign = campaign ? campaignState.campaigns.find((c) => c.slug === campaign) : undefined;

    const [kind, setKind] = useState<CampaignKind | null>(null);
    const [result, setResult] = useState<MySubmissions | null>(null);
    const [items, setItems] = useState<Submission[]>([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [failed, setFailed] = useState(false);
    const requestId = useRef(0);

    const load = useCallback(
        async (nextPage: number, mode: 'initial' | 'more' | 'refresh') => {
            const id = ++requestId.current;
            if (mode === 'initial') setLoading(true);
            if (mode === 'more') setLoadingMore(true);
            if (mode === 'refresh') setRefreshing(true);
            setFailed(false);
            try {
                const data = await campaignService.getMySubmissions({
                    page: nextPage,
                    kind: kind ?? undefined,
                    campaign: campaign || undefined,
                });
                // a newer request (tab switch) won; drop this one
                if (id !== requestId.current) return;
                setResult(data);
                setItems((prev) => (mode === 'more' ? [...prev, ...(data.data ?? [])] : data.data ?? []));
                setPage(nextPage);
            } catch {
                if (id === requestId.current && mode !== 'more') setFailed(true);
            } finally {
                if (id === requestId.current) {
                    setLoading(false);
                    setLoadingMore(false);
                    setRefreshing(false);
                }
            }
        },
        [kind, campaign]
    );

    useEffect(() => {
        void load(1, 'initial');
    }, [load]);

    const hasMore = !!result && items.length < (result.total ?? 0);

    // same grouping as before: verified green, rejected/revoked red, waiting brand, the rest neutral
    const statusTone = (status: SubmissionStatus): ChipTone => {
        if (status === 'VERIFIED') return 'success';
        if (status === 'REJECTED' || status === 'REVOKED') return 'danger';
        if (status === 'PENDING' || status === 'NEEDS_REVIEW') return 'primary';
        return 'neutral';
    };

    const tab = (label: string, active: boolean, onPress: () => void, count?: number) => (
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
                {count != null && <Text style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>{` · ${count}`}</Text>}
            </Text>
        </TouchableOpacity>
    );

    const renderItem = ({ item }: { item: Submission }) => {
        const title = itemTitle(item, i18n.language, t) || t(KIND_LABEL_KEYS[item.kind] ?? 'campaign-kind-place');
        const outsideCampaign = item.status === 'VERIFIED' && (item.scoreDetail?.reason === 'outside_campaign' || !item.campaign);
        const reason = item.decisionNote ? formatReasons(item.decisionNote, t) : null;
        const photo = item.photoUrls?.[0];

        return (
            // no dividers: spacing separates rows
            <View className="flex-row items-start py-3">
                <SubmissionThumb photo={photo} />
                <View className="flex-1 mr-3">
                    <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 15 }} numberOfLines={1}>
                        {title}
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }} numberOfLines={1}>
                        {t(KIND_LABEL_KEYS[item.kind] ?? 'campaign-kind-place')}
                        {item.action === 'correction' ? ` · ${t('submission-correction')}` : ''}
                        {item.campaign ? ` · ${pickLocalized(item.campaign.name, i18n.language)}` : ''}
                    </Text>
                    <View className="flex-row mt-1.5">
                        <Chip tone={statusTone(item.status)}>{t(STATUS_LABEL_KEYS[item.status] ?? 'submission-status-pending')}</Chip>
                    </View>
                    {!!reason && (item.status === 'REJECTED' || item.status === 'REVOKED') && (
                        <Text className="text-xs mt-1" style={{ color: theme.textSecondary }} numberOfLines={2}>
                            {t('submission-reason')}: {reason}
                        </Text>
                    )}
                    {outsideCampaign && (
                        <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                            {t('submission-no-campaign-points')}
                        </Text>
                    )}
                </View>
                <Text
                    className="text-sm mt-0.5"
                    style={{ color: item.points > 0 ? theme.green : theme.textSecondary, fontFamily: FONT_MEDIUM, fontVariant: ['tabular-nums'] }}
                >
                    {item.status === 'VERIFIED' && item.points > 0 ? `+${item.points}` : '—'}
                </Text>
            </View>
        );
    };

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
            <View className="px-4 pt-3 pb-2 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="p-1 -ml-1" activeOpacity={0.7} hitSlop={8}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
            </View>
            <View className="px-4 mb-4 flex-row items-end">
                <View className="flex-1 mr-3">
                    <Text style={{ color: theme.textPrimary, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 }} numberOfLines={1}>
                        {t('my-contributions')}
                    </Text>
                    {!!scopedCampaign && (
                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }} numberOfLines={1}>
                            {pickLocalized(scopedCampaign.name, i18n.language)}
                        </Text>
                    )}
                </View>
                {result && (
                    <View className="items-end">
                        <Text style={{ color: theme.textPrimary, fontSize: 24, lineHeight: 30, letterSpacing: -0.3, fontVariant: ['tabular-nums'] }}>
                            {result.totalPoints ?? 0}
                        </Text>
                        <Text className="text-xs" style={{ color: theme.textSecondary }}>
                            {t('campaign-pts')}
                        </Text>
                    </View>
                )}
            </View>

            <View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                    {tab(t('all'), kind === null, () => setKind(null), result?.total != null && kind === null ? result.total : undefined)}
                    {KINDS.map((k) =>
                        tab(t(KIND_LABEL_KEYS[k]), kind === k, () => setKind(k), result?.byKind?.[k]?.submitted)
                    )}
                </ScrollView>
            </View>

            {loading ? (
                // skeleton rows shaped like the list: photo, title, meta, status
                <View className="px-4 pt-1" style={{ gap: 20 }}>
                    {[0.65, 0.5, 0.7, 0.55, 0.6].map((w, i) => (
                        <View key={i} className="flex-row items-center">
                            <SkeletonBlock height={44} width={44} style={{ marginRight: 12 }} />
                            <View className="flex-1" style={{ gap: 8 }}>
                                <SkeletonBlock height={13} width={`${Math.round(w * 100)}%`} />
                                <SkeletonBlock height={10} width="40%" />
                            </View>
                        </View>
                    ))}
                </View>
            ) : failed ? (
                <TouchableOpacity onPress={() => void load(1, 'initial')} className="items-center mt-8">
                    <Text className="text-sm" style={{ color: theme.textSecondary }}>{t('my-contributions-failed')}</Text>
                    <Text className="text-sm mt-2" style={{ color: theme.primary, fontFamily: FONT_MEDIUM }}>{t('try-again')}</Text>
                </TouchableOpacity>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(1, 'refresh')} />}
                    onEndReachedThreshold={0.4}
                    onEndReached={() => {
                        if (hasMore && !loadingMore) void load(page + 1, 'more');
                    }}
                    ListFooterComponent={loadingMore ? <ActivityIndicator className="my-4" color={theme.primary} /> : null}
                    ListEmptyComponent={
                        <Text className="text-center text-sm mt-8" style={{ color: theme.textSecondary }}>
                            {t('my-contributions-empty')}
                        </Text>
                    }
                />
            )}
        </View>
    );
}
