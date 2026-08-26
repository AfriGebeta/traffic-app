import React, { useEffect, useState } from 'react';
import { Modal, View, TouchableOpacity, Keyboard, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useUserRegistration } from '../../register/hooks/useUserRegistration';
import { useLekfelPayment } from '../hooks/useLekfelPayment';
import LekfelPayCard from './LekfelPayCard';
import LekfelPaymentModal from './LekfelPaymentModal';

interface LekfelPaySheetProps {
    visible: boolean;
    onClose: () => void;
    originName?: string;
    originLat?: number;
    originLng?: number;
    destinationName?: string;
    destinationLat?: number;
    destinationLng?: number;
}

export default function LekfelPaySheet({
    visible,
    onClose,
    originName,
    originLat,
    originLng,
    destinationName,
    destinationLat,
    destinationLng,
}: LekfelPaySheetProps) {
    const { t } = useTranslation();
    const { colors: theme } = useTheme();
    const insets = useSafeAreaInsets();
    const { getStoredUser } = useUserRegistration();
    const { stage, errorMessage, pay, reset } = useLekfelPayment();

    const [payerPhone, setPayerPhone] = useState('');
    const [receiverPhone, setReceiverPhone] = useState('');
    const [amount, setAmount] = useState('');
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, (event) => {
            setKeyboardHeight(event.endCoordinates.height);
        });
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    useEffect(() => {
        getStoredUser().then(storedUser => {
            if (storedUser?.phoneNumber) setPayerPhone(storedUser.phoneNumber);
        });
    }, []);

    const canPay = payerPhone.trim().length > 0
        && receiverPhone.trim().length > 0
        && Number(amount.trim()) > 0;

    const handlePay = () => {
        const now = new Date();
        pay({
            payerPhone: payerPhone.trim(),
            receiverPhone: receiverPhone.trim(),
            amount: Number(amount.trim()),
            description: `${t('taxi-ride')} ${originName ?? ''} -> ${destinationName ?? ''}`.trim(),
            originName,
            originLat,
            originLng,
            destinationName,
            destinationLat,
            destinationLng,
            tripDayOfWeek: now.getDay(),
            tripMinutesOfDay: now.getHours() * 60 + now.getMinutes(),
        });
    };

    const handleDismissStatus = () => {
        if (stage === 'success') {
            setReceiverPhone('');
            setAmount('');
            reset();
            onClose();
            return;
        }
        reset();
    };

    return (
        <>
            <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
                <View
                    className="flex-1 justify-end"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                >
                    <View
                        className="rounded-t-3xl px-4 pt-2"
                        style={{
                            backgroundColor: theme.background,
                            paddingBottom: keyboardHeight > 0 ? keyboardHeight + 16 : insets.bottom + 24,
                        }}
                    >
                        <View className="flex-row items-center justify-end">
                            <TouchableOpacity onPress={onClose} className="p-2">
                                <Ionicons name="close" size={24} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <LekfelPayCard
                            payerPhone={payerPhone}
                            onPayerPhoneChange={setPayerPhone}
                            receiverPhone={receiverPhone}
                            onReceiverPhoneChange={setReceiverPhone}
                            amount={amount}
                            onAmountChange={setAmount}
                            currency="ETB"
                            canPay={canPay}
                            onPay={handlePay}
                        />
                    </View>
                </View>
            </Modal>

            <LekfelPaymentModal
                stage={stage}
                errorMessage={errorMessage}
                amount={amount}
                currency="ETB"
                onRetry={reset}
                onDismiss={handleDismissStatus}
            />
        </>
    );
}
