import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { showToast } from '../../../shared/utils/toast';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { AUTH_ROUTE, isAuthenticated } from '../utils/authGate';

export function withAuthGuard<P extends object>(Screen: React.ComponentType<P>) {
    const Guarded: React.FC<P> = (props) => {
        const router = useRouter();
        const { t } = useTranslation();
        const { colors: theme } = useTheme();
        const [allowed, setAllowed] = useState<boolean | null>(null);

        useEffect(() => {
            let cancelled = false;

            isAuthenticated().then((authed) => {
                if (cancelled) return;
                setAllowed(authed);

                if (!authed) {
                    showToast(t('register-or-login-to-continue') || 'Register or login to continue');
                    router.replace(AUTH_ROUTE as any);
                }
            });

            return () => {
                cancelled = true;
            };
        }, [router, t]);

        if (allowed !== true) {
            return (
                <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
                    {allowed === null ? <ActivityIndicator size="large" color={theme.primary} /> : null}
                </View>
            );
        }

        return <Screen {...props} />;
    };

    Guarded.displayName = `withAuthGuard(${Screen.displayName || Screen.name || 'Screen'})`;

    return Guarded;
}
