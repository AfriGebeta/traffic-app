import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { userService } from '../services/user.service';
import { AuthResponse, UserLoginRequest } from '../types/user.types';
import { AuthErrorCode, toFriendlyAuthError } from '../utils/authErrors';

const USER_STORAGE_KEY = '@traffic_app_user';
const TOKEN_STORAGE_KEY = '@traffic_app_token';

export interface LoginResult {
    data: AuthResponse | null;
    error: string | null;
    code: AuthErrorCode | null;
    userId?: string | null;
    email?: string | null;
    hasEmail?: boolean;
}

export const useUserLogin = () => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fail = (raw?: string, status?: number, errorBody?: any): LoginResult => {
        const { code, message } = toFriendlyAuthError(t, 'login', raw, status, errorBody);

        if (code === 'EMAIL_NOT_VERIFIED') {
            setError(null);
            return {
                data: null,
                error: message,
                code,
                userId: errorBody?.userId ?? null,
                email: errorBody?.email ?? null,
                hasEmail: errorBody?.hasEmail !== false,
            };
        }

        setError(message);
        return { data: null, error: message, code, userId: null, email: null };
    };

    const login = async (data: UserLoginRequest): Promise<LoginResult> => {
        setLoading(true);
        setError(null);

        try {
            const response = await userService.login(data);

            if (response.error) {
                return fail(response.error, response.status, response.errorBody);
            }

            if (!response.data?.token) {
                return fail(response.message, response.status, response.errorBody);
            }

            const { password, ...userWithoutPassword } = response.data.user;
            await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userWithoutPassword));
            await AsyncStorage.setItem(TOKEN_STORAGE_KEY, response.data.token);

            return {
                data: response.data,
                error: null,
                code: null,
                userId: response.data.user?.id ?? null,
                email: response.data.user?.email ?? null,
            };
        } catch (err) {
            return fail(err instanceof Error ? err.message : undefined);
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
