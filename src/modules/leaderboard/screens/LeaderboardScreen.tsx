import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

export const LeaderboardScreen = () => {
    const router = useRouter();
    const { t } = useTranslation();
    const [selectedPeriod, setSelectedPeriod] = useState<LeaderboardPeriod>('global');
    const { leaderboard, loading } = useLeaderboard(selectedPeriod);
    const { colors: theme, isDark } = useTheme();

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
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#f97316" />
                </View>
            ) : (
                <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                    {leaderboard.map((entry, index) => (
                        <View
                            key={entry.id}
                            className="flex-row items-center p-4 mb-3 rounded-2xl"
                            style={entry.rank <= 3
                                ? { backgroundColor: theme.primaryMuted, borderWidth: 1, borderColor: colors.primary.main }
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

                    <View className="h-6" />
                </ScrollView>
            )}
        </View>
    );
};

export default LeaderboardScreen;
