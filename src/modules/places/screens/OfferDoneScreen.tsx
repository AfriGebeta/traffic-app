import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { showToast } from '../../../shared/utils/toast';
import { FONT_MEDIUM, RADIUS, RADIUS_SM } from '../../campaigns/components/CampaignUi';
import { businessService } from '../services/business.service';
import { useBusinessPlace } from '../hooks/useBusinessPlace';
import { LoyaltyVisit } from '../types/business.types';

const str = (value: unknown) => (typeof value === 'string' ? value : '');

type Feedback = 'none' | 'reporting' | 'sent';

export default function OfferDoneScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();
    const params = useLocalSearchParams();
    const placeId = str(params.placeId);
    const placeName = str(params.placeName);
    const code = str(params.code);
    const loyalty = (() => {
        try {
            return params.loyalty ? (JSON.parse(str(params.loyalty)) as LoyaltyVisit) : null;
        } catch {
            return null;
        }
    })();
    const business = useBusinessPlace(placeId || null);
    const [feedback, setFeedback] = useState<Feedback>('none');
    const [note, setNote] = useState('');
    const [sending, setSending] = useState(false);

    const send = async (given: boolean) => {
        if (!code || sending) return;
        setSending(true);
        try {
            await businessService.redemptionFeedback(placeId, code, given, given ? undefined : note);
            setFeedback('sent');
        } catch {
            showToast(t('could-not-send'));
        } finally {
            setSending(false);
        }
    };

    const follow = async () => {
        const ok = await business.setFollowing(true);
        showToast(ok ? t('following-place', { name: placeName }) : t('could-not-update'));
    };

    const secondary = { height: 44, borderRadius: RADIUS_SM, borderWidth: 1, borderColor: theme.border } as const;

    return (
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ backgroundColor: theme.background }}>
            <ScrollView
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, gap: 12 }}
                keyboardShouldPersistTaps="handled"
            >
                <View className="items-center justify-center" style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.greenMuted }}>
                    <Ionicons name="checkmark" size={36} color={theme.green} />
                </View>
                <Text style={{ color: theme.textPrimary, fontSize: 26 }}>{t('offer-done-title')}</Text>
                <Text className="text-sm text-center" style={{ color: theme.textSecondary }}>{t('offer-used-at', { name: placeName })}</Text>
                {!!loyalty && (
                    <Text className="text-sm text-center" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>
                        {loyalty.isReward ? t('loyalty-reward-now', { reward: loyalty.reward }) : t('loyalty-visit', { visit: loyalty.visit, every: loyalty.every })}
                    </Text>
                )}

                {!!code && feedback !== 'sent' && (
                    <View className="w-full items-center gap-3 mt-4" style={{ maxWidth: 420 }}>
                        <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 15 }}>{t('offer-given-question')}</Text>
                        {feedback === 'none' ? (
                            <View className="flex-row gap-3 w-full">
                                <TouchableOpacity onPress={() => void send(true)} disabled={sending} activeOpacity={0.7} className="flex-1 items-center justify-center" style={secondary}>
                                    <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{t('yes')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setFeedback('reporting')} disabled={sending} activeOpacity={0.7} className="flex-1 items-center justify-center" style={secondary}>
                                    <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{t('offer-not-given')}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View className="w-full gap-2">
                                <TextInput
                                    value={note}
                                    onChangeText={setNote}
                                    placeholder={t('offer-report-placeholder')}
                                    placeholderTextColor={theme.textSecondary}
                                    multiline
                                    maxLength={300}
                                    style={{ minHeight: 80, borderRadius: RADIUS_SM, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, color: theme.textPrimary, padding: 12, fontSize: 15, textAlignVertical: 'top' }}
                                />
                                <TouchableOpacity
                                    onPress={() => void send(false)}
                                    disabled={sending}
                                    activeOpacity={0.8}
                                    className="items-center justify-center"
                                    style={{ height: 44, borderRadius: RADIUS_SM, backgroundColor: theme.primary, opacity: sending ? 0.6 : 1 }}
                                >
                                    {sending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontFamily: FONT_MEDIUM }}>{t('send-report')}</Text>}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
                {feedback === 'sent' && <Text className="text-sm mt-4" style={{ color: theme.textSecondary }}>{t('thanks-for-telling-us')}</Text>}

                {business.following === false && (
                    <TouchableOpacity
                        onPress={() => void follow()}
                        activeOpacity={0.7}
                        className="flex-row items-center justify-center px-4 mt-2"
                        style={{ minHeight: 44, borderRadius: RADIUS_SM, borderWidth: 1, borderColor: theme.border, maxWidth: 420, width: '100%' }}
                    >
                        <Ionicons name="notifications-outline" size={16} color={theme.textPrimary} />
                        <Text className="ml-2 flex-shrink" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{t('follow-for-next-offer', { name: placeName })}</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    onPress={() => router.dismissTo('/')}
                    activeOpacity={0.8}
                    className="items-center justify-center mt-2"
                    style={{ height: 48, borderRadius: RADIUS, backgroundColor: theme.primary, maxWidth: 420, width: '100%' }}
                >
                    <Text style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 15 }}>{t('back-to-map')}</Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
