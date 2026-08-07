import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';

export function FieldError({ message }: { message?: string | null }) {
    if (!message) return null;

    return (
        <Text className="text-xs mt-1.5 ml-1" style={{ color: colors.error.main }}>
            {message}
        </Text>
    );
}

export function FormError({ message }: { message?: string | null }) {
    if (!message) return null;

    return (
        <View
            className="flex-row items-center rounded-xl px-3 py-3 mb-4"
            style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: colors.error.light }}
        >
            <Ionicons name="alert-circle" size={18} color={colors.error.main} />
            <Text className="flex-1 ml-2 text-sm" style={{ color: '#B91C1C' }}>
                {message}
            </Text>
        </View>
    );
}
