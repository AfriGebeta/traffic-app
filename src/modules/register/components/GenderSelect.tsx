import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { colors } from '../../../shared/theme/colors';

export const SEX_FEMALE = 0;
export const SEX_MALE = 1;

export interface GenderSelectPalette {
    surface: string;
    border: string;
    text: string;
    selectedSurface: string;
    selectedBorder: string;
    selectedText: string;
}

const LIGHT_PALETTE: GenderSelectPalette = {
    surface: '#F9FAFB',
    border: '#D1D5DB',
    text: '#374151',
    selectedSurface: '#FFF7EB',
    selectedBorder: colors.primary.main,
    selectedText: '#92400E',
};

interface GenderSelectProps {
    value: number | null;
    onChange: (value: number) => void;
    maleLabel: string;
    femaleLabel: string;
    disabled?: boolean;
    hasError?: boolean;
    palette?: GenderSelectPalette;
}

export function GenderSelect({
    value,
    onChange,
    maleLabel,
    femaleLabel,
    disabled,
    hasError,
    palette = LIGHT_PALETTE,
}: GenderSelectProps) {
    const options = [
        { value: SEX_MALE, label: maleLabel },
        { value: SEX_FEMALE, label: femaleLabel },
    ];

    return (
        <View className="flex-row" style={{ gap: 12 }}>
            {options.map((option) => {
                const selected = value === option.value;

                return (
                    <TouchableOpacity
                        key={option.value}
                        className="flex-1 items-center justify-center rounded-xl py-4"
                        style={{
                            borderWidth: selected ? 2 : 1,
                            borderColor: selected
                                ? palette.selectedBorder
                                : hasError
                                    ? colors.error.main
                                    : palette.border,
                            backgroundColor: selected ? palette.selectedSurface : palette.surface,
                        }}
                        onPress={() => onChange(option.value)}
                        disabled={disabled}
                        activeOpacity={0.8}
                    >
                        <Text
                            className="text-base font-semibold"
                            style={{ color: selected ? palette.selectedText : palette.text }}
                        >
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}
