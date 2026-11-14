import React, { useCallback, useState } from 'react';
import { Clipboard, RefreshControl, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { showToast } from '../../../shared/utils/toast';
import { Chip, ChipTone, FONT_MEDIUM, RADIUS, RADIUS_SM, SectionLabel, SkeletonBlock } from '../../campaigns/components/CampaignUi';
import { getMyReferral, MyReferral, ReferralStage } from '../services/referral.service';

const STAGE_LABEL_KEYS: Record<ReferralStage, string> = {
    installed: 'referral-stage-installed',
    registered: 'referral-stage-registered',
    joined: 'referral-stage-joined',
    qualified: 'referral-stage-qualified',
};

const STAGE_TONES: Record<ReferralStage, ChipTone> = {
    installed: 'neutral',
    registered: 'neutral',
    joined: 'primary',
    qualified: 'success',
};

export const MyReferralScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { colors: theme } = useTheme();
    const [referral, setReferral] = useState<MyReferral | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        const mine = await getMyReferral();
        setReferral(mine);
        setLoading(false);
        setRefreshing(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            void load();
        }, [load])
    );

    const goBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace('/profile');
    };

    const copy = (value: string) => {
        Clipboard.setString(value);
        showToast(t('copied'));
    };

    const share = async () => {
        if (!referral) return;
        try {
            await Share.share({ message: t('referral-share-message', { url: referral.url, code: referral.code }) });
        } catch (error) {
            console.log('referral share failed', String(error));
            copy(referral.url);
        }
    };

    const cardStyle = { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: RADIUS };
    const textPrimary = { color: theme.textPrimary };
    const textSecondary = { color: theme.textSecondary };
    const mediumPrimary = { color: theme.textPrimary, fontFamily: FONT_MEDIUM };

    const header = (
        <View className="px-4 pt-3 pb-2 flex-row items-center">
            <TouchableOpacity onPress={goBack} className="mr-3 p-1 -ml-1" activeOpacity={0.7} hitSlop={8}>
                <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
        </View>
    );

    const title = (
        <>
            <SectionLabel style={{ marginBottom: 6 }}>{t('referral-section')}</SectionLabel>
            <Text style={{ ...textPrimary, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 }}>{t('referral-my-link')}</Text>
            <Text className="text-sm leading-6 mt-4" style={textSecondary}>
                {t('referral-my-link-description')}
            </Text>
            <View style={{ height: 24 }} />
        </>
    );

    if (loading || !referral) {
        return (
            <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
                {header}
                <View className="flex-1 px-4">
                    {title}
                    {loading ? (
                        <View style={{ gap: 12 }}>
                            <SkeletonBlock height={52} style={{ borderRadius: RADIUS }} />
                            <SkeletonBlock height={52} style={{ borderRadius: RADIUS }} />
                            <SkeletonBlock height={180} style={{ marginTop: 12, borderRadius: RADIUS }} />
                        </View>
                    ) : (
                        <View style={{ ...cardStyle, padding: 16 }}>
                            <Text style={mediumPrimary}>{t('referral-load-failed')}</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setLoading(true);
                                    void load();
                                }}
                                activeOpacity={0.7}
                                className="mt-3 self-start"
                                hitSlop={8}
                            >
                                <Text style={{ color: theme.primary, fontFamily: FONT_MEDIUM }}>{t('retry')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        );
    }

    const copyField = (label: string, value: string) => (
        <View className="mb-4">
            <SectionLabel style={{ marginBottom: 8 }}>{label}</SectionLabel>
            <TouchableOpacity
                onPress={() => copy(value)}
                activeOpacity={0.7}
                style={{ ...cardStyle, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}
            >
                {/* no `selectable`: on Android it breaks numberOfLines and clips a second line */}
                <Text numberOfLines={1} ellipsizeMode="middle" className="flex-1 mr-3" style={{ ...mediumPrimary, fontSize: 15 }}>
                    {value}
                </Text>
                <Ionicons name="copy-outline" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
        </View>
    );

    const stats: { key: keyof MyReferral; label: string }[] = [
        { key: 'clicks', label: t('referral-stat-clicks') },
        { key: 'installs', label: t('referral-stat-installs') },
        { key: 'registered', label: t('referral-stat-registered') },
        { key: 'joined', label: t('referral-stat-joined') },
        { key: 'qualified', label: t('referral-stat-qualified') },
    ];

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
            {header}

            <ScrollView
                className="flex-1 px-4"
                contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            void load();
                        }}
                        tintColor={theme.primary}
                    />
                }
            >
                {title}

                {copyField(t('referral-your-link'), referral.url)}
                {copyField(t('referral-your-code'), referral.code)}

                <View style={{ height: 8 }} />

                <SectionLabel style={{ marginBottom: 8 }}>{t('referral-progress')}</SectionLabel>
                <View style={{ ...cardStyle, paddingVertical: 4, marginBottom: 24 }}>
                    {stats.map(({ key, label }) => (
                        <View key={key} className="flex-row items-center justify-between px-4 py-2.5">
                            <Text className="text-sm" style={textPrimary}>
                                {label}
                            </Text>
                            <Text className="text-sm" style={{ ...mediumPrimary, fontVariant: ['tabular-nums'] }}>
                                {Number(referral[key]) || 0}
                            </Text>
                        </View>
                    ))}
                </View>

                <SectionLabel style={{ marginBottom: 8 }}>{t('referral-people')}</SectionLabel>
                {referral.people.length === 0 ? (
                    <Text className="text-sm leading-5" style={textSecondary}>
                        {t('referral-no-people')}
                    </Text>
                ) : (
                    <View style={{ ...cardStyle, paddingVertical: 4 }}>
                        {referral.people.map((person, index) => (
                            <View
                                key={`${person.username ?? person.name ?? 'person'}-${index}`}
                                className="flex-row items-center justify-between px-4 py-2.5"
                                style={index > 0 ? { borderTopWidth: 1, borderTopColor: theme.border } : undefined}
                            >
                                <View className="flex-1 mr-3">
                                    <Text className="text-sm" style={textPrimary} numberOfLines={1}>
                                        {person.name || person.username || t('referral-unnamed')}
                                    </Text>
                                    {person.username && person.name ? (
                                        <Text className="text-xs mt-0.5" style={textSecondary} numberOfLines={1}>
                                            @{person.username}
                                        </Text>
                                    ) : null}
                                </View>
                                <Chip tone={STAGE_TONES[person.stage] ?? 'neutral'}>
                                    {t(STAGE_LABEL_KEYS[person.stage] ?? 'referral-stage-installed')}
                                </Chip>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>

            <View
                className="absolute left-0 right-0 bottom-0 px-4 pt-3"
                style={{ paddingBottom: insets.bottom + 12, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border }}
            >
                <TouchableOpacity
                    onPress={share}
                    activeOpacity={0.7}
                    style={{
                        height: 48,
                        borderRadius: RADIUS_SM,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: theme.primary,
                    }}
                >
                    <Ionicons name="share-social-outline" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 15, marginLeft: 8 }}>{t('referral-share-link')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default MyReferralScreen;
