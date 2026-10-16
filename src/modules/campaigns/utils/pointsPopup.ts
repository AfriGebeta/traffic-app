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

// pending points one contribution would earn here; 0 when no campaign the user is in counts it
export const estimateCampaignPoints = (
    kind: CampaignKind,
    location: { lat: number; lng: number } | null | undefined,
    quality: SubmissionQuality = {}
): number => {
    if (!location) return 0;
    const state = getCampaignState();
    const participating = state.campaigns.filter((campaign) => isParticipating(campaign, state));
    const campaign = findCampaignAt(participating, location.lat, location.lng);
    return campaign ? estimatePoints(campaign, kind, quality) : 0;
};

export const showPointsPopup = (points: number) => {
    if (points > 0) listeners.forEach((listener) => listener(points));
};

export const showCampaignPointsEstimate = (
    kind: CampaignKind,
    location: { lat: number; lng: number } | null | undefined,
    quality: SubmissionQuality = {}
) => showPointsPopup(estimateCampaignPoints(kind, location, quality));
