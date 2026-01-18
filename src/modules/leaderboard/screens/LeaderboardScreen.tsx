import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { LeaderboardPeriod } from '../types/leaderboard.types';

const TABS: { id: LeaderboardPeriod; label: string }[] = [
    { id: 'global', label: 'All Time' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'weekly', label: 'Weekly' },
];

export const LeaderboardScreen = () => {
    const router = useRouter();
    const { t } = useTranslation();
    const [selectedPeriod, setSelectedPeriod] = useState<LeaderboardPeriod>('global');
    const { leaderboard, loading } = useLeaderboard(selectedPeriod);

    const getMedalColor = (rank: number) => {
        if (rank === 1) return '#FFD700'; // Gold
        if (rank === 2) return '#C0C0C0'; // Silver
        if (rank === 3) return '#CD7F32'; // Bronze
        return '#6b7280';
    };

    const getMedalIcon = (rank: number) => {
        if (rank <= 3) return 'medal';
        return 'ellipse';
    };

    return (
        <View className="flex-1 bg-white">
            {/* Header */}
            <View className="px-6 pt-12 pb-4">
                <View className="flex-row items-center mb-6">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4">
                        <Ionicons name="arrow-back" size={24} color="#1f2937" />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-gray-900">{t('leaderboard')}</Text>
                </View>

                {/* Tabs */}
                <View className="flex-row bg-gray-100 rounded-2xl p-1">
                    {TABS.map((tab) => (
                        <TouchableOpacity
                            key={tab.id}
                            onPress={() => setSelectedPeriod(tab.id)}
                            className={`flex-1 py-2 rounded-xl ${selectedPeriod === tab.id ? 'bg-white' : ''
                                }`}
                        >
                            <Text
                                className={`text-center font-semibold ${selectedPeriod === tab.id ? 'text-gray-900' : 'text-gray-500'
                                    }`}
                            >
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Leaderboard List */}
            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#f97316" />
                </View>
            ) : (
                <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                    {leaderboard.map((entry, index) => (
                        <View
                            key={entry.id}
                            className={`flex-row items-center p-4 mb-3 rounded-2xl ${entry.rank <= 3 ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'
                                }`}
                        >
                            {/* Rank */}
                            <View className="w-12 items-center">
                                {entry.rank <= 3 ? (
                                    <Ionicons
                                        name={getMedalIcon(entry.rank)}
                                        size={28}
                                        color={getMedalColor(entry.rank)}
                                    />
                                ) : (
                                    <Text className="text-gray-600 font-bold text-lg">
                                        {entry.rank}
                                    </Text>
                                )}
                            </View>

                            {/* Avatar */}
                            <View className="bg-orange-500 rounded-full w-12 h-12 items-center justify-center mx-3">
                                <Text className="text-white font-bold text-lg">
                                    {entry.name.charAt(0).toUpperCase()}
                                </Text>
                            </View>

                            {/* Info */}
                            <View className="flex-1">
                                <Text className="text-gray-900 font-bold text-base">
                                    {entry.name}
                                </Text>
                                <Text className="text-gray-500 text-xs">{entry.level}</Text>
                            </View>

                            {/* Stats */}
                            <View className="items-end">
                                <View className="flex-row items-center">
                                    <Ionicons name="star" size={16} color="#f97316" />
                                    <Text className="text-gray-900 font-bold ml-1">
                                        {entry.points}
                                    </Text>
                                </View>
                                <Text className="text-gray-500 text-xs mt-1">
                                    {entry.reportsCount} reports
                                </Text>
                            </View>
                        </View>
                    ))}

                    {leaderboard.length === 0 && (
                        <View className="items-center py-20">
                            <Ionicons name="trophy-outline" size={64} color="#d1d5db" />
                            <Text className="text-gray-400 mt-4">No data available</Text>
                        </View>
                    )}

                    <View className="h-6" />
                </ScrollView>
            )}
        </View>
    );
};

export default LeaderboardScreen;
