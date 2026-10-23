import type { ApiResponse } from '../services/api';

export enum ApiErrorCode {
    DuplicatePlace = 'E0016',
    UserRestricted = 'E0017',
    PhotoLocationMismatch = 'E0018',
    CampaignRulesNotMet = 'E0019',
    CampaignNotOpen = 'E0020',
    CampaignAlreadyJoined = 'E0021',
}

export interface UserRestriction {
    scope?: string;
    reason?: string;
    expiresAt?: string | null;
}

export const hasErrorCode = (response: Pick<ApiResponse<unknown>, 'errorCode'>, code: ApiErrorCode): boolean =>
    response.errorCode === code;

export const getRestriction = (response: ApiResponse<unknown>): UserRestriction | null =>
    hasErrorCode(response, ApiErrorCode.UserRestricted) ? (response.errorAdditional ?? {}) : null;

const restrictedListeners = new Set<(restriction: UserRestriction) => void>();

// any signed-in call can return E0017; the app shell shows it once, globally
export const onUserRestricted = (listener: (restriction: UserRestriction) => void) => {
    restrictedListeners.add(listener);
    return () => {
        restrictedListeners.delete(listener);
    };
};

export const notifyIfRestricted = <T>(response: ApiResponse<T>): ApiResponse<T> => {
    const restriction = getRestriction(response);
    if (restriction) restrictedListeners.forEach((listener) => listener(restriction));
    return response;
};

// place names come back as { en, am }, either side can be ""
const pickLocalizedName = (name: unknown, language: string): string | undefined => {
    if (typeof name === 'string') return name;
    if (!name || typeof name !== 'object') return undefined;
    const names = name as Record<string, unknown>;
    const preferred = language.startsWith('am') ? ['am', 'en'] : ['en', 'am'];
    return preferred.map((key) => names[key]).find((value): value is string => typeof value === 'string' && value.trim().length > 0);
};

// E0016 additional.duplicates: [{ id, type, name: { en, am }, lat, lng, distanceM, similarity }]
export const getDuplicatePlaceNames = (additional: Record<string, any> | undefined, language: string): string[] => {
    const duplicates = Array.isArray(additional?.duplicates) ? additional.duplicates : [];
    return duplicates
        .map((place: any) => pickLocalizedName(place?.name, language))
        .filter((name: string | undefined): name is string => !!name);
};

// E0019 additional.failed: [{ detail }] — each rule the contribution missed
export const getCampaignFailures = (additional?: Record<string, any>): string[] =>
    (Array.isArray(additional?.failed) ? additional.failed : [])
        .map((failure: any) => failure?.detail)
        .filter((detail: unknown): detail is string => typeof detail === 'string' && detail.trim().length > 0);

export const isRestrictedError = (code?: string): boolean => code === ApiErrorCode.UserRestricted;

// lets services that throw keep the backend code for callers
export class ApiError extends Error {
    status?: number;
    code?: string;
    additional?: Record<string, any>;

    constructor(response: ApiResponse<unknown>, fallback = 'Request failed') {
        super(response.error || fallback);
        this.name = 'ApiError';
        this.status = response.status;
        this.code = response.errorCode;
        this.additional = response.errorAdditional;
    }
}
