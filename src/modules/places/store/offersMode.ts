import { useSyncExternalStore } from 'react';
import { businessService } from '../services/business.service';
import { NearbyOfferPlace } from '../types/business.types';

interface State {
    on: boolean;
    places: NearbyOfferPlace[];
    loaded: boolean;
}

const PIN_RADIUS_M = 3000;
const REFETCH_MS = 5 * 60 * 1000;
const MOVED_M = 1200;

let state: State = { on: false, places: [], loaded: false };
const listeners = new Set<() => void>();
let last: { at: number; lat: number; lng: number } | null = null;
let inFlight = false;
let generation = 0;

const set = (next: Partial<State>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
};

const metresBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const rad = Math.PI / 180;
    const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
    const y = (b.lat - a.lat) * rad;
    return Math.sqrt(x * x + y * y) * 6371000;
};

export const setOffersMode = (on: boolean) => {
    if (state.on === on) return;
    generation += 1;
    last = null;
    inFlight = false;
    set({ on, places: [], loaded: false });
};

export const loadOfferPins = (lat: number, lng: number) => {
    if (!state.on || inFlight) return;
    if (last && Date.now() - last.at < REFETCH_MS && metresBetween(last, { lat, lng }) < MOVED_M) return;
    inFlight = true;
    last = { at: Date.now(), lat, lng };
    const mine = generation;
    businessService
        .nearbyOffers(lat, lng, PIN_RADIUS_M)
        .then((places) => {
            if (mine !== generation) return;
            set({ places: places.filter((p) => p?.id && Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.offers?.length), loaded: true });
        })
        .catch(() => {
            if (mine === generation) set({ loaded: true });
        })
        .finally(() => {
            inFlight = false;
        });
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const useOffersState = () => useSyncExternalStore(subscribe, () => state);
export const useOffersMode = () => useSyncExternalStore(subscribe, () => state.on);
