import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { userService } from '../services/user.service';
import { AuthResponse } from '../types/user.types';
import { AuthErrorCode, toFriendlyAuthError } from '../utils/authErrors';

const USER_STORAGE_KEY = '@traffic_app_user';
const TOKEN_STORAGE_KEY = '@traffic_app_token';

export const RESEND_COOLDOWN_SECONDS = 60;

export interface VerifyResult {
    data: AuthResponse | null;
    error: string | null;
    code: AuthErrorCode | null;
}

export interface ResendResult {
    sent: boolean;
    error: string | null;
    code: AuthErrorCode | null;
}

export interface SubmitEmailResult {
    userId: string | null;
    error: string | null;
    code: AuthErrorCode | null;
}

export const useEmailVerification = () => {
    const { t } = useTranslation();
    const [verifying, setVerifying] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const startCooldown = useCallback(() => {
        setCooldown(RESEND_COOLDOWN_SECONDS);

        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
            setCooldown((current) => {
                if (current <= 1) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    intervalRef.current = null;
                    return 0;
                }
                return current - 1;
            });
        }, 1000);
    }, []);

    const verify = useCallback(
        async (userId: string, code: string): Promise<VerifyResult> => {
            setVerifying(true);
            setError(null);

            try {
                const response = await userService.verifyEmail({ userId, code });

                if (response.error || !response.data?.token) {
                    const friendly = toFriendlyAuthError(
                        t,
                        'verify-email',
                        response.error ?? response.message,
                        response.status,
                        response.errorBody
                    );
                    setError(friendly.message);
                    return { data: null, error: friendly.message, code: friendly.code };
                }

                const { password, ...userWithoutPassword } = response.data.user;
                await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userWithoutPassword));
                await AsyncStorage.setItem(TOKEN_STORAGE_KEY, response.data.token);

                return { data: response.data, error: null, code: null };
            } catch (err) {
                const friendly = toFriendlyAuthError(
                    t,
                    'verify-email',
                    err instanceof Error ? err.message : undefined
                );
                setError(friendly.message);
                return { data: null, error: friendly.message, code: friendly.code };
            } finally {
                setVerifying(false);
            }
        },
        [t]
    );

    //for accounts that exist but have no email on file
    const submitEmail = useCallback(
        async (phoneNumber: string, email: string): Promise<SubmitEmailResult> => {
            setResending(true);
            setError(null);

            try {
                const response = await userService.submitEmail({ phoneNumber, email });

                if (response.error || !response.data?.userId) {
                    const friendly = toFriendlyAuthError(
                        t,
                        'verify-email',
                        response.error ?? response.message,
                        response.status,
                        response.errorBody
                    );
                    setError(friendly.message);
                    return { userId: null, error: friendly.message, code: friendly.code };
                }

                startCooldown();
                return { userId: response.data.userId, error: null, code: null };
            } catch (err) {
                const friendly = toFriendlyAuthError(
                    t,
                    'verify-email',
                    err instanceof Error ? err.message : undefined
                );
                setError(friendly.message);
                return { userId: null, error: friendly.message, code: friendly.code };
            } finally {
                setResending(false);
            }
        },
        [startCooldown, t]
    );

    const resend = useCallback(
        async (userId: string): Promise<ResendResult> => {
            if (cooldown > 0) {
                return { sent: false, error: null, code: null };
            }

            setResending(true);
            setError(null);

            try {
                const response = await userService.resendVerification({ userId });

                if (response.error) {
                    const friendly = toFriendlyAuthError(
                        t,
                        'verify-email',
                        response.error,
                        response.status,
                        response.errorBody
                    );
                    setError(friendly.message);
                    return { sent: false, error: friendly.message, code: friendly.code };
                }

                startCooldown();
                return { sent: true, error: null, code: null };
            } catch (err) {
                const friendly = toFriendlyAuthError(
                    t,
                    'verify-email',
                    err instanceof Error ? err.message : undefined
                );
                setError(friendly.message);
                return { sent: false, error: friendly.message, code: friendly.code };
            } finally {
                setResending(false);
            }
        },
        [cooldown, startCooldown, t]
    );

    return {
        verify,
        resend,
        submitEmail,
        startCooldown,
        verifying,
        resending,
        cooldown,
        error,
        setError,
    };
};
