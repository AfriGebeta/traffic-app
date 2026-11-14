import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { apiService } from '../../../shared/services/api';
import { getAccessToken, onSessionStarted } from '../../../shared/services/auth-session';

const PENDING_CODE_KEY = '@referral_pending_code';
const CLAIM_DONE_KEY = '@referral_claim_done';

const REFERRER_TIMEOUT_MS = 5000;
const CODE_PATTERN = /^[a-z0-9]{4,16}$/;

export type ClaimResult = 'claimed' | 'not_found' | 'not_allowed' | 'already_used' | 'failed';

const rlog = (...args: any[]) => console.log('referral', ...args);

export const normalizeCode = (raw: string | null | undefined): string | null => {
    const code = (raw ?? '').trim().toLowerCase();
    return CODE_PATTERN.test(code) ? code : null;
};

export async function getPendingCode(): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(PENDING_CODE_KEY);
    } catch {
        return null;
    }
}

export async function savePendingCode(raw: string): Promise<void> {
    const code = normalizeCode(raw);
    if (!code) {
        rlog('pending code rejected, bad format:', JSON.stringify(raw));
        return;
    }
    try {
        await AsyncStorage.setItem(PENDING_CODE_KEY, code);
        rlog('pending code saved', code);
    } catch (error) {
        rlog('pending code save failed', String(error));
    }
}

async function clearPendingCode(reason: string): Promise<void> {
    try {
        await AsyncStorage.removeItem(PENDING_CODE_KEY);
        rlog('pending code cleared:', reason);
    } catch {
    }
}

async function markClaimDone(): Promise<void> {
    try {
        await AsyncStorage.setItem(CLAIM_DONE_KEY, 'true');
        rlog('claim marked done');
    } catch {
    }
}

export async function isClaimDone(): Promise<boolean> {
    try {
        return (await AsyncStorage.getItem(CLAIM_DONE_KEY)) === 'true';
    } catch {
        return false;
    }
}

export async function captureInstallReferrer(): Promise<string | null> {
    if (Platform.OS !== 'android') {
        rlog('install referrer skipped, platform:', Platform.OS);
        return null;
    }
    try {
        const startedAt = Date.now();
        const raw = await Promise.race([
            Application.getInstallReferrerAsync(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), REFERRER_TIMEOUT_MS)),
        ]);
        rlog(`install referrer (${Date.now() - startedAt}ms):`, raw === null ? 'timed out / empty' : JSON.stringify(raw));
        if (!raw) return null;
        const refParam = new URLSearchParams(raw).get('ref');
        const code = normalizeCode(refParam);
        if (code) {
            await savePendingCode(code);
        } else {
            rlog(refParam ? `install referrer ref invalid: ${JSON.stringify(refParam)}` : 'install referrer has no ref (organic install)');
        }
        return code;
    } catch (error) {
        rlog('install referrer unavailable', String(error));
        return null;
    }
}

export function trackOpen(code: string): void {
    rlog('open: sending', code);
    apiService
        .post(`/api/referrals/${encodeURIComponent(code)}/open`)
        .then((response) =>
            rlog('open:', code, response.error ? `failed ${response.status ?? 'network'}: ${response.error}` : 'ok')
        )
        .catch((error) => rlog('open threw', String(error)));
}

export async function claim(raw: string): Promise<ClaimResult> {
    const code = normalizeCode(raw);
    if (!code) {
        rlog('claim: bad format, not sending:', JSON.stringify(raw));
        return 'not_found';
    }

    rlog('claim: sending', code);
    const response = await apiService.post<{ data?: { stage?: string } }>('/api/referrals/claim', { code });

    if (!response.error) {
        rlog('claim: ok', code, 'stage:', response.data?.data?.stage ?? '?');
        await clearPendingCode('claimed');
        await markClaimDone();
        return 'claimed';
    }

    rlog(`claim: failed ${response.status ?? 'network'}`, code, response.errorCode ?? '', response.error);

    switch (response.status) {
        case 404:
            await clearPendingCode('404 no such code');
            return 'not_found';
        case 403:
            await clearPendingCode('403 not allowed');
            return 'not_allowed';
        case 409:
            await clearPendingCode('409 already used a referral');
            await markClaimDone();
            return 'already_used';
        default:
            // network or server error: keep the code, next sign-in retries
            rlog('claim: keeping pending code for retry');
            return 'failed';
    }
}

let initialized = false;

export function initReferrals(): void {
    if (initialized) return;
    initialized = true;
    rlog('init');
    onSessionStarted(() => {
        rlog('session started, checking pending code');
        void claimPendingIfAny();
    });
    void claimPendingIfAny();
}

let inflightClaim: Promise<void> | null = null;

export function claimPendingIfAny(): Promise<void> {
    if (inflightClaim) return inflightClaim;
    inflightClaim = (async () => {
        try {
            const [code, token] = await Promise.all([getPendingCode(), getAccessToken()]);
            if (!code) {
                rlog('pending claim: no pending code');
                return;
            }
            if (!token) {
                rlog('pending claim: have code', code, 'but not signed in, waiting for login');
                return;
            }
            await claim(code);
        } catch (error) {
            rlog('pending claim threw', String(error));
        } finally {
            inflightClaim = null;
        }
    })();
    return inflightClaim;
}
