import { useCampaigns } from '../store/campaignStore';
import { basePoints } from '../utils/campaignPoints';
import { Campaign, CampaignKind } from '../types/campaign.types';
import { CampaignTourStage, useCampaignTour } from './campaignTour';

// what the contribute page offers, in its top-to-bottom order (incidents are reported from the map instead)
const CONTRIBUTE_KINDS: CampaignKind[] = ['place', 'traffic_rule', 'taxi_station'];

export interface TourCampaign {
    stage: CampaignTourStage | null;
    campaign: Campaign | null;
    points: (kind: CampaignKind) => number;
    contributeKinds: CampaignKind[];
    photoBonus: boolean;
}

// the campaign the running tour is about, with its points; never hardcoded
export const useTourCampaign = (): TourCampaign => {
    const tour = useCampaignTour();
    const { campaigns } = useCampaigns();
    const campaign = tour.slug ? campaigns.find((c) => c.slug === tour.slug) ?? null : null;
    const points = (kind: CampaignKind) => (campaign ? basePoints(campaign, kind) : 0);
    return {
        stage: campaign ? tour.stage : null,
        campaign,
        points,
        contributeKinds: CONTRIBUTE_KINDS.filter((kind) => points(kind) > 0),
        photoBonus: (campaign?.pointsFormula?.quality?.photo ?? 1) > 1,
    };
};
