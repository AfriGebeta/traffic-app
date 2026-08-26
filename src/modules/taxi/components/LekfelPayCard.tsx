import React, { useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface PayFieldProps {
    icon: 'person' | 'car';
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    theme: ReturnType<typeof useTheme>['colors'];
}

const ACCENT = '#F97316';
const ICON_ACCENT = colors.primary.main;

function PayField({ icon, label, value, onChangeText, placeholder, theme }: PayFieldProps) {
    return (
        <View className="flex-row items-center mb-4">
            <View
                className="w-9 h-9 rounded-full items-center justify-center mr-3"
                style={{ borderWidth: 1.5, borderColor: ICON_ACCENT }}
            >
                <Ionicons name={icon} size={18} color={ICON_ACCENT} />
            </View>
            <View className="flex-1" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <Text className="text-xs" style={{ color: theme.textSecondary }}>
                    {label}
                </Text>
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    keyboardType="phone-pad"
                    placeholder={placeholder}
                    placeholderTextColor={theme.textSecondary}
                    className="text-base p-0 pb-1"
                    style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-Bold' }}
                />
            </View>
        </View>
    );
}

interface LekfelPayCardProps {
    payerPhone: string;
    onPayerPhoneChange: (text: string) => void;
    receiverPhone: string;
    onReceiverPhoneChange: (text: string) => void;
    amount: string;
    onAmountChange: (text: string) => void;
    currency: string;
    canPay: boolean;
    onPay: () => void;
}

export default function LekfelPayCard({
    payerPhone,
    onPayerPhoneChange,
    receiverPhone,
    onReceiverPhoneChange,
    amount,
    onAmountChange,
    currency,
    canPay,
    onPay,
}: LekfelPayCardProps) {
    const { t } = useTranslation();
    const { colors: theme } = useTheme();
    const amountInputRef = useRef<TextInput>(null);

    return (
        <View
            className="rounded-2xl p-5 mt-4"
            style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
        >
            <View className="flex-row items-center justify-between mb-5">
                <Text className="text-xl" style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-Bold' }}>
                    {t('pay')}
                </Text>
                <View className="flex-row items-baseline">
                    <Text style={{ color: theme.textSecondary }}>{t('powered-by')} </Text>
                    <Text style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-Bold' }}>
                        Lekefel
                    </Text>
                </View>
            </View>

            <PayField
                icon="person"
                label={t('your-phone-number')}
                value={payerPhone}
                onChangeText={onPayerPhoneChange}
                placeholder="09XXXXXXXX"
                theme={theme}
            />

            <PayField
                icon="car"
                label={t('driver-phone-number')}
                value={receiverPhone}
                onChangeText={onReceiverPhoneChange}
                placeholder="09XXXXXXXX"
                theme={theme}
            />

            <Pressable
                onPress={() => amountInputRef.current?.focus()}
                className="flex-row items-center justify-between rounded-xl px-4 py-4 mt-1"
                style={{ backgroundColor: theme.background }}
            >
                <Text className="text-base" style={{ color: theme.textSecondary }}>
                    {t('taxi-fare')}
                </Text>
                <View className="flex-row items-baseline">
                    <TextInput
                        ref={amountInputRef}
                        value={amount}
                        onChangeText={onAmountChange}
                        keyboardType="numeric"
                        placeholder="00"
                        placeholderTextColor={theme.textSecondary}
                        className="text-xl text-right p-0"
                        style={{ color: theme.textPrimary, minWidth: 40, fontFamily: 'PlusJakartaSans-Bold' }}
                    />
                    <Text className="text-lg ml-2" style={{ color: theme.green, fontFamily: 'PlusJakartaSans-Bold' }}>
                        {currency}
                    </Text>
                </View>
            </Pressable>

            <TouchableOpacity
                onPress={onPay}
                disabled={!canPay}
                activeOpacity={0.8}
                className="py-4 rounded-xl mt-4"
                style={{ backgroundColor: canPay ? ACCENT : theme.border }}
            >
                <Text className="text-white text-center text-lg" style={{ fontFamily: 'PlusJakartaSans-Bold' }}>
                    {t('pay')}
                </Text>
            </TouchableOpacity>
        </View>
    );
}
