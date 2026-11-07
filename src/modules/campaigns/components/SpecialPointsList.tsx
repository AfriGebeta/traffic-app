import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { getPlaceIcon } from '../../places/utils/placeIcons';
import { typeForSlug } from '../../places/services/placeCategories';
import { useSpecialPoints, useSpecialPointsLabel } from '../hooks/useSpecialPoints';
import { pickLocalized } from '../utils/localizedText';
import { CampaignKind, SpecialPoint } from '../types/campaign.types';

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
        <View className="mt-6">
            <Text className="text-lg mb-1" style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-SemiBold' }}>
                {t('special-points-title')}
            </Text>
            <Text className="text-sm mb-3" style={{ color: theme.textSecondary }}>
                {t('special-points-subtitle')}
            </Text>
            <View className="gap-3">
                {visible.map((row) => {
                    const Icon = row.kind === 'place' && row.key ? getPlaceIcon(typeForSlug(row.key), isDark) : null;
                    const title = pickLocalized(row.name ?? null, i18n.language) || t(KIND_TITLE_KEYS[row.kind]);
                    return (
                        <TouchableOpacity
                            key={`${row.campaign.slug}:${row.kind}:${row.key ?? ''}`}
                            onPress={() => open(row)}
                            activeOpacity={0.7}
                            className="flex-row items-center rounded-2xl p-4"
                            style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                        >
                            <View className="w-12 h-12 items-center justify-center mr-4">
                                {Icon ? <Icon width={40} height={40} /> : <Ionicons name="star-outline" size={30} color={colors.primary.main} />}
                            </View>
                            <View className="flex-1">
                                <Text className="text-base font-semibold" style={{ color: theme.textPrimary }} numberOfLines={1}>
                                    {title}
                                </Text>
                                <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }} numberOfLines={1}>
                                    {pickLocalized(row.campaign.name, i18n.language)}
                                </Text>
                            </View>
                            <View className="rounded-full px-3 py-1 ml-2" style={{ backgroundColor: theme.primaryMuted }}>
                                <Text className="font-bold text-sm" style={{ color: colors.primary.main }}>
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
