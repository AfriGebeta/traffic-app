import { apiService } from '../services/api';

const BUCKET_SEGMENT = 'traffic-app';
const CACHE_TTL_MS = 55 * 60 * 1000;

const urlCache = new Map<string, { url: string; expiresAt: number }>();
const pending = new Map<string, Promise<string | null>>();

const isDirectlyLoadable = (value: string): boolean => {
    if (/^(file|content|data):/.test(value)) return true;
    return /^https?:/.test(value) && !value.includes(`/${BUCKET_SEGMENT}/`);
};

const toObjectKey = (value: string): string => {
    if (!/^https?:/.test(value)) return value.replace(/^\/+/, '');

    try {
        const parts = new URL(value).pathname.split('/').filter(Boolean);
        const bucketIndex = parts.indexOf(BUCKET_SEGMENT);
        return bucketIndex === -1 ? parts.join('/') : parts.slice(bucketIndex + 1).join('/');
    } catch {
        return value;
    }
};


export const resolveImageUri = async (value?: string | null): Promise<string | null> => {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    if (isDirectlyLoadable(trimmed)) return trimmed;

    const key = toObjectKey(trimmed);
    if (!key) return null;

    const cached = urlCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.url;
    }

    const inFlight = pending.get(key);
    if (inFlight) return inFlight;

    const request = apiService
        .get<{ url: string }>(`/api/uploads/presigned?key=${encodeURIComponent(key)}`)
        .then((response) => {
            const url = response.data?.url;
            if (!url) return null;

            urlCache.set(key, { url, expiresAt: Date.now() + CACHE_TTL_MS });
            return url;
        })
        .finally(() => {
            pending.delete(key);
        });

    pending.set(key, request);
    return request;
};
