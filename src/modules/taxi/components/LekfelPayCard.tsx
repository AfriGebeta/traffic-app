import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useDriverLookup } from '../hooks/useDriverLookup';
import DriverQrScanner from './DriverQrScanner';

import QrCodeIcon from '../../../../assets/images/qr-code.svg';

interface PayFieldProps {
    icon: 'person' | 'car' | 'call';
    keyboardType?: 'phone-pad' | 'number-pad';
    footer?: React.ReactNode;
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    theme: ReturnType<typeof useTheme>['colors'];
    disabled?: boolean;
    showEditIcon?: boolean;
    rightAccessory?: React.ReactNode;
}

const TELEBIRR_LOGO = require('../../../../assets/images/telebirr-logo.png');

const ACCENT = '#F97316';
const ICON_ACCENT = colors.primary.main;

function PayField({
    icon,
    label,
    value,
    onChangeText,
    placeholder,
    theme,
    disabled,
    showEditIcon,
    keyboardType = 'phone-pad',
    footer,
    rightAccessory,
}: PayFieldProps) {
    const iconColor = disabled ? theme.textSecondary : ICON_ACCENT;
    const inputRef = useRef<TextInput>(null);

    return (
        <View className="flex-row items-start mb-4">
            <View
                className="w-9 h-9 rounded-full items-center justify-center mr-3"
                style={{ borderWidth: 1.5, borderColor: iconColor }}
            >
                <Ionicons name={icon} size={18} color={iconColor} />
            </View>
            <View className="flex-1" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <Text className="text-xs" style={{ color: theme.textSecondary }}>
                    {label}
                </Text>
                <View className="flex-row items-center">
                    <TextInput
                        ref={inputRef}
                        value={value}
                        onChangeText={onChangeText}
                        editable={!disabled}
                        keyboardType={keyboardType}
                        placeholder={placeholder}
                        placeholderTextColor={theme.textSecondary}
                        className="flex-1 text-base p-0 pb-1"
                        style={{
                            color: disabled ? theme.textSecondary : theme.textPrimary,
                            fontFamily: 'PlusJakartaSans-Bold',
                        }}
                    />
                    {showEditIcon && (
                        <TouchableOpacity
                            onPress={() => inputRef.current?.focus()}
                            disabled={disabled}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            className="pl-2 pb-1"
                        >
                            <Ionicons name="pencil" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
                {footer}
            </View>
            {rightAccessory}
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
    disabled?: boolean;
    disabledHint?: string;
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
    disabled = false,
    disabledHint,
}: LekfelPayCardProps) {
    const { t } = useTranslation();
    const { colors: theme } = useTheme();
    const amountInputRef = useRef<TextInput>(null);

    const [driverCode, setDriverCode] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const { status: lookupStatus, driver } = useDriverLookup(driverCode, onReceiverPhoneChange);

    return (
        <View
            className="rounded-2xl p-5 mt-4"
            style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.border,
                opacity: disabled ? 0.6 : 1,
            }}
        >
            <View className="flex-row items-center justify-between mb-5">
                <View className="flex-row items-center">
                    <Text className="text-xl" style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-Bold' }}>
                        {t('pay')}
                    </Text>
                    <Image
                        source={TELEBIRR_LOGO}
                        style={{ width: 24, height: 24, marginLeft: 8 }}
                        resizeMode="contain"
                    />
                </View>
                <View className="flex-row items-baseline">
                    <Text style={{ color: theme.textSecondary }}>{t('powered-by')} </Text>
                    <Text style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-Bold' }}>
                        Lekfel
                    </Text>
                </View>
            </View>

            <View className="flex-row items-center">
                <TouchableOpacity
                    onPress={() => setShowScanner(true)}
                    disabled={disabled}
                    activeOpacity={0.7}
                    className="flex-row items-center rounded-xl"
                    style={{
                        backgroundColor: theme.background,
                        borderWidth: 1,
                        borderColor: theme.border,
                        paddingHorizontal: 12,
                        paddingVertical: 11,
                        opacity: disabled ? 0.5 : 1,
                    }}
                >
                    <QrCodeIcon width={22} height={21} />
                    <Text
                        className="ml-2 text-sm"
                        style={{ color: theme.textPrimary, fontFamily: 'PlusJakartaSans-Bold' }}
                    >
                        {t('scan-qr')}
                    </Text>
                </TouchableOpacity>

                <TextInput
                    value={driverCode}
                    onChangeText={setDriverCode}
                    editable={!disabled}
                    keyboardType="number-pad"
                    placeholder={t('driver-code-placeholder')}
                    placeholderTextColor={theme.textSecondary}
                    className="flex-1 ml-2 rounded-xl px-4"
                    style={{
                        backgroundColor: theme.background,
                        borderWidth: 1,
                        borderColor: theme.border,
                        color: disabled ? theme.textSecondary : theme.textPrimary,
                        fontFamily: 'PlusJakartaSans-Bold',
                        paddingVertical: 10,
                    }}
                />
            </View>

            {lookupStatus !== 'idle' && (
                <View className="flex-row items-center mt-2">
                    {lookupStatus === 'loading' && (
                        <>
                            <ActivityIndicator size="small" color={theme.textSecondary} />
                            <Text className="text-xs ml-2" style={{ color: theme.textSecondary }}>
                                {t('looking-up-driver')}
                            </Text>
                        </>
                    )}
                    {lookupStatus === 'found' && !!driver && (
                        <>
                            <Ionicons name="checkmark-circle" size={14} color={theme.green} />
                            <Text className="text-xs ml-1" style={{ color: theme.green }}>
                                {driver.fullName}
                            </Text>
                        </>
                    )}
                    {lookupStatus === 'error' && (
                        <>
                            <Ionicons name="alert-circle" size={14} color={colors.error.main} />
                            <Text className="text-xs ml-1" style={{ color: colors.error.main }}>
                                {t('driver-not-found')}
                            </Text>
                        </>
                    )}
                </View>
            )}

            <View className="flex-row items-center my-2">
                <View className="flex-1" style={{ height: 1, backgroundColor: theme.border }} />
                <Text className="text-xs mx-3" style={{ color: theme.textSecondary }}>
                    {t('or')}
                </Text>
                <View className="flex-1" style={{ height: 1, backgroundColor: theme.border }} />
            </View>

            <PayField
                icon="call"
                label={t('driver-phone-number')}
                value={receiverPhone}
                onChangeText={onReceiverPhoneChange}
                placeholder="09XXXXXXXX"
                theme={theme}
                disabled={disabled}
            />

            <PayField
                icon="person"
                label={t('your-phone-number')}
                value={payerPhone}
                onChangeText={onPayerPhoneChange}
                placeholder="09XXXXXXXX"
                theme={theme}
                disabled={disabled}
                showEditIcon
            />

            <Pressable
                onPress={() => amountInputRef.current?.focus()}
                disabled={disabled}
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
                        editable={!disabled}
                        keyboardType="numeric"
                        placeholder="00"
                        placeholderTextColor={theme.textSecondary}
                        className="text-xl text-right p-0"
                        style={{
                            color: disabled ? theme.textSecondary : theme.textPrimary,
                            minWidth: 40,
                            fontFamily: 'PlusJakartaSans-Bold',
                        }}
                    />
                    <Text
                        className="text-lg ml-2"
                        style={{
                            color: disabled ? theme.textSecondary : theme.green,
                            fontFamily: 'PlusJakartaSans-Bold',
                        }}
                    >
                        {currency}
                    </Text>
                </View>
            </Pressable>

            {disabled && !!disabledHint && (
                <Text className="text-xs text-center mt-3" style={{ color: theme.textSecondary }}>
                    {disabledHint}
                </Text>
            )}

            <TouchableOpacity
                onPress={onPay}
                disabled={disabled || !canPay}
                activeOpacity={0.8}
                className="py-4 rounded-xl mt-4"
                style={{ backgroundColor: !disabled && canPay ? ACCENT : theme.border }}
            >
                <Text className="text-white text-center text-lg" style={{ fontFamily: 'PlusJakartaSans-Bold' }}>
                    {t('pay')}
                </Text>
            </TouchableOpacity>

            <DriverQrScanner
                visible={showScanner}
                onClose={() => setShowScanner(false)}
                onScanned={setDriverCode}
            />
        </View>
    );
}
