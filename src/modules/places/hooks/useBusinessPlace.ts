import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccessToken } from '../../../shared/services/auth-session';
import { resolveStorageUri } from '../../../shared/utils/storage';
import { businessService } from '../services/business.service';
import { PublicOffer, PublicPlace } from '../types/business.types';

const photosFrontFirst = (place: PublicPlace | null): string[] => {
    const images = (place?.images ?? []).filter(Boolean);
    const frontKeys = (place?.photoTypes ?? []).filter((photo) => photo.type === 'front').map((photo) => photo.key);
    if (!frontKeys.length) return images;
    const isFront = (uri: string) => frontKeys.some((key) => uri.endsWith(key) || uri.includes(`/${key}`));
    return [...images.filter(isFront), ...images.filter((uri) => !isFront(uri))];
};

export interface BusinessPlaceState {
    place: PublicPlace | null;
    offers: PublicOffer[];
    following: boolean | null;
    photos: string[];
    loaded: boolean;
}

const EMPTY: BusinessPlaceState = { place: null, offers: [], following: null, photos: [], loaded: false };

export const featuredOffer = (offers: PublicOffer[]): PublicOffer | null =>
    offers.find((o) => o.type !== 'announce' && o.availableNow) ?? offers.find((o) => o.type !== 'announce') ?? offers[0] ?? null;

export function useBusinessPlace(businessId: string | null | undefined) {
    const [state, setState] = useState<BusinessPlaceState>(EMPTY);
    const currentId = useRef<string | null | undefined>(businessId);

    useEffect(() => {
        currentId.current = businessId;
        setState(EMPTY);
        if (!businessId) return;
        let cancelled = false;
        const stillCurrent = () => !cancelled && currentId.current === businessId;

        void (async () => {
            const [place, offers] = await Promise.all([
                businessService.getPlace(businessId).catch(() => null),
                businessService.placeOffers(businessId).then((data) => data.offers).catch(() => [] as PublicOffer[]),
            ]);
            if (!stillCurrent()) return;
            setState((prev) => ({ ...prev, place, offers, loaded: true }));

            // signed urls are cached for ~55 min in storage.ts, so reopening the card costs nothing
            const stored = photosFrontFirst(place).slice(0, 8);
            if (stored.length) {
                const resolved = await Promise.all(stored.map((uri) => resolveStorageUri(uri).catch(() => null)));
                if (!stillCurrent()) return;
                const photos = resolved.filter((uri): uri is string => !!uri);
                if (photos.length) setState((prev) => ({ ...prev, photos }));
            }

            if (!(await getAccessToken())) return;
            const followed = await businessService.following().catch(() => null);
            if (!stillCurrent() || !followed) return;
            setState((prev) => ({ ...prev, following: followed.some((row) => row.id === businessId) }));
        })();

        return () => {
            cancelled = true;
        };
    }, [businessId]);

    const setFollowing = useCallback(
        async (next: boolean): Promise<boolean> => {
            if (!businessId) return false;
            setState((prev) => ({ ...prev, following: next }));
            try {
                const saved = await businessService.follow(businessId, next);
                if (currentId.current === businessId) setState((prev) => ({ ...prev, following: saved }));
                return true;
            } catch {
                if (currentId.current === businessId) setState((prev) => ({ ...prev, following: !next }));
                return false;
            }
        },
        [businessId]
    );

    return { ...state, setFollowing };
}
