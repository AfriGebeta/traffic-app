import { Platform } from 'react-native';
import * as Device from 'expo-device';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

const deviceModel = [Device.brand, Device.modelName]
    .filter(Boolean)
    .join(' ')
    .trim();

export const CLIENT_HEADERS: Record<string, string> = {
    'X-Platform': Platform.OS,
    ...(deviceModel ? { 'X-Device-Model': deviceModel } : {}),
};

const isApiUrl = (url: string): boolean => {
    if (!API_URL) return false;
    return url.startsWith(API_URL) || url.startsWith('/');
};

let installed = false;

export function installClientHeaders(): void {
    if (installed) return;
    installed = true;

    const originalFetch = global.fetch;

    if (__DEV__) {
        console.log('client headers: installed:', JSON.stringify(CLIENT_HEADERS));
    }

    global.fetch = function patchedFetch(input: any, init?: RequestInit) {
        const url = typeof input === 'string' ? input : input?.url ?? '';

        if (!isApiUrl(url)) {
            return originalFetch(input, init);
        }

        const headers = new Headers(init?.headers ?? (typeof input === 'string' ? undefined : input?.headers));
        Object.entries(CLIENT_HEADERS).forEach(([key, value]) => {
            if (!headers.has(key)) headers.set(key, value);
        });

        if (__DEV__) {
            console.log(
                `client headers: ${init?.method ?? 'GET'} ${url} x-platform=${headers.get('X-Platform')} x-device-model=${headers.get('X-Device-Model')}`
            );
        }

        return originalFetch(input, { ...init, headers });
    } as typeof fetch;
}

installClientHeaders();
