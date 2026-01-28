import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userService } from '../services/user.service';
import { AuthResponse, UserLoginRequest } from '../types/user.types';

const USER_STORAGE_KEY = '@traffic_app_user';
const TOKEN_STORAGE_KEY = '@traffic_app_token';

export const useUserLogin = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const login = async (data: UserLoginRequest): Promise<AuthResponse | null> => {
        setLoading(true);
        setError(null);

        try {
            const response = await userService.login(data);

            if (response.error) {
                let errorMessage = response.error;

                if (errorMessage.toLowerCase().includes('not found') ||
                    errorMessage.toLowerCase().includes('does not exist')) {
                    errorMessage = 'User not found. Please register first.';
                } else if (errorMessage.toLowerCase().includes('invalid')) {
                    errorMessage = 'Invalid credentials. Please check your details.';
                } else if (errorMessage.toLowerCase().includes('network')) {
                    errorMessage = 'Network error. Please check your connection.';
                }

                setError(errorMessage);
                return null;
            }

            if (response.data) {
                await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.data.user));
                await AsyncStorage.setItem(TOKEN_STORAGE_KEY, response.data.token);
                return response.data;
            }

            return null;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Login failed';
            setError(errorMessage);
            return null;
        } finally {
            setLoading(false);
        }
    };

    return {
        login,
        loading,
        error,
    };
};
