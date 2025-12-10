import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    secureTextEntry?: boolean;
    className?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    showClearButton?: boolean;
    onClear?: () => void;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    secureTextEntry,
    className,
    icon,
    showClearButton,
    onClear,
    ...props
}) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const getBorderStyle = () => {
        if (isFocused) {
            return { borderColor: colors.primary.main, backgroundColor: colors.white };
        }
        if (error) {
            return { borderColor: colors.error.main, backgroundColor: colors.gray[50] };
        }
        return { borderColor: colors.gray[200], backgroundColor: colors.gray[50] };
    };

    return (
        <View className={label || error ? "mb-4" : ""}>
            {label && (
                <Text className="mb-2 text-sm font-semibold text-gray-700">
                    {label}
                </Text>
            )}
            <View
                className="flex-row items-center rounded-xl border min-h-[52px] px-4"
                style={getBorderStyle()}
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
                    className={`flex-1 text-lg font-bold text-black py-0 ${className || ''}`}
                    secureTextEntry={secureTextEntry && !isPasswordVisible}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholderTextColor={colors.gray[800]}
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
                            color="#9CA3AF"
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
                            color="#6B7280"
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
