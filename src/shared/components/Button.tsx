import React from 'react';
import { ActivityIndicator, Text, TextStyle, TouchableOpacity, ViewStyle, View } from 'react-native';
import { colors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

interface ButtonProps {
    title: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'outline';
    style?: ViewStyle;
    textStyle?: TextStyle;
    icon?: string;
}

export const Button: React.FC<ButtonProps> = ({
    title,
    onPress,
    loading = false,
    disabled = false,
    variant = 'primary',
    style,
    textStyle,
    icon,
}) => {
    const isDisabled = disabled || loading;
    const { colors: theme, isDark } = useTheme();

    const getVariantStyles = () => {
        switch (variant) {
            case 'primary':
                return { backgroundColor: colors.primary.main };
            case 'secondary':
                return { backgroundColor: isDark ? theme.surface : colors.gray[100] };
            case 'outline':
                return {
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderColor: colors.primary.main
                };
            default:
                return { backgroundColor: colors.primary.main };
        }
    };

    const getTextColor = () => {
        switch (variant) {
            case 'primary':
                return colors.white;
            case 'secondary':
                return isDark ? theme.textPrimary : colors.gray[800];
            case 'outline':
                return colors.primary.main;
            default:
                return colors.white;
        }
    };

    return (
        <TouchableOpacity
            className="py-4 px-6 rounded-xl items-center justify-center min-h-[52px]"
            style={[
                getVariantStyles(),
                isDisabled && { opacity: 0.6 },
                style
            ]}
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.7}
        >
            {loading ? (
                <ActivityIndicator
                    color={variant === 'primary' ? colors.white : colors.primary.main}
                />
            ) : (
                <View className="flex-row items-center justify-center">
                    <Text
                        className="text-xl font-bold"
                        style={[{ color: getTextColor() }, textStyle]}
                    >
                        {title}
                    </Text>
                    {icon && (
                        <Text
                            className="text-2xl font-bold ml-2"
                            style={{ color: getTextColor() }}
                        >
                            {icon}
                        </Text>
                    )}
                </View>
            )}
        </TouchableOpacity>
    );
};
