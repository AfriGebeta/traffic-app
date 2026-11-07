import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';

const FONT_MEDIUM = 'PlusJakartaSans-Medium';

// form field label: medium weight, brand "*" when required, quiet "optional", optional hint line
export function FieldLabel({ label, required, optional, hint }: { label: string; required?: boolean; optional?: boolean; hint?: string }) {
    const { colors: theme } = useTheme();
    const { t } = useTranslation();
    return (
        <View className="mb-2">
            <Text className="text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>
                {label}
                {required && <Text style={{ color: theme.primary }}> *</Text>}
                {optional && <Text className="text-xs" style={{ color: theme.textSecondary, fontFamily: undefined }}>{`  ${t('optional')}`}</Text>}
            </Text>
            {!!hint && (
                <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                    {hint}
                </Text>
            )}
        </View>
    );
}
