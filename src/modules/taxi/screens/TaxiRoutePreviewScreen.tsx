import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import GebetaMap from '../../../components/GebetaMap';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { colors } from '../../../shared/theme/colors';
import { showToast } from '../../../shared/utils/toast';
import { useMapTheme } from '../../map/context/MapThemeContext';
import { TaxiNavigationResponse } from '../types/taxi.types';

export default function TaxiRoutePreviewScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { currentTheme } = useMapTheme();
    const mapRef = useRef<GebetaMapRef>(null);

    const [mapReady, setMapReady] = useState(false);

    const routeData: TaxiNavigationResponse | null = params.routeData
        ? JSON.parse(params.routeData as string)
        : null;

    if (!routeData) {
        return (
            <View className="flex-1 bg-gray-50 items-center justify-center">
                <Text className="text-gray-600">{t('error')}</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-4">
                    <Text className="text-orange-500">{t('go-back')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const { origin, destination, startNode, endNode, formattedPath, summary, originWalkRoute, destinationWalkRoute, segments } = routeData;

    const walkRoutes = segments?.filter(seg => seg.type === 'walk' || seg.mode === 'pedestrian').map((seg, idx) => ({
        type: idx === 0 ? 'origin' as const : 'destination' as const,
        polyline: seg.polyline
    })) || [];

    console.log('[TaxiRoutePreview] Walk routes prepared:', {
        segmentsCount: segments?.length || 0,
        walkRoutesCount: walkRoutes.length,
        walkRoutes: walkRoutes.map(r => ({ type: r.type, polylineLength: r.polyline.length }))
    });

    const { decodePolyline } = require('../../../shared/utils/polyline');
    const taxiSegments = segments?.filter(seg => seg.type === 'taxi' || seg.mode === 'auto').map(seg => {
        const decoded = decodePolyline(seg.polyline, 6);
        return {
            coordinates: decoded.map(([lat, lng]: [number, number]) => [lng, lat] as [number, number]),
            cost: seg.fare || 0,
            from: seg.fromNode?.name || '',
            to: seg.toNode?.name || ''
        };
    }) || [];

    console.log('[TaxiRoutePreview] Taxi segments prepared:', {
        taxiSegmentsCount: taxiSegments.length,
        taxiSegments: taxiSegments.map(s => ({ from: s.from, to: s.to, coordsCount: s.coordinates.length }))
    });

    useEffect(() => {
        if (mapReady && mapRef.current) {
            mapRef.current.addImageMarker(
                [startNode.lng, startNode.lat],
                '',
                [40, 40],
                () => showToast.info(startNode.name, 'Boarding Point'),
                10
            );

            mapRef.current.addImageMarker(
                [endNode.lng, endNode.lat],
                '',
                [40, 40],
                () => showToast.info(endNode.name, 'Drop-off Point'),
                10
            );

            const allCoords = [
                [origin.lng, origin.lat],
                [startNode.lng, startNode.lat],
                [endNode.lng, endNode.lat],
                [destination.lng, destination.lat],
            ];

            const lngs = allCoords.map(c => c[0]);
            const lats = allCoords.map(c => c[1]);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);

            const centerLng = (minLng + maxLng) / 2;
            const centerLat = (minLat + maxLat) / 2;

            mapRef.current.flyTo({
                center: [centerLng, centerLat],
                zoom: 12,
                duration: 1000,
            });
        }
    }, [mapReady, startNode, endNode, origin, destination]);

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

    const handleStartNavigation = () => {
        showToast.info(t('coming-soon'), 'Active taxi navigation will be implemented in Phase 5');
        router.back();
    };

    return (
        <View className="flex-1 bg-gray-50">
            <View className="flex-1">
                <GebetaMap
                    ref={mapRef}
                    apiKey={process.env.EXPO_PUBLIC_GEBETA_API_KEY || ''}
                    mapStyleUrl={currentTheme.styleUrl ? `${currentTheme.styleUrl}?apiKey=${process.env.EXPO_PUBLIC_GEBETA_API_KEY}` : undefined}
                    mapStyleJson={currentTheme.styleJson}
                    center={[origin.lng, origin.lat]}
                    zoom={13}
                    onMapLoaded={() => setMapReady(true)}
                    taxiWalkRoutes={walkRoutes.length > 0 ? walkRoutes : undefined}
                    taxiRouteSegments={taxiSegments.length > 0 ? taxiSegments : undefined}
                />

                {!mapReady && (
                    <View className="absolute inset-0 items-center justify-center bg-gray-100">
                        <ActivityIndicator size="large" color={colors.primary.main} />
                    </View>
                )}

                <View
                    className="absolute left-4 bg-white rounded-full shadow-lg"
                    style={{ top: insets.top + 16 }}
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-12 h-12 items-center justify-center"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={24} color="#374151" />
                    </TouchableOpacity>
                </View>
            </View>

            <View
                className="bg-white rounded-t-3xl shadow-2xl"
                style={{ paddingBottom: insets.bottom + 16 }}
            >
                <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
                    <View className="px-6 pt-6 pb-4 border-b border-gray-200">
                        <Text className="text-2xl font-bold text-gray-900 mb-2">
                            {t('taxi-route')}
                        </Text>
                        <Text className="text-gray-600">{formattedPath}</Text>
                    </View>

                    <View className="px-6 py-4">

                        {segments && segments.map((segment: any, index: number) => {
                            const isWalkSegment = segment.type === 'walk' || segment.mode === 'pedestrian';
                            const isTaxiSegment = segment.type === 'taxi' || segment.mode === 'auto';

                            if (isWalkSegment) {
                                return (
                                    <View key={index} className="mb-4">
                                        <View className="flex-row items-center mb-2">
                                            <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center">
                                                <Ionicons name="walk" size={18} color="#3B82F6" />
                                            </View>
                                            <Text className="text-gray-900 font-semibold ml-3 flex-1">
                                                {index === 0 ? t('walk-to-boarding-point') : t('walk-to-destination')}
                                            </Text>
                                            <Text className="text-gray-600 text-sm">
                                                {formatDistance(segment.distance * 1000)}
                                            </Text>
                                        </View>
                                        <View className="ml-4 pl-4 border-l-2 border-blue-200">
                                            <Text className="text-gray-600 text-sm">
                                                {segment.toNode?.name || (index === 0 ? startNode.name : t('final-destination'))}
                                            </Text>
                                            <Text className="text-gray-500 text-xs mt-1">
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
                                            <View
                                                className="w-8 h-8 rounded-full items-center justify-center"
                                                style={{ backgroundColor: colors.primary.light }}
                                            >
                                                <Ionicons name="car" size={18} color={colors.primary.main} />
                                            </View>
                                            <Text className="text-gray-900 font-semibold ml-3 flex-1">
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
                                            <Text className="text-gray-600 text-sm">
                                                {segment.fromNode?.name || startNode.name} → {segment.toNode?.name || endNode.name}
                                            </Text>
                                            <Text className="text-gray-500 text-xs mt-1">
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
                                            <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center">
                                                <Ionicons name="walk" size={18} color="#3B82F6" />
                                            </View>
                                            <Text className="text-gray-900 font-semibold ml-3 flex-1">
                                                {t('walk-to-boarding-point')}
                                            </Text>
                                            <Text className="text-gray-600 text-sm">
                                                {formatDistance(originWalkRoute.trip.summary.length)}
                                            </Text>
                                        </View>
                                        <View className="ml-4 pl-4 border-l-2 border-blue-200">
                                            <Text className="text-gray-600 text-sm">
                                                {startNode.name}
                                            </Text>
                                            <Text className="text-gray-500 text-xs mt-1">
                                                {formatTime(originWalkRoute.trip.summary.time)}
                                            </Text>
                                        </View>
                                    </View>
                                )}

                                <View className="mb-4">
                                    <View className="flex-row items-center mb-2">
                                        <View
                                            className="w-8 h-8 rounded-full items-center justify-center"
                                            style={{ backgroundColor: colors.primary.light }}
                                        >
                                            <Ionicons name="car" size={18} color={colors.primary.main} />
                                        </View>
                                        <Text className="text-gray-900 font-semibold ml-3 flex-1">
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
                                        <Text className="text-gray-600 text-sm">
                                            {startNode.name} → {endNode.name}
                                        </Text>
                                        <Text className="text-gray-500 text-xs mt-1">
                                            {summary.taxiSegments} {t('stops')} • {startNode.route_name}
                                        </Text>
                                    </View>
                                </View>

                                {destinationWalkRoute && (
                                    <View className="mb-4">
                                        <View className="flex-row items-center mb-2">
                                            <View className="w-8 h-8 rounded-full bg-green-100 items-center justify-center">
                                                <Ionicons name="walk" size={18} color="#10B981" />
                                            </View>
                                            <Text className="text-gray-900 font-semibold ml-3 flex-1">
                                                {t('walk-to-destination')}
                                            </Text>
                                            <Text className="text-gray-600 text-sm">
                                                {formatDistance(destinationWalkRoute.trip.summary.length)}
                                            </Text>
                                        </View>
                                        <View className="ml-4 pl-4 border-l-2 border-green-200">
                                            <Text className="text-gray-600 text-sm">
                                                {t('final-destination')}
                                            </Text>
                                            <Text className="text-gray-500 text-xs mt-1">
                                                {formatTime(destinationWalkRoute.trip.summary.time)}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                            </>
                        )}
                    </View>

                    <View className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                        <View className="flex-row items-center justify-between mb-2">
                            <Text className="text-gray-600">{t('total-fare')}</Text>
                            <Text
                                className="text-2xl font-bold"
                                style={{ color: colors.primary.main }}
                            >
                                {summary.estimatedFare} {summary.currency}
                            </Text>
                        </View>
                        <View className="flex-row items-center justify-between">
                            <Text className="text-gray-500 text-sm">
                                {summary.taxiSegments} {t('taxi-segments')} • {summary.walkSegments} {t('walk-segments')}
                            </Text>
                            <Text className="text-gray-500 text-sm">
                                {summary.pricingSource}
                            </Text>
                        </View>
                    </View>
                </ScrollView>

                <View className="px-6 pt-4">
                    <TouchableOpacity
                        onPress={handleStartNavigation}
                        className="rounded-2xl py-4 shadow-lg"
                        style={{
                            backgroundColor: colors.primary.main,
                            shadowColor: colors.primary.main,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 8,
                        }}
                        activeOpacity={0.8}
                    >
                        <Text className="text-white text-center font-bold text-lg">
                            {t('start-navigation')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
