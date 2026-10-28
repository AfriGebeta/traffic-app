import { useGpsWarmup } from '../../../shared/services/gpsWarmup';
import { isParticipating, useCampaigns } from '../store/campaignStore';
import { basePoints } from '../utils/campaignPoints';
import { CampaignKind } from '../types/campaign.types';

export const useCampaignGpsWarmup = (kinds: CampaignKind[]) => {
    const state = useCampaigns();
    const active = state.campaigns.some((campaign) => isParticipating(campaign, state) && kinds.some((kind) => basePoints(campaign, kind) > 0));
    useGpsWarmup(active);
};
