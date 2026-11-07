import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    secureTextEntry?: boolean;
    className?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    showClearButton?: boolean;
    onClear?: () => void;
    // calm: smaller corners, regular-weight 15px text; default keeps the original look everywhere else
    variant?: 'default' | 'calm';
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    secureTextEntry,
    className,
    icon,
    showClearButton,
    onClear,
    variant = 'default',
    ...props
}) => {
    const calm = variant === 'calm';
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const { colors: theme, isDark } = useTheme();

    const restingBackground = isDark ? theme.surface : colors.gray[50];

    const getBorderStyle = () => {
        if (isFocused) {
            return { borderColor: theme.primary, backgroundColor: isDark ? theme.surface : colors.white };
        }
        if (error) {
            return { borderColor: theme.error, backgroundColor: restingBackground };
        }
        return { borderColor: theme.border, backgroundColor: restingBackground };
    };

    return (
        <View className={label || error ? "mb-4" : ""}>
            {label && (
                <Text className="mb-2 text-sm font-semibold" style={{ color: theme.textPrimary }}>
                    {label}
                </Text>
            )}
            <View
                className="flex-row items-center rounded-xl border min-h-[52px] px-4"
                style={[getBorderStyle(), calm && { borderRadius: 6, minHeight: props.multiline ? 88 : 48, paddingHorizontal: 14 }]}
            >
                {icon && (
                    <Ionicons
                        name={icon}
                        size={24}
                        color={colors.primary.main}
                        style={{ marginRight: 12 }}
                    />
                )}
                <TextInput
                    className={`flex-1 text-lg font-bold py-0 ${className || ''}`}
                    style={[
                        { color: theme.textPrimary },
                        calm && { fontSize: 15, fontWeight: 'normal', paddingVertical: props.multiline ? 12 : 0, textAlignVertical: props.multiline ? 'top' : 'center' },
                    ]}
                    secureTextEntry={secureTextEntry && !isPasswordVisible}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholderTextColor={theme.textSecondary}
                    {...props}
                />
                {showClearButton && props.value && (
                    <TouchableOpacity
                        onPress={onClear}
                        className="p-1"
                    >
                        <Ionicons
                            name="close"
                            size={20}
                            color={theme.textSecondary}
                        />
                    </TouchableOpacity>
                )}
                {secureTextEntry && (
                    <TouchableOpacity
                        onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                        className="p-1"
                    >
                        <Ionicons
                            name={isPasswordVisible ? 'eye-off' : 'eye'}
                            size={20}
                            color={theme.textSecondary}
                        />
                    </TouchableOpacity>
                )}
            </View>
            {error && (
                <Text className="mt-1 ml-1 text-xs text-red-500">{error}</Text>
            )}
        </View>
    );
};
