import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Device from 'expo-device';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Location from '../services/location';
import { colors } from '../theme/colors';

// Campaign photos must carry GPS, capture time, camera make/model and "GebetaMaps" in
// ImageDescription/UserComment, or the backend treats them as gallery photos.
const APP_EXIF_TAG = 'GebetaMaps';
const FIX_MAX_AGE_MS = 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');
// EXIF date format: "YYYY:MM:DD HH:MM:SS", local time
const exifDate = (date: Date) =>
    `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

const buildExif = async (): Promise<Record<string, string | number>> => {
    const exif: Record<string, string | number> = {
        DateTimeOriginal: exifDate(new Date()),
        ImageDescription: APP_EXIF_TAG,
        UserComment: APP_EXIF_TAG,
    };
    if (Device.manufacturer) exif.Make = Device.manufacturer;
    if (Device.modelName) exif.Model = Device.modelName;
    try {
        const fix = await Location.getLastKnownPositionAsync({ maxAge: FIX_MAX_AGE_MS });
        if (fix) {
            exif.GPSLatitude = fix.coords.latitude;
            exif.GPSLongitude = fix.coords.longitude;
            if (fix.coords.altitude != null) exif.GPSAltitude = fix.coords.altitude;
        }
    } catch {
        // no fix: the photo still goes out, the backend decides
    }
    return exif;
};

interface InAppCameraProps {
    visible: boolean;
    onClose: () => void;
    onCaptured: (uri: string) => void;
}

// Full-screen camera inside our own activity. The system camera app made Android kill
// low-RAM phones in the background, which lost the form; this never leaves the app.
export function InAppCamera({ visible, onClose, onCaptured }: InAppCameraProps) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const cameraRef = useRef<CameraView>(null);
    const [permission, requestPermission] = useCameraPermissions();
    const [ready, setReady] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    // Android reports canAskAgain=false before the first request and after an "Only this time"
    // grant expires, so always ask once per opening; only a refused request means "go to Settings"
    const [askedThisOpen, setAskedThisOpen] = useState(false);

    useEffect(() => {
        if (!visible) {
            setPreview(null);
            setReady(false);
            setAskedThisOpen(false);
            return;
        }
        if (permission && !permission.granted && !askedThisOpen) {
            setAskedThisOpen(true);
            void requestPermission();
        }
    }, [visible, permission, askedThisOpen, requestPermission]);

    const blocked = askedThisOpen && !!permission && !permission.granted && !permission.canAskAgain;

    const capture = async () => {
        if (!cameraRef.current || !ready || capturing) return;
        setCapturing(true);
        try {
            const additionalExif = await buildExif();
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, exif: true, additionalExif, shutterSound: false });
            if (photo?.uri) setPreview(photo.uri);
        } catch (error) {
            console.warn('in-app camera: capture failed', error);
        } finally {
            setCapturing(false);
        }
    };

    const usePhoto = () => {
        if (!preview) return;
        onCaptured(preview);
        onClose();
    };

    const renderBody = () => {
        if (!permission) {
            return (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color="#fff" />
                </View>
            );
        }

        if (!permission.granted) {
            return (
                <View className="flex-1 items-center justify-center px-8">
                    <Ionicons name="camera-outline" size={48} color="#fff" />
                    <Text className="text-white text-center mt-4 text-base">{t('camera-permission-required')}</Text>
                    <TouchableOpacity
                        className="mt-6 rounded-xl px-6 py-3"
                        style={{ backgroundColor: colors.primary.main }}
                        onPress={() => (blocked ? Linking.openSettings() : requestPermission())}
                    >
                        <Text className="text-white font-semibold">
                            {blocked ? t('open-settings') : t('allow-camera')}
                        </Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (preview) {
            return (
                <View className="flex-1">
                    <Image source={{ uri: preview }} style={{ flex: 1 }} resizeMode="contain" />
                    <View
                        className="flex-row justify-between px-8 pt-6"
                        style={{ paddingBottom: insets.bottom + 24, backgroundColor: 'rgba(0,0,0,0.6)' }}
                    >
                        <TouchableOpacity onPress={() => setPreview(null)} className="px-6 py-3">
                            <Text className="text-white font-semibold text-base">{t('retake')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={usePhoto}
                            className="rounded-xl px-6 py-3"
                            style={{ backgroundColor: colors.primary.main }}
                        >
                            <Text className="text-white font-bold text-base">{t('use-photo')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return (
            <View className="flex-1">
                <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" onCameraReady={() => setReady(true)} />
                <View
                    className="absolute left-0 right-0 bottom-0 items-center"
                    style={{ paddingBottom: insets.bottom + 32 }}
                >
                    <TouchableOpacity
                        onPress={capture}
                        disabled={!ready || capturing}
                        activeOpacity={0.7}
                        className="items-center justify-center rounded-full"
                        style={{ width: 76, height: 76, borderWidth: 4, borderColor: '#fff', opacity: ready ? 1 : 0.5 }}
                    >
                        {capturing ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <View className="rounded-full" style={{ width: 60, height: 60, backgroundColor: '#fff' }} />
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
            <StatusBar barStyle="light-content" />
            <View className="flex-1" style={{ backgroundColor: '#000' }}>
                {renderBody()}
                <TouchableOpacity
                    onPress={onClose}
                    className="absolute rounded-full items-center justify-center"
                    style={{ top: insets.top + 12, left: 16, width: 44, height: 44, backgroundColor: 'rgba(0,0,0,0.5)' }}
                    accessibilityLabel={t('close')}
                >
                    <Ionicons name="close" size={26} color="#fff" />
                </TouchableOpacity>
            </View>
        </Modal>
    );
}
