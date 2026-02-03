import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { userService } from '../services/user.service';
import { AuthResponse, UserRegistrationRequest } from '../types/user.types';

const USER_STORAGE_KEY = '@traffic_app_user';
const TOKEN_STORAGE_KEY = '@traffic_app_token';

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
                await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.data.user));
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
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
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
    };

    return {
        register,
        getStoredUser,
        getStoredToken,
        clearAuth,
        loading,
        error,
    };
};
