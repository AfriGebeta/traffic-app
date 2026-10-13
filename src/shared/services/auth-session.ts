import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getAppCheckToken } from '../utils/appCheck';
import { CLIENT_HEADERS } from '../utils/clientHeaders';
import { logBreadcrumb } from '../utils/crashlytics';

const API_URL = process.env.EXPO_PUBLIC_API_URL!;
const REFRESH_PATH = '/api/users/refresh';

const ACCESS_TOKEN_KEY = '@traffic_app_token';
const USER_STORAGE_KEY = '@traffic_app_user';
const REFRESH_TOKEN_KEY = 'traffic_app_refresh_token';

const UNAUTHENTICATED_PATHS = [
    '/api/users/login',
    '/api/users/telegram/login',
    '/api/users/apple/login',
    '/api/users/verify-email',
    '/api/users/register',
    REFRESH_PATH,
];

export interface SessionTokens {
    token?: string;
    accessToken?: string;
    refreshToken?: string;
}

let accessTokenCache: string | null | undefined;
let refreshTokenCache: string | null | undefined;
let sessionEpoch = 0;
let inflightRefresh: Promise<string | null> | null = null;

const expiredListeners = new Set<() => void>();

const preview = (token: string | null | undefined): string =>
    token ? `…${token.slice(-6)}` : 'none';

const secondsUntilExpiry = (jwt: string): number | null => {
    try {
        const payload = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const { exp } = JSON.parse(atob(payload));
        return typeof exp === 'number' ? Math.round(exp - Date.now() / 1000) : null;
    } catch {
        return null;
    }
};

const pathOf = (url: string): string =>
    (url.startsWith(API_URL) ? url.slice(API_URL.length) : url).split('?')[0];

const log = (message: string, breadcrumb = false) => {
    console.log(`[AuthSession] ${message}`);
    if (breadcrumb) logBreadcrumb(`auth: ${message}`);
};

export const onSessionExpired = (listener: () => void) => {
    expiredListeners.add(listener);
    return () => {
        expiredListeners.delete(listener);
    };
};

export async function getAccessToken(): Promise<string | null> {
    if (accessTokenCache === undefined) {
        try {
            accessTokenCache = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
        } catch {
            return null;
        }
    }
    return accessTokenCache;
}

async function getRefreshToken(): Promise<string | null> {
    if (refreshTokenCache === undefined) {
        try {
            refreshTokenCache = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        } catch {
            return null;
        }
    }
    return refreshTokenCache;
}

async function writeTokens(tokens: SessionTokens): Promise<void> {
    const accessToken = tokens.accessToken ?? tokens.token;
    if (!accessToken) return;

    accessTokenCache = accessToken;
    refreshTokenCache = tokens.refreshToken ?? null;

    log(
        `tokens saved access=${preview(accessToken)} ` +
            `(expires in ${secondsUntilExpiry(accessToken) ?? '?'}s) refresh=${preview(tokens.refreshToken)}`,
        true
    );

    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (tokens.refreshToken) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
    } else {
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined);
    }
}

export async function saveSession(tokens: SessionTokens): Promise<void> {
    sessionEpoch++;
    await writeTokens(tokens);
}

export async function clearSession(): Promise<void> {
    log('session cleared', true);
    sessionEpoch++;
    accessTokenCache = null;
    refreshTokenCache = null;
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, USER_STORAGE_KEY]).catch(() => undefined);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined);
}

async function expireSession(): Promise<void> {
    log('session expired, sending user to login', true);
    await clearSession();
    expiredListeners.forEach((listener) => listener());
}

