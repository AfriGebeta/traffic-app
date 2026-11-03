import React, { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { hasCampaignEnded, isParticipating, useCampaigns } from '../store/campaignStore';
import { getSeenEndingBanners, markEndingBannerSeen } from '../utils/campaignPrefs';
import { pickLocalized } from '../utils/localizedText';
import { Campaign, CampaignMe } from '../types/campaign.types';

// hours before the end; the banner comes back at each one even if closed at the previous
const THRESHOLDS_H = [24, 12];
const HOUR_MS = 3_600_000;

const endTime = (campaign: Campaign) => (campaign.endsAt ? new Date(campaign.endsAt).getTime() : NaN);

const slotFor = (msLeft: number): number | null => {
    const passed = THRESHOLDS_H.filter((hours) => msLeft <= hours * HOUR_MS);
    return passed.length > 0 ? Math.min(...passed) : null;
};

const myRank = (me: CampaignMe | undefined): number | null => {
    const standings = me?.periods ?? [];
    const total = standings.find((standing) => typeof standing.period === 'string');
    return total?.rank ?? standings.find((standing) => standing.rank !== null)?.rank ?? null;
};

export function CampaignEndingBanner() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const { colors: theme } = useTheme();
    const state = useCampaigns();
    const [seen, setSeen] = useState<string[] | null>(null);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        getSeenEndingBanners().then(setSeen);
    }, []);

    // minutes are the smallest unit shown
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(timer);
    }, []);

    const current = useMemo(() => {
        if (!state.loaded || !seen) return null;
        return state.campaigns
            .filter((campaign) => !hasCampaignEnded(campaign, now))
            .map((campaign) => {
                const msLeft = endTime(campaign) - now;
                const slot = Number.isNaN(msLeft) ? null : slotFor(msLeft);
                return { campaign, msLeft, id: `${campaign.slug}:${slot}`, slot };
            })
            .filter((item) => item.slot !== null && !seen.includes(item.id))
            .sort((a, b) => a.msLeft - b.msLeft)[0] ?? null;
    }, [state, seen, now]);

    if (!current) return null;
    const { campaign, msLeft, id } = current;

    const joined = isParticipating(campaign, state);
    const rank = joined ? myRank(state.me[campaign.slug]) : null;
    const minutesLeft = Math.max(1, Math.ceil(msLeft / 60_000));
    const hours = Math.floor(minutesLeft / 60);
    const minutes = minutesLeft % 60;
    const time = hours > 0 ? t('campaign-ending-time-hm', { h: hours, m: minutes }) : t('campaign-ending-time-m', { m: minutes });
    const subtitle = !joined ? t('campaign-ending-join') : rank ? t('campaign-ending-rank', { rank }) : t('campaign-ending-keep-going');

    const close = () => {
        void markEndingBannerSeen(id);
        setSeen((prev) => [...(prev ?? []), id]);
    };

    const open = () => {
        close();
        if (joined) router.push('/contribution');
        else router.push({ pathname: '/campaigns/[slug]', params: { slug: campaign.slug } });
    };

    return (
        <TouchableOpacity
            onPress={open}
            activeOpacity={0.85}
            className="flex-row items-center rounded-2xl mt-2 pl-4 pr-2 py-3"
            style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: colors.primary.main,
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
            }}
        >
            <Ionicons name="time-outline" size={22} color={colors.primary.main} />
            <View className="flex-1 ml-3">
                <Text className="font-semibold" style={{ color: theme.textPrimary }} numberOfLines={1}>
                    {t('campaign-ending-title', { name: pickLocalized(campaign.name, i18n.language), time })}
                </Text>
                <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }} numberOfLines={1}>
                    {subtitle}
                </Text>
            </View>
            <TouchableOpacity onPress={close} hitSlop={10} className="p-2" activeOpacity={0.7}>
                <Ionicons name="close" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
        </TouchableOpacity>
    );
}
