import { useSyncExternalStore } from 'react';
import { hasSeenCampaignTour, markCampaignTourSeen } from '../utils/campaignPrefs';

export type CampaignTourStage = 'map-contribute' | 'contribute-page' | 'map-report' | 'profile-campaigns';

interface CampaignTourState {
    slug: string | null;
    stage: CampaignTourStage | null;
    returning: boolean;
}

let state: CampaignTourState = { slug: null, stage: null, returning: false };
const listeners = new Set<() => void>();

const setState = (next: CampaignTourState) => {
    state = next;
    listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const getCampaignTour = () => state;
export const startCampaignTour = (slug: string) => {
    setState({ slug, stage: 'map-contribute', returning: false });
    void hasSeenCampaignTour().then((seen) => {
        if (seen && state.slug === slug) setState({ ...state, returning: true });
        if (!seen) void markCampaignTourSeen();
    });
};

export const setCampaignTourStage = (stage: CampaignTourStage) => setState({ ...state, stage });

export const endCampaignTour = () => setState({ slug: null, stage: null, returning: false });

export const useCampaignTour = () => useSyncExternalStore(subscribe, getCampaignTour);
