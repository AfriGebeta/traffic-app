import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { RADIUS, SectionLabel } from './CampaignUi';

const UNITS = [
    { key: 'campaign-countdown-days', seconds: 86400 },
    { key: 'campaign-countdown-hours', seconds: 3600 },
    { key: 'campaign-countdown-minutes', seconds: 60 },
    { key: 'campaign-countdown-seconds', seconds: 1 },
] as const;

// same dark tile in both themes; flat, with a hairline border instead of a shadow
const COUNTDOWN_BG = '#26272B';

const secondsUntil = (endMs: number) => Math.max(0, Math.floor((endMs - Date.now()) / 1000));

interface Props {
    endsAt: string;
    // heading above the boxes; defaults to "Ends in"
    label?: string;
    onDone?: () => void;
}

// live time left until endsAt; renders nothing once it's over (the store flips the campaign to ended)
export function CampaignCountdown({ endsAt, label, onDone }: Props) {
    const { t } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const endMs = new Date(endsAt).getTime();
    const [left, setLeft] = useState(() => (Number.isNaN(endMs) ? 0 : secondsUntil(endMs)));
    const onDoneRef = useRef(onDone);
    onDoneRef.current = onDone;

    useEffect(() => {
        if (Number.isNaN(endMs)) return;
        setLeft(secondsUntil(endMs));
        const timer = setInterval(() => {
            const next = secondsUntil(endMs);
            setLeft(next);
            if (next === 0) {
                clearInterval(timer);
                onDoneRef.current?.();
            }
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
            <SectionLabel style={{ marginBottom: 8 }}>{label ?? t('campaign-ends-in')}</SectionLabel>
            <View
                className="flex-row items-center py-4 px-2"
                style={{
                    backgroundColor: COUNTDOWN_BG,
                    borderRadius: RADIUS,
                    borderWidth: 1,
                    borderColor: isDark ? theme.border : COUNTDOWN_BG,
                }}
            >
                {parts.map((part, i) => (
                    <React.Fragment key={part.key}>
                        {i > 0 && <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.15)' }} />}
                        <View className="flex-1 items-center">
                            <Text style={{ color: '#FFFFFF', fontSize: 28, letterSpacing: -0.3, fontVariant: ['tabular-nums'] }}>
                                {String(part.value).padStart(2, '0')}
                            </Text>
                            <Text className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                                {t(part.key)}
                            </Text>
                        </View>
                    </React.Fragment>
                ))}
            </View>
        </View>
    );
}
