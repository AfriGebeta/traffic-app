import React, { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { DIALOG_MAX_STYLE } from '../../../shared/layout/modalStyles';
import { isUpcoming, useCampaigns } from '../store/campaignStore';
import { getSeenBannerSlugs, markBannerSeen } from '../utils/campaignPrefs';
import { pickAnnouncementCampaign } from '../utils/announcementCampaign';
import { askForNotifications } from '../../../shared/services/notificationPermission';
import { locationPermissionSettled } from '../../../shared/utils/permissionSequence';
import { pickLocalized } from '../utils/localizedText';

const AnnouncementLight = require('../../../../assets/images/announcement-light.png');
const AnnouncementDark = require('../../../../assets/images/announcement-dark.png');

export function CampaignBanner() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const state = useCampaigns();
    const [seen, setSeen] = useState<string[] | null>(null);

    useEffect(() => {
        getSeenBannerSlugs().then(setSeen);
    }, []);

    // newest campaign the user hasn't seen or joined; the rest are listed under Profile → Campaigns
    const campaign = useMemo(() => {
        if (!state.loaded || !seen) return null;
        return pickAnnouncementCampaign(state, seen);
    }, [state, seen]);

    // home's turn-on-notifications ask waits for the location prompt and never stacks on a campaign announcement
    const idle = state.loaded && !!seen && !campaign;
    useEffect(() => {
        if (!idle) return;
        let cancelled = false;
        const timeout = new Promise<void>((resolve) => setTimeout(resolve, 30_000));
        void Promise.race([locationPermissionSettled, timeout]).then(() => {
            if (!cancelled) void askForNotifications('home');
        });
        return () => {
            cancelled = true;
        };
    }, [idle]);

    if (!campaign) return null;

    const dismiss = () => {
        void markBannerSeen(campaign.slug);
        setSeen((prev) => [...(prev ?? []), campaign.slug]);
    };

    const view = () => {
        dismiss();
        router.push({ pathname: '/campaigns/[slug]', params: { slug: campaign.slug } });
    };

    const name = pickLocalized(campaign.name, i18n.language);
    const description = pickLocalized(campaign.description, i18n.language);
    // pre-booking: say when it starts instead of "New campaign"
    const startsAt = isUpcoming(campaign) && campaign.startsAt ? new Date(campaign.startsAt) : null;
    const label = startsAt
        ? t('campaign-starts-on', { date: startsAt.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' }) })
        : t('campaign-new');

    return (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
            <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                <View
                    className="w-full rounded-2xl p-6 items-center"
                    style={[{ backgroundColor: theme.background }, DIALOG_MAX_STYLE]}
                >
                    <TouchableOpacity
                        onPress={dismiss}
                        className="absolute p-2"
                        style={{ top: 8, right: 8 }}
                        accessibilityLabel={t('close')}
                        hitSlop={8}
                    >
                        <Ionicons name="close" size={22} color={theme.textSecondary} />
                    </TouchableOpacity>

                    <Image
                        source={isDark ? AnnouncementDark : AnnouncementLight}
                        style={{ width: 88, height: 88, marginBottom: 16 }}
                        resizeMode="contain"
                    />

                    <Text className="text-xs font-bold uppercase mb-1" style={{ color: colors.primary.main, letterSpacing: 1 }}>
                        {label}
                    </Text>
                    <Text className="text-xl font-bold text-center" style={{ color: theme.textPrimary }}>
                        {name}
                    </Text>
                    <Text className="text-sm text-center leading-5 mt-2" style={{ color: theme.textSecondary }}>
                        {description || t('campaign-banner-pitch')}
                    </Text>

                    <View className="flex-row gap-3 mt-6 w-full">
                        <TouchableOpacity
                            onPress={dismiss}
                            className="flex-1 rounded-xl py-3.5 items-center"
                            style={{ borderWidth: 1, borderColor: theme.border }}
                        >
                            <Text className="font-semibold text-base" style={{ color: theme.textPrimary }}>
                                {t('not-now')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={view}
                            className="flex-1 rounded-xl py-3.5 items-center"
                            style={{ backgroundColor: colors.primary.main }}
                        >
                            <Text className="text-white font-semibold text-base">{t('campaign-view')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
