import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { userService } from '../services/user.service';
import { AuthResponse, UserRegistrationRequest } from '../types/user.types';
import { resetHomeOnboarding } from '../../places/utils/homeOnboarding';

const USER_STORAGE_KEY = '@traffic_app_user';
const TOKEN_STORAGE_KEY = '@traffic_app_token';

const sanitizeName = (name?: string | null): string =>
    (name || '').replace(/\s+undefined$/i, '').trim();

const sanitizeUser = <T extends { name?: string } | null>(user: T): T =>
    user ? { ...user, name: sanitizeName(user.name) } : user;

export const useUserRegistration = () => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const register = async (data: UserRegistrationRequest): Promise<AuthResponse | null> => {
        setLoading(true);
        setError(null);

        try {
            const response = await userService.register(data);

            if (response.error) {
                let errorMessage = response.error;

                if (errorMessage.toLowerCase().includes('already') ||
                    errorMessage.toLowerCase().includes('exist') ||
                    errorMessage.toLowerCase().includes('duplicate') ||
                    errorMessage.toLowerCase().includes('registered')) {
                    errorMessage = t('user-already-registered') || 'This phone number is already registered. Please login instead.';
                } else if (errorMessage.toLowerCase().includes('invalid')) {
                    errorMessage = t('invalid-phone-or-name') || 'Invalid phone number or name. Please check your details.';
                } else if (errorMessage.toLowerCase().includes('network')) {
                    errorMessage = t('network-error') || 'Network error. Please check your connection.';
                }

                setError(errorMessage);
                setLoading(false);
                throw new Error(errorMessage);
            }

            if (response.data) {

                const { password, ...userWithoutPassword } = response.data.user;
                await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userWithoutPassword));
                await AsyncStorage.setItem(TOKEN_STORAGE_KEY, response.data.token);
                setLoading(false);
                return response.data;
            }

            setLoading(false);
            return null;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : (t('registration-failed') || 'Registration failed');
            setError(errorMessage);
            setLoading(false);
            throw err;
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
