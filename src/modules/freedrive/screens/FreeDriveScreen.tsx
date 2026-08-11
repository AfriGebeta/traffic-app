import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useMapTheme } from '../../map/context/MapThemeContext';
import FreeDriveMap, {
    FreeDriveMapHandle,
    FreeDriveTelemetry,
} from '../components/FreeDriveMap';
import { useFreeDriveLocation } from '../hooks/useFreeDriveLocation';
import type { MotionFix } from '../utils/motionModel';

const FreeDriveScreen: React.FC = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t, i18n } = useTranslation();
    const { colors, isDark } = useTheme();
    const { currentTheme } = useMapTheme();
    useKeepAwake();

    const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
    const handoverCenter = useMemo(() => {
        const lat = Number(params.lat);
        const lng = Number(params.lng);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    }, [params.lat, params.lng]);

    const mapHandle = useRef<FreeDriveMapHandle>(null);

    const [fix, setFix] = useState<MotionFix | null>(null);
    const [telemetry, setTelemetry] = useState<FreeDriveTelemetry | null>(null);
    const [cameraFree, setCameraFree] = useState(false);

    const onFix = useCallback((next: MotionFix) => setFix(next), []);
    const { status } = useFreeDriveLocation({ enabled: true, onFix });

    const speedKmh = telemetry ? Math.round(telemetry.speed * 3.6) : 0;
    const surface = isDark ? 'rgba(17,24,39,0.92)' : 'rgba(255,255,255,0.94)';

    return (
        <View style={styles.root}>
            <FreeDriveMap
                ref={mapHandle}
                styleJson={currentTheme.styleJson}
                styleUrl={currentTheme.styleUrl}
                fix={fix}
                initialCenter={handoverCenter}
                nameLang={i18n.language === 'am' ? 'am' : 'latin'}
                onTelemetry={setTelemetry}
                onCameraFreeChange={setCameraFree}
            />

            <TouchableOpacity
                onPress={() => router.back()}
                activeOpacity={0.8}
                style={[
                    styles.iconButton,
                    { top: insets.top + 12, left: 16, backgroundColor: surface },
                ]}
            >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>

            {cameraFree && (
                <View style={[styles.recenterRow, { bottom: insets.bottom + 108 }]}>
                    <TouchableOpacity
                        onPress={() => mapHandle.current?.recenter()}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        style={[styles.recenterButton, { backgroundColor: colors.surface }]}
                    >
                        <Ionicons name="navigate" size={20} color="#0F9D58" />
                        <Text style={[styles.recenterLabel, { color: colors.textPrimary }]}>
                            {t('recenter', 'Re-center')}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            <View
                style={[
                    styles.hud,
                    { bottom: insets.bottom + 24, backgroundColor: surface },
                ]}
            >
                <View style={styles.speedBlock}>
                    <Text style={[styles.speedValue, { color: colors.textPrimary }]}>
                        {speedKmh}
                    </Text>
                    <Text style={[styles.speedUnit, { color: colors.textSecondary }]}>
                        km/h
                    </Text>
                </View>
                <View style={styles.roadBlock}>
                    {!!telemetry?.roadName && (
                        <Text
                            numberOfLines={1}
                            style={[styles.roadName, { color: colors.textPrimary }]}
                        >
                            {telemetry.roadName}
                        </Text>
                    )}
                    <Text
                        style={[
                            styles.statusText,
                            { color: telemetry?.roadName ? colors.textSecondary : colors.textPrimary },
                        ]}
                    >
                        {status === 'denied'
                            ? t('location-permission-required', 'Location permission required')
                            : status !== 'tracking'
                                ? t('acquiring-gps', 'Acquiring GPS…')
                                : telemetry?.snapped
                                    ? t('free-drive-on-road', 'On road')
                                    : t('free-drive-off-road', 'Off road')}
                    </Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1 },
    iconButton: {
        position: 'absolute',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
    hud: {
        position: 'absolute',
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 18,
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
    },
    recenterRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
    recenterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 9999,
        paddingVertical: 12,
        paddingHorizontal: 22,
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
    recenterLabel: { fontSize: 16, fontWeight: '600', marginLeft: 8 },
    speedBlock: { alignItems: 'center', minWidth: 72 },
    speedValue: { fontSize: 34, fontWeight: '700', lineHeight: 38 },
    speedUnit: { fontSize: 12, marginTop: -2 },
    roadBlock: { flex: 1, marginLeft: 16 },
    roadName: { fontSize: 16, fontWeight: '600' },
    statusText: { fontSize: 16, fontWeight: '600', marginTop: 2 },
});

export default FreeDriveScreen;
