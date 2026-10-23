import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Linking, Modal, Platform, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Device from 'expo-device';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Location from '../services/location';
import { colors } from '../theme/colors';
import { PhotoFix, gpsLog, toPhotoFix } from '../utils/photoFix';

// Campaign photos must carry GPS, capture time, camera make/model and "GebetaMaps" in
// ImageDescription/UserComment, or the backend treats them as gallery photos.
const APP_EXIF_TAG = 'GebetaMaps';

const GOOD_ACCURACY_M = 50;
const ACCEPTABLE_ACCURACY_M = 100;
const RELAX_AFTER_MS = 15_000;
const FIX_MAX_AGE_MS = 30_000;
const GIVE_UP_AFTER_MS = 20_000;
const REPLACE_STALE_FIX_MS = 5_000;

type LocationPermission = 'checking' | 'granted' | 'denied' | 'blocked';

const pad = (n: number) => String(n).padStart(2, '0');
// EXIF date format: "YYYY:MM:DD HH:MM:SS", local time
const exifDate = (date: Date) =>
    `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

const buildExif = (fix: Location.LocationObject | null): Record<string, string | number> => {
    const exif: Record<string, string | number> = {
        DateTimeOriginal: exifDate(new Date()),
        ImageDescription: APP_EXIF_TAG,
        UserComment: APP_EXIF_TAG,
    };
    if (fix) {
        const { latitude, longitude, altitude } = fix.coords;
        exif.GPSLatitude = Math.abs(latitude);
        exif.GPSLatitudeRef = latitude >= 0 ? 'N' : 'S';
        exif.GPSLongitude = Math.abs(longitude);
        exif.GPSLongitudeRef = longitude >= 0 ? 'E' : 'W';
        if (altitude != null) exif.GPSAltitude = altitude;
    }
    if (Device.manufacturer) exif.Make = Device.manufacturer;
    if (Device.modelName) exif.Model = Device.modelName;
    return exif;
};

const isFresh = (fix: Location.LocationObject | null, now: number) => !!fix && now - fix.timestamp <= FIX_MAX_AGE_MS;

const openLocationSettings = () => {
    if (Platform.OS === 'android') {
        Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => Linking.openSettings());
    } else {
        void Linking.openSettings();
    }
};

interface InAppCameraProps {
    visible: boolean;
    onClose: () => void;
    onCaptured: (uri: string, fix: PhotoFix | null) => void;
    requireLocation?: boolean;
}

// Full-screen camera inside our own activity. The system camera app made Android kill
// low-RAM phones in the background, which lost the form; this never leaves the app.
export function InAppCamera({ visible, onClose, onCaptured, requireLocation = false }: InAppCameraProps) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const cameraRef = useRef<CameraView>(null);
    const [permission, requestPermission] = useCameraPermissions();
    const [ready, setReady] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const [preview, setPreview] = useState<{ uri: string; fix: PhotoFix | null } | null>(null);
    // Android reports canAskAgain=false before the first request and after an "Only this time"
    // grant expires, so always ask once per opening; only a refused request means "go to Settings"
    const [askedThisOpen, setAskedThisOpen] = useState(false);

    const [locationPermission, setLocationPermission] = useState<LocationPermission>('checking');
    const [servicesOn, setServicesOn] = useState(true);
    const [fix, setFix] = useState<Location.LocationObject | null>(null);
    const [watchStartedAt, setWatchStartedAt] = useState(0);
    const [cameraOpenedAt, setCameraOpenedAt] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    // bumped by Retry and by coming back from Settings to restart the location checks
    const [locationAttempt, setLocationAttempt] = useState(0);

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

    useEffect(() => {
        if (!visible) return;
        setCameraOpenedAt(Date.now());
        setNow(Date.now());
    }, [visible]);

    // campaign forms keep location warm the whole time; other photos only while the camera is open
    const watchActive = visible || requireLocation;

    // returning from Settings (permission or location switched on): check again
    useEffect(() => {
        if (!watchActive) return;
        let wentToBackground = false;
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'background') wentToBackground = true;
            if (state === 'active' && wentToBackground) {
                wentToBackground = false;
                setLocationAttempt((n) => n + 1);
            }
        });
        return () => subscription.remove();
    }, [watchActive]);

    useEffect(() => {
        if (!watchActive) {
            setLocationPermission('checking');
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                let result = await Location.getForegroundPermissionsAsync();
                if (!result.granted && requireLocation && visible && result.canAskAgain) {
                    result = await Location.requestForegroundPermissionsAsync();
                }
                if (cancelled) return;
                const state = result.granted ? 'granted' : result.canAskAgain ? 'denied' : 'blocked';
                gpsLog('permission:', state, { cameraOpen: visible, requireLocation });
                setLocationPermission(state);
            } catch {
                if (!cancelled) setLocationPermission('denied');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [watchActive, visible, requireLocation, locationAttempt]);

    // watch position and keep the best recent fix
    useEffect(() => {
        if (!watchActive || locationPermission !== 'granted') return;
        setFix(null);
        setWatchStartedAt(Date.now());
        setNow(Date.now());
        let cancelled = false;
        let subscription: Location.LocationSubscription | undefined;
        (async () => {
            const enabled = await Location.hasServicesEnabledAsync().catch(() => true);
            if (cancelled) return;
            setServicesOn(enabled);
            gpsLog('location services', enabled ? 'on' : 'OFF');
            if (!enabled) return;
            gpsLog('watch started', { attempt: locationAttempt });
            try {
                const watch = await Location.watchPositionAsync(
                    { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0 },
                    (location) => {
                        gpsLog(
                            `fix ±${Math.round(location.coords.accuracy ?? -1)} m`,
                            `age ${Math.round((Date.now() - location.timestamp) / 1000)}s`,
                            location.mocked ? 'MOCKED' : ''
                        );
                        setFix((prev) =>
                            !prev ||
                            (location.coords.accuracy ?? Infinity) <= (prev.coords.accuracy ?? Infinity) ||
                            location.timestamp - prev.timestamp > REPLACE_STALE_FIX_MS
                                ? location
                                : prev
                        );
                    }
                );
                if (cancelled) watch.remove();
                else subscription = watch;
            } catch (error) {
                // no watch: the status pill ends up on "can't get your location" with Retry
                gpsLog('watch failed', error);
            }
        })();
        return () => {
            cancelled = true;
            if (subscription) gpsLog('watch stopped');
            subscription?.remove();
        };
    }, [watchActive, locationPermission, locationAttempt]);

    // readiness depends on the clock (fix age, 15 s relaxation), so tick while waiting on the viewfinder
    useEffect(() => {
        if (!visible || !requireLocation || preview) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [visible, requireLocation, preview]);

    const accuracy = fix?.coords.accuracy ?? Infinity;
    const locationReady =
        isFresh(fix, now) &&
        (accuracy <= GOOD_ACCURACY_M || (watchStartedAt > 0 && now - watchStartedAt > RELAX_AFTER_MS && accuracy <= ACCEPTABLE_ACCURACY_M));
    // give up 20 s after whichever came later: opening the camera or (re)starting the watch
    const waitingSince = Math.max(cameraOpenedAt, watchStartedAt);
    const locationFailed = !locationReady && waitingSince > 0 && now - waitingSince > GIVE_UP_AFTER_MS;
    const shutterEnabled = ready && !capturing && (!requireLocation || locationReady);

    useEffect(() => {
        if (!visible) return;
        gpsLog('camera opened', {
            requireLocation,
            ready: locationReady,
            accuracy: fix ? Math.round(accuracy) : null,
            fixAge: fix ? `${Math.round((Date.now() - fix.timestamp) / 1000)}s` : null,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    useEffect(() => {
        if (visible && requireLocation) gpsLog(locationReady ? 'READY' : locationFailed ? 'gave up (no usable fix)' : 'waiting for fix');
    }, [visible, requireLocation, locationReady, locationFailed]);

    const blocked = askedThisOpen && !!permission && !permission.granted && !permission.canAskAgain;

    const retryLocation = () => setLocationAttempt((n) => n + 1);

    const capture = async () => {
        if (!cameraRef.current || !shutterEnabled) return;
        // campaign photos only go out with a good fix; others take whatever recent fix there is
        const captureFix = requireLocation ? fix : isFresh(fix, Date.now()) ? fix : null;
        if (requireLocation && !captureFix) return;
        setCapturing(true);
        try {
            const written = buildExif(captureFix);
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                exif: true,
                additionalExif: written,
                shutterSound: false,
            });
            gpsLog('captured', photo?.uri, {
                exifWritten: { lat: written.GPSLatitude, latRef: written.GPSLatitudeRef, lng: written.GPSLongitude, lngRef: written.GPSLongitudeRef, time: written.DateTimeOriginal },
                exifReadBack: photo?.exif
                    ? {
                          lat: photo.exif.GPSLatitude,
                          latRef: photo.exif.GPSLatitudeRef,
                          lng: photo.exif.GPSLongitude,
                          lngRef: photo.exif.GPSLongitudeRef,
                          time: photo.exif.DateTimeOriginal,
                          comment: photo.exif.UserComment,
                          make: photo.exif.Make,
                          model: photo.exif.Model,
                      }
                    : 'none',
            });
            if (photo?.uri) setPreview({ uri: photo.uri, fix: captureFix ? toPhotoFix(captureFix) : null });
        } catch (error) {
            console.warn('in-app camera: capture failed', error);
        } finally {
            setCapturing(false);
        }
    };

    // the file goes up exactly as taken; resizing or re-encoding would strip the GPS and time
    const usePhoto = () => {
        if (!preview) return;
        onCaptured(preview.uri, preview.fix);
        onClose();
    };

    const blockingMessage = (icon: React.ComponentProps<typeof Ionicons>['name'], message: string, action: string, onPress: () => void) => (
        <View className="flex-1 items-center justify-center px-8">
            <Ionicons name={icon} size={48} color="#fff" />
            <Text className="text-white text-center mt-4 text-base">{message}</Text>
            <TouchableOpacity className="mt-6 rounded-xl px-6 py-3" style={{ backgroundColor: colors.primary.main }} onPress={onPress}>
                <Text className="text-white font-semibold">{action}</Text>
            </TouchableOpacity>
        </View>
    );

    const renderLocationStatus = () => {
        // nothing to say in the normal case: the fix was warmed up while the form was open
        if (!requireLocation || locationReady) return null;
        if (locationFailed) {
            return (
                <View className="items-center rounded-2xl px-4 py-3 mb-4 mx-6" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
                    <Text className="text-white text-sm text-center">{t('camera-location-failed')}</Text>
                    <TouchableOpacity onPress={retryLocation} className="mt-2 rounded-lg px-4 py-2" style={{ backgroundColor: colors.primary.main }}>
                        <Text className="text-white font-semibold text-sm">{t('try-again')}</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return (
            <View className="flex-row items-center rounded-full px-4 py-2 mb-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                <ActivityIndicator size="small" color="#fff" />
                <Text className="text-white text-sm ml-2">{t('camera-location-waiting')}</Text>
            </View>
        );
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
            return blockingMessage(
                'camera-outline',
                t('camera-permission-required'),
                blocked ? t('open-settings') : t('allow-camera'),
                () => (blocked ? void Linking.openSettings() : void requestPermission())
            );
        }

        if (requireLocation && (locationPermission === 'denied' || locationPermission === 'blocked')) {
            return blockingMessage(
                'location-outline',
                t('camera-location-permission'),
                locationPermission === 'blocked' ? t('open-settings') : t('camera-allow-location'),
                () => (locationPermission === 'blocked' ? void Linking.openSettings() : retryLocation())
            );
        }

        if (requireLocation && locationPermission === 'granted' && !servicesOn) {
            return blockingMessage('location-outline', t('camera-location-off'), t('camera-turn-on-location'), openLocationSettings);
        }

        if (preview) {
            return (
                <View className="flex-1">
                    <Image source={{ uri: preview.uri }} style={{ flex: 1 }} resizeMode="contain" resizeMethod="resize" />
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
                    {renderLocationStatus()}
                    <TouchableOpacity
                        onPress={capture}
                        disabled={!shutterEnabled}
                        activeOpacity={0.7}
                        className="items-center justify-center rounded-full"
                        style={{ width: 76, height: 76, borderWidth: 4, borderColor: '#fff', opacity: shutterEnabled || capturing ? 1 : 0.4 }}
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
