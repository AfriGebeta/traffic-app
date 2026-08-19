import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import TaxiLightIcon from '../../../../assets/images/contribute-taxi-light.svg';
import TaxiDarkIcon from '../../../../assets/images/contribute-taxi-dark.svg';
import type { TaxiPlan } from '../../navigation/types/voice-navigation.types';
import type { RouteSegment } from '../../taxi/types/taxi.types';

const formatDistance = (km: number): string =>
    km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

const formatMinutes = (seconds: number): string => `${Math.max(1, Math.round(seconds / 60))} min`;

const segmentLabel = (segment: RouteSegment): string =>
    segment.type === 'taxi'
        ? (segment.toNode?.name ?? '')
        : (segment.toNode?.name ?? '');

interface TaxiPlanCardProps {
    plan: TaxiPlan;
    onStart: () => void;
}

export default function TaxiPlanCard({ plan, onStart }: TaxiPlanCardProps) {
    const { t } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const TaxiIcon = isDark ? TaxiDarkIcon : TaxiLightIcon;

    const segments = plan.route.segments ?? [];
    const totalSeconds = segments.reduce((sum, segment) => sum + (segment.time ?? 0), 0);
    const totalKm = segments.reduce((sum, segment) => sum + (segment.distance ?? 0), 0);
    const { estimatedFare, currency } = plan.route.summary ?? { estimatedFare: 0, currency: '' };

    return (
        <View
            className="self-start w-full mb-3 rounded-2xl rounded-tl-sm overflow-hidden"
            style={{ backgroundColor: theme.surface }}
        >
            <View className="px-4 pt-4 pb-3">
                <View className="flex-row items-center mb-2">
                    <View className="w-5 h-5 items-center justify-center mr-2">
                        <TaxiIcon width={18} height={18} />
                    </View>
                    <Text
                        className="text-base flex-1"
                        style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-Medium' }}
                    >
                        {t('taxi-plan')}
                    </Text>
                    <Text
                        className="text-sm"
                        style={{ color: theme.textSecondary, fontFamily: 'PlusJakartaSans-Regular' }}
                    >
                        {formatMinutes(totalSeconds)} · {formatDistance(totalKm)}
                    </Text>
                </View>

                {plan.narrative ? (
                    <Text
                        className="text-sm leading-5 mb-3"
                        style={{ color: theme.textSecondary, fontFamily: 'PlusJakartaSans-Regular' }}
                    >
                        {plan.narrative}
                    </Text>
                ) : null}

                {segments.map((segment, index) => (
                    <View key={`${segment.type}-${index}`} className="flex-row items-center mb-2">
                        {segment.type === 'taxi' ? (
                            <TaxiIcon width={16} height={16} />
                        ) : (
                            <Ionicons name="walk-outline" size={16} color={theme.textSecondary} />
                        )}
                        <Text
                            className="text-sm ml-2 flex-1"
                            numberOfLines={1}
                            style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-Regular' }}
                        >
                            {segment.type === 'taxi' ? (segment.fromNode?.name ?? t('taxi')) : t('walk')}
                            {segmentLabel(segment) ? ` → ${segmentLabel(segment)}` : ''}
                        </Text>
                        <Text
                            className="text-xs ml-2"
                            style={{ color: theme.textSecondary, fontFamily: 'PlusJakartaSans-Regular' }}
                        >
                            {formatDistance(segment.distance ?? 0)}
                        </Text>
                    </View>
                ))}

                {estimatedFare > 0 ? (
                    <View className="flex-row items-center mt-1">
                        <Text
                            className="text-sm flex-1"
                            style={{ color: theme.textSecondary, fontFamily: 'PlusJakartaSans-Regular' }}
                        >
                            {t('estimated-fare')}
                        </Text>
                        <Text
                            className="text-sm"
                            style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-Medium' }}
                        >
                            {estimatedFare} {currency}
                        </Text>
                    </View>
                ) : null}
            </View>

            <TouchableOpacity
                onPress={onStart}
                disabled={plan.started}
                className="flex-row items-center justify-center py-3"
                style={{ backgroundColor: plan.started ? theme.surface : colors.primary.main }}
                activeOpacity={0.8}
            >
                {plan.started ? (
                    <Ionicons name="checkmark-circle" size={18} color={colors.primary.main} />
                ) : null}
                <Text
                    className={plan.started ? 'text-base ml-2' : 'text-base'}
                    style={{
                        color: plan.started ? colors.primary.main : 'white',
                        fontFamily: 'PlusJakartaSans-Medium',
                    }}
                >
                    {plan.started ? t('trip-started') : t('start-trip')}
                </Text>
            </TouchableOpacity>
        </View>
    );
}
