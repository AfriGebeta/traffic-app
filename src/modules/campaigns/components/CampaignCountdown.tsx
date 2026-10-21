import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';

const UNITS = [
    { key: 'campaign-countdown-days', seconds: 86400 },
    { key: 'campaign-countdown-hours', seconds: 3600 },
    { key: 'campaign-countdown-minutes', seconds: 60 },
    { key: 'campaign-countdown-seconds', seconds: 1 },
] as const;

// same dark card in both themes; dark mode adds a border so it doesn't melt into the background
const COUNTDOWN_BG = '#26272B';

const secondsUntil = (endMs: number) => Math.max(0, Math.floor((endMs - Date.now()) / 1000));

// live time left until endsAt; renders nothing once it's over (the store flips the campaign to ended)
export function CampaignCountdown({ endsAt }: { endsAt: string }) {
    const { t } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const endMs = new Date(endsAt).getTime();
    const [left, setLeft] = useState(() => (Number.isNaN(endMs) ? 0 : secondsUntil(endMs)));

    useEffect(() => {
        if (Number.isNaN(endMs)) return;
        setLeft(secondsUntil(endMs));
        const timer = setInterval(() => {
            const next = secondsUntil(endMs);
            setLeft(next);
            if (next === 0) clearInterval(timer);
        }, 1000);
        return () => clearInterval(timer);
    }, [endMs]);

    if (left === 0) return null;

    let rest = left;
    const parts = UNITS.map((unit) => {
        const value = Math.floor(rest / unit.seconds);
        rest -= value * unit.seconds;
        return { key: unit.key, value };
    });

    return (
        <View className="mb-6">
            <Text className="font-bold text-base mb-3" style={{ color: theme.textPrimary }}>
                {t('campaign-ends-in')}
            </Text>
            <View
                className="flex-row items-center rounded-3xl py-4 px-2"
                style={{
                    backgroundColor: COUNTDOWN_BG,
                    borderWidth: isDark ? 1 : 0,
                    borderColor: theme.border,
                    shadowColor: '#000',
                    shadowOpacity: 0.15,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 4,
                }}
            >
                {parts.map((part, i) => (
                    <React.Fragment key={part.key}>
                        {i > 0 && <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.15)' }} />}
                        <View className="flex-1 items-center">
                            <Text style={{ color: '#FFFFFF', fontSize: 30, fontVariant: ['tabular-nums'] }}>
                                {String(part.value).padStart(2, '0')}
                            </Text>
                            <Text className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                                {t(part.key)}
                            </Text>
                        </View>
                    </React.Fragment>
                ))}
            </View>
        </View>
    );
}
