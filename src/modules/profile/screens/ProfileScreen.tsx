import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserRegistration } from '../../register/hooks/useUserRegistration';
import { User } from '../../register/types/user.types';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { LanguageSwitcher } from '../../../shared/components/LanguageSwitcher';
import { leaderboardService } from '../../leaderboard/services/leaderboard.service';
import { colors } from '../../../shared/theme/colors';

export const ProfileScreen = () => {
    const router = useRouter();
    const { t } = useTranslation();
    const { getStoredUser, clearAuth } = useUserRegistration();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const insets = useSafeAreaInsets();

    const [level, setLevel] = useState('');
    const [rank, setRank] = useState(0);
    const [reportsCount, setReportsCount] = useState(0);
    const [points, setPoints] = useState(0);

    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async () => {
        const storedUser = await getStoredUser();
        setUser(storedUser);

        if (storedUser) {
            const stats = await leaderboardService.getUserStats(storedUser.id);
            if (stats) {
                setLevel(stats.level);
                setRank(stats.rank);
                setReportsCount(stats.reportsCount);
                setPoints(stats.points);
            }
        }

        setLoading(false);
    };

    const handleLogout = async () => {
        await clearAuth();
        router.replace('/');
    };

    const getInitial = (name: string): string => {
        return name.charAt(0).toUpperCase();
    };

    if (loading) {
        return (
            <View className="flex-1 bg-white">
                <View className="px-6 pt-12 pb-4 flex-row items-center justify-between">
                    <View className="w-6 h-6 bg-gray-200 rounded-full" />
                    <View className="w-32 h-10 bg-gray-200 rounded-xl" />
                </View>

                <View className="px-6">
                    <View className="items-center mb-8 mt-4">
                        <View className="bg-gray-200 rounded-full w-20 h-20 mb-4" />
                        <View className="w-32 h-7 bg-gray-200 rounded-lg mb-2" />
                        <View className="w-40 h-5 bg-gray-200 rounded-lg" />
                    </View>

                    <View className="flex-row mb-6 gap-3">
                        <View className="flex-1 bg-gray-50 rounded-2xl p-4">
                            <View className="w-6 h-6 bg-gray-200 rounded-full mb-2" />
                            <View className="w-16 h-8 bg-gray-200 rounded-lg mb-1" />
                            <View className="w-12 h-3 bg-gray-200 rounded" />
                        </View>
                        <View className="flex-1 bg-gray-50 rounded-2xl p-4">
                            <View className="w-6 h-6 bg-gray-200 rounded-full mb-2" />
                            <View className="w-16 h-8 bg-gray-200 rounded-lg mb-1" />
                            <View className="w-12 h-3 bg-gray-200 rounded" />
                        </View>
                        <View className="flex-1 bg-gray-50 rounded-2xl p-4">
                            <View className="w-6 h-6 bg-gray-200 rounded-full mb-2" />
                            <View className="w-16 h-8 bg-gray-200 rounded-lg mb-1" />
                            <View className="w-12 h-3 bg-gray-200 rounded" />
                        </View>
                    </View>

                    <View className="bg-gray-50 rounded-2xl p-5 mb-6">
                        <View className="flex-row items-center">
                            <View className="w-9 h-9 bg-gray-200 rounded-full mr-3" />
                            <View>
                                <View className="w-20 h-3 bg-gray-200 rounded mb-2" />
                                <View className="w-32 h-5 bg-gray-200 rounded-lg" />
                            </View>
                        </View>
                    </View>

                    <View className="bg-gray-50 rounded-2xl p-5 mb-6">
                        <View className="flex-row items-center">
                            <View className="w-6 h-6 bg-gray-200 rounded-full mr-3" />
                            <View className="w-24 h-5 bg-gray-200 rounded-lg" />
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    if (!user) {
        return (
            <View className="flex-1 bg-white">
                <View className="px-6 pt-12 pb-6">
                    <TouchableOpacity onPress={() => router.back()} className="mb-6">
                        <Ionicons name="arrow-back" size={24} color="#1f2937" />
                    </TouchableOpacity>
                </View>

                <View className="flex-1 items-center justify-center px-8 -mt-20">
                    <View className="rounded-full w-24 h-24 items-center justify-center mb-6" style={{ backgroundColor: colors.primary.main }}>
                        <Ionicons name="person-outline" size={48} color="#fff" />
                    </View>
                    <Text className="text-2xl font-bold text-gray-900 mb-3">
                        {t('please-register')}
                    </Text>
                    <Text className="text-gray-500 text-center mb-8 text-base">
                        {t('register-to-access-profile')}
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.push('/register')}
                        className="px-12 py-4 rounded-full"
                        style={{ minWidth: 160, backgroundColor: colors.primary.main }}
                    >
                        <Text className="text-white font-semibold text-base text-center">{t('register')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-white">
            <View className="px-6 pt-12 pb-4 flex-row items-center justify-between">
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#1f2937" />
                </TouchableOpacity>
                <LanguageSwitcher />
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <View className="px-6">
                    <View className="items-center mb-8 mt-4">
                        <View className="rounded-full w-20 h-20 items-center justify-center mb-4" style={{ backgroundColor: colors.primary.main }}>
                            <Text className="text-white text-3xl font-bold">
                                {getInitial(user.name)}
                            </Text>
                        </View>
                        <Text className="text-2xl font-bold text-gray-900 mb-1">
                            {user.name}
                        </Text>
                        <Text className="text-gray-500">{user.phoneNumber}</Text>
                    </View>
                    <View className="flex-row mb-6 gap-3">
                        <View className="flex-1 bg-gray-50 rounded-2xl p-4">
                            <Image
                                source={require('../../../../assets/images/star.png')}
                                style={{ width: 24, height: 24 }}
                                resizeMode="contain"
                            />
                            <Text className="text-2xl font-bold text-gray-900 mt-2">{points}</Text>
                            <Text className="text-gray-500 text-xs">{t('your-points')}</Text>
                        </View>
                        <View className="flex-1 bg-gray-50 rounded-2xl p-4">
                            <Image
                                source={require('../../../../assets/images/flag.png')}
                                style={{ width: 24, height: 24 }}
                                resizeMode="contain"
                            />
                            <Text className="text-2xl font-bold text-gray-900 mt-2">{reportsCount}</Text>
                            <Text className="text-gray-500 text-xs">{t('reports')}</Text>
                        </View>
                        <View className="flex-1 bg-gray-50 rounded-2xl p-4">
                            <Image
                                source={require('../../../../assets/images/trophy.png')}
                                style={{ width: 24, height: 24 }}
                                resizeMode="contain"
                            />
                            <Text className="text-2xl font-bold text-gray-900 mt-2">#{rank}</Text>
                            <Text className="text-gray-500 text-xs">{t('rank')}</Text>
                        </View>
                    </View>
                    <View className="bg-orange-50 rounded-2xl p-5 mb-6 border border-orange-200">
                        <View className="flex-row items-center">
                            <Image
                                source={require('../../../../assets/images/rank.png')}
                                style={{ width: 32, height: 32, marginRight: 12 }}
                                resizeMode="contain"
                            />
                            <View>
                                <Text className="text-gray-500 text-xs">{t('current-level')}</Text>
                                <Text className="text-gray-900 font-bold text-lg">{level}</Text>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity
                        className="bg-gray-50 rounded-2xl p-5 mb-6 flex-row items-center justify-between"
                        onPress={() => router.push('/leaderboard')}
                    >
                        <View className="flex-row items-center flex-1 mr-2">
                            <Image
                                source={require('../../../../assets/images/leaderboard.png')}
                                style={{ width: 24, height: 24 }}
                                resizeMode="contain"
                            />
                            <Text
                                className="text-gray-900 font-semibold ml-3"
                                numberOfLines={2}
                                style={{ flex: 1 }}
                            >
                                {t('leaderboard')}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="bg-white rounded-2xl p-3 mb-6 flex-row items-center justify-between border border-red-200"
                        onPress={handleLogout}
                    >
                        <View className="flex-row items-center flex-1 mr-2">
                            <Ionicons name="log-out-outline" size={24} color="#ef4444" />
                            <Text
                                className="text-red-600 font-semibold ml-3"
                                numberOfLines={2}
                                style={{ flex: 1 }}
                            >
                                {t('logout')}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <View
                className="items-center border-t border-gray-100"
                style={{ paddingTop: 24, paddingBottom: Math.max(insets.bottom + 8, 24) }}
            >
                <View className="flex-row items-center mb-1">
                    <Image
                        source={require('../../../../assets/images/favicon.png')}
                        style={{ width: 18, height: 18 }}
                        resizeMode="contain"
                    />
                    <Text className="text-gray-900 font-semibold ml-2">GebetaMaps</Text>
                </View>
                <Text className="text-gray-400 text-xs">{t('powered-by-community')}</Text>
            </View>
        </View>
    );
};

export default ProfileScreen;
