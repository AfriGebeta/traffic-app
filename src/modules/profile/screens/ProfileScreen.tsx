import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserRegistration } from '../../register/hooks/useUserRegistration';
import { User } from '../../register/types/user.types';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { changeLanguage } from '../../../shared/utils/localization/i18n';
import { leaderboardService } from '../../leaderboard/services/leaderboard.service';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { IncidentFiltersModal } from '../../incidents/components/IncidentFiltersModal';
import { useRulePreferences } from '../../rules/hooks/useRulePreferences';
import { showToast } from '../../../shared/utils/toast';
import { useResolvedImageUri } from '../../../shared/hooks/useResolvedImageUri';

import PointsIcon from '../../../../assets/images/profile-points.svg';
import ReportIcon from '../../../../assets/images/profile-report.svg';
import RankIcon from '../../../../assets/images/profile-rank.svg';
import LeaderboardIcon from '../../../../assets/images/profile-leaderboard.svg';
import HomeIcon from '../../../../assets/images/profile-home.svg';
import WorkIcon from '../../../../assets/images/profile-work.svg';
import OthersIcon from '../../../../assets/images/profile-others.svg';
import IncidentFiltersIcon from '../../../../assets/images/profile-incident-filters.svg';
import RulesIcon from '../../../../assets/images/profile-rules.svg';
import LogoutIcon from '../../../../assets/images/profile-logout.svg';

const LANGUAGES = [
    { code: 'en' as const, label: 'English', flag: '🇬🇧' },
    { code: 'am' as const, label: 'አማርኛ', flag: '🇪🇹' },
];

const SAVED_PLACE_CARDS = [
    { key: 'home', label: 'Home', Icon: HomeIcon, color: '#A855F7' },
    { key: 'office', label: 'Office', Icon: WorkIcon, color: '#3B82F6' },
    { key: 'custom', label: 'Custom', Icon: OthersIcon, color: '#A855F7' },
];

