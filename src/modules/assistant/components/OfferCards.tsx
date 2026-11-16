import React, { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { showToast } from '../../../shared/utils/toast';
import { FONT_MEDIUM, RADIUS, RADIUS_SM } from '../../campaigns/components/CampaignUi';
import { useAuthGate } from '../../register/hooks/useAuthGate';
import { businessService } from '../../places/services/business.service';
import { distanceText } from '../../places/hooks/useSignedImages';
import type { AssistantOfferCard } from '../../navigation/types/voice-navigation.types';

const REMIND_SLOTS = ['12:00', '13:00', '17:00', '18:00', '19:00'];
const nextRemindSlot = (): string | null => {
    const now = new Date();
    const soonest = now.getHours() * 60 + now.getMinutes() + 10;
    return (
        REMIND_SLOTS.find((slot) => {
            const [h, m] = slot.split(':').map(Number);
            return h * 60 + m >= soonest;
        }) ?? null
    );
};

export function OfferCards({ offers }: { offers: AssistantOfferCard[] }) {
    const { t } = useTranslation();
    const router = useRouter();
    const { colors: theme } = useTheme();
    const { requireAuth } = useAuthGate();
    const [reminded, setReminded] = useState<Set<string>>(() => new Set());
    const [busy, setBusy] = useState<string | null>(null);
    const slot = nextRemindSlot();

    const open = (card: AssistantOfferCard) =>
        router.push({ pathname: '/places/offer', params: { placeId: card.placeId, offerId: card.offerId, name: card.placeName } } as any);

    const remind = async (card: AssistantOfferCard) => {
        if (!slot || busy) return;
        if (!(await requireAuth())) return;
        setBusy(card.offerId);
        try {
            await businessService.remindOffer(card.placeId, card.offerId, slot);
            setReminded((prev) => new Set(prev).add(card.offerId));
            showToast(t('reminder-set', { time: slot }));
        } catch (e) {
            showToast(e instanceof Error && e.message ? e.message : t('could-not-update'));
        } finally {
            setBusy(null);
        }
    };

    return (
        <View className="self-stretch mb-3" style={{ gap: 8 }}>
            {offers.map((card) => {
                const meta = [card.placeName, distanceText(card.distanceM), card.studentsOnly ? t('students-only') : null].filter(Boolean).join(' · ');
                const done = reminded.has(card.offerId);
                return (
                    <View key={`${card.placeId}-${card.offerId}`} style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background }}>
                        <TouchableOpacity onPress={() => open(card)} activeOpacity={0.7} className="flex-row items-center px-3 pt-3 pb-2.5">
                            <View className="flex-1 mr-2">
                                <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 15 }} numberOfLines={2}>
                                    {card.text}
                                </Text>
                                <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }} numberOfLines={1}>
                                    {meta}
                                </Text>
                                {card.availableNow === false && (
                                    <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>{t('offer-not-now')}</Text>
                                )}
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>
                        {!!slot && (
                            <View className="flex-row px-3 pb-3">
                                <TouchableOpacity
                                    onPress={() => void remind(card)}
                                    disabled={done || busy === card.offerId}
                                    activeOpacity={0.7}
                                    className="flex-row items-center px-3"
                                    style={{ height: 32, borderRadius: RADIUS_SM, borderWidth: 1, borderColor: theme.border, opacity: done ? 0.6 : 1 }}
                                >
                                    {busy === card.offerId ? (
                                        <ActivityIndicator size="small" color={theme.primary} />
                                    ) : (
                                        <>
                                            <Ionicons name={done ? 'checkmark' : 'alarm-outline'} size={14} color={theme.textPrimary} />
                                            <Text className="ml-1.5" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 13 }}>
                                                {done ? t('reminder-set', { time: slot }) : t('remind-me-at', { time: slot })}
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                );
            })}
        </View>
    );
}
