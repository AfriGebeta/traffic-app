import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { getPlaceIcon } from '../../places/utils/placeIcons';
import { typeForSlug } from '../../places/services/placeCategories';
import { useSpecialPoints, useSpecialPointsLabel } from '../hooks/useSpecialPoints';
import { pickLocalized } from '../utils/localizedText';
import { CampaignKind, SpecialPoint } from '../types/campaign.types';
import { FONT_MEDIUM, FONT_SEMIBOLD, RADIUS, tint } from './CampaignUi';

const KIND_TITLE_KEYS: Record<CampaignKind, string> = {
    place: 'contribute-place',
    traffic_rule: 'report-traffic-rule',
    taxi_station: 'contribute-taxi-info',
    incident: 'report',
};

// a whole kind opens its usual screen; incidents are reported from the map
const KIND_ROUTES: Partial<Record<CampaignKind, string>> = {
    place: '/places/contribute',
    traffic_rule: '/rules/contribute',
    taxi_station: '/taxi/contribute',
};

// Contribute screen: one card per bonus from /api/special-points, only for campaigns the user joined.
// The amount shown is the bonus ("+20" / "×1.5"), never `points`: the real score also depends on photo quality etc.
export function SpecialPointsList() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const { visible } = useSpecialPoints();
    const bonusLabel = useSpecialPointsLabel();

    if (visible.length === 0) return null;

    const open = (row: SpecialPoint) => {
        if (row.kind === 'place' && row.key) {
            router.push({ pathname: '/places/add', params: { type: typeForSlug(row.key) } });
            return;
        }
        const route = KIND_ROUTES[row.kind];
        if (route) router.push(route as never);
        else router.dismissTo({ pathname: '/', params: { openReport: String(Date.now()) } });
    };

    return (
        <View className="mt-8">
            <Text className="mb-1" style={{ color: theme.textPrimary, fontFamily: FONT_SEMIBOLD, fontSize: 17 }}>
                {t('special-points-title')}
            </Text>
            <Text className="text-xs mb-3" style={{ color: theme.textSecondary }}>
                {t('special-points-subtitle')}
            </Text>
            <View className="gap-2">
                {visible.map((row) => {
                    const Icon = row.kind === 'place' && row.key ? getPlaceIcon(typeForSlug(row.key), isDark) : null;
                    const title = pickLocalized(row.name ?? null, i18n.language) || t(KIND_TITLE_KEYS[row.kind]);
                    return (
                        <TouchableOpacity
                            key={`${row.campaign.slug}:${row.kind}:${row.key ?? ''}`}
                            onPress={() => open(row)}
                            activeOpacity={0.7}
                            className="flex-row items-center px-4 py-3"
                            style={{ borderRadius: RADIUS, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                        >
                            <View className="w-10 h-10 items-center justify-center mr-3">
                                {Icon ? <Icon width={34} height={34} /> : <Ionicons name="star-outline" size={24} color={theme.primary} />}
                            </View>
                            <View className="flex-1">
                                <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 15 }} numberOfLines={1}>
                                    {title}
                                </Text>
                                <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }} numberOfLines={1}>
                                    {pickLocalized(row.campaign.name, i18n.language)}
                                </Text>
                            </View>
                            <View className="px-2 py-0.5 ml-2" style={{ borderRadius: 4, backgroundColor: tint(theme.primary) }}>
                                <Text className="text-xs" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontVariant: ['tabular-nums'] }}>
                                    {bonusLabel(row)}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}
