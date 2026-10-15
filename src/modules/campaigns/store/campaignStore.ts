import { useSyncExternalStore } from 'react';
import { isAuthenticated } from '../../register/utils/authGate';
import { campaignService } from '../services/campaign.service';
import { Campaign, CampaignMe } from '../types/campaign.types';


export interface CampaignState {
    loaded: boolean;
    loading: boolean;
    campaigns: Campaign[];
    // keyed by slug; missing when signed out or the call failed
    me: Record<string, CampaignMe>;
}

let state: CampaignState = { loaded: false, loading: false, campaigns: [], me: {} };
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;

const setState = (next: Partial<CampaignState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const getCampaignState = () => state;

export const refreshCampaigns = (): Promise<void> => {
    if (inFlight) return inFlight;
    setState({ loading: true });

    inFlight = (async () => {
        try {
            const campaigns = await campaignService.getRunning();
            const me: Record<string, CampaignMe> = {};
            if (await isAuthenticated()) {
                const standings = await Promise.all(
                    campaigns.map((campaign) => campaignService.getMe(campaign.slug).catch(() => null))
                );
                campaigns.forEach((campaign, i) => {
                    const standing = standings[i];
                    if (standing) me[campaign.slug] = standing;
                });
            }
            setState({ campaigns, me, loaded: true });
        } catch (error) {
            console.warn('campaigns: refresh failed', error);
            setState({ loaded: true });
        } finally {
            setState({ loading: false });
            inFlight = null;
        }
    })();

    return inFlight;
};

export const markCampaignJoined = (slug: string, track: string | null) => {
    setState({
        me: { ...state.me, [slug]: { ...state.me[slug], joined: true, enrollment: track ? { track } : null } },
    });
};

export const markCampaignLeft = (slug: string) => {
    setState({ me: { ...state.me, [slug]: { ...state.me[slug], joined: false, enrollment: null } } });
};

export const isParticipating = (campaign: Campaign, s: CampaignState = state): boolean =>
    !campaign.requiresJoin || s.me[campaign.slug]?.joined === true;

export const useCampaigns = () => useSyncExternalStore(subscribe, getCampaignState);
