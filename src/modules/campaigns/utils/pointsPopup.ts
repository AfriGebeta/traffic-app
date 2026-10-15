import { getCampaignState, isParticipating } from '../store/campaignStore';
import { CampaignKind } from '../types/campaign.types';
import { findCampaignAt } from './campaignGeo';
import { estimatePoints, SubmissionQuality } from './campaignPoints';

type Listener = (points: number) => void;

const listeners = new Set<Listener>();

export const subscribePointsPopup = (listener: Listener) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const showCampaignPointsEstimate = (
    kind: CampaignKind,
    location: { lat: number; lng: number } | null | undefined,
    quality: SubmissionQuality = {}
) => {
    if (!location) return;
    const state = getCampaignState();
    const participating = state.campaigns.filter((campaign) => isParticipating(campaign, state));
    const campaign = findCampaignAt(participating, location.lat, location.lng);
    if (!campaign) return;
    const points = estimatePoints(campaign, kind, quality);
    if (points > 0) listeners.forEach((listener) => listener(points));
};
