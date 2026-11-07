import React from 'react';
import { StyleProp, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../shared/theme/ThemeContext';

export const FONT_MEDIUM = 'PlusJakartaSans-Medium';
export const FONT_SEMIBOLD = 'PlusJakartaSans-SemiBold';
export const RADIUS = 8;
export const RADIUS_SM = 6;

// 8-digit hex: ~12% tint of a theme colour
export const tint = (hex: string, alpha = '1F') => `${hex.slice(0, 7)}${alpha}`;

export function SectionLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
    const { colors: theme } = useTheme();
    return (
        <View style={style}>
            <Text style={{ color: theme.textSecondary, fontFamily: FONT_MEDIUM, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' }}>
                {children}
            </Text>
        </View>
    );
}

export type ChipTone = 'neutral' | 'primary' | 'success' | 'danger';

export function Chip({ tone = 'neutral', children }: { tone?: ChipTone; children: React.ReactNode }) {
    const { colors: theme } = useTheme();
    const toneStyle = {
        neutral: { bg: theme.surface, fg: theme.textSecondary, border: theme.border },
        primary: { bg: tint(theme.primary), fg: theme.textPrimary, border: 'transparent' },
        success: { bg: theme.greenMuted, fg: theme.green, border: 'transparent' },
        danger: { bg: tint(theme.error), fg: theme.error, border: 'transparent' },
    }[tone];
    return (
        <View style={{ backgroundColor: toneStyle.bg, borderColor: toneStyle.border, borderWidth: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: toneStyle.fg, fontSize: 12, fontVariant: ['tabular-nums'] }}>{children}</Text>
        </View>
    );
}

export function NavRow({
    icon,
    title,
    subtitle,
    onPress,
}: {
    icon?: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    subtitle?: string;
    onPress: () => void;
}) {
    const { colors: theme } = useTheme();
    return (
        // static style only: NativeWind drops Pressable's function-style
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.6}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: RADIUS_SM }}
        >
            {!!icon && (
                <View
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: RADIUS_SM,
                        backgroundColor: theme.surface,
                        borderWidth: 1,
                        borderColor: theme.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                    }}
                >
                    <Ionicons name={icon} size={18} color={theme.primary} />
                </View>
            )}
            <View style={{ flex: 1 }}>
                <Text style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 15 }}>{title}</Text>
                {!!subtitle && <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
    );
}

export function SkeletonBlock({ height, width = '100%', style }: { height: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
    const { colors: theme } = useTheme();
    return <View style={[{ height, width, borderRadius: RADIUS_SM, backgroundColor: theme.border, opacity: 0.6 }, style]} />;
}
