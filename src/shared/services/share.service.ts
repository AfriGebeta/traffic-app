import { apiService, type ApiResponse } from './api';
import type { SharedLocation } from '../utils/deepLinking';

export type ShareKind = 'place' | 'route_dest' | 'route' | 'sos';
export type ShareRouteMode = 'driving' | 'walking';

export interface SharePoint {
    lat: number;
    lng: number;
    name?: string | null;
}

export interface ShareRouteExtras {
    origin?: SharePoint;
    waypoints?: SharePoint[];
    mode?: ShareRouteMode;
}

export interface ShareUser {
    id: string;
    name: string;
    avatarUrl: string | null;
}

export interface CreateShareResponse {
    code: string;
    url: string;
    expiresAt: string | null;
    createdAt: string;
}

export interface ResolvedShare {
    code: string;
    kind: ShareKind;
    location: {
        lat: number;
        lng: number;
        name?: string | null;
        city?: string | null;
        country?: string | null;
        type?: string | null;
    };
    origin?: SharePoint | null;
    waypoints?: SharePoint[] | null;
    mode?: ShareRouteMode | null;
    sender?: ShareUser | null;
    recipient?: ShareUser | null;
    createdAt: string;
    expiresAt: string | null;
}

const CREATE_TIMEOUT_MS = 4000;
const RESOLVE_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<ApiResponse<T>>, ms: number): Promise<ApiResponse<T>> {
    return Promise.race([
        promise,
        new Promise<ApiResponse<T>>((resolve) =>
            setTimeout(() => resolve({ error: 'timeout' }), ms)
        ),
    ]);
}

async function logged<T>(label: string, request: unknown, call: Promise<ApiResponse<T>>): Promise<ApiResponse<T>> {
    // const startedAt = Date.now();
    // console.log(`[share] ${label} request`, JSON.stringify(request));
    const response = await call;
    // const ms = Date.now() - startedAt;
    // if (response.data) {
    //     console.log(`[share] ${label} response (${ms}ms)`, JSON.stringify(response.data));
    // } else {
    //     console.warn(`[share] ${label} failed (${ms}ms)`, response.status ?? '-', response.error, JSON.stringify(response.errorBody ?? null));
    // }
    return response;
}

export const shareService = {
    create(location: SharedLocation, kind: ShareKind, extras: ShareRouteExtras = {}): Promise<ApiResponse<CreateShareResponse>> {
        const body = {
            lat: location.lat,
            lng: location.lng,
            name: location.name,
            city: location.city,
            country: location.country,
            type: location.type,
            kind,
            ...extras,
        };
        return logged(
            'POST /api/shares',
            body,
            withTimeout(apiService.post<CreateShareResponse>('/api/shares', body), CREATE_TIMEOUT_MS)
        );
    },

    resolve(code: string): Promise<ApiResponse<ResolvedShare>> {
        const endpoint = `/api/shares/${encodeURIComponent(code)}`;
        return logged(
            `GET ${endpoint}`,
            { code },
            withTimeout(apiService.get<ResolvedShare>(endpoint), RESOLVE_TIMEOUT_MS)
        );
    },
};
