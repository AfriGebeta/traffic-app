import { useEffect, useState } from 'react';
import { apiService } from '../../../shared/services/api';
import { LocalizedLabel, PlaceCatalog } from '../types/business.types';

let cached: PlaceCatalog | null = null;
let inFlight: Promise<PlaceCatalog | null> | null = null;

//  /api/places/catalog: every dropdown of the business form. One fetch per app run; null when it fails
export const loadPlaceCatalog = (): Promise<PlaceCatalog | null> => {
    if (cached) return Promise.resolve(cached);
    if (inFlight) return inFlight;
    inFlight = apiService
        .get<PlaceCatalog | { data: PlaceCatalog }>('/api/places/catalog')
        .then((response) => {
            const body = response.data as any;
            const catalog: PlaceCatalog | null = body?.businessGroups ? body : body?.data?.businessGroups ? body.data : null;
            if (catalog) cached = catalog;
            return catalog;
        })
        .catch(() => null)
        .finally(() => {
            inFlight = null;
        });
    return inFlight;
};

export const usePlaceCatalog = (): { catalog: PlaceCatalog | null; failed: boolean; retry: () => void } => {
    const [catalog, setCatalog] = useState<PlaceCatalog | null>(cached);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (cached) return;
        let alive = true;
        setFailed(false);
        void loadPlaceCatalog().then((next) => {
            if (!alive) return;
            setCatalog(next);
            setFailed(!next);
        });
        return () => {
            alive = false;
        };
    }, [attempt]);
    return { catalog, failed, retry: () => setAttempt((n) => n + 1) };
};

// label in the app language, falling back to English, then the key
export const pickLabel = (label: LocalizedLabel | string | undefined | null, language: string, fallback = ''): string => {
    if (!label) return fallback;
    if (typeof label === 'string') return label;
    const am = language.toLowerCase().startsWith('am');
    return (am ? label.am || label.en : label.en || label.am) || fallback;
};

export const isActive = (option: { active?: boolean }) => option.active !== false;
