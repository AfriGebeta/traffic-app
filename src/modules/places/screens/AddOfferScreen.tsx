import React, { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { ApiError } from '../../../shared/utils/apiErrors';
import { showToast } from '../../../shared/utils/toast';
import { FONT_MEDIUM, FONT_SEMIBOLD, RADIUS, RADIUS_SM, SkeletonBlock } from '../../campaigns/components/CampaignUi';
import { OfferEditor } from '../components/OfferEditor';
import { businessService } from '../services/business.service';
import { isActive, usePlaceCatalog } from '../services/placeCatalog';
import { CatalogOption } from '../types/business.types';
import { DEFAULT_OFFER_DAYS, addDays, cleanOffer, emptyBusinessDraft, isoDate, offerMissing, BusinessDraft } from '../utils/businessDraft';

const str = (value: unknown) => (typeof value === 'string' ? value : '');

type Done = { text: string; pin: string | null };

export default function AddOfferScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();
    const params = useLocalSearchParams();
    const placeId = str(params.placeId);
    const placeName = str(params.name);
    const { catalog, failed: catalogFailed, retry } = usePlaceCatalog();

    const [draft, setDraft] = useState<BusinessDraft>(() => {
        let products: string[] = [];
        try {
            const parsed = JSON.parse(str(params.products) || '[]');
            if (Array.isArray(parsed)) products = parsed.filter((p): p is string => typeof p === 'string');
        } catch {
            // no quick picks then
        }
        return { ...emptyBusinessDraft(), group: str(params.group) || null, kind: str(params.kind) || null, products };
    });
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState<Done | null>(null);

    const offer = draft.offers[0];
    React.useEffect(() => {
        if (!catalog || draft.offers.length) return;
        const firstKey = (list: CatalogOption[]) => list.filter(isActive)[0]?.key;
        const today = isoDate(new Date());
        const options = catalog.offerOptions;
        setDraft((prev) => ({
            ...prev,
            offers: [
                {
                    type: firstKey(options.types) ?? 'percent',
                    startsOn: today,
                    endsOn: addDays(today, DEFAULT_OFFER_DAYS),
                    audience: firstKey(options.audience),
                    days: firstKey(options.days),
                    time: firstKey(options.time),
                    redeem: firstKey(options.redeem),
                    limit: firstKey(options.limit),
                },
            ],
        }));
    }, [catalog, draft.offers.length]);

    const type = useMemo(() => catalog?.offerOptions.types.find((ty) => ty.key === offer?.type), [catalog, offer?.type]);
    const missing = offer ? offerMissing(offer, type) : ['type'];
    const canSave = !!placeId && !!offer && missing.length === 0 && !saving;

    const save = async () => {
        if (!canSave || !offer) return;
        setSaving(true);
        try {
            const result = await businessService.addOffer(placeId, cleanOffer(offer, type));
            setDone({ text: String(result.offer?.title ?? '').trim() || result.offer?.text || '', pin: result.pin ?? null });
        } catch (e) {
            const status = e instanceof ApiError ? e.status : undefined;
            showToast(status === 404 ? t('business-other-area') : e instanceof Error && e.message ? e.message : t('could-not-send'));
        } finally {
            setSaving(false);
        }
    };

    const header = (
        <View className="px-4 pt-3 pb-2">
            <TouchableOpacity onPress={() => router.back()} className="self-start p-1 -ml-1" activeOpacity={0.7} hitSlop={8} accessibilityLabel={t('back')}>
                <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <Text className="mt-3" style={{ color: theme.textPrimary, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 }}>{t('add-offer')}</Text>
            {!!placeName && <Text className="text-sm mt-1" style={{ color: theme.textSecondary }}>{placeName}</Text>}
        </View>
    );

    if (done) {
        return (
            <View className="flex-1" style={{ backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom + 12 }}>
                <View className="flex-1 items-center justify-center px-6" style={{ gap: 12 }}>
                    <View className="items-center justify-center" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.greenMuted }}>
                        <Ionicons name="checkmark" size={32} color={theme.green} />
                    </View>
                    <Text style={{ color: theme.textPrimary, fontSize: 22 }}>{t('offer-added')}</Text>
                    {!!done.text && <Text className="text-base text-center" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{done.text}</Text>}
                    {!!placeName && <Text className="text-sm" style={{ color: theme.textSecondary }}>{placeName}</Text>}
                    {!!done.pin && (
                        <View className="items-center mt-4 px-6 py-4" style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
                            <Text className="text-xs" style={{ color: theme.textSecondary }}>{t('shop-pin')}</Text>
                            <Text selectable style={{ color: theme.textPrimary, fontFamily: FONT_SEMIBOLD, fontSize: 30, letterSpacing: 8, marginTop: 4 }}>{done.pin}</Text>
                            <Text className="text-xs text-center mt-2" style={{ color: theme.textSecondary }}>{t('offer-added-pin-hint')}</Text>
                        </View>
                    )}
                </View>
                <View className="px-4">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        activeOpacity={0.8}
                        className="items-center justify-center"
                        style={{ height: 48, borderRadius: RADIUS, backgroundColor: theme.primary }}
                    >
                        <Text style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 15 }}>{t('done')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ backgroundColor: theme.background, paddingTop: insets.top }}>
            {header}
            <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                {!catalog ? (
                    catalogFailed ? (
                        <View className="items-center mt-10" style={{ gap: 12 }}>
                            <Text className="text-sm" style={{ color: theme.textSecondary }}>{t('could-not-load')}</Text>
                            <TouchableOpacity onPress={retry} activeOpacity={0.7} className="px-4 justify-center" style={{ height: 40, borderRadius: RADIUS_SM, borderWidth: 1, borderColor: theme.border }}>
                                <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{t('try-again')}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={{ gap: 10 }}>
                            <SkeletonBlock height={52} style={{ borderRadius: RADIUS_SM }} />
                            <SkeletonBlock height={52} style={{ borderRadius: RADIUS_SM }} />
                            <SkeletonBlock height={200} style={{ borderRadius: RADIUS }} />
                        </View>
                    )
                ) : (
                    offer && (
                        <OfferEditor
                            single
                            draft={draft}
                            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
                            catalog={catalog}
                            placeName={placeName}
                            description=""
                        />
                    )
                )}
            </ScrollView>
            <View className="px-4 pt-3" style={{ paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: theme.border }}>
                <TouchableOpacity
                    onPress={() => void save()}
                    disabled={!canSave}
                    activeOpacity={0.8}
                    className="items-center justify-center"
                    style={{ height: 48, borderRadius: RADIUS, backgroundColor: theme.primary, opacity: canSave ? 1 : 0.5 }}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 15 }}>{t('add-offer')}</Text>}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}
