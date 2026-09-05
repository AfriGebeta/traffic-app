import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface DriverQrScannerProps {
    visible: boolean;
    onClose: () => void;
    onScanned: (code: string) => void;
}

const extractDriverCode = (raw: string): string => {
    const value = raw.trim();

    if (/^[A-Za-z0-9_-]+$/.test(value)) return value;

    const segments = value.split(/[/?#=]/).filter(Boolean);
    const lastUsable = [...segments].reverse().find(segment => /^[A-Za-z0-9_-]+$/.test(segment));
    return lastUsable ?? value;
};

export default function DriverQrScanner({ visible, onClose, onScanned }: DriverQrScannerProps) {
    const { t } = useTranslation();
    const { colors: theme } = useTheme();
    const [permission, requestPermission] = useCameraPermissions();
    const [isRequesting, setIsRequesting] = useState(false);
    const hasScannedRef = useRef(false);

    const ensurePermission = useCallback(async () => {
        setIsRequesting(true);
        try {
            await requestPermission();
        } finally {
            setIsRequesting(false);
        }
    }, [requestPermission]);

    useEffect(() => {
        if (!visible) {
            hasScannedRef.current = false;
            return;
        }

        ensurePermission();
    }, [visible]);

    const handleBarcodeScanned = ({ data }: { data: string }) => {
        if (hasScannedRef.current || !data) return;
        hasScannedRef.current = true;
        onScanned(extractDriverCode(data));
        onClose();
    };

    const renderBody = () => {
        if (isRequesting || !permission) {
            return (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
            );
        }

        if (!permission.granted) {
            return (
                <View className="flex-1 items-center justify-center px-8">
                    <Ionicons name="camera-outline" size={48} color="#FFFFFF" />
                    <Text className="text-white text-center text-base mt-4">
                        {t('camera-permission-needed')}
                    </Text>
                    <TouchableOpacity
                        onPress={() => (permission.canAskAgain ? ensurePermission() : Linking.openSettings())}
                        className="rounded-xl py-3 px-6 mt-5"
                        style={{ backgroundColor: colors.primary.main }}
                    >
                        <Text className="text-white font-semibold">
                            {permission.canAskAgain ? t('allow-camera') : t('open-settings')}
                        </Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleBarcodeScanned}
            >
                <View className="flex-1 items-center justify-center">
                    <View
                        style={{
                            width: 240,
                            height: 240,
                            borderWidth: 3,
                            borderColor: '#FFFFFF',
                            borderRadius: 24,
                            backgroundColor: 'transparent',
                        }}
                    />
                    <Text className="text-white text-center text-base mt-6 px-8">
                        {t('scan-driver-qr-hint')}
                    </Text>
                </View>
            </CameraView>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View className="flex-1" style={{ backgroundColor: '#000000' }}>
                <View
                    className="flex-row items-center justify-between px-4 py-4"
                    style={{ backgroundColor: '#000000' }}
                >
                    <Text className="text-white text-lg" style={{ fontFamily: 'PlusJakartaSans-Bold' }}>
                        {t('scan-driver-qr')}
                    </Text>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close" size={26} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
                {renderBody()}
            </View>
        </Modal>
    );
}
