import { CampaignState, getCampaignState, hasCampaignEnded, isParticipating, isUpcoming, refreshCampaigns } from '../store/campaignStore';
import { Campaign } from '../types/campaign.types';
import { getSeenBannerSlugs } from './campaignPrefs';

const startTime = (campaign: Campaign) => {
    const time = campaign.startsAt ? new Date(campaign.startsAt).getTime() : NaN;
    return Number.isNaN(time) ? 0 : time;
};

export const pickAnnouncementCampaign = (state: CampaignState, seen: string[]): Campaign | null => {
    const running = [...state.campaigns]
        .filter((c) => !seen.includes(c.slug) && !hasCampaignEnded(c) && !(c.requiresJoin && isParticipating(c, state)))
        .sort((a, b) => startTime(b) - startTime(a))[0];
    if (running) return running;
    const next = state.upcoming;
    if (!next || !isUpcoming(next) || !next.requiresJoin || seen.includes(next.slug) || state.me[next.slug]?.joined) return null;
    return next;
};

export const findOnboardingCampaign = async (): Promise<string | null> => {
    try {
        await refreshCampaigns();
        const seen = await getSeenBannerSlugs();
        return pickAnnouncementCampaign(getCampaignState(), seen)?.slug ?? null;
    } catch {
        return null;
    }
};
