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
