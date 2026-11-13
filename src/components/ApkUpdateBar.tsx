import { Modal, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../shared/theme/ThemeContext';
import { colors as palette } from '../shared/theme/colors';
import { useApkUpdate } from '../shared/hooks/useApkUpdate';

/**
 * In-app updater for the sideloaded APK build only (see IS_APK_BUILD). The Play
 * Store build uses UpdateBanner / ForceUpdateModal instead and never mounts this.
 */
export function ApkUpdateBar({ visible }: { visible: boolean }) {
    const { t } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { status, progress, forced, download, install, dismiss } = useApkUpdate();

    if (status === 'idle') return null;
    if (!visible && !forced) return null;

    const downloading = status === 'downloading';
    const percent = Math.round(progress * 100);

    const title =
        status === 'error'
            ? t('update-failed') || 'Update failed'
            : downloading
                ? `${t('downloading-update') || 'Downloading update'} ${percent}%`
                : t('new-version-available') || 'New version available';

    const primaryLabel =
        status === 'error'
            ? t('try-again') || 'Try Again'
            : status === 'ready'
                ? t('install-update') || 'Install'
                : t('update-now') || 'Update now';

    const card = (
        <View
            className="rounded-2xl px-4 pt-4 pb-3"
            style={{
                backgroundColor: isDark ? theme.surface : '#FFFFFF',
                shadowColor: '#000',
                shadowOpacity: 0.15,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: -2 },
                elevation: 5,
            }}
        >
            <View className="flex-row items-center">
                <Ionicons
                    name={status === 'error' ? 'alert-circle' : 'arrow-up-circle'}
                    size={22}
                    color={palette.primary.main}
                />
                <View className="flex-1 ml-3">
                    <Text className="text-sm font-semibold" style={{ color: theme.textPrimary }}>
                        {title}
                    </Text>
                    {!downloading && status !== 'error' && (
                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                            {t('update-for-latest-features') || 'Update to get the latest features'}
                        </Text>
                    )}
                </View>
            </View>

            {downloading ? (
                <View
                    className="h-1.5 rounded-full mt-4 mb-2 overflow-hidden"
                    style={{ backgroundColor: isDark ? '#3A3A3C' : '#E5E7EB' }}
                >
                    <View
                        className="h-full rounded-full"
                        style={{ width: `${percent}%`, backgroundColor: palette.primary.main }}
                    />
                </View>
            ) : (
                <View className="flex-row items-center mt-4">
                    {!forced && (
                        <Pressable className="flex-1 rounded-xl py-3 items-center mr-2" onPress={dismiss}>
                            <Text className="text-sm font-semibold" style={{ color: theme.textSecondary }}>
                                {t('later') || 'Later'}
                            </Text>
                        </Pressable>
                    )}
                    <Pressable
                        className="flex-1 rounded-xl py-3 items-center"
                        style={{ backgroundColor: palette.primary.main }}
                        onPress={status === 'ready' ? install : download}
                    >
                        <Text className="text-white text-sm font-bold">{primaryLabel}</Text>
                    </Pressable>
                </View>
            )}
        </View>
    );

    // Below minVersionCode: block the app until the update is installed.
    if (forced) {
        return (
            <Modal visible transparent animationType="fade" statusBarTranslucent>
                <View
                    className="flex-1 justify-end px-4"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingBottom: insets.bottom + 16 }}
                >
                    {card}
                </View>
            </Modal>
        );
    }

    return (
        <View
            className="absolute left-0 right-0 px-4"
            style={{ bottom: insets.bottom + 16 }}
            pointerEvents="box-none"
        >
            {card}
        </View>
    );
}
