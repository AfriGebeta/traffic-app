import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import GebetaMap from '../../../components/GebetaMap';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { colors } from '../../../shared/theme/colors';
import { useMapTheme } from '../../map/context/MapThemeContext';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { ManeuverSign } from '../components/ManeuverSign';
import {
    getNavigationPreviewData,
    clearNavigationPreviewData,
} from '../services/navigationPreviewCache';
import { segmentToGeoJSON } from '../utils/navigationPreviewUtils';

const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
};

const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours} hr ${minutes} min`;
    return `${minutes} min`;
};

const formatETA = (seconds: number): string => {
    const eta = new Date(Date.now() + seconds * 1000);
    const hours = eta.getHours();
    const minutes = eta.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

const fitBoundsToCoords = (coords: [number, number][]) => {
    if (coords.length === 0) return null;

    const bounds = coords.reduce(
        (acc, [lng, lat]) => ({
            minLng: Math.min(acc.minLng, lng),
            maxLng: Math.max(acc.maxLng, lng),
            minLat: Math.min(acc.minLat, lat),
            maxLat: Math.max(acc.maxLat, lat),
        }),
        {
            minLng: coords[0][0],
            maxLng: coords[0][0],
            minLat: coords[0][1],
            maxLat: coords[0][1],
        }
    );

    const centerLng = (bounds.minLng + bounds.maxLng) / 2;
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;
    const maxDiff = Math.max(bounds.maxLat - bounds.minLat, bounds.maxLng - bounds.minLng);

    let zoom = 16;
    if (maxDiff > 0.08) zoom = 12;
    else if (maxDiff > 0.04) zoom = 13;
    else if (maxDiff > 0.015) zoom = 14;
    else if (maxDiff > 0.006) zoom = 15;

    return { center: [centerLng, centerLat] as [number, number], zoom };
};

export default function RouteDirectionsPreviewScreen() {
    useKeepAwake();
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { currentTheme } = useMapTheme();
    const { userLocation } = useUserLocation();
    const mapRef = useRef<GebetaMapRef>(null);

    const previewData = getNavigationPreviewData();
    const [mapReady, setMapReady] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [showAllSteps, setShowAllSteps] = useState(false);
    const hasInitialFit = useRef(false);

    const steps = previewData?.previewSteps ?? [];
    const currentStep = steps[stepIndex];

    const activeSegmentGeoJSON = useMemo(() => {
        if (!currentStep?.segmentCoords?.length) return null;
        return segmentToGeoJSON(currentStep.segmentCoords);
    }, [currentStep]);

    useEffect(() => {
        return () => clearNavigationPreviewData();
    }, []);

    useEffect(() => {
        if (!mapReady || !mapRef.current || !previewData || !currentStep) return;

        const flyToStep = (coords: [number, number][], fallbackCenter?: [number, number]) => {
            const fit = fitBoundsToCoords(coords);
            if (fit) {
                mapRef.current?.flyTo({
                    center: fit.center,
                    zoom: Math.min(fit.zoom + 1, 18),
                    duration: 700,
                    pitch: 0,
                });
            } else if (fallbackCenter) {
                mapRef.current?.flyTo({
                    center: fallbackCenter,
                    zoom: 17,
                    duration: 700,
                    pitch: 0,
                });
            }
        };

        if (!hasInitialFit.current) {
            hasInitialFit.current = true;

            if (stepIndex === 0 && previewData.routeGeoJSON) {
                const coords = previewData.routeGeoJSON.geometry?.coordinates as [number, number][] | undefined;
                if (coords?.length) {
                    const fit = fitBoundsToCoords(coords);
                    if (fit) {
                        mapRef.current.flyTo({
                            center: fit.center,
                            zoom: fit.zoom,
                            duration: 1000,
                            pitch: 0,
                        });
                        return;
                    }
                }
            }
        }

        flyToStep(currentStep.segmentCoords, currentStep.center);
    }, [mapReady, stepIndex, currentStep, previewData]);

    if (!previewData || steps.length === 0) {
        return (
            <View className="flex-1 bg-white items-center justify-center">
                <Text className="text-gray-600 mb-4">{t('route-unavailable')}</Text>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={{ color: colors.primary.main, fontWeight: '600' }}>{t('go-back')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const { routeGeoJSON, destination, origin, distance, duration, waypoints } = previewData;
    const originLabel = origin?.name ?? t('your-location');

    return (
        <View className="flex-1">
            <GebetaMap
                ref={mapRef}
                externalCameraControl
                apiKey={process.env.EXPO_PUBLIC_GEBETA_API_KEY || ''}
                mapStyleUrl={
                    currentTheme.styleUrl
                        ? `${currentTheme.styleUrl}?apiKey=${process.env.EXPO_PUBLIC_GEBETA_API_KEY}`
                        : undefined
                }
                mapStyleJson={currentTheme.styleJson}
                center={
                    origin
                        ? [origin.longitude, origin.latitude]
                        : routeGeoJSON.geometry.coordinates[0]
                }
                zoom={13}
                onMapLoaded={() => setMapReady(true)}
                routeGeoJSON={routeGeoJSON}
                routeStyle={{
                    color: colors.primary.main,
                    width: 6,
                    opacity: 0.9,
                }}
                activeSegmentGeoJSON={activeSegmentGeoJSON}
                previewStepLocation={
                    currentStep
                        ? { lng: currentStep.center[0], lat: currentStep.center[1] }
                        : null
                }
                selectedDestination={{
                    latitude: destination.latitude,
                    longitude: destination.longitude,
                    name: destination.name,
                }}
                routeOrigin={origin}
                userLocation={userLocation}
                showUserLocationMarker={!origin}
                waypointMarkers={
                    waypoints.length > 0
                        ? waypoints.map((wp) => ({
                              latitude: wp.latitude,
                              longitude: wp.longitude,
                              name: wp.name,
                          }))
                        : undefined
                }
            />

            {!mapReady && (
                <View className="absolute inset-0 items-center justify-center bg-gray-100">
                    <ActivityIndicator size="large" color={colors.primary.main} />
                </View>
            )}

            <TouchableOpacity
                onPress={() => router.back()}
                className="absolute left-4 w-11 h-11 rounded-full bg-white items-center justify-center shadow-lg"
                style={{ top: insets.top + 12 }}
            >
                <Ionicons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>

            {currentStep && (
                <View
                    className="absolute items-center"
                    style={{
                        top: insets.top + 72,
                        left: 0,
                        right: 0,
                    }}
                    pointerEvents="none"
                >
                    <ManeuverSign maneuver={currentStep.maneuver} size="large" />
                </View>
            )}

            <View
                className="absolute left-4 right-4 rounded-3xl shadow-2xl overflow-hidden"
                style={{ bottom: insets.bottom > 0 ? insets.bottom + 8 : 24 }}
            >
                <BlurView intensity={100} tint="light" style={{ borderRadius: 24 }}>
                    <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.45)', borderRadius: 24 }}>
                        <View className="px-5 pt-4 pb-2 border-b border-gray-100">
                            <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
                                {destination.name}
                            </Text>
                            <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                                {t('from')} {originLabel} • {formatTime(duration)} • {formatDistance(distance)}
                            </Text>
                        </View>

                        <View className="px-5 py-4">
                            <View className="flex-row items-center justify-between mb-3">
                                <TouchableOpacity
                                    onPress={() => setStepIndex((i) => Math.max(0, i - 1))}
                                    disabled={stepIndex === 0}
                                    className="w-11 h-11 rounded-full bg-gray-100 items-center justify-center"
                                    style={{ opacity: stepIndex === 0 ? 0.35 : 1 }}
                                >
                                    <Ionicons name="chevron-back" size={26} color={colors.primary.main} />
                                </TouchableOpacity>

                                <View className="items-center">
                                    <Text className="text-sm font-semibold text-gray-600">
                                        {stepIndex + 1} / {steps.length}
                                    </Text>
                                    {currentStep && (
                                        <View className="mt-1">
                                            <ManeuverSign maneuver={currentStep.maneuver} size="medium" />
                                        </View>
                                    )}
                                </View>

                                <TouchableOpacity
                                    onPress={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
                                    disabled={stepIndex >= steps.length - 1}
                                    className="w-11 h-11 rounded-full bg-gray-100 items-center justify-center"
                                    style={{ opacity: stepIndex >= steps.length - 1 ? 0.35 : 1 }}
                                >
                                    <Ionicons name="chevron-forward" size={26} color={colors.primary.main} />
                                </TouchableOpacity>
                            </View>

                            <Text className="text-base font-semibold text-gray-900 leading-6 min-h-[48px]">
                                {currentStep?.maneuver.instruction}
                            </Text>

                            {currentStep && currentStep.maneuver.length > 0 && (
                                <Text className="text-sm text-gray-500 mt-2">
                                    {formatDistance(currentStep.maneuver.length * 1000)}
                                    {currentStep.maneuver.time > 0 && ` • ${formatTime(currentStep.maneuver.time)}`}
                                </Text>
                            )}
                        </View>

                        <TouchableOpacity
                            onPress={() => setShowAllSteps(!showAllSteps)}
                            className="px-5 py-2 border-t border-gray-100"
                        >
                            <Text className="text-center text-sm font-semibold" style={{ color: colors.primary.main }}>
                                {showAllSteps ? t('hide-steps') : t('show-all-steps')}
                            </Text>
                        </TouchableOpacity>

                        {showAllSteps && (
                            <ScrollView
                                className="max-h-48 border-t border-gray-100"
                                showsVerticalScrollIndicator={false}
                            >
                                {steps.map((step, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        onPress={() => setStepIndex(index)}
                                        className="px-5 py-3 flex-row items-center"
                                        style={{
                                            backgroundColor:
                                                index === stepIndex ? `${colors.primary.main}12` : 'transparent',
                                        }}
                                    >
                                        <View className="mr-3">
                                            <ManeuverSign maneuver={step.maneuver} size="medium" />
                                        </View>
                                        <View className="flex-1">
                                            <Text
                                                className="text-sm text-gray-900"
                                                style={{ fontWeight: index === stepIndex ? '600' : '400' }}
                                                numberOfLines={2}
                                            >
                                                {step.maneuver.instruction}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}

                        <View className="px-5 py-3 border-t border-gray-100">
                            <View className="bg-gray-200 rounded-2xl p-3 flex-row items-center justify-between">
                                <View>
                                    <Text className="text-2xl font-bold text-gray-900">{formatTime(duration)}</Text>
                                    <Text className="text-gray-500 text-xs mt-0.5">
                                        {t('eta')} {formatETA(duration)} • {formatDistance(distance)}
                                    </Text>
                                </View>
                                <Image
                                    source={require('../../../../assets/images/car-selected.png')}
                                    style={{ width: 28, height: 28 }}
                                    resizeMode="contain"
                                />
                            </View>
                        </View>
                    </View>
                </BlurView>
            </View>
        </View>
    );
}
