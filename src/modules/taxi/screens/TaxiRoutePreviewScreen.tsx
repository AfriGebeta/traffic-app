import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import GebetaMap from '../../../components/GebetaMap';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { showToast } from '../../../shared/utils/toast';
import { useMapTheme } from '../../map/context/MapThemeContext';
import { useRemoteConfig } from '../../../shared/contexts/RemoteConfigContext';
import { TaxiNavigationResponse } from '../types/taxi.types';
import { decodeTaxiSegmentPaths } from '../../navigation/utils/navigationUtils';
import { fitBoundsToCoords } from '../../navigation/utils/navigationPreviewUtils';

export default function TaxiRoutePreviewScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { currentTheme } = useMapTheme();
    const { colors: theme, isDark } = useTheme();
    const { apiKey } = useRemoteConfig();
    const mapRef = useRef<GebetaMapRef>(null);

    const [mapReady, setMapReady] = useState(false);

    const routeData: TaxiNavigationResponse | null = useMemo(
        () => (params.routeData ? JSON.parse(params.routeData as string) : null),
        [params.routeData]
    );

    if (!routeData) {
        return (
            <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
                <Text style={{ color: theme.textSecondary }}>{t('error')}</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-4">
                    <Text style={{ color: theme.primary }}>{t('go-back')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const { origin, destination, startNode, endNode, formattedPath, summary, originWalkRoute, destinationWalkRoute, segments } = routeData;

    const segmentPaths = useMemo(() => decodeTaxiSegmentPaths(segments ?? []), [segments]);

    const walkRoutes = useMemo(() => (segments ?? [])
        .map((seg, idx) => ({ seg, idx }))
        .filter(({ seg }) => seg.type === 'walk' || seg.mode === 'pedestrian')
        .map(({ seg, idx }) => ({
            type: idx === 0 ? 'origin' as const
                : idx === (segments?.length ?? 0) - 1 ? 'destination' as const
                    : 'transfer' as const,
            polyline: seg.polyline ?? '',
            coordinates: segmentPaths[idx].map(([lat, lng]: [number, number]) => [lng, lat] as [number, number]),
        }))
        .filter(route => route.coordinates.length >= 2), [segments, segmentPaths]);

    console.log('[TaxiRoutePreview] Walk routes prepared:', {
        segmentsCount: segments?.length || 0,
        walkRoutesCount: walkRoutes.length,
        walkRoutes: walkRoutes.map(r => ({ type: r.type, polylineLength: r.polyline.length }))
    });

    const taxiSegments = useMemo(() => (segments ?? [])
        .map((seg, idx) => ({ seg, idx }))
        .filter(({ seg }) => seg.type === 'taxi' || seg.mode === 'auto')
        .map(({ seg, idx }) => ({
            coordinates: segmentPaths[idx].map(([lat, lng]: [number, number]) => [lng, lat] as [number, number]),
            cost: seg.fare || 0,
            from: seg.fromNode?.name || '',
            to: seg.toNode?.name || ''
        })), [segments, segmentPaths]);

    const taxiStations = useMemo(() => (segments ? [
        {
            id: startNode.id || 1,
            name: startNode.name,
            lat: startNode.lat,
            lng: startNode.lng,
            type: 'start' as const
        },
        {
            id: endNode.id || 2,
            name: endNode.name,
            lat: endNode.lat,
            lng: endNode.lng,
            type: 'end' as const
        }
    ] : []), [segments, startNode, endNode]);

    console.log('[TaxiRoutePreview] Taxi segments prepared:', {
        taxiSegmentsCount: taxiSegments.length,
        taxiSegments: taxiSegments.map(s => ({ from: s.from, to: s.to, coordsCount: s.coordinates.length })),
        taxiStations: taxiStations.map(s => ({ name: s.name, type: s.type }))
    });

    const didAddMarkersRef = useRef(false);

    useEffect(() => {
        if (!mapReady || !mapRef.current || didAddMarkersRef.current) return;
        didAddMarkersRef.current = true;

        mapRef.current.addImageMarker(
            [startNode.lng, startNode.lat],
            '',
            [40, 40],
            () => showToast(`${startNode.name}: Boarding Point`),
            10
        );

        mapRef.current.addImageMarker(
            [endNode.lng, endNode.lat],
            '',
            [40, 40],
            () => showToast(`${endNode.name}: Drop-off Point`),
            10
        );
    }, [mapReady, startNode, endNode]);

    const formatDistance = (meters: number): string => {
        if (meters < 1000) {
            return `${Math.round(meters)} m`;
        }
        return `${(meters / 1000).toFixed(1)} km`;
    };

    const formatTime = (seconds: number): string => {
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
            return `${minutes} min`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours} hr ${remainingMinutes} min`;
    };

    const [initialCamera] = useState(() => {
        const endpointCoords = [origin, startNode, endNode, destination]
            .filter((point): point is { lat: number; lng: number } =>
                !!point && Number.isFinite(point.lng) && Number.isFinite(point.lat))
            .map((point) => [point.lng, point.lat] as [number, number]);

        const fit = fitBoundsToCoords([
            ...endpointCoords,
            ...taxiSegments.flatMap((segment) => segment.coordinates),
            ...walkRoutes.flatMap((route) => route.coordinates),
        ]);

        if (!fit) return { center: [startNode.lng, startNode.lat] as [number, number], zoom: 13 };

        return { center: fit.center, zoom: Math.max(fit.zoom - 2, 9) };
    });

    useEffect(() => {
        if (mapReady) return;
        const timer = setTimeout(() => {
            console.warn('[TaxiRoutePreview] onMapLoaded never fired — revealing map anyway');
            setMapReady(true);
        }, 4000);
        return () => clearTimeout(timer);
    }, [mapReady]);

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <View className="flex-1">
                <GebetaMap
                    ref={mapRef}
                    apiKey={apiKey || ''}
                    mapStyleUrl={currentTheme.styleUrl ? `${currentTheme.styleUrl}?apiKey=${apiKey}` : undefined}
                    mapStyleJson={currentTheme.styleJson}
                    center={initialCamera.center}
                    zoom={initialCamera.zoom}
                    externalCameraControl
                    freeCamera
                    staticInitialCamera
                    onMapLoaded={() => setMapReady(true)}
                    taxiWalkRoutes={walkRoutes.length > 0 ? walkRoutes : undefined}
                    taxiRouteSegments={taxiSegments.length > 0 ? taxiSegments : undefined}
                    taxiStations={taxiStations.length > 0 ? taxiStations : undefined}
                />

                {!mapReady && (
                    <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: theme.background }}>
                        <ActivityIndicator size="large" color={colors.primary.main} />
                    </View>
                )}

                <View
                    className="absolute left-4 rounded-full shadow-lg"
                    style={{ top: insets.top + 16, backgroundColor: theme.surface }}
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-12 h-12 items-center justify-center"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                    </TouchableOpacity>
                </View>
            </View>

            <View
                className="rounded-t-3xl shadow-2xl"
                style={{ paddingBottom: insets.bottom + 16, backgroundColor: theme.background }}
            >
                <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
                    <View className="px-6 pt-6 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
                        <Text className="text-2xl font-bold mb-2" style={{ color: theme.textPrimary }}>
                            {t('taxi-route')}
                        </Text>
                        <Text style={{ color: theme.textSecondary }}>{formattedPath}</Text>
                    </View>

                    <View className="px-6 py-4">

                        {segments && segments.map((segment: any, index: number) => {
                            const isWalkSegment = segment.type === 'walk' || segment.mode === 'pedestrian';
                            const isTaxiSegment = segment.type === 'taxi' || segment.mode === 'auto';

                            if (isWalkSegment) {
                                const isDestinationWalk = index === segments.length - 1;

                                if (index !== 0 && !isDestinationWalk && !segment.distance && !segment.time) {
                                    return null;
                                }

                                return (
                                    <View key={index} className="mb-4">
                                        <View className="flex-row items-center mb-2">
                                            <View className="w-8 h-8 items-center justify-center">
                                                <Ionicons name="walk" size={20} color={theme.blue} />
                                            </View>
                                            <Text className="font-semibold ml-3 flex-1" style={{ color: theme.textPrimary }}>
                                                {isDestinationWalk ? t('walk-to-destination') : t('walk-to-boarding-point')}
                                            </Text>
                                            <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                                {formatDistance(segment.distance * 1000)}
                                            </Text>
                                        </View>
                                        <View className="ml-4 pl-4" style={{ borderLeftWidth: 2, borderLeftColor: theme.blueMuted }}>
                                            <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                                {segment.toNode?.name || (index === 0 ? startNode.name : t('final-destination'))}
                                            </Text>
                                            <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                                                {formatTime(segment.time)}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            }

                            if (isTaxiSegment) {
                                return (
                                    <View key={index} className="mb-4">
                                        <View className="flex-row items-center mb-2">
                                            <View className="w-8 h-8 items-center justify-center">
                                                <Ionicons name="car" size={20} color={colors.primary.main} />
                                            </View>
                                            <Text className="font-semibold ml-3 flex-1" style={{ color: theme.textPrimary }}>
                                                {t('taxi-ride')}
                                            </Text>
                                            <Text
                                                className="font-bold text-sm"
                                                style={{ color: colors.primary.main }}
                                            >
                                                {segment.fare || summary.estimatedFare} {summary.currency}
                                            </Text>
                                        </View>
                                        <View
                                            className="ml-4 pl-4 border-l-2"
                                            style={{ borderLeftColor: colors.primary.light }}
                                        >
                                            <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                                {segment.fromNode?.name || startNode.name} → {segment.toNode?.name || endNode.name}
                                            </Text>
                                            <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                                                {formatDistance(segment.distance * 1000)} • {formatTime(segment.time)}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            }

                            return null;
                        })}

                        {(!segments || segments.length === 0) && (
                            <>
                                {originWalkRoute && (
                                    <View className="mb-4">
                                        <View className="flex-row items-center mb-2">
                                            <View className="w-8 h-8 items-center justify-center">
                                                <Ionicons name="walk" size={20} color={theme.blue} />
                                            </View>
                                            <Text className="font-semibold ml-3 flex-1" style={{ color: theme.textPrimary }}>
                                                {t('walk-to-boarding-point')}
                                            </Text>
                                            <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                                {formatDistance(originWalkRoute.trip.summary.length)}
                                            </Text>
                                        </View>
                                        <View className="ml-4 pl-4" style={{ borderLeftWidth: 2, borderLeftColor: theme.blueMuted }}>
                                            <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                                {startNode.name}
                                            </Text>
                                            <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                                                {formatTime(originWalkRoute.trip.summary.time)}
                                            </Text>
                                        </View>
                                    </View>
                                )}

                                <View className="mb-4">
                                    <View className="flex-row items-center mb-2">
                                        <View className="w-8 h-8 items-center justify-center">
                                            <Ionicons name="car" size={20} color={colors.primary.main} />
                                        </View>
                                        <Text className="font-semibold ml-3 flex-1" style={{ color: theme.textPrimary }}>
                                            {t('taxi-ride')}
                                        </Text>
                                        <Text
                                            className="font-bold text-sm"
                                            style={{ color: colors.primary.main }}
                                        >
                                            {summary.estimatedFare} {summary.currency}
                                        </Text>
                                    </View>
                                    <View
                                        className="ml-4 pl-4 border-l-2"
                                        style={{ borderLeftColor: colors.primary.light }}
                                    >
                                        <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                            {startNode.name} → {endNode.name}
                                        </Text>
                                        <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                                            {summary.taxiSegments} {t('stops')} • {startNode.route_name}
                                        </Text>
                                    </View>
                                </View>

                                {destinationWalkRoute && (
                                    <View className="mb-4">
                                        <View className="flex-row items-center mb-2">
                                            <View className="w-8 h-8 items-center justify-center">
                                                <Ionicons name="walk" size={20} color={theme.green} />
                                            </View>
                                            <Text className="font-semibold ml-3 flex-1" style={{ color: theme.textPrimary }}>
                                                {t('walk-to-destination')}
                                            </Text>
                                            <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                                {formatDistance(destinationWalkRoute.trip.summary.length)}
                                            </Text>
                                        </View>
                                        <View className="ml-4 pl-4" style={{ borderLeftWidth: 2, borderLeftColor: theme.greenMuted }}>
                                            <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                                {t('final-destination')}
                                            </Text>
                                            <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                                                {formatTime(destinationWalkRoute.trip.summary.time)}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                            </>
                        )}
                    </View>

                    <View className="px-6 py-4" style={{ backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border }}>
                        {/* dev-only movement simulation — needs the simulateMovement state and
                            a start-navigation handler back if this is ever re-enabled:
                        {__DEV__ && (
                            <TouchableOpacity
                                onPress={() => setSimulateMovement(!simulateMovement)}
                                className="flex-row items-center justify-between mb-4 py-2"
                                activeOpacity={0.7}
                            >
                                <View className="flex-row items-center">
                                    <Ionicons
                                        name={simulateMovement ? "checkmark-circle" : "ellipse-outline"}
                                        size={24}
                                        color={simulateMovement ? colors.primary.main : theme.textSecondary}
                                    />
                                    <Text className="font-medium ml-3" style={{ color: theme.textPrimary }}>
                                        Simulate Movement (testing)
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        */}
                        <View className="flex-row items-center justify-between mb-2">
                            <Text style={{ color: theme.textSecondary }}>{t('total-fare')}</Text>
                            <Text
                                className="text-2xl font-bold"
                                style={{ color: colors.primary.main }}
                            >
                                {summary.estimatedFare} {summary.currency}
                            </Text>
                        </View>
                    </View>
                </ScrollView>

            </View>

        </View>
    );
}
