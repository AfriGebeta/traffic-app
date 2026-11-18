import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../shared/theme/ThemeContext';
import { colors as palette } from '../shared/theme/colors';

interface Props {
    visible: boolean;
    onRestart: () => void;
}

export function UpdateReadySnackbar({ visible, onRestart }: Props) {
    const { t } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    if (!visible) return null;

    return (
        <View
            className="absolute left-0 right-0 px-4"
            style={{ bottom: insets.bottom + 16 }}
            pointerEvents="box-none"
        >
            <View
                className="flex-row items-center rounded-2xl pl-4 pr-2 py-2"
                style={{
                    backgroundColor: isDark ? theme.surface : '#FFFFFF',
                    shadowColor: '#000',
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: -2 },
                    elevation: 5,
                }}
            >
                <Ionicons name="checkmark-circle" size={22} color={palette.primary.main} />
                <Text className="flex-1 ml-3 text-sm font-semibold" style={{ color: theme.textPrimary }}>
                    {t('update-ready') || 'Update ready'}
                </Text>
                <Pressable
                    className="rounded-xl px-4 py-2.5"
                    style={{ backgroundColor: palette.primary.main }}
                    onPress={onRestart}
                >
                    <Text className="text-white text-sm font-bold">
                        {t('restart') || 'Restart'}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}
