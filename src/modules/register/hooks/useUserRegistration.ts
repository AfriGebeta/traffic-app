import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { userService } from '../services/user.service';
import { AuthResponse, UserRegistrationRequest } from '../types/user.types';
import { resetHomeOnboarding } from '../../places/utils/homeOnboarding';
import { AuthErrorCode, toFriendlyAuthError } from '../utils/authErrors';

const USER_STORAGE_KEY = '@traffic_app_user';
const TOKEN_STORAGE_KEY = '@traffic_app_token';

export interface RegisterResult {
    data: AuthResponse | null;
    error: string | null;
    code: AuthErrorCode | null;
}

const sanitizeName = (name?: string | null): string =>
    (name || '').replace(/\s+undefined$/i, '').trim();

const sanitizeUser = <T extends { name?: string } | null>(user: T): T =>
    user ? { ...user, name: sanitizeName(user.name) } : user;

export const useUserRegistration = () => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fail = (raw?: string, status?: number): RegisterResult => {
        const { code, message } = toFriendlyAuthError(t, 'register', raw, status);
        setError(message);
        return { data: null, error: message, code };
    };

    const register = async (data: UserRegistrationRequest): Promise<RegisterResult> => {
        setLoading(true);
        setError(null);

        try {
            const response = await userService.register(data);

            if (response.error) {
                return fail(response.error, response.status);
            }

            if (!response.data?.token) {
                return fail(response.message, response.status);
            }

            const { password, ...userWithoutPassword } = response.data.user;
            await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userWithoutPassword));
            await AsyncStorage.setItem(TOKEN_STORAGE_KEY, response.data.token);

            return { data: response.data, error: null, code: null };
        } catch (err) {
            return fail(err instanceof Error ? err.message : undefined);
        } finally {
            setLoading(false);
        }
    };

    const getStoredUser = async () => {
        try {
            const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
            return stored ? sanitizeUser(JSON.parse(stored)) : null;
        } catch {
            return null;
        }
    };

    const updateStoredUser = async (updates: Partial<AuthResponse['user']>) => {
        const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
        const current = stored ? JSON.parse(stored) : {};
        const merged = sanitizeUser({ ...current, ...updates });
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(merged));
        return merged;
    };

    const refreshStoredUser = async () => {
        const response = await userService.getProfile();
        const serverUser = response.data;

        if (!serverUser?.id) {
            return getStoredUser();
        }

        const { password, ...updates } = serverUser;

        if (!updates.profileImage) {
            delete updates.profileImage;
        }

        return updateStoredUser(updates);
    };

    const getStoredToken = async (): Promise<string | null> => {
        try {
            return await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
        } catch {
            return null;
        }
    };

    const clearAuth = async (): Promise<void> => {
        await AsyncStorage.multiRemove([USER_STORAGE_KEY, TOKEN_STORAGE_KEY]);
        await resetHomeOnboarding();
    };

    return {
        register,
        getStoredUser,
        updateStoredUser,
        refreshStoredUser,
        getStoredToken,
        clearAuth,
        loading,
        error,
    };
};
