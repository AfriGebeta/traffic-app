import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { showToast } from '../../../shared/utils/toast';
import { FONT_MEDIUM, RADIUS, RADIUS_SM, SectionLabel, SkeletonBlock, tint } from '../../campaigns/components/CampaignUi';
import { OfferNotificationSettings, offerMessagesService } from '../services/offerMessages.service';

type Kind = 'nearby' | 'following' | 'savedEnding' | 'weekly';

const KINDS: { key: Kind; title: string; hint: string }[] = [
    { key: 'nearby', title: 'offer-notif-nearby', hint: 'offer-notif-nearby-hint' },
    { key: 'following', title: 'offer-notif-following', hint: 'offer-notif-following-hint' },
    { key: 'savedEnding', title: 'offer-notif-saved', hint: 'offer-notif-saved-hint' },
    { key: 'weekly', title: 'offer-notif-weekly', hint: 'offer-notif-weekly-hint' },
];

export default function OfferNotificationsScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();
    const [settings, setSettings] = useState<OfferNotificationSettings | null>(null);
    const [failed, setFailed] = useState(false);
    const saved = useRef<OfferNotificationSettings | null>(null);
    const queue = useRef<Promise<void>>(Promise.resolve());

    const load = useCallback(async () => {
        setFailed(false);
        try {
            const next = await offerMessagesService.getSettings();
            saved.current = next;
            setSettings(next);
        } catch {
            setFailed(true);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const change = (patch: Partial<OfferNotificationSettings>) => {
        if (!settings) return;
        setSettings({ ...settings, ...patch });
        queue.current = queue.current.then(async () => {
            try {
                const result = await offerMessagesService.saveSettings(patch);
                saved.current = { ...(saved.current ?? settings), ...result };
            } catch {
                showToast(t('could-not-update'));
                if (saved.current) setSettings(saved.current);
            }
        });
    };

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background, paddingTop: insets.top }}>
            <View className="px-4 pt-3 pb-2">
                <TouchableOpacity onPress={() => router.back()} className="self-start p-1 -ml-1" activeOpacity={0.7} hitSlop={8} accessibilityLabel={t('back')}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="mt-3" style={{ color: theme.textPrimary, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 }}>
                    {t('offer-notif-title')}
                </Text>
            </View>

            <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 24 }}>
                {!settings && !failed && (
                    <View style={{ gap: 10 }}>
                        <SkeletonBlock height={240} style={{ borderRadius: RADIUS }} />
                        <SkeletonBlock height={12} width="40%" style={{ marginTop: 12 }} />
                        <SkeletonBlock height={44} style={{ borderRadius: RADIUS }} />
                    </View>
                )}

                {failed && (
                    <View className="items-center mt-10" style={{ gap: 12 }}>
                        <Text className="text-sm text-center" style={{ color: theme.textSecondary }}>{t('offer-notif-load-failed')}</Text>
                        <TouchableOpacity
                            onPress={() => void load()}
                            activeOpacity={0.7}
                            className="px-4 justify-center"
                            style={{ height: 40, borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border }}
                        >
                            <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{t('try-again')}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {settings && (
                    <>
                        <View style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
                            {KINDS.map(({ key, title, hint }, i) => (
                                <View
                                    key={key}
                                    className="flex-row items-center px-4 py-3.5"
                                    style={{ borderTopWidth: i ? 1 : 0, borderTopColor: theme.border }}
                                >
                                    <View className="flex-1 mr-3">
                                        <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 15 }}>{t(title)}</Text>
                                        <Text className="text-xs mt-0.5 leading-4" style={{ color: theme.textSecondary }}>{t(hint)}</Text>
                                    </View>
                                    <Switch
                                        value={!!settings[key]}
                                        onValueChange={(value) => change({ [key]: value })}
                                        trackColor={{ false: theme.border, true: tint(theme.primary, '99') }}
                                        thumbColor={settings[key] ? theme.primary : theme.surface}
                                        accessibilityLabel={t(title)}
                                    />
                                </View>
                            ))}
                        </View>

                        <SectionLabel style={{ marginTop: 24, marginBottom: 8 }}>{t('offer-notif-per-day')}</SectionLabel>
                        <View className="flex-row p-1" style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
                            {([1, 2, 3] as const).map((n) => {
                                const active = settings.perDay === n;
                                return (
                                    <TouchableOpacity
                                        key={n}
                                        onPress={() => !active && change({ perDay: n })}
                                        activeOpacity={0.8}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: active }}
                                        className="flex-1 items-center justify-center"
                                        style={{
                                            height: 36,
                                            borderRadius: RADIUS_SM,
                                            backgroundColor: active ? theme.background : 'transparent',
                                            borderWidth: active ? 1 : 0,
                                            borderColor: theme.border,
                                        }}
                                    >
                                        <Text style={{ color: active ? theme.textPrimary : theme.textSecondary, fontFamily: FONT_MEDIUM, fontSize: 15 }}>{n}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View className="flex-row items-start mt-4">
                            <Ionicons name="moon-outline" size={14} color={theme.textSecondary} style={{ marginTop: 1 }} />
                            <Text className="text-xs ml-1.5 flex-1 leading-4" style={{ color: theme.textSecondary }}>{t('offer-notif-quiet')}</Text>
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}
