import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { DIALOG_MAX_STYLE } from '../layout/modalStyles';
import { useCampaignTour } from '../../modules/campaigns/tour/campaignTour';
import { dismissNotificationAsk, enableNotifications, usePendingNotificationAsk } from '../services/notificationPermission';

const BODY_KEY = {
    home: 'notif-ask-body-home',
    contribution: 'notif-ask-body-contribution',
    campaign: 'notif-ask-body-campaign',
} as const;

// our own "turn on notifications" card; Android's dialog only comes after "Turn on", so "Not now" costs nothing.
// waits while a drive is on screen (blocked) or the campaign tour is running
export function NotificationPromptHost({ blocked }: { blocked: boolean }) {
    const { t } = useTranslation();
    const { colors: theme } = useTheme();
    const reason = usePendingNotificationAsk();
    const tourRunning = useCampaignTour().slug !== null;

    if (!reason || blocked || tourRunning) return null;

    const turnOn = () => {
        dismissNotificationAsk();
        void enableNotifications();
    };

    return (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={dismissNotificationAsk}>
            <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                <View className="w-full rounded-2xl p-6 items-center" style={[{ backgroundColor: theme.background }, DIALOG_MAX_STYLE]}>
                    <View className="w-16 h-16 rounded-full items-center justify-center mb-4" style={{ backgroundColor: theme.primaryMuted }}>
                        <Ionicons name="notifications" size={30} color={colors.primary.main} />
                    </View>
                    <Text className="text-xl font-bold text-center" style={{ color: theme.textPrimary }}>
                        {t('notif-ask-title')}
                    </Text>
                    <Text className="text-sm text-center leading-5 mt-2" style={{ color: theme.textSecondary }}>
                        {t(BODY_KEY[reason])}
                    </Text>
                    <TouchableOpacity
                        onPress={turnOn}
                        className="w-full rounded-xl py-3.5 items-center mt-6"
                        style={{ backgroundColor: colors.primary.main }}
                    >
                        <Text className="text-white font-semibold text-base">{t('notif-turn-on')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={dismissNotificationAsk} className="w-full py-3 items-center mt-1">
                        <Text className="font-semibold" style={{ color: theme.textSecondary }}>
                            {t('notif-not-now')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