export const ProfileScreen = () => {
    const router = useRouter();
    const { t, language } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const { getStoredUser, refreshStoredUser, clearAuth } = useUserRegistration();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const insets = useSafeAreaInsets();
    const [showFiltersModal, setShowFiltersModal] = useState(false);
    const [showLanguages, setShowLanguages] = useState(false);
    const [remoteAvatarFailed, setRemoteAvatarFailed] = useState(false);

    const [level, setLevel] = useState('');
    const [rank, setRank] = useState(0);
    const [reportsCount, setReportsCount] = useState(0);
    const [points, setPoints] = useState(0);

    const { preferences: rulePreferences, toggleShowOnMap } = useRulePreferences();

    const elevatedCardStyle = {
        backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.35 : 0.08,
        shadowRadius: 8,
        elevation: 3,
    };

    const heroCardStyle = {
        backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 165, 0, 0.2)',
        shadowColor: isDark ? '#000000' : '#FFA500',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.4 : 0.12,
        shadowRadius: 10,
        elevation: 4,
    };

    const dividerStyle = {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    };

    useFocusEffect(
        React.useCallback(() => {
            loadUser();
        }, [])
    );

    const loadUser = async () => {
        const storedUser = await getStoredUser();

        setUser(storedUser);
        setRemoteAvatarFailed(false);
        setLoading(false);

        const freshUser = await refreshStoredUser().catch(() => storedUser);

        if (freshUser) {
            setUser(freshUser);
        }

        const userId = freshUser?.id ?? storedUser?.id;

        if (userId) {
            const stats = await leaderboardService.getUserStats(userId);
            if (stats) {
                setLevel(stats.level);
                setRank(stats.rank);
                setReportsCount(stats.reportsCount);
                setPoints(stats.points);
            }
        }
    };

    const handleLogout = async () => {
        await clearAuth();
        router.replace('/');
    };

    const getInitial = (name: string): string => {
        return name.charAt(0).toUpperCase();
    };

    const resolvedAvatar = useResolvedImageUri(user?.profileImage);
    const displayImage = (remoteAvatarFailed ? null : resolvedAvatar)
        ?? user?.profileImageLocal
        ?? null;

    if (loading) {
        return (
            <View className="flex-1" style={{ paddingTop: insets.top + 12, backgroundColor: theme.background }}>
                <View className="px-5">
                    <View className="p-4 mb-6" style={elevatedCardStyle}>
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="w-12 h-12 rounded-full mr-3" style={{ backgroundColor: theme.surface }} />
                                <View>
                                    <View className="w-16 h-3 rounded mb-2" style={{ backgroundColor: theme.surface }} />
                                    <View className="w-24 h-5 rounded-lg" style={{ backgroundColor: theme.surface }} />
                                </View>
                            </View>
                            <View className="w-9 h-9 rounded-full" style={{ backgroundColor: theme.surface }} />
                        </View>
                    </View>

                    <View className="p-4 mb-8" style={heroCardStyle}>
                        <View className="w-24 h-3 rounded mb-3" style={{ backgroundColor: theme.surface }} />
                        <View className="w-48 h-8 rounded-lg" style={{ backgroundColor: theme.surface }} />
                    </View>

                    <View className="w-28 h-5 rounded mb-3" style={{ backgroundColor: theme.surface }} />
                    <View className="flex-row gap-3 mb-3">
                        <View className="flex-1 h-14" style={elevatedCardStyle} />
                        <View className="flex-1 h-14" style={elevatedCardStyle} />
                    </View>
                    <View className="flex-row gap-3 mb-8">
                        <View className="flex-1 h-14" style={elevatedCardStyle} />
                        <View className="flex-1 h-14" style={elevatedCardStyle} />
                    </View>

                    <View className="w-28 h-5 rounded mb-3" style={{ backgroundColor: theme.surface }} />
                    <View className="flex-row gap-3">
                        <View className="flex-1 h-24" style={elevatedCardStyle} />
                        <View className="flex-1 h-24" style={elevatedCardStyle} />
                        <View className="flex-1 h-24" style={elevatedCardStyle} />
                    </View>
                </View>
            </View>
        );
    }

    if (!user) {
        return (
            <View className="flex-1" style={{ backgroundColor: theme.background }}>
                <View className="px-6 pt-12 pb-6">
                    <TouchableOpacity onPress={() => router.back()} className="mb-6">
                        <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                    </TouchableOpacity>
                </View>

                <View className="flex-1 items-center justify-center px-8 -mt-20">
                    <View className="rounded-full w-24 h-24 items-center justify-center mb-6" style={{ backgroundColor: colors.primary.main, elevation: 4 }}>
                        <Ionicons name="person-outline" size={48} color="#fff" />
                    </View>
                    <Text className="text-2xl font-bold mb-3" style={{ color: theme.textPrimary }}>
                        {t('please-register')}
                    </Text>
                    <Text className="text-center mb-8 text-base" style={{ color: theme.textSecondary }}>
                        {t('register-to-access-profile')}
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.push('/telegram-login')}
                        className="px-12 py-4 rounded-full"
                        style={{ minWidth: 160, backgroundColor: colors.primary.main, elevation: 3 }}
                    >
                        <Text className="text-white font-semibold text-base text-center">{t('register')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    paddingTop: insets.top + 12,
                    paddingBottom: Math.max(insets.bottom, 16) + 16,
                }}
            >
                <View className="px-5">
                    <View className="px-4 py-3.5 mb-6 flex-row items-center justify-between" style={elevatedCardStyle}>
                        <View className="flex-row items-center flex-1 mr-3">
                            <TouchableOpacity
                                onPress={() => router.push('/edit-profile')}
                                activeOpacity={0.8}
                                style={{ marginRight: 12 }}
                            >
                                {displayImage ? (
                                    <Image
                                        source={{ uri: displayImage }}
                                        style={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 24,
                                            borderWidth: 2,
                                            borderColor: colors.primary.main,
                                        }}
                                        onError={() => setRemoteAvatarFailed(true)}
                                    />
                                ) : (
                                    <View
                                        className="rounded-full items-center justify-center"
                                        style={{
                                            width: 48,
                                            height: 48,
                                            backgroundColor: colors.primary.main,
                                            borderWidth: 2,
                                            borderColor: 'rgba(255, 165, 0, 0.4)',
                                        }}
                                    >
                                        <Text className="text-white text-xl font-bold">
                                            {getInitial(user.name)}
                                        </Text>
                                    </View>
                                )}
                                <View
                                    className="absolute items-center justify-center"
                                    style={{
                                        right: -2,
                                        bottom: -2,
                                        width: 20,
                                        height: 20,
                                        borderRadius: 10,
                                        backgroundColor: colors.primary.main,
                                        borderWidth: 2,
                                        borderColor: isDark ? '#1E1E1E' : '#FFFFFF',
                                    }}
                                >
                                    <Ionicons name="pencil" size={9} color="#fff" />
                                </View>
                            </TouchableOpacity>
                            <View className="flex-1">
                                <Text className="text-xs mb-0.5 font-medium" style={{ color: theme.textSecondary }}>
                                    {t('welcome') || 'Welcome'}
                                </Text>
                                <Text className="font-bold text-base" style={{ color: theme.textPrimary }} numberOfLines={1}>
                                    {user.name}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={handleLogout}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            className="items-center justify-center p-2"
                        >
                            <LogoutIcon width={22} height={22} color={theme.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <View className="px-5 py-4 mb-8" style={heroCardStyle}>
                        <View className="flex-row items-center mb-2">
                            <View className="mr-2">
                                <LeaderboardIcon width={16} height={16} color={colors.primary.main} />
                            </View>
                            <Text className="text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>
                                {t('current-level')}
                            </Text>
                        </View>
                        <Text
                            style={{ fontFamily: 'RammettoOne-Regular', fontSize: 26, lineHeight: 36, color: theme.textPrimary }}
                            numberOfLines={1}
                        >
                            {(level || '—').toUpperCase()}
                        </Text>
                    </View>

                    <Text className="font-bold text-base mb-3" style={{ color: theme.textPrimary }}>
                        {t('community') || 'Community'}
                    </Text>
                    <View className="mb-8">
                        <View className="flex-row gap-3 mb-3">
                            <View className="flex-1 px-4 py-3.5 flex-row items-center justify-between" style={elevatedCardStyle}>
                                <View className="flex-row items-center">
                                    <View className="mr-2.5">
                                        <PointsIcon width={18} height={18} color="#F59E0B" />
                                    </View>
                                    <Text className="text-sm font-medium" style={{ color: theme.textPrimary }}>
                                        {t('your-points') || 'Points'}
                                    </Text>
                                </View>
                                <Text className="font-bold text-base" style={{ color: theme.textPrimary }}>{points}</Text>
                            </View>

                            <View className="flex-1 px-4 py-3.5 flex-row items-center justify-between" style={elevatedCardStyle}>
                                <View className="flex-row items-center">
                                    <View className="mr-2.5">
                                        <ReportIcon width={18} height={18} color="#3B82F6" />
                                    </View>
                                    <Text className="text-sm font-medium" style={{ color: theme.textPrimary }}>
                                        {t('reports') || 'Reports'}
                                    </Text>
                                </View>
                                <Text className="font-bold text-base" style={{ color: theme.textPrimary }}>{reportsCount}</Text>
                            </View>
                        </View>

                        <View className="flex-row gap-3">
                            <View className="flex-1 px-4 py-3.5 flex-row items-center justify-between" style={elevatedCardStyle}>
                                <View className="flex-row items-center">
                                    <View className="mr-2.5">
                                        <RankIcon width={18} height={18} color="#A855F7" />
                                    </View>
                                    <Text className="text-sm font-medium" style={{ color: theme.textPrimary }}>
                                        {t('rank') || 'Rank'}
                                    </Text>
                                </View>
                                <Text className="font-bold text-base" style={{ color: theme.textPrimary }}>#{rank}</Text>
                            </View>

                            <TouchableOpacity
                                className="flex-1 px-4 py-3.5 flex-row items-center justify-between"
                                style={elevatedCardStyle}
                                activeOpacity={0.7}
                                onPress={() => router.push('/leaderboard')}
                            >
                                <View className="flex-row items-center flex-1 mr-1">
                                    <View className="mr-2.5">
                                        <LeaderboardIcon width={18} height={18} color="#10B981" />
                                    </View>
                                    <Text className="text-sm font-medium" style={{ color: theme.textPrimary }} numberOfLines={1}>
                                        {t('leaderboard')}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Saved Places Section */}
                    <View className="flex-row items-center justify-between mb-3">
                        <Text className="font-bold text-base" style={{ color: theme.textPrimary }}>
                            {t('saved-places') || 'Saved Places'}
                        </Text>
                        <TouchableOpacity
                            className="py-1 px-2"
                            activeOpacity={0.7}
                            onPress={() => router.push('/saved-places')}
                        >
                            <Text className="text-sm font-bold" style={{ color: theme.blue }}>
                                {t('view-all') || 'View all'} ›
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <View className="flex-row gap-2 mb-8">
                        {SAVED_PLACE_CARDS.map(({ key, label, Icon, color }) => (
                            <TouchableOpacity
                                key={key}
                                activeOpacity={0.8}
                                className="flex-1 p-2.5"
                                style={elevatedCardStyle}
                                onPress={() => router.push('/saved-places')}
                            >
                                <View
                                    className="rounded-xl items-center justify-center mb-2.5"
                                    style={{ width: 36, height: 36, backgroundColor: color }}
                                >
                                    <Icon width={18} height={18} color="#fff" />
                                </View>
                                <View className="flex-row items-center justify-between">
                                    <Text className="font-semibold text-xs flex-1 mr-1" style={{ color: theme.textPrimary }} numberOfLines={1}>
                                        {label}
                                    </Text>
                                    <Ionicons name="arrow-up" size={12} color={theme.textSecondary} style={{ transform: [{ rotate: '45deg' }] }} />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Personalisation Section */}
                    <Text className="font-bold text-base mb-3" style={{ color: theme.textPrimary }}>
                        {t('personalisation') || 'Personalisation'}
                    </Text>
                    <View className="overflow-hidden mb-8" style={elevatedCardStyle}>
                        <TouchableOpacity
                            className="flex-row items-center justify-between px-4 py-4"
                            activeOpacity={0.7}
                            onPress={() => setShowFiltersModal(true)}
                        >
                            <View className="flex-row items-center flex-1 mr-2">
                                <View className="mr-3">
                                    <IncidentFiltersIcon width={18} height={18} color="#EF4444" />
                                </View>
                                <Text className="text-sm font-medium" style={{ color: theme.textPrimary }} numberOfLines={1}>
                                    {t('incident-filters') || 'Incident Filters'}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>

                        <View className="h-px mx-4" style={dividerStyle} />

                        <TouchableOpacity
                            className="flex-row items-center justify-between px-4 py-4"
                            activeOpacity={0.7}
                            onPress={async () => {
                                try {
                                    const newValue = await toggleShowOnMap();
                                    showToast.success(
                                        newValue
                                            ? t('rules-shown-on-map')
                                            : t('rules-hidden-on-map')
                                    );
                                } catch (error) {
                                    showToast.error(t('error'), t('failed-to-update-settings'));
                                }
                            }}
                        >
                            <View className="flex-row items-center flex-1 mr-2">
                                <View className="mr-3">
                                    <RulesIcon width={18} height={18} color="#F59E0B" />
                                </View>
                                <Text className="text-sm font-medium" style={{ color: theme.textPrimary }} numberOfLines={1}>
                                    {t('show-rules-on-map')}
                                </Text>
                            </View>
                            <View
                                className="w-11 h-6 rounded-full justify-center"
                                style={{ backgroundColor: rulePreferences.showOnMap ? '#F59E0B' : (isDark ? '#333333' : '#E5E7EB') }}
                            >
                                <View className={`w-5 h-5 rounded-full bg-white ${rulePreferences.showOnMap ? 'ml-5' : 'ml-0.5'}`} />
                            </View>
                        </TouchableOpacity>

                        <View className="h-px mx-4" style={dividerStyle} />

                        <TouchableOpacity
                            className="flex-row items-center justify-between px-4 py-4"
                            activeOpacity={0.7}
                            onPress={() => setShowLanguages(!showLanguages)}
                        >
                            <View className="flex-row items-center flex-1 mr-2">
                                <View className="mr-3">
                                    <Ionicons name="language-outline" size={18} color="#3B82F6" />
                                </View>
                                <Text className="text-sm font-medium" style={{ color: theme.textPrimary }}>
                                    {t('language') || 'Language'}
                                </Text>
                            </View>
                            <Ionicons name={showLanguages ? 'chevron-down' : 'chevron-forward'} size={16} color={theme.textSecondary} />
                        </TouchableOpacity>

                        {showLanguages && LANGUAGES.map((lang) => (
                            <TouchableOpacity
                                key={lang.code}
                                className="flex-row items-center px-4 py-3"
                                style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)' }}
                                onPress={async () => {
                                    await changeLanguage(lang.code);
                                    setShowLanguages(false);
                                }}
                            >
                                <Text className="text-base mr-2">{lang.flag}</Text>
                                <Text
                                    className={`text-sm ${lang.code === language ? 'font-bold' : ''}`}
                                    style={{ color: lang.code === language ? theme.textPrimary : theme.textSecondary }}
                                >
                                    {lang.label}
                                </Text>
                                {lang.code === language && (
                                    <Ionicons name="checkmark" size={18} color={colors.primary.main} style={{ marginLeft: 'auto' }} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View className="items-center mb-4">
                        <View className="flex-row items-center">
                            <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
                                <Text className="text-xs font-medium" style={{ color: theme.textSecondary }}>Privacy Policy</Text>
                            </TouchableOpacity>
                            <Text className="text-xs mx-2" style={{ color: theme.textSecondary }}>•</Text>
                            <TouchableOpacity onPress={() => router.push('/terms-conditions')}>
                                <Text className="text-xs font-medium" style={{ color: theme.textSecondary }}>Terms & Conditions</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </ScrollView>

            <IncidentFiltersModal
                visible={showFiltersModal}
                onClose={() => setShowFiltersModal(false)}
            />
        </View>
    );
};

export default ProfileScreen;