async function doRefresh(): Promise<string | null> {
    const epoch = sessionEpoch;
    const refreshToken = await getRefreshToken();

    if (!refreshToken) {
        log('refresh skipped: no refresh token stored (legacy session)', true);
        await expireSession();
        return null;
    }

    log(`refresh start refresh=${preview(refreshToken)}`, true);
    const startedAt = Date.now();

    let response: Response;
    try {
        const appCheckToken = await getAppCheckToken();
        response = await fetch(`${API_URL}${REFRESH_PATH}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...CLIENT_HEADERS,
                ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
            },
            body: JSON.stringify({ refreshToken }),
        });
    } catch (error) {
        log(`refresh network error, keeping session: ${error instanceof Error ? error.message : error}`, true);
        return null;
    }

    const took = `${Date.now() - startedAt}ms`;

    if (epoch !== sessionEpoch) {
        log(`refresh result ignored: session changed while in flight (${response.status}, ${took})`, true);
        return getAccessToken();
    }

    if (response.status === 401) {
        log(`refresh rejected 401 (${took})`, true);
        await expireSession();
        return null;
    }

    if (!response.ok) {
        log(`refresh failed ${response.status}, keeping session (${took})`, true);
        return null;
    }

    try {
        const data = (await response.json()) as SessionTokens;
        if (epoch !== sessionEpoch) return getAccessToken();
        log(`refresh ok (${took})`, true);
        await writeTokens(data);
        return accessTokenCache ?? null;
    } catch (error) {
        log(`refresh response unreadable: ${error instanceof Error ? error.message : error}`, true);
        return null;
    }
}

export function refreshSession(): Promise<string | null> {
    if (inflightRefresh) {
        log('refresh already in flight, waiting on it');
    } else {
        inflightRefresh = doRefresh().finally(() => {
            inflightRefresh = null;
        });
    }
    return inflightRefresh;
}

const isUnauthenticatedEndpoint = (url: string): boolean =>
    UNAUTHENTICATED_PATHS.includes(pathOf(url));

const withAuthorization = (init: RequestInit, accessToken: string | null): RequestInit => ({
    ...init,
    headers: {
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        ...(init.headers as Record<string, string> | undefined),
    },
});

export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const sentToken = await getAccessToken();
    const response = await fetch(url, withAuthorization(init, sentToken));

    if (response.status !== 401 || !sentToken || isUnauthenticatedEndpoint(url)) {
        return response;
    }

    const path = pathOf(url);
    log(`401 on ${path} with access=${preview(sentToken)}`);

    const current = await getAccessToken();
    let freshToken: string | null;
    if (current && current !== sentToken) {
        log(`${path}: token already rotated to ${preview(current)}, retrying without refresh`);
        freshToken = current;
    } else {
        freshToken = await refreshSession();
    }

    if (!freshToken) {
        log(`${path}: no fresh token, giving up with 401`);
        return response;
    }

    const retried = await fetch(url, withAuthorization(init, freshToken));
    log(`${path}: retry -> ${retried.status}`);
    return retried;
}

if (__DEV__) {
    const profileUrl = `${API_URL}/api/users/profile`;
    (globalThis as any).authDebug = {
        async status() {
            const access = await getAccessToken();
            const refresh = await getRefreshToken();
            log(
                `status access=${preview(access)} (expires in ${access ? secondsUntilExpiry(access) ?? '?' : '-'}s) ` +
                    `refresh=${preview(refresh)}`
            );
        },
        async breakAccessToken() {
            accessTokenCache = 'invalid.access.token';
            await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessTokenCache);
            log('access token replaced with an invalid one');
        },
        async breakRefreshToken() {
            refreshTokenCache = 'invalid-refresh-token';
            await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshTokenCache);
            log('refresh token replaced with an invalid one');
        },
        async burst(n = 5) {
            const appCheckToken = await getAppCheckToken();
            const headers = {
                ...CLIENT_HEADERS,
                ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
            };
            const statuses = await Promise.all(
                Array.from({ length: n }, () => authFetch(profileUrl, { headers }).then((r) => r.status))
            );
            log(`burst x${n} -> ${statuses.join(', ')}`);
        },
    };
}
