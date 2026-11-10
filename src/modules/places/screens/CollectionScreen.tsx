import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { colors } from '../../../shared/theme/colors';
import { Chip, ChipTone, FONT_MEDIUM, FONT_SEMIBOLD, RADIUS, RADIUS_SM, SectionLabel } from '../../campaigns/components/CampaignUi';
import { businessService } from '../services/business.service';
import { isActive, pickLabel, usePlaceCatalog } from '../services/placeCatalog';
import { COLLECTION_STATUSES, CollectionBusiness, CollectionOverview, CollectionStatus, CollectorData } from '../types/business.types';
import { ChipSelect } from '../components/FormControls';

const statusOf = (row: { status?: CollectionStatus; collectionStatus?: CollectionStatus }): CollectionStatus =>
    (row.collectionStatus ?? row.status ?? 'New') as CollectionStatus;

const toneFor: Record<CollectionStatus, ChipTone> = { New: 'neutral', Checked: 'primary', Live: 'success', Rejected: 'danger' };

// data collectors: everything they mapped, with status, Set Live, shop PIN and offer pausing
export default function CollectionScreen() {
    const { t, i18n } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();
    const lang = i18n.language;
    const { catalog } = usePlaceCatalog();

    const [overview, setOverview] = useState<CollectionOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<CollectionStatus | null>(null);
    const [campus, setCampus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [details, setDetails] = useState<Record<string, CollectorData>>({});

    const load = useCallback(
        async (mode: 'initial' | 'refresh' = 'initial') => {
            if (mode === 'refresh') setRefreshing(true);
            try {
                const next = await businessService.collection({ search: search.trim() || undefined, status: status ?? undefined, campus: campus ?? undefined });
                setOverview(next);
                setError(null);
            } catch (e) {
                // 403 for non-collectors
                setError(e instanceof Error ? e.message : t('could-not-load'));
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [search, status, campus, t]
    );

    // filters refetch after a short pause while typing
    useEffect(() => {
        const timer = setTimeout(() => void load(), search ? 350 : 0);
        return () => clearTimeout(timer);
    }, [load, search]);

    // back from the form: show the new entry
    useFocusEffect(
        useCallback(() => {
            void load();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [])
    );

    const toggleExpanded = async (id: string) => {
        if (expanded === id) {
            setExpanded(null);
            return;
        }
        setExpanded(id);
        if (details[id]) return;
        try {
            const data = await businessService.collectorData(id);
            setDetails((prev) => ({ ...prev, [id]: data }));
        } catch {
            // the row still works without the private details
        }
    };

    const kindLabel = (row: CollectionBusiness) => {
        const group = catalog?.businessGroups.find((g) => g.key === row.business?.group);
        const kind = group?.kinds.find((k) => k.key === row.business?.kind);
        return kind ? pickLabel(kind.label, lang, kind.key) : row.business?.kind ?? '';
    };

    // older buildings (added before collectors) have no campus; a campus filter hides them
    const campusLabel = (row: { campus?: unknown; campusArea?: unknown }) => {
        const key = (row.campus ?? row.campusArea) as string | null | undefined;
        if (!key) return t('no-campus');
        const area = catalog?.campusAreas.find((c) => c.key === key);
        return area ? pickLabel(area.label, lang, key) : key;
    };

    const renderBusiness = (row: CollectionBusiness) => {
        const rowStatus = statusOf(row);
        const open = expanded === row.id;
        const data = details[row.id];
        const offers = data?.offers ?? row.offers ?? row.business?.offers ?? [];
        const pin = data?.offerPin ?? row.offerPin;
        const floor = row.business?.floor;
        return (
            <View key={row.id} className="py-3" style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
                <TouchableOpacity onPress={() => void toggleExpanded(row.id)} activeOpacity={0.7} className="flex-row items-center">
                    <View className="flex-1 mr-2">
                        <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 15 }} numberOfLines={1}>
                            {pickLabel(row.name as any, lang, t('unnamed'))}
                        </Text>
                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }} numberOfLines={1}>
                            {[kindLabel(row), floor ? (floor === 'ground' ? t('floor-ground') : floor === 'basement' ? t('floor-basement') : t('floor-n', { floor })) : null, offers.length ? t('offers-count', { count: offers.length }) : null]
                                .filter(Boolean)
                                .join(' · ')}
                        </Text>
                    </View>
                    <Chip tone={toneFor[rowStatus]}>{t(`status-${rowStatus.toLowerCase()}`)}</Chip>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textSecondary} style={{ marginLeft: 6 }} />
                </TouchableOpacity>

                {open && (
                    <View className="mt-3 gap-3">

                        {!!pin && (
                            <View className="flex-row items-center p-3" style={{ borderRadius: RADIUS_SM, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                                <View className="flex-1">
                                    <Text className="text-xs" style={{ color: theme.textSecondary }}>{t('shop-pin')}</Text>
                                    <Text style={{ color: theme.textPrimary, fontFamily: FONT_SEMIBOLD, fontSize: 20, letterSpacing: 4 }}>{pin}</Text>
                                </View>
                            </View>
                        )}

                        {offers.map((offer, i) => (
                            <View key={offer.id ?? i} className="flex-row items-center">
                                <Text className="flex-1 text-sm" style={{ color: offer.paused ? theme.textSecondary : theme.textPrimary }} numberOfLines={2}>
                                    {offer.text || offer.type}
                                    {offer.months?.length ? `  · ${offer.months.join(', ')}` : ''}
                                </Text>
                                {!!offer.paused && (
                                    <Text className="text-xs ml-2" style={{ color: theme.textSecondary, fontFamily: FONT_MEDIUM }}>
                                        {t('offer-paused')}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    const counts = overview?.counts;
    const buildings = overview?.buildings ?? [];
    const streetLevel = overview?.streetLevel ?? [];
    const empty = !loading && !error && buildings.length === 0 && streetLevel.length === 0;

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background, paddingTop: insets.top }}>
            <View className="px-4 pt-3 pb-2">
                <TouchableOpacity onPress={() => router.back()} className="self-start p-1 -ml-1" activeOpacity={0.7} hitSlop={8}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="mt-3" style={{ color: theme.textPrimary, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 }}>{t('collection-title')}</Text>
                {!!counts && (
                    <Text className="text-sm mt-1" style={{ color: theme.textSecondary }}>
                        {[
                            t('collection-businesses', { count: counts.businesses ?? 0, target: counts.businessesTarget ?? '–' }),
                            t('collection-buildings', { count: counts.buildings ?? 0 }),
                            t('collection-with-offers', { count: counts.withOffers ?? 0, target: counts.withOffersTarget ?? '–' }),
                        ].join(' · ')}
                    </Text>
                )}
            </View>

            <View className="px-4 pb-2 gap-3">
                <View className="flex-row items-center px-3" style={{ borderRadius: RADIUS_SM, borderWidth: 1, borderColor: theme.border, backgroundColor: isDark ? theme.surface : colors.gray[50], minHeight: 44 }}>
                    <Ionicons name="search" size={16} color={theme.textSecondary} />
                    <TextInput
                        className="flex-1 ml-2"
                        style={{ color: theme.textPrimary, fontSize: 15 }}
                        placeholder={t('search-by-name')}
                        placeholderTextColor={theme.textSecondary}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    <ChipSelect
                        options={COLLECTION_STATUSES.map((s) => ({ value: s, label: t(`status-${s.toLowerCase()}`) }))}
                        selected={status ? [status] : []}
                        onToggle={(s) => setStatus(status === s ? null : s)}
                    />
                    {(catalog?.campusAreas ?? []).filter(isActive).length > 1 && (
                        <ChipSelect
                            options={(catalog?.campusAreas ?? []).filter(isActive).map((c) => ({ value: c.key, label: pickLabel(c.label, lang, c.key) }))}
                            selected={campus ? [campus] : []}
                            onToggle={(c) => setCampus(campus === c ? null : c)}
                        />
                    )}
                </ScrollView>
            </View>

            <ScrollView
                className="flex-1 px-4"
                contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 24, gap: 16 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} />}
            >
                {loading && <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />}
                {!!error && (
                    <Text className="text-sm text-center mt-6" style={{ color: theme.error }}>
                        {error}
                    </Text>
                )}
                {empty && (
                    <Text className="text-sm text-center mt-6" style={{ color: theme.textSecondary }}>
                        {t('collection-empty')}
                    </Text>
                )}

                {buildings.map((building) => (
                    <View key={building.id} className="px-4 pt-3 pb-1" style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
                        <View className="flex-row items-center pb-3">
                            <Ionicons name="business-outline" size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
                            <View className="flex-1">
                                <Text style={{ color: theme.textPrimary, fontFamily: FONT_SEMIBOLD, fontSize: 15 }} numberOfLines={1}>
                                    {pickLabel(building.name as any, lang, t('unnamed-building'))}
                                </Text>
                                <Text className="text-xs" style={{ color: theme.textSecondary }}>
                                    {[campusLabel(building), building.floorCount ? t('floors-count', { count: Number(building.floorCount) }) : null, t('businesses-count', { count: building.businesses.length })]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </Text>
                            </View>
                            <Chip tone={toneFor[statusOf(building)]}>{t(`status-${statusOf(building).toLowerCase()}`)}</Chip>
                        </View>
                        {building.businesses.map(renderBusiness)}
                    </View>
                ))}

                {streetLevel.length > 0 && (
                    <View>
                        <SectionLabel style={{ marginBottom: 8 }}>{t('street-level')}</SectionLabel>
                        <View className="px-4 pb-1" style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
                            {streetLevel.map(renderBusiness)}
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
