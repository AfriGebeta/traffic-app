import React from 'react';
import { StyleProp, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { enableNotifications, useNotificationStatus } from '../services/notificationPermission';

// quiet reminder on the inbox, campaigns list and profile; stays while notifications are off, never interrupts
export function NotificationsOffStrip({ style }: { style?: StyleProp<ViewStyle> }) {
    const { t } = useTranslation();
    const { colors: theme } = useTheme();
    const status = useNotificationStatus();

    if (!status || status.enabled) return null;

    return (
        <TouchableOpacity
            onPress={() => void enableNotifications()}
            activeOpacity={0.8}
            className="flex-row items-center rounded-xl px-4 py-3"
            style={[{ backgroundColor: theme.primaryMuted, borderWidth: 1, borderColor: theme.border }, style]}
        >
            <Ionicons name="notifications-off-outline" size={20} color={colors.primary.main} />
            <View className="flex-1 mx-3">
                <Text className="font-semibold" style={{ color: theme.textPrimary }}>
                    {t('notif-strip-title')}
                </Text>
                <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                    {t('notif-strip-body')}
                </Text>
            </View>
            <Text className="font-semibold" style={{ color: colors.primary.main }}>
                {t('notif-turn-on')}
            </Text>
        </TouchableOpacity>
    );
}
