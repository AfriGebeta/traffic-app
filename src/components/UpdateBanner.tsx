import { useEffect, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../shared/theme/ThemeContext';
import { colors as palette } from '../shared/theme/colors';

const DISMISSED_KEY = '@traffic_app_update_banner_dismissed_version';

interface Props {
    visible: boolean;
    latestVersion: string;
    storeUrl: string;
}

export function UpdateBanner({ visible, latestVersion, storeUrl }: Props) {
    const { t } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem(DISMISSED_KEY)
            .then((value) => setDismissedVersion(value))
            .catch(() => undefined)
            .finally(() => setLoaded(true));
    }, []);

    const dismiss = () => {
        setDismissedVersion(latestVersion);
        AsyncStorage.setItem(DISMISSED_KEY, latestVersion).catch(() => undefined);
    };

    if (!visible || !loaded || !latestVersion) return null;
    if (dismissedVersion === latestVersion) return null;

    return (
        <View
            className="absolute left-0 right-0 px-4"
            style={{ top: insets.top + 8 }}
            pointerEvents="box-none"
        >
            <View
                className="flex-row items-center rounded-2xl px-4 py-3"
                style={{
                    backgroundColor: isDark ? theme.surface : '#FFFFFF',
                    shadowColor: '#000',
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 5,
                }}
            >
                <Ionicons name="arrow-up-circle" size={22} color={palette.primary.main} />
                <View className="flex-1 ml-3">
                    <Text className="text-sm font-semibold" style={{ color: theme.textPrimary }}>
                        {t('new-version-available') || 'New version available'}
                    </Text>
                    <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                        {t('update-for-latest-features') || 'Update to get the latest features and fixes'}
                    </Text>
                </View>
                <Pressable
                    className="rounded-xl px-3 py-2 ml-2"
                    style={{ backgroundColor: palette.primary.main }}
                    onPress={() => {
                        dismiss();
                        Linking.openURL(storeUrl).catch(() => undefined);
                    }}
                >
                    <Text className="text-white text-xs font-bold">{t('update') || 'Update'}</Text>
                </Pressable>
                <Pressable className="ml-1 p-1" onPress={dismiss} hitSlop={8}>
                    <Ionicons name="close" size={18} color={theme.textSecondary} />
                </Pressable>
            </View>
        </View>
    );
}
