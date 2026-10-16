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

// /running only drops a campaign on the next refresh; until then, end it locally at endsAt
export const hasCampaignEnded = (campaign: Campaign, now = Date.now()): boolean => {
    const end = campaign.endsAt ? new Date(campaign.endsAt).getTime() : NaN;
    return !Number.isNaN(end) && now >= end;
};

// wake subscribers exactly when the next campaign ends, so badges/popups switch off on time.
// JS timers pause in the background; the foreground refresh in _layout covers that case
let endTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_TIMER_MS = 24 * 60 * 60 * 1000;

const scheduleNextEnd = () => {
    if (endTimer) clearTimeout(endTimer);
    endTimer = null;
    const now = Date.now();
    const nextEnd = state.campaigns
        .map((campaign) => (campaign.endsAt ? new Date(campaign.endsAt).getTime() : NaN))
        .filter((end) => !Number.isNaN(end) && end > now)
        .sort((a, b) => a - b)[0];
    if (nextEnd === undefined) return;
    endTimer = setTimeout(() => {
        // new object so useSyncExternalStore re-renders and every check re-reads the clock
        setState({});
        scheduleNextEnd();
    }, Math.min(nextEnd - now + 1000, MAX_TIMER_MS));
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
            scheduleNextEnd();
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

// an ended campaign counts for nobody: no badges, popups, photo warnings
export const isParticipating = (campaign: Campaign, s: CampaignState = state): boolean =>
    !hasCampaignEnded(campaign) && (!campaign.requiresJoin || s.me[campaign.slug]?.joined === true);

export const useCampaigns = () => useSyncExternalStore(subscribe, getCampaignState);
