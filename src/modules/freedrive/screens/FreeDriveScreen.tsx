import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../../shared/theme/ThemeContext';
import { colors as palette } from '../../../shared/theme/colors';
import { useMapTheme } from '../../map/context/MapThemeContext';
import { IncidentReportSheet } from '../../map/components/IncidentReportSheet';
import { IncidentAlert } from '../../map/components/IncidentAlert';
import { useIncidentAlerts } from '../../map/hooks/useIncidentAlerts';
import { useRuleAlerts } from '../../map/hooks/useRuleAlerts';
import { useIncidents } from '../../incidents/hooks/useIncidents';
import type { TrafficRuleReport } from '../../rules/types/rule.types';
import { headingRayCoordinates } from '../utils/geo';
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
    const [showReportOptions, setShowReportOptions] = useState(false);

    const reportLocation = useMemo(
        () => (fix ? { lat: fix.lat, lng: fix.lng } : handoverCenter),
        [fix, handoverCenter]
    );

    const { incidents } = useIncidents();
    const [rules, setRules] = useState<TrafficRuleReport[]>([]);

    useEffect(() => {
        let cancelled = false;
        import('../../rules/services/rule.service')
            .then(({ ruleService }) => ruleService.getAllReports())
            .then((data) => {
                if (!cancelled) setRules(data);
            })
            .catch(() => { });
        return () => { cancelled = true; };
    }, []);

    const aheadCoordinates = useMemo(() => {
        if (!fix) return undefined;
        const bearing = fix.roadBearing ?? fix.heading;
        if (bearing === null || bearing === undefined) return undefined;
        return headingRayCoordinates({ lat: fix.lat, lng: fix.lng }, bearing);
    }, [fix]);

    const { activeAlert: activeIncidentAlert, dismissAlert: dismissIncidentAlert } = useIncidentAlerts(
        reportLocation,
        incidents,
        true,
        aheadCoordinates
    );
    const activeRuleAlert = useRuleAlerts(reportLocation, rules, true, aheadCoordinates);

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

            {activeIncidentAlert && (
                <IncidentAlert
                    incidentId={activeIncidentAlert.incidentId}
                    incidentName={activeIncidentAlert.incidentName}
                    distance={activeIncidentAlert.distance}
                    distanceKm={activeIncidentAlert.distanceKm}
                    incidentType={activeIncidentAlert.incidentType}
                    onDismiss={dismissIncidentAlert}
                    topOffset={12}
                />
            )}

            {activeRuleAlert && (
                <View
                    style={[
                        styles.ruleBadge,
                        { bottom: insets.bottom + 108, backgroundColor: colors.surface },
                    ]}
                >
                    <Image
                        source={{ uri: activeRuleAlert.ruleImg }}
                        style={{ width: 38, height: 38 }}
                        resizeMode="contain"
                    />
                </View>
            )}

            <TouchableOpacity
                onPress={() => setShowReportOptions(true)}
                activeOpacity={0.85}
                accessibilityRole="button"
                style={[
                    styles.reportButton,
                    { bottom: insets.bottom + 108, backgroundColor: palette.primary.main },
                ]}
            >
                <Ionicons name="warning-outline" size={24} color="#fff" />
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

            <IncidentReportSheet
                isVisible={showReportOptions}
                onClose={() => setShowReportOptions(false)}
                userLocation={reportLocation}
                isNavigating={true}
            />
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
    ruleBadge: {
        position: 'absolute',
        left: 16,
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
    reportButton: {
        position: 'absolute',
        right: 16,
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
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
