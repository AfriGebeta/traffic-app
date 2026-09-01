import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { useRemoteConfig } from '../../../shared/contexts/RemoteConfigContext';
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
import { segmentToGeoJSON, fitBoundsToCoords } from '../utils/navigationPreviewUtils';

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

export default function RouteDirectionsPreviewScreen() {
    useKeepAwake();
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { currentTheme } = useMapTheme();
    const { apiKey } = useRemoteConfig();
    const { userLocation } = useUserLocation();
    const [frozenUserLocation] = useState(userLocation);
    const mapRef = useRef<GebetaMapRef>(null);

    const previewData = getNavigationPreviewData();
    const [mapReady, setMapReady] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [showAllSteps, setShowAllSteps] = useState(false);
    const hasSteppedRef = useRef(false);

    const steps = previewData?.previewSteps ?? [];
    const currentStep = steps[stepIndex];

    const activeSegmentGeoJSON = useMemo(() => {
        if (!currentStep?.segmentCoords?.length) return null;
        return segmentToGeoJSON(currentStep.segmentCoords);
    }, [currentStep]);

    useEffect(() => {
        return () => clearNavigationPreviewData();
    }, []);

    const [initialCamera] = useState(() => {
        const coords = previewData?.routeGeoJSON?.geometry?.coordinates as [number, number][] | undefined;
        const fit = coords?.length ? fitBoundsToCoords(coords) : null;
        if (fit) return { center: fit.center, zoom: Math.max(fit.zoom - 1, 9) };

        const fallback = previewData?.origin
            ? [previewData.origin.longitude, previewData.origin.latitude] as [number, number]
            : coords?.[0];
        return { center: fallback, zoom: 13 };
    });
    const mapRouteStyle = useMemo(() => ({
        color: colors.primary.main,
        width: 6,
        opacity: 0.9,
    }), []);

    const mapSelectedDestination = useMemo(() => (previewData?.destination ? {
        latitude: previewData.destination.latitude,
        longitude: previewData.destination.longitude,
        name: previewData.destination.name,
    } : undefined), [previewData?.destination]);

    const mapWaypointMarkers = useMemo(() => (previewData?.waypoints?.length
        ? previewData.waypoints.map((wp) => ({
            latitude: wp.latitude,
            longitude: wp.longitude,
            name: wp.name,
        }))
        : undefined), [previewData?.waypoints]);

    const mapPreviewStepLocation = useMemo(() => (currentStep
        ? { lng: currentStep.center[0], lat: currentStep.center[1] }
        : null), [currentStep]);

    useEffect(() => {
        if (!mapReady || !mapRef.current || !currentStep) return;
        if (!hasSteppedRef.current) return;

        const fit = fitBoundsToCoords(currentStep.segmentCoords);
        if (fit) {
            mapRef.current.flyTo({
                center: fit.center,
                zoom: Math.min(fit.zoom + 1, 18),
                duration: 700,
                pitch: 0,
            });
        } else if (currentStep.center) {
            mapRef.current.flyTo({
                center: currentStep.center,
                zoom: 17,
                duration: 700,
                pitch: 0,
            });
        }
    }, [mapReady, stepIndex, currentStep]);

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
                freeCamera
                staticInitialCamera
                apiKey={apiKey || ''}
                mapStyleUrl={
                    currentTheme.styleUrl
                        ? `${currentTheme.styleUrl}?apiKey=${apiKey}`
                        : undefined
                }
                mapStyleJson={currentTheme.styleJson}
                center={initialCamera.center}
                zoom={initialCamera.zoom}
                onMapLoaded={() => setMapReady(true)}
                routeGeoJSON={routeGeoJSON}
                routeStyle={mapRouteStyle}
                activeSegmentGeoJSON={activeSegmentGeoJSON}
                previewStepLocation={mapPreviewStepLocation}
                selectedDestination={mapSelectedDestination}
                routeOrigin={origin}
                userLocation={frozenUserLocation ?? userLocation}
                showUserLocationMarker={!origin}
                waypointMarkers={mapWaypointMarkers}
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
                <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.97)', borderRadius: 24 }}>
                    <View style={{ borderRadius: 24 }}>
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
                                    onPress={() => { hasSteppedRef.current = true; setStepIndex((i) => Math.max(0, i - 1)); }}
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
                                    onPress={() => { hasSteppedRef.current = true; setStepIndex((i) => Math.min(steps.length - 1, i + 1)); }}
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
                                        onPress={() => { hasSteppedRef.current = true; setStepIndex(index); }}
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
                </View>
            </View>
        </View>
    );
}
