import { Linking, Platform } from 'react-native';

const TELEGRAM_SCHEMES = ['tg://', 'telegram://', 'intent://'];

export function isTelegramAppUrl(url: string): boolean {
    return TELEGRAM_SCHEMES.some((scheme) => url.startsWith(scheme));
}

export function isExternalAuthUrl(url: string): boolean {
    return isTelegramAppUrl(url) || url.startsWith('trafficapp://');
}

export function isHttpUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
}

function extractIntentFallbackUrl(url: string): string | null {
    const match = url.match(/S\.browser_fallback_url=([^;]+)/i);
    if (!match?.[1]) {
        return null;
    }

    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

function extractIntentSchemeUrl(url: string): string | null {
    if (!url.startsWith('intent://')) {
        return null;
    }

    const schemeMatch = url.match(/[#;]scheme=([^;&#]+)/i);
    if (!schemeMatch?.[1]) {
        return null;
    }

    const intentIndex = url.indexOf('#Intent');
    const intentPath =
        intentIndex === -1
            ? url.slice('intent:'.length)
            : url.slice('intent:'.length, intentIndex);

    return `${schemeMatch[1]}:${intentPath}`;
}

export async function openExternalAppUrl(url: string): Promise<boolean> {
    const candidates = [url];

    if (Platform.OS === 'android' && url.startsWith('intent://')) {
        const schemeUrl = extractIntentSchemeUrl(url);
        const fallbackUrl = extractIntentFallbackUrl(url);

        if (schemeUrl) {
            candidates.unshift(schemeUrl);
        }

        if (fallbackUrl) {
            candidates.push(fallbackUrl);
        }
    }

    for (const candidate of candidates) {
        try {
            await Linking.openURL(candidate);
            return true;
        } catch (error) {
            console.warn('Failed to open external URL:', candidate, error);
        }
    }

    return false;
}
