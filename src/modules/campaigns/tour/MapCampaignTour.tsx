import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCopilot } from 'react-native-copilot';
import { useTranslation } from 'react-i18next';
import { endCampaignTour, setCampaignTourStage } from './campaignTour';
import { TourActions } from './TourTooltip';
import { useTourCampaign } from './useTourCampaign';

const START_DELAY_MS = 700;

export const useMapTourActions = (): TourActions => {
    const router = useRouter();
    const { t } = useTranslation();
    const { stage } = useTourCampaign();
    const titles: Record<string, string> = {
        contribute: 'tour-contribute-title',
        report: 'tour-report-title',
        campaigns: 'tour-campaigns-title',
    };
    return {
        titleFor: (name) => (titles[name] ? t(titles[name]) : undefined),
        // the Report part always ends on the home Campaigns button; nothing to open after it
        lastLabel: stage === 'map-contribute' ? t('tour-open-contribute') : t('tour-done'),
        onLast: () => {
            if (stage === 'map-contribute') {
                setCampaignTourStage('contribute-page');
                router.push('/contribution');
            } else {
                endCampaignTour();
            }
        },
        // skipping the Contribute step skips the contribute page too, and moves on to Report
        onSkipLast: () => {
            if (stage === 'map-contribute') setCampaignTourStage('map-report');
            else endCampaignTour();
        },
    };
};

export function MapCampaignTour() {
    const { start, visible } = useCopilot();
    const { stage, contributeKinds } = useTourCampaign();
    const [focused, setFocused] = useState(false);
    const hasContributeKinds = contributeKinds.length > 0;

    useFocusEffect(
        useCallback(() => {
            setFocused(true);
            return () => setFocused(false);
        }, [])
    );

    useEffect(() => {
        if (!focused || visible || (stage !== 'map-contribute' && stage !== 'map-report')) return;
        // nothing on the contribute page pays in this campaign: go straight to the Report part
        if (stage === 'map-contribute' && !hasContributeKinds) {
            setCampaignTourStage('map-report');
            return;
        }
        const timer = setTimeout(() => void start(), START_DELAY_MS);
        return () => clearTimeout(timer);
    }, [focused, visible, stage, hasContributeKinds, start]);

    return null;
}
