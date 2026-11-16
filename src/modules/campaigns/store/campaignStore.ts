import { useSyncExternalStore } from 'react';
import { isAuthenticated } from '../../register/utils/authGate';
import { campaignService } from '../services/campaign.service';
import { Campaign, CampaignMe } from '../types/campaign.types';


export interface CampaignState {
    loaded: boolean;
    loading: boolean;
    campaigns: Campaign[];
    upcoming: Campaign | null | undefined;
    // keyed by slug; missing when signed out or the call failed. Also holds the upcoming campaign's /me
    me: Record<string, CampaignMe>;
}

let state: CampaignState = { loaded: false, loading: false, campaigns: [], upcoming: undefined, me: {} };
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;

const setState = (next: Partial<CampaignState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
};

// ended = phase past live (backend), or endsAt passed before the next refresh says so
export const hasCampaignEnded = (campaign: Campaign, now = Date.now()): boolean => {
    if (campaign.phase && campaign.phase !== 'live') return true;
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

export const isUpcoming = (campaign: Campaign, now = Date.now()): boolean => {
    const start = campaign.startsAt ? new Date(campaign.startsAt).getTime() : NaN;
    return !Number.isNaN(start) && start > now;
};

let startTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleUpcomingStart = () => {
    if (startTimer) clearTimeout(startTimer);
    startTimer = null;
    const start = state.upcoming?.startsAt ? new Date(state.upcoming.startsAt).getTime() : NaN;
    if (Number.isNaN(start) || start <= Date.now()) return;
    startTimer = setTimeout(() => {
        startTimer = null;
        void refreshCampaigns();
    }, Math.min(start - Date.now() + 2000, MAX_TIMER_MS));
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
            const [campaigns, next] = await Promise.all([
                campaignService.getRunning(),
                campaignService.getNext().catch(() => undefined),
            ]);
            // once it starts it comes back from /running; never show it twice
            const upcoming = next && isUpcoming(next) && !campaigns.some((c) => c.slug === next.slug) ? next : next === undefined ? undefined : null;
            const me: Record<string, CampaignMe> = {};
            if (await isAuthenticated()) {
                const all = upcoming ? [...campaigns, upcoming] : campaigns;
                const standings = await Promise.all(all.map((campaign) => campaignService.getMe(campaign.slug).catch(() => null)));
                all.forEach((campaign, i) => {
                    const standing = standings[i];
                    if (standing) me[campaign.slug] = standing;
                });
            }
            setState({ campaigns, upcoming, me, loaded: true });
            scheduleNextEnd();
            scheduleUpcomingStart();
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
