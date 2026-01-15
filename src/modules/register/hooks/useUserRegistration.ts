import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userService } from '../services/user.service';
import { AuthResponse, UserRegistrationRequest } from '../types/user.types';

const USER_STORAGE_KEY = '@traffic_app_user';
const TOKEN_STORAGE_KEY = '@traffic_app_token';

export const useUserRegistration = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const register = async (data: UserRegistrationRequest): Promise<AuthResponse | null> => {
        setLoading(true);
        setError(null);

        try {
            const response = await userService.register(data);

            if (response.error) {
                setError(response.error);
                return null;
            }

            if (response.data) {
                await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.data.user));
                await AsyncStorage.setItem(TOKEN_STORAGE_KEY, response.data.token);
                return response.data;
            }

            return null;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Registration failed';
            setError(errorMessage);
            return null;
        } finally {
            setLoading(false);
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
