import { useEffect, useState } from 'react';
import { resolveStorageUri } from '../../../shared/utils/storage';

export function useSignedImages(uris: (string | null | undefined)[]): Record<string, string> {
    const [images, setImages] = useState<Record<string, string>>({});
    const wanted = Array.from(new Set(uris.filter((u): u is string => !!u)));
    const key = wanted.join('|');
    useEffect(() => {
        if (!wanted.length) return;
        let cancelled = false;
        void Promise.all(wanted.map(async (uri) => [uri, await resolveStorageUri(uri).catch(() => null)] as const)).then((pairs) => {
            if (cancelled) return;
            setImages(Object.fromEntries(pairs.filter((pair): pair is readonly [string, string] => !!pair[1])));
        });
        return () => {
            cancelled = true;
        };
    }, [key]);
    return images;
}

export const distanceText = (metres: number | null | undefined): string => {
    if (metres == null || !Number.isFinite(metres) || metres < 0) return '';
    if (metres < 1000) return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
    const km = metres / 1000;
    return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
};
