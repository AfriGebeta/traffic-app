import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { campaignService } from '../services/campaign.service';
import { pickLocalized } from '../utils/localizedText';
import { useCampaigns } from '../store/campaignStore';
import { getIncidentTranslationKey } from '../../incidents/utils/incidentTranslations';
import { RULE_TRANSLATION_MAP } from '../../rules/utils/ruleTranslations';
import { CampaignKind, MySubmissions, Submission, SubmissionStatus } from '../types/campaign.types';

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
const KNOWN_REASONS = ['duplicate', 'photo_reused', 'mock_location', 'high_risk', 'disputed'];

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
    const { colors: theme, isDark } = useTheme();
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

    const statusColor = (status: SubmissionStatus) => {
        if (status === 'VERIFIED') return theme.green;
        if (status === 'REJECTED' || status === 'REVOKED') return colors.error.main;
        if (status === 'PENDING' || status === 'NEEDS_REVIEW') return colors.primary.main;
        return theme.textSecondary;
    };

    const tab = (label: string, active: boolean, onPress: () => void, count?: number) => (
        <TouchableOpacity
            key={label}
            onPress={onPress}
            activeOpacity={0.7}
            className="px-4 py-2 rounded-full mr-2"
            style={{
                backgroundColor: active ? colors.primary.main : theme.surface,
                borderWidth: 1,
                borderColor: active ? colors.primary.main : theme.border,
            }}
        >
            <Text className="font-semibold" style={{ color: active ? '#fff' : theme.textPrimary }}>
                {label}
                {count != null ? ` · ${count}` : ''}
            </Text>
        </TouchableOpacity>
    );

    const renderItem = ({ item }: { item: Submission }) => {
        const title = itemTitle(item, i18n.language, t) || t(KIND_LABEL_KEYS[item.kind] ?? 'campaign-kind-place');
        const outsideCampaign = item.status === 'VERIFIED' && (item.scoreDetail?.reason === 'outside_campaign' || !item.campaign);
        const reason = item.decisionNote
            ? KNOWN_REASONS.includes(item.decisionNote)
                ? t(`submission-reason-${item.decisionNote.replace('_', '-')}`)
                : item.decisionNote
            : null;
        const photo = item.photoUrls?.[0];

        return (
            <View className="flex-row items-center py-3" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
                {photo ? (
                    <Image source={{ uri: photo }} style={{ width: 48, height: 48, borderRadius: 10, marginRight: 12 }} />
                ) : (
                    <View
                        className="items-center justify-center mr-3"
                        style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: theme.surface }}
                    >
                        <Ionicons name="image-outline" size={20} color={theme.textSecondary} />
                    </View>
                )}
                <View className="flex-1 mr-3">
                    <Text className="text-base font-semibold" style={{ color: theme.textPrimary }} numberOfLines={1}>
                        {title}
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }} numberOfLines={1}>
                        {t(KIND_LABEL_KEYS[item.kind] ?? 'campaign-kind-place')}
                        {item.action === 'correction' ? ` · ${t('submission-correction')}` : ''}
                        {item.campaign ? ` · ${pickLocalized(item.campaign.name, i18n.language)}` : ''}
                    </Text>
                    <Text className="text-xs font-semibold mt-1" style={{ color: statusColor(item.status) }}>
                        {t(STATUS_LABEL_KEYS[item.status] ?? 'submission-status-pending')}
                    </Text>
                    {!!reason && (item.status === 'REJECTED' || item.status === 'REVOKED') && (
                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }} numberOfLines={2}>
                            {t('submission-reason')}: {reason}
                        </Text>
                    )}
                    {outsideCampaign && (
                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                            {t('submission-no-campaign-points')}
                        </Text>
                    )}
                </View>
                <Text className="font-bold text-base" style={{ color: item.points > 0 ? theme.green : theme.textSecondary }}>
                    {item.status === 'VERIFIED' && item.points > 0 ? `+${item.points}` : '—'}
                </Text>
            </View>
        );
    };

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
            <View className="px-4 py-4 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4" activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={26} color={theme.textPrimary} />
                </TouchableOpacity>
                <View className="flex-1">
                    <Text className="text-xl font-bold" style={{ color: theme.textPrimary }} numberOfLines={1}>
                        {t('my-contributions')}
                    </Text>
                    {!!scopedCampaign && (
                        <Text className="text-sm" style={{ color: theme.textSecondary }} numberOfLines={1}>
                            {pickLocalized(scopedCampaign.name, i18n.language)}
                        </Text>
                    )}
                </View>
                {result && (
                    <View className="rounded-full px-3 py-1" style={{ backgroundColor: isDark ? '#4D3400' : theme.primaryMuted }}>
                        <Text className="font-bold" style={{ color: colors.primary.main }}>
                            {result.totalPoints ?? 0} {t('campaign-pts')}
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
                <ActivityIndicator className="mt-8" color={colors.primary.main} />
            ) : failed ? (
                <TouchableOpacity onPress={() => void load(1, 'initial')} className="items-center mt-8">
                    <Text style={{ color: theme.textSecondary }}>{t('my-contributions-failed')}</Text>
                    <Text className="font-semibold mt-2" style={{ color: colors.primary.main }}>{t('try-again')}</Text>
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
                    ListFooterComponent={loadingMore ? <ActivityIndicator className="my-4" color={colors.primary.main} /> : null}
                    ListEmptyComponent={
                        <Text className="text-center mt-8" style={{ color: theme.textSecondary }}>
                            {t('my-contributions-empty')}
                        </Text>
                    }
                />
            )}
        </View>
    );
}
