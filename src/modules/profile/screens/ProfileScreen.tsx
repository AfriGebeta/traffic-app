import React, { useEffect, useState } from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserRegistration } from '../../register/hooks/useUserRegistration';
import { User } from '../../register/types/user.types';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { leaderboardService } from '../../leaderboard/services/leaderboard.service';
import { colors } from '../../../shared/theme/colors';
import { IncidentFiltersModal } from '../../incidents/components/IncidentFiltersModal';
import { useRulePreferences } from '../../rules/hooks/useRulePreferences';
import { showToast } from '../../../shared/utils/toast';
import { Icon } from '../../../components/icons';

const PLACEHOLDER_COLORS = ['#BC6DD7', '#1976D2', '#B962D1'];

export const ProfileScreen = () => {
    const router = useRouter();
    const { t } = useTranslation();
    const { getStoredUser, clearAuth } = useUserRegistration();
    const insets = useSafeAreaInsets();
    const { preferences: rulePreferences, toggleShowOnMap } = useRulePreferences();

    const[level, setLevel] = useState('')
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [showFiltersModal, setShowFiltersModal] = useState(false);
    const [rank, setRank] = useState(0);
    const [reportsCount, setReportsCount] = useState(0);
    const [points, setPoints] = useState(0);
    const hasContributions = reportsCount > 0 || points > 0;

    useEffect(() => {
        void loadUser();
    }, []);

    const loadUser = async () => {
        const storedUser = await getStoredUser();
        if (storedUser?.name) {
            storedUser.name = storedUser.name.replace(/\s+undefined$/i, '').trim();
        }
        setUser(storedUser);
        setPoints(storedUser?.points ?? 0);

        if (storedUser) {
            const stats = await leaderboardService.getUserStats(storedUser.id);
            if (stats) {
                setLevel(stats.level)
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

    const renderAvatar = () => {
        if (user?.profileImage) {
            return <Image source={{ uri: user.profileImage }} style={styles.avatarImage} />;
        }
        return (
            <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{user?.name?.charAt(0).toUpperCase() || ''}</Text>
            </View>
        );
    };

    if (loading) {
        return <View style={styles.loadingScreen} />;
    }

    if (!user) {
        return (
            <View style={[styles.emptyScreen, { paddingTop: insets.top + 24 }]}>
                <Text style={styles.emptyTitle}>{t('please-register')}</Text>
                <Text style={styles.emptyCopy}>{t('register-to-access-profile')}</Text>
                <TouchableOpacity style={styles.registerButton} onPress={() => router.push('/telegram-login')}>
                    <Text style={styles.registerButtonText}>{t('register')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.content, { paddingTop: insets.top + 22, paddingBottom: insets.bottom + 32 }]}
            >
                <View style={styles.welcomeRow}>
                    {renderAvatar()}
                    <View style={styles.welcomeCopy}>
                        <Text style={styles.welcomeLabel}>Welcome</Text>
                        <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
                    </View>
                    <TouchableOpacity onPress={handleLogout} hitSlop={12} style={styles.logoutButton}>
                        <Icon name="curved-dark-outline-logout" size={26} color="#D65D5D" />
                    </TouchableOpacity>
                </View>

                <View style={styles.levelCard}>
                    <View style={styles.levelHeading}>
                        <Icon name="curved-dark-light-activity" size={25} color="#34343A" />
                        <Text style={styles.levelLabel}>{t('current-level')}</Text>
                    </View>
                    <Text style={[styles.levelText, hasContributions && styles.legendaryLevelText]} numberOfLines={1}>
                        {level || "No contribution yet"}
                    </Text>
                </View>

                <View style={styles.divider} />

                <Text style={styles.sectionTitle}>Community</Text>
                <View style={styles.communityGrid}>
                    <TouchableOpacity style={[styles.gridItem, styles.gridRightBorder, styles.gridBottomBorder]} activeOpacity={0.7}>
                        <Icon name="curved-dark-outline-star" size={22} color="#34343A" />
                        <Text style={styles.gridLabel}>Points</Text>
                        <Text style={styles.gridValue}>{points}</Text>
                    </TouchableOpacity>
                    <View style={[styles.gridItem, styles.gridBottomBorder]}>
                        <Icon name="curved-dark-outline-edit-square" size={22} color="#34343A" />
                        <Text style={styles.gridLabel}>Reports</Text>
                        <Text style={styles.gridValue}>{setReportsCount}</Text>
                    </View>
                    <View style={[styles.gridItem, styles.gridRightBorder]}>
                        <Icon name="curved-dark-outline-3-user" size={22} color="#34343A" />
                        <Text style={styles.gridLabel}>Rank</Text>
                        <Text style={styles.gridValue}>#{rank || '—'}</Text>
                    </View>
                    <TouchableOpacity style={styles.gridItem} onPress={() => router.push('/leaderboard')} activeOpacity={0.7}>
                        <Icon name="curved-dark-outline-chart" size={22} color="#34343A" />
                        <Text style={styles.gridLabel}>Leaderboard</Text>
                        <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.sectionRow}>
                    <Text style={styles.sectionTitle}>Saved Places</Text>
                    <TouchableOpacity style={styles.placesLinkButton} onPress={() => router.push('/saved-places')} activeOpacity={0.8}>
                        <Text style={styles.placesLink}>View all ›</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.placesList}>
                    {['Home', 'Office', 'Custom'].map((place, index) => (
                        <TouchableOpacity key={place} style={styles.placeCard} onPress={() => router.push('/saved-places')} activeOpacity={0.75}>
                            <View style={[styles.placeIconBadge, { backgroundColor: PLACEHOLDER_COLORS[index] }]}>
                                <Icon
                                    name={index === 0 ? 'curved-light-light-home' : index === 1 ? 'curved-light-light-work' : 'curved-light-light-bookmark'}
                                    size={17}
                                    color="#FFFFFF"
                                />
                            </View>
                            <View style={styles.placeCardBottom}>
                                <Text style={styles.placeName}>{place}</Text>
                                <Text style={styles.openPlace}>↗</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <Text style={[styles.sectionTitle, styles.personalisationTitle]}>Personalisation</Text>
                <View style={styles.settingsCard}>
                    <TouchableOpacity style={styles.settingRow} onPress={() => setShowFiltersModal(true)}>
                        <View style={styles.settingTitle}>
                            <Icon name="curved-dark-light-filter-2" size={22} color="#34343A" />
                            <Text style={styles.settingLabel}>{t('incident-filters') || 'Incident Filters'}</Text>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                    <View style={styles.settingRow}>
                        <View style={styles.settingTitle}>
                            <Icon name="curved-dark-outline-danger-triangle" size={22} color="#34343A" />
                            <Text style={styles.settingLabel}>{t('show-rules-on-map')}</Text>
                        </View>
                        <Switch
                            value={rulePreferences.showOnMap}
                            onValueChange={async () => {
                                try {
                                    const visible = await toggleShowOnMap();
                                    showToast.success(visible ? t('rules-shown-on-map') : t('rules-hidden-on-map'));
                                } catch {
                                    showToast.error(t('error'), t('failed-to-update-settings'));
                                }
                            }}
                            trackColor={{ false: '#E5E7EB', true: '#F6AD12' }}
                            thumbColor="#FFFFFF"
                        />
                    </View>
                    <TouchableOpacity style={styles.settingRow}>
                        <Text style={styles.settingLabel}>Language</Text>
                        <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <IncidentFiltersModal visible={showFiltersModal} onClose={() => setShowFiltersModal(false)} />
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#FFFFFF' },
    content: { paddingHorizontal: 24 },
    loadingScreen: { flex: 1, backgroundColor: '#FFFFFF' },
    emptyScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: '#FFFFFF' },
    emptyTitle: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 24, color: '#1D1D1F', marginBottom: 10 },
    emptyCopy: { fontFamily: 'PlusJakartaSans-Regular', textAlign: 'center', color: '#71717A', marginBottom: 24 },
    registerButton: { backgroundColor: colors.primary.main, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 34 },
    registerButtonText: { fontFamily: 'PlusJakartaSans-Bold', color: '#FFFFFF' },
    welcomeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 26 },
    avatarImage: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F1F1F1' },
    avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
    avatarInitial: { fontFamily: 'PlusJakartaSans-Bold', fontSize: 18, color: '#5E5E63' },
    welcomeCopy: { flex: 1, marginLeft: 12 },
    welcomeLabel: { fontFamily: 'PlusJakartaSans-Regular', color: '#8A8A91', fontSize: 12, marginBottom: 2 },
    userName: { fontFamily: 'PlusJakartaSans-Bold', color: '#222227', fontSize: 14 },
    logoutButton: { paddingVertical: 8, paddingLeft: 12 },
    levelCard: { paddingHorizontal: 20, paddingVertical: 16, borderWidth: 1, borderColor: '#E5E5E8', borderRadius: 8 },
    levelHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7 },
    levelLabel: { fontFamily: 'PlusJakartaSans-Regular', color: '#777780', fontSize: 12 },
    levelText: { fontFamily: 'PlusJakartaSans-ExtraBold', color: '#08080A', fontSize: 24, lineHeight: 36, letterSpacing: 0.4 },
    legendaryLevelText: { fontFamily: 'RammettoOne-Regular', fontSize: 22, letterSpacing: 0, lineHeight: 36 },
    divider: { height: 1, backgroundColor: '#EEEEF0', marginVertical: 27 },
    sectionTitle: { fontFamily: 'PlusJakartaSans-Bold', color: '#35353A', fontSize: 14, marginBottom: 10 },
    communityGrid: { borderWidth: 1, borderColor: '#ECECEF', borderRadius: 10, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' },
    gridItem: { width: '50%', minHeight: 74, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
    gridRightBorder: { borderRightWidth: 1, borderRightColor: '#ECECEF' },
    gridBottomBorder: { borderBottomWidth: 1, borderBottomColor: '#ECECEF' },
    gridLabel: { fontFamily: 'PlusJakartaSans-SemiBold', color: '#5F5F67', fontSize: 13 },
    gridValue: { fontFamily: 'PlusJakartaSans-Bold', marginLeft: 'auto', color: '#27272C', fontSize: 13 },
    chevron: { fontFamily: 'PlusJakartaSans-Regular', color: '#7A7A82', fontSize: 25, lineHeight: 25 },
    sectionRow: { marginTop: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    placesLinkButton: { backgroundColor: '#318CE7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
    placesLink: { fontFamily: 'PlusJakartaSans-Bold', color: '#FFFFFF', fontSize: 11 },
    placesList: { gap: 10, paddingRight: 24 },
    placeCard: { width: 140, height: 88, borderWidth: 1, borderColor: '#ECECEF', borderRadius: 10, padding: 14, justifyContent: 'space-between' },
    placeIconBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    placeCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    placeName: { fontFamily: 'PlusJakartaSans-Bold', color: '#313137', fontSize: 13 },
    openPlace: { fontFamily: 'PlusJakartaSans-Regular', color: '#4D4D55', fontSize: 18 },
    personalisationTitle: { marginTop: 26 },
    settingsCard: { borderWidth: 1, borderColor: '#ECECEF', borderRadius: 10, paddingHorizontal: 16 },
    settingRow: { minHeight: 53, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F1F3' },
    lastSettingRow: { borderBottomWidth: 0 },
    settingLabel: { fontFamily: 'PlusJakartaSans-SemiBold', color: '#45454D', fontSize: 13 },
    settingTitle: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
});

export default ProfileScreen;
