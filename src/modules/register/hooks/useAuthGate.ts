import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { showToast } from '../../../shared/utils/toast';
import { AUTH_ROUTE, isAuthenticated } from '../utils/authGate';

export const useAuthGate = () => {
    const router = useRouter();
    const { t } = useTranslation();

    const requireAuth = useCallback(
        async (action?: () => void): Promise<boolean> => {
            if (await isAuthenticated()) {
                action?.();
                return true;
            }

            showToast(t('register-or-login-to-continue') || 'Register or login to continue');
            router.push(AUTH_ROUTE as any);
            return false;
        },
        [router, t]
    );

    return { requireAuth };
};
