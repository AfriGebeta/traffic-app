import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { LeaderboardPeriod } from '../types/leaderboard.types';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { colors } from '../../../shared/theme/colors';

const TABS: { id: LeaderboardPeriod; translationKey: string }[] = [
    { id: 'global', translationKey: 'all-time' },
    { id: 'monthly', translationKey: 'monthly' },
    { id: 'weekly', translationKey: 'weekly' },
];
const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

export const LeaderboardScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const [selectedPeriod, setSelectedPeriod] = useState<LeaderboardPeriod>('global');
    const { leaderboard, loading } = useLeaderboard(selectedPeriod);
    const { colors: theme, isDark } = useTheme();
    const skeletonColor = isDark ? '#2B2B2B' : '#E9E9E9';

    const getMedalColor = (rank: number) => {
        if (rank === 1) return '#FFD700'; // Gold
        if (rank === 2) return '#C0C0C0'; // Silver
        if (rank === 3) return '#CD7F32'; // Bronze
        return theme.textSecondary;
    };

    const getMedalIcon = (rank: number) => {
        if (rank <= 3) return 'medal';
        return 'ellipse';
    };

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <View className="px-6 pt-12 pb-4">
                <View className="flex-row items-center mb-6">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4">
                        <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold" style={{ color: theme.textPrimary }}>{t('leaderboard-screen')}</Text>
                </View>
                <View className="flex-row rounded-2xl p-1" style={{ backgroundColor: isDark ? theme.surface : '#F3F4F6' }}>
                    {TABS.map((tab) => (
                        <TouchableOpacity
                            key={tab.id}
                            onPress={() => setSelectedPeriod(tab.id)}
                            className="flex-1 py-2 rounded-xl"
                            style={{ backgroundColor: selectedPeriod === tab.id ? theme.background : 'transparent' }}
                        >
                            <Text
                                className="text-center font-semibold"
                                style={{ color: selectedPeriod === tab.id ? theme.textPrimary : theme.textSecondary }}
                            >
                                {t(tab.translationKey)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
            {loading ? (
                <ScrollView
                    className="flex-1 px-6"
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
                >
                    {SKELETON_ROWS.map((row) => (
                        <View
                            key={row}
                            className="flex-row items-center p-4 mb-2 rounded-2xl"
                            style={{ backgroundColor: theme.surface }}
                        >
                            <View className="w-12 items-center">
                                <View className="w-6 h-4 rounded" style={{ backgroundColor: skeletonColor }} />
                            </View>
                            <View className="w-12 h-12 rounded-full mx-3" style={{ backgroundColor: skeletonColor }} />
                            <View className="flex-1">
                                <View className="w-3/5 h-4 rounded mb-2" style={{ backgroundColor: skeletonColor }} />
                                <View className="w-2/5 h-3 rounded" style={{ backgroundColor: skeletonColor }} />
                            </View>
                            <View className="items-end ml-4">
                                <View className="w-12 h-4 rounded mb-2" style={{ backgroundColor: skeletonColor }} />
                                <View className="w-16 h-3 rounded" style={{ backgroundColor: skeletonColor }} />
                            </View>
                        </View>
                    ))}
                </ScrollView>
            ) : (
                <ScrollView
                    className="flex-1 px-6"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
                >
                    {leaderboard.map((entry, index) => (
                        <View
                            key={entry.id}
                            className="flex-row items-center p-4 mb-2 rounded-2xl"
                            style={entry.rank <= 3
                                ? {
                                    backgroundColor: isDark
                                        ? 'rgba(255, 165, 0, 0.08)'
                                        : 'rgba(255, 165, 0, 0.06)',
                                    borderWidth: 1,
                                    borderColor: isDark
                                        ? 'rgba(255, 165, 0, 0.28)'
                                        : 'rgba(255, 165, 0, 0.22)',
                                }
                                : { backgroundColor: theme.surface }}
                        >
                            <View className="w-12 items-center">
                                {entry.rank <= 3 ? (
                                    <Ionicons
                                        name={getMedalIcon(entry.rank)}
                                        size={28}
                                        color={getMedalColor(entry.rank)}
                                    />
                                ) : (
                                    <Text className="font-bold text-lg" style={{ color: theme.textSecondary }}>
                                        {entry.rank}
                                    </Text>
                                )}
                            </View>

                            <View className="rounded-full w-12 h-12 items-center justify-center mx-3" style={{ backgroundColor: colors.primary.main }}>
                                <Text className="text-white font-bold text-lg">
                                    {entry.name.charAt(0).toUpperCase()}
                                </Text>
                            </View>

                            <View className="flex-1">
                                <Text className="font-bold text-base" style={{ color: theme.textPrimary }}>
                                    {entry.name}
                                </Text>
                                <Text className="text-xs" style={{ color: theme.textSecondary }}>{entry.level}</Text>
                            </View>

                            <View className="items-end">
                                <View className="flex-row items-center">
                                    <Ionicons name="star" size={16} color="#f97316" />
                                    <Text className="font-bold ml-1" style={{ color: theme.textPrimary }}>
                                        {entry.points}
                                    </Text>
                                </View>
                                <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                                    {entry.reportsCount} {t('reports')}
                                </Text>
                            </View>
                        </View>
                    ))}

                    {leaderboard.length === 0 && (
                        <View className="items-center py-20">
                            <Ionicons name="trophy-outline" size={64} color={theme.border} />
                            <Text className="mt-4" style={{ color: theme.textSecondary }}>No data available</Text>
                        </View>
                    )}
                </ScrollView>
            )}
        </View>
    );
};

export default LeaderboardScreen;
