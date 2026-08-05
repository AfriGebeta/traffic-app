import AsyncStorage from '@react-native-async-storage/async-storage';
import { userService } from '../services/user.service';
import type { User } from '../types/user.types';
import { getPostAuthRoute } from '../../places/utils/homeOnboarding';

const USER_STORAGE_KEY = '@traffic_app_user';

export const COMPLETE_PROFILE_ROUTE = '/complete-profile';

export interface MissingProfileFields {
    phone: boolean;
    sex: boolean;
}

const plog = (...args: any[]) => console.log('profile gate', ...args);

export function hasPhoneNumber(user?: Partial<User> | null): boolean {
    const phone = (user?.phoneNumber || '').trim();
    return /^\+?\d{9,15}$/.test(phone);
}

export function hasSex(user?: Partial<User> | null): boolean {
    return user?.sex === 0 || user?.sex === 1;
}

export function getMissingProfileFields(user?: Partial<User> | null): MissingProfileFields {
    return {
        phone: !hasPhoneNumber(user),
        sex: !hasSex(user),
    };
}

export function isProfileComplete(fields: MissingProfileFields): boolean {
    return !fields.phone && !fields.sex;
}

function unwrapUser(payload: unknown): Partial<User> | null {
    if (!payload || typeof payload !== 'object') return null;
    const candidate = payload as any;
    return (candidate.user && typeof candidate.user === 'object' ? candidate.user : candidate) as Partial<User>;
}

export async function getStoredUser(): Promise<Partial<User> | null> {
    try {
        const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

async function mergeStoredUser(updates: Partial<User>): Promise<void> {
    try {
        const current = (await getStoredUser()) || {};
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ ...current, ...updates }));
    } catch {
    }
}

export async function resolveProfileGateRoute(): Promise<string | null> {
    const stored = await getStoredUser();

    if (!stored?.id) {
        return null;
    }

    const missing = getMissingProfileFields(stored);
    if (isProfileComplete(missing)) {
        return null;
    }

    plog('stored profile incomplete', { missing, rawPhone: stored.phoneNumber ?? null, rawSex: stored.sex ?? null });

    try {
        const response = await userService.getProfile();
        const serverUser = unwrapUser(response.data);
        plog('profile check', {
            error: response.error ?? null,
            serverPhone: serverUser?.phoneNumber ?? null,
            serverSex: serverUser?.sex ?? null,
        });

        if (serverUser) {
            const patch: Partial<User> = {};
            if (missing.phone && hasPhoneNumber(serverUser)) patch.phoneNumber = serverUser.phoneNumber;
            if (missing.sex && hasSex(serverUser)) patch.sex = serverUser.sex;

            if (Object.keys(patch).length > 0) {
                plog('syncing fields already set on the server', patch);
                await mergeStoredUser(patch);
            }

            if (isProfileComplete(getMissingProfileFields({ ...stored, ...patch }))) {
                return null;
            }
        }
    } catch (error) {
        plog('profile check failed, falling back to stored user:', String(error));
    }

    plog('routing to complete-profile');
    return COMPLETE_PROFILE_ROUTE;
}

export async function resolveAfterAuthRoute(): Promise<string> {
    const gateRoute = await resolveProfileGateRoute();
    return gateRoute ?? (await getPostAuthRoute());
}

export async function storeProfileUpdates(updates: Partial<User>): Promise<void> {
    await mergeStoredUser(updates);
}

export async function getStoredUserId(): Promise<string | null> {
    const stored = await getStoredUser();
    return stored?.id || null;
}
