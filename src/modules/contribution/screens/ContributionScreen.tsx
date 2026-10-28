import React, { useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CopilotStep, useCopilot } from 'react-native-copilot';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import PlaceLightIcon from '../../../../assets/images/contribute-place-light.svg';
import PlaceDarkIcon from '../../../../assets/images/contribute-place-dark.svg';
import NeighborhoodLightIcon from '../../../../assets/images/contribute-neighborhood-light.svg';
import NeighborhoodDarkIcon from '../../../../assets/images/contribute-neighborhood-dark.svg';
import TrafficLightIcon from '../../../../assets/images/contribute-traffic-light.svg';
import TrafficDarkIcon from '../../../../assets/images/contribute-traffic-dark.svg';
import TaxiLightIcon from '../../../../assets/images/contribute-taxi-light.svg';
import TaxiDarkIcon from '../../../../assets/images/contribute-taxi-dark.svg';
import { CampaignPointsBadge } from '../../campaigns/components/CampaignPointsBadge';
import { CampaignKind } from '../../campaigns/types/campaign.types';
import { CampaignTourProvider } from '../../campaigns/tour/CampaignTourProvider';
import { useTourCampaign } from '../../campaigns/tour/useTourCampaign';
import { endCampaignTour, setCampaignTourStage } from '../../campaigns/tour/campaignTour';
import { sentences } from '../../campaigns/tour/tourText';
import { TourActions } from '../../campaigns/tour/TourTooltip';
import { TourTouchable, TourView } from '../../campaigns/tour/walkthroughables';

// lets the tooltip after the map's Contribute step land here
const START_DELAY_MS = 500;

export default function ContributionScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const tour = useTourCampaign();
    // back on the map there's the Report step (if incidents pay) and, for first-timers, the Profile step
    const mapStepsLeft = tour.points('incident') > 0 || tour.firstTime;

    const tourActions: TourActions = {
        titleFor: (name) => (name === 'requirements' ? t('tour-rules-title') : TOUR_TITLE_KEYS[name] ? t(TOUR_TITLE_KEYS[name]) : undefined),
        lastLabel: t(mapStepsLeft ? 'tour-next' : 'tour-done'),
        onLast: () => {
            if (!mapStepsLeft) {
                endCampaignTour();
                return;
            }
            setCampaignTourStage('map-report');
            router.back();
        },
    };

    return (
        <CampaignTourProvider actions={tourActions}>
            <ContributionOptions />
        </CampaignTourProvider>
    );
}

// step names are the option ids below; titles reuse the options' own labels
const TOUR_TITLE_KEYS: Record<string, string> = {
    taxi: 'contribute-taxi-info',
    rules: 'report-traffic-rule',
    places: 'contribute-place',
};

const TOUR_TEXT_KEYS: Partial<Record<CampaignKind, string>> = {
    taxi_station: 'tour-taxi-text',
    traffic_rule: 'tour-rule-text',
    place: 'tour-place-text',
};

function ContributionOptions() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();
    const { start } = useCopilot();
    const tour = useTourCampaign();
    const touring = tour.stage === 'contribute-page';
    const startRef = useRef(start);
    startRef.current = start;

    useFocusEffect(
        useCallback(() => {
            if (!touring) return;
            const timer = setTimeout(() => void startRef.current(), START_DELAY_MS);
            return () => clearTimeout(timer);
        }, [touring])
    );

    const contributionOptions = [
        {
            id: 'places',
            titleKey: 'contribute-place',
            descriptionKey: 'contribute-place-description',
            Icon: isDark ? PlaceDarkIcon : PlaceLightIcon,
            route: '/places/contribute',
            campaignKind: 'place' as CampaignKind,
        },
        {
            id: 'neighborhoods',
            titleKey: 'contribute-neighborhood',
            descriptionKey: 'contribute-neighborhood-description',
            Icon: isDark ? NeighborhoodDarkIcon : NeighborhoodLightIcon,
            route: '/neighborhoods/contribute',
            // neighborhoods aren't campaign contributions, so no points badge
            campaignKind: null,
        },
        {
            id: 'rules',
            titleKey: 'report-traffic-rule',
            descriptionKey: 'report-traffic-rule-description',
            Icon: isDark ? TrafficDarkIcon : TrafficLightIcon,
            route: '/rules/contribute',
            campaignKind: 'traffic_rule' as CampaignKind,
        },
        {
            id: 'taxi',
            titleKey: 'contribute-taxi-info',
            descriptionKey: 'contribute-taxi-info-description',
            Icon: isDark ? TaxiDarkIcon : TaxiLightIcon,
            route: '/taxi/contribute',
            campaignKind: 'taxi_station' as CampaignKind,
        },
    ];

    // tour order: top to bottom as on the page; kinds worth nothing in this campaign are skipped
    const tourKinds = contributionOptions
        .map((option) => option.campaignKind)
        .filter((kind): kind is CampaignKind => !!kind && tour.points(kind) > 0);
    const withinM = tour.campaign?.requirements?.contributorWithinM;
    const rulesText = sentences(
        withinM ? t('tour-rules-text', { meters: withinM }) : t('tour-rules-text-anywhere'),
        tour.photoBonus && t('tour-photo-bonus'),
        tour.points('incident') <= 0 && !tour.firstTime && t('tour-track-points')
    );

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: theme.background }}>
            <View className="px-4 py-6" style={{ borderBottomWidth: 1, borderBottomColor: theme.background }}>
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="mr-4"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={28} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold" style={{ color: theme.textPrimary }}>{t('contribute')}</Text>
                </View>
                <CopilotStep name="requirements" order={tourKinds.length + 1} text={rulesText} active={touring}>
                    <TourView>
                        <Text className="mt-2" style={{ color: theme.textSecondary }}>{t('choose-what-to-contribute')}</Text>
                    </TourView>
                </CopilotStep>
            </View>

            <ScrollView className="flex-1 p-4">
                <View className="gap-4">
                    {contributionOptions.map((option) => {
                        const tourIndex = option.campaignKind ? tourKinds.indexOf(option.campaignKind) : -1;
                        const textKey = option.campaignKind ? TOUR_TEXT_KEYS[option.campaignKind] : undefined;
                        return (
                            <CopilotStep
                                key={option.id}
                                name={option.id}
                                order={tourIndex + 1}
                                text={textKey && option.campaignKind ? t(textKey, { points: tour.points(option.campaignKind) }) : ''}
                                active={touring && tourIndex >= 0}
                            >
                                <TourTouchable
                                    className="rounded-2xl p-6 shadow-sm"
                                    style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                                    onPress={() => router.push(option.route as any)}
                                    activeOpacity={0.7}
                                >
                                    <View className="flex-row items-center">
                                        <View className="w-12 h-12 items-center justify-center mr-4">
                                            <option.Icon width={40} height={40} />
                                        </View>
                                        <View className="flex-1">
                                            <View className="flex-row items-center flex-wrap mb-1">
                                                <Text className="text-xl font-semibold mr-2" style={{ color: theme.textPrimary }}>
                                                    {t(option.titleKey)}
                                                </Text>
                                                {option.campaignKind && <CampaignPointsBadge kind={option.campaignKind} />}
                                            </View>
                                            <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                                {t(option.descriptionKey)}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={24} color={theme.textSecondary} />
                                    </View>
                                </TourTouchable>
                            </CopilotStep>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
}
