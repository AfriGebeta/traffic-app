import { isParticipating, useCampaigns } from '../store/campaignStore';
import { basePoints } from '../utils/campaignPoints';
import { Campaign, CampaignKind } from '../types/campaign.types';

// A campaign the user takes part in that scores this kind, wherever they are.
// null = no campaign pays for this kind. (Area isn't checked here; badges and popups still check it.)
export const useScoringCampaign = (kind: CampaignKind): Campaign | null => {
    const state = useCampaigns();
    return state.campaigns.find((campaign) => isParticipating(campaign, state) && basePoints(campaign, kind) > 0) ?? null;
};
