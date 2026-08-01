import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { GeocodingPlace, Maneuver } from '../types/navigation.types';
import { placeService } from '../../places/services/place.service';
import { showToast } from '../../../shared/utils/toast';
import type { SavedPlace } from '../../places/types/place.types';
import { taxiService } from '../../taxi/services/taxi.service';
import { navigationService } from '../services/navigation.service';
import type { TaxiNavigationResponse } from '../../taxi/types/taxi.types';

interface RoutePreviewProps {
    distance: number;
    duration: number;
    destinationName: string;
    simulateMovement: boolean;
    onSimulateToggle: () => void;
    onStartNavigation: () => void;
    onStartTaxiNavigation?: (taxiRoute: TaxiNavigationResponse) => void;
    onCancel: () => void;
    destination?: GeocodingPlace | null;
    userLocation?: { lat: number; lng: number } | null;
    onTaxiRouteChange?: (taxiRoute: TaxiNavigationResponse | null) => void;
    initialMode?: 'driving' | 'taxi' | 'walking';
    onModeChange?: (mode: 'driving' | 'taxi' | 'walking') => void;
    waypoints?: GeocodingPlace[];
    onWaypointsChange?: (waypoints: GeocodingPlace[]) => void;
    origin?: GeocodingPlace | null;
    onOriginChange?: (place: GeocodingPlace | null) => void;
    maneuvers?: Maneuver[];
    onPreviewPress?: () => void;
    routeOptions?: Array<{ distance: number; duration: number }>;
    selectedRouteIndex?: number;
    onSelectRoute?: (index: number) => void;
    isFetchingRoute?: boolean;
}

const formatDistance = (meters: number): string => {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
};

const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours} hr ${minutes} min`;
    }
    return `${minutes} min`;
};

const formatETA = (seconds: number): string => {
    const now = new Date();
    const eta = new Date(now.getTime() + seconds * 1000);
    const hours = eta.getHours();
    const minutes = eta.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

export const RoutePreview: React.FC<RoutePreviewProps> = ({
    distance,
    duration,
    destinationName,
    simulateMovement,
    onSimulateToggle,
    onStartNavigation,
    onStartTaxiNavigation,
    onCancel,
    destination,
    userLocation,
    onTaxiRouteChange,
    initialMode = 'driving',
    onModeChange,
    waypoints = [],
    onWaypointsChange,
    origin = null,
    onOriginChange,
    maneuvers = [],
    onPreviewPress,
    routeOptions,
    selectedRouteIndex = 0,
    onSelectRoute,
    isFetchingRoute = false,
}) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();
    const router = useRouter();
    const [savedPlace, setSavedPlace] = useState<SavedPlace | null>(null);

    const [transportMode, setTransportMode] = useState<'driving' | 'taxi' | 'walking'>(initialMode);
    const [taxiRoute, setTaxiRoute] = useState<TaxiNavigationResponse | null>(null);
    const [loadingTaxiRoute, setLoadingTaxiRoute] = useState(false);
    const [taxiRouteError, setTaxiRouteError] = useState<string | null>(null);
    const [walkingRoute, setWalkingRoute] = useState<{ distance: number; duration: number } | null>(null);
    const [loadingWalkingRoute, setLoadingWalkingRoute] = useState(false);

    const isCustomOrigin = origin !== null;

    const getOriginCoords = () => {
        if (origin) return { lat: origin.latitude, lng: origin.longitude };
        if (userLocation) return { lat: userLocation.lat, lng: userLocation.lng };
        return null;
    };

    useEffect(() => {
        checkIfSaved();
    }, [destination]);

    useFocusEffect(
        React.useCallback(() => {
            checkIfSaved();
        }, [destination])
    );

    useEffect(() => {
        const checkMapPickerData = () => {
            const data = (globalThis as any).__mapPickerData;
            if (data && data.timestamp) {

                const age = Date.now() - data.timestamp;
                if (age < 2000) {

                    if (data.mode === 'origin') {
                        onOriginChange?.(data.place);
                    } else {
                        const updated = [...waypoints, data.place];
                        onWaypointsChange?.(updated);
                    }

                    delete (globalThis as any).__mapPickerData;
                }
            }
        };

        checkMapPickerData();

        const interval = setInterval(checkMapPickerData, 200);

        return () => clearInterval(interval);
    }, [waypoints, onOriginChange, onWaypointsChange]);

    useEffect(() => {
        const coords = getOriginCoords();
        if (transportMode === 'taxi' && destination && coords && !taxiRoute) {
            fetchTaxiRoute();
        } else if (transportMode === 'walking' && destination && coords && !walkingRoute) {
            fetchWalkingRoute();
        }
    }, [transportMode, destination, userLocation, origin]);

    const fetchTaxiRoute = async () => {
        const coords = getOriginCoords();
        if (!destination || !coords) return;

        setLoadingTaxiRoute(true);
        setTaxiRouteError(null);
        try {
            const result = await taxiService.requestTaxiNavigation({
                origin: [coords.lat, coords.lng],
                destination: [destination.latitude, destination.longitude],
            });

            if (!result.startNode || !result.endNode) {
                setTaxiRouteError(t('taxi-route-unavailable'));
                setTaxiRoute(null);
                onTaxiRouteChange?.(null);
            } else {
                setTaxiRoute(result);
                setTaxiRouteError(null);
                onTaxiRouteChange?.(result);
            }
        } catch (error: any) {
            console.error('Error fetching taxi route:', error);
            setTaxiRouteError(t('taxi-route-unavailable'));
            setTaxiRoute(null);
            onTaxiRouteChange?.(null);
        } finally {
            setLoadingTaxiRoute(false);
        }
    };

    const fetchWalkingRoute = async () => {
        const coords = getOriginCoords();
        if (!destination || !coords) return;

        setLoadingWalkingRoute(true);
        try {
            const result = await navigationService.getNavigation({
                origin: [coords.lat, coords.lng],
                destination: [destination.latitude, destination.longitude],
                costing: 'pedestrian',
            });

            if (result?.data?.trip?.legs?.[0]) {
                const leg = result.data.trip.legs[0];
                setWalkingRoute({
                    distance: leg.summary.length * 1000,
                    duration: leg.summary.time,
                });
            }
        } catch (error) {
            console.error('Error fetching walking route:', error);
        } finally {
            setLoadingWalkingRoute(false);
        }
    };

    const handleModeChange = (mode: 'driving' | 'taxi' | 'walking') => {
        setTransportMode(mode);

        if (onModeChange) {
            onModeChange(mode);
        }

        if (mode === 'driving') {
            setTaxiRoute(null);
            setTaxiRouteError(null);
            setWalkingRoute(null);
            onTaxiRouteChange?.(null);
        } else if (mode === 'taxi') {
            setWalkingRoute(null);
        } else if (mode === 'walking') {
            setTaxiRoute(null);
            setTaxiRouteError(null);
            onTaxiRouteChange?.(null);
        }
    };

    const checkIfSaved = async () => {
        if (!destination) return;
        const saved = await placeService.isPlaceSaved(destination.latitude, destination.longitude);
        setSavedPlace(saved);
    };

    const handleUnsavePlace = async () => {
        if (!savedPlace) return;

        try {
            await placeService.deleteSavedPlace(savedPlace.id);
            setSavedPlace(null);
            showToast(t('place-removed'));
        } catch (error) {
            showToast(t('failed-to-remove-place'));
            console.error('Error removing place:', error);
        }
    };

    const handlePreviewPress = () => {
        onPreviewPress?.();
    };

    const handleStartNavigation = () => {
        if (transportMode === 'taxi') {
            if (taxiRoute && onStartTaxiNavigation) {
                onStartTaxiNavigation(taxiRoute);
            } else {
                showToast('No taxi route available');
            }
        } else {
            onStartNavigation();
        }
    };

    const handleShareDestination = async () => {
        if (!destination) return;
        const { Share } = await import('react-native');
        const url = `https://maps.gebeta.app/?lat=${destination.latitude}&lng=${destination.longitude}&name=${encodeURIComponent(destination.name)}`;
        Share.share({
            message: `Check out ${destination.name} on Gebeta Maps: ${url}`,
            url: url,
        });
    };

    const handleGoRoute = (index: number) => {
        onSelectRoute?.(index);
        if (isCustomOrigin) {
            handlePreviewPress();
        } else {
            handleStartNavigation();
        }
    };

    const showRouteOptionCards = transportMode === 'driving' && !!routeOptions && routeOptions.length > 1;

    const displayDistance = transportMode === 'taxi' && taxiRoute
        ? ((taxiRoute.originWalkRoute?.trip.summary.length || 0) + (taxiRoute.destinationWalkRoute?.trip.summary.length || 0)) * 1000
        : transportMode === 'walking' && walkingRoute
            ? walkingRoute.distance
            : distance;

    const displayDuration = transportMode === 'taxi' && taxiRoute
        ? (() => {
            if (taxiRoute.segments && taxiRoute.segments.length > 0) {
                return taxiRoute.segments.reduce((total, segment) => total + segment.time, 0);
            }
            return (taxiRoute.originWalkRoute?.trip.summary.time || 0) + (taxiRoute.destinationWalkRoute?.trip.summary.time || 0);
        })()
        : transportMode === 'walking' && walkingRoute
            ? walkingRoute.duration
            : duration;

    return (
        <View
            className="absolute left-4 right-4 rounded-3xl shadow-2xl overflow-hidden"
            style={{ bottom: insets.bottom > 0 ? insets.bottom + 8 : 36 }}
        >
            <BlurView intensity={100} tint={isDark ? 'dark' : 'light'} style={{ flex: 1, borderRadius: 24 }}>
                <View style={{ backgroundColor: isDark ? 'rgba(30, 30, 30, 0.6)' : 'rgba(255, 255, 255, 0.4)', borderRadius: 24 }}>
                    <View className="px-6 pt-4" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
                        <View className="flex-row items-center justify-between mb-2">
                            <Text className="text-2xl font-bold" style={{ color: theme.textPrimary }}>{t('directions')}</Text>
                            <TouchableOpacity
                                onPress={onCancel}
                                className="w-10 h-10 items-center justify-center rounded-full"
                                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#F3F4F6' }}
                            >
                                <Ionicons name="close" size={24} color={theme.textPrimary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View className="px-6 py-3" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
                        <View className="flex-row rounded-xl p-1" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6' }}>
                            <TouchableOpacity
                                onPress={() => handleModeChange('driving')}
                                className="flex-1 flex-row items-center justify-center py-2 rounded-lg"
                                style={{
                                    backgroundColor: transportMode === 'driving' ? theme.surface : 'transparent',
                                }}
                                activeOpacity={0.7}
                            >
                                <Image
                                    source={transportMode === 'driving'
                                        ? require('../../../../assets/images/car-selected.png')
                                        : require('../../../../assets/images/car-unselected.png')
                                    }
                                    style={{ width: 20, height: 20 }}
                                    resizeMode="contain"
                                />
                                <Text
                                    className="ml-2 font-semibold text-xs"
                                    style={{
                                        color: transportMode === 'driving' ? colors.primary.main : theme.textSecondary,
                                    }}
                                >
                                    {t('driving')}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleModeChange('walking')}
                                className="flex-1 flex-row items-center justify-center py-2 rounded-lg"
                                style={{
                                    backgroundColor: transportMode === 'walking' ? theme.surface : 'transparent',
                                }}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name="walk"
                                    size={20}
                                    color={transportMode === 'walking' ? colors.primary.main : theme.textSecondary}
                                />
                                <Text
                                    className="ml-2 font-semibold text-xs"
                                    style={{
                                        color: transportMode === 'walking' ? colors.primary.main : theme.textSecondary,
                                    }}
                                >
                                    {t('walking')}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleModeChange('taxi')}
                                className="flex-1 flex-row items-center justify-center py-2 rounded-lg"
                                style={{
                                    backgroundColor: transportMode === 'taxi' ? theme.surface : 'transparent',
                                }}
                                activeOpacity={0.7}
                            >
                                <Image
                                    source={transportMode === 'taxi'
                                        ? require('../../../../assets/images/minibus-selected.png')
                                        : require('../../../../assets/images/minibus-unselected.png')
                                    }
                                    style={{ width: 20, height: 20 }}
                                    resizeMode="contain"
                                />
                                <Text
                                    className="ml-2 font-semibold text-xs"
                                    style={{
                                        color: transportMode === 'taxi' ? colors.primary.main : theme.textSecondary,
                                    }}
                                >
                                    {t('taxi-mode')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {showRouteOptionCards && (
                        <ScrollView
                            className="max-h-80"
                            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {routeOptions!.map((opt, i) => {
                                const isSelected = i === selectedRouteIndex;
                                return (
                                    <TouchableOpacity
                                        key={i}
                                        activeOpacity={0.85}
                                        onPress={() => onSelectRoute?.(i)}
                                        className="rounded-2xl p-4"
                                        style={{
                                            borderWidth: 1,
                                            borderColor: isSelected ? colors.primary.main : theme.border,
                                            backgroundColor: theme.surface,
                                        }}
                                    >
                                        <View className="flex-row items-center justify-between">
                                            <View className="flex-1 mr-3">
                                                {i === 0 && (
                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary.main, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                        Fastest
                                                    </Text>
                                                )}
                                                <Text className="text-2xl font-bold" style={{ color: theme.textPrimary }}>
                                                    {formatTime(opt.duration)}
                                                </Text>
                                                <Text className="text-sm mt-0.5" style={{ color: theme.textSecondary }}>
                                                    {t('eta')} {formatETA(opt.duration)} • {formatDistance(opt.distance)}
                                                </Text>
                                            </View>

                                            <View className="flex-row items-center flex-shrink-0">
                                                {destination && (
                                                    <TouchableOpacity
                                                        onPress={handleShareDestination}
                                                        className="w-11 h-11 items-center justify-center rounded-2xl mr-2"
                                                        style={{ borderWidth: 1.5, borderColor: colors.primary.main }}
                                                    >
                                                        <Ionicons name="share-social" size={20} color={colors.primary.main} />
                                                    </TouchableOpacity>
                                                )}
                                                <TouchableOpacity
                                                    onPress={() => handleGoRoute(i)}
                                                    className="rounded-2xl px-6 py-4 shadow-lg"
                                                    style={{
                                                        backgroundColor: colors.primary.main,
                                                        shadowColor: colors.primary.main,
                                                        shadowOffset: { width: 0, height: 4 },
                                                        shadowOpacity: 0.3,
                                                        shadowRadius: 8,
                                                        elevation: 8,
                                                    }}
                                                >
                                                    <Text className="text-white text-lg font-bold">
                                                        {!isCustomOrigin ? t('go') : t('preview')}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    )}

                     {__DEV__ && (
                        <View className="px-6 py-3" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
                            <TouchableOpacity
                                onPress={onSimulateToggle}
                                className="flex-row items-center justify-between"
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
                        </View>
                    )}
                    <ScrollView className="max-h-48">
                        {loadingTaxiRoute ? (
                            <View className="px-6 py-8 items-center">
                                <ActivityIndicator size="large" color={colors.primary.main} />
                                <Text className="mt-2" style={{ color: theme.textSecondary }}>{t('loading-taxi-route')}</Text>
                            </View>
                        ) : taxiRouteError ? (
                            <View className="px-6 py-6">
                                <View className="rounded-2xl p-4" style={{ backgroundColor: theme.primaryMuted }}>
                                    <Text className="font-semibold text-base mb-1" style={{ color: theme.textPrimary }}>
                                        {t('no-taxi-route-found')}
                                    </Text>
                                    <Text className="text-sm" style={{ color: colors.primary.main }}>
                                        {taxiRouteError}
                                    </Text>
                                </View>
                            </View>
                        ) : transportMode === 'taxi' && taxiRoute ? (
                            <View className="px-6 py-3">
                                <View className="rounded-2xl p-4" style={{ backgroundColor: isDark ? theme.surface : '#E5E7EB' }}>

                                    {taxiRoute.segments && taxiRoute.segments.length > 0 ? (
                                        taxiRoute.segments.map((segment: any, index: number) => {
                                            const isWalkSegment = segment.type === 'walk' || segment.mode === 'pedestrian';
                                            const isTaxiSegment = segment.type === 'taxi' || segment.mode === 'auto';
                                            const isLastSegment = index === taxiRoute.segments!.length - 1;

                                            if (isWalkSegment) {
                                                const isOrigin = index === 0;
                                                const isDestination = index === taxiRoute.segments!.length - 1;
                                                return (
                                                    <View key={index} className={`flex-row items-start ${!isLastSegment ? 'mb-3' : ''}`}>
                                                        <View className="w-8 items-center pt-1">
                                                            <Ionicons name="walk" size={18} color={theme.error} />
                                                            {!isLastSegment && <View className="w-0.5 h-8 my-1" style={{ backgroundColor: theme.border }} />}
                                                        </View>
                                                        <View className="flex-1 ml-3">
                                                            <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                                                {isOrigin ? t('walk-to-boarding-point') : t('walk-to-destination')}
                                                            </Text>
                                                            <Text className="font-semibold text-sm mt-1" style={{ color: theme.textPrimary }}>
                                                                {isOrigin
                                                                    ? (segment.toNode?.name || taxiRoute.startNode?.name || 'Boarding Point')
                                                                    : destinationName
                                                                }
                                                            </Text>
                                                            <Text className="text-xs" style={{ color: theme.textSecondary }}>
                                                                {formatDistance(segment.distance * 1000)} • {formatTime(segment.time)}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                );
                                            }

                                            if (isTaxiSegment) {
                                                return (
                                                    <View key={index} className={`flex-row items-start ${!isLastSegment ? 'mb-3' : ''}`}>
                                                        <View className="w-8 items-center pt-1">
                                                            <Ionicons name="car" size={18} color={colors.primary.main} />
                                                            {!isLastSegment && <View className="w-0.5 h-8 my-1" style={{ backgroundColor: theme.border }} />}
                                                        </View>
                                                        <View className="flex-1 ml-3">
                                                            <Text className="text-sm" style={{ color: theme.textSecondary }}>{t('taxi-ride')}</Text>
                                                            <Text className="font-semibold text-sm mt-1" style={{ color: theme.textPrimary }}>
                                                                {segment.fromNode?.name || taxiRoute.startNode?.name || 'Start'} → {segment.toNode?.name || taxiRoute.endNode?.name || 'End'}
                                                            </Text>
                                                            <Text className="text-xs" style={{ color: theme.textSecondary }}>
                                                                {segment.fare || taxiRoute.summary?.estimatedFare || 0} {taxiRoute.summary?.currency || 'ETB'} • {formatDistance(segment.distance * 1000)}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                );
                                            }

                                            return null;
                                        })
                                    ) : (

                                        <>
                                            {taxiRoute.originWalkRoute && taxiRoute.startNode && (
                                                <View className="flex-row items-start mb-3">
                                                    <View className="w-8 items-center pt-1">
                                                        <Ionicons name="walk" size={18} color={theme.error} />
                                                        <View className="w-0.5 h-8 my-1" style={{ backgroundColor: theme.border }} />
                                                    </View>
                                                    <View className="flex-1 ml-3">
                                                        <Text className="text-sm" style={{ color: theme.textSecondary }}>{t('walk-to-boarding-point')}</Text>
                                                        <Text className="font-semibold text-sm mt-1" style={{ color: theme.textPrimary }}>
                                                            {taxiRoute.startNode?.name || 'Boarding Point'}
                                                        </Text>
                                                        <Text className="text-xs" style={{ color: theme.textSecondary }}>
                                                            {formatDistance((taxiRoute.originWalkRoute?.trip?.summary?.length || 0) * 1000)} • {formatTime(taxiRoute.originWalkRoute?.trip?.summary?.time || 0)}
                                                        </Text>
                                                    </View>
                                                </View>
                                            )}

                                            {taxiRoute.startNode && taxiRoute.endNode && (
                                                <View className="flex-row items-start mb-3">
                                                    <View className="w-8 items-center pt-1">
                                                        <Ionicons name="car" size={18} color={colors.primary.main} />
                                                        <View className="w-0.5 h-8 my-1" style={{ backgroundColor: theme.border }} />
                                                    </View>
                                                    <View className="flex-1 ml-3">
                                                        <Text className="text-sm" style={{ color: theme.textSecondary }}>{t('taxi-ride')}</Text>
                                                        <Text className="font-semibold text-sm mt-1" style={{ color: theme.textPrimary }}>
                                                            {taxiRoute.formattedPath || `${taxiRoute.startNode?.name || 'Start'} → ${taxiRoute.endNode?.name || 'End'}`}
                                                        </Text>
                                                        <Text className="text-xs" style={{ color: theme.textSecondary }}>
                                                            {taxiRoute.summary?.estimatedFare || 0} {taxiRoute.summary?.currency || 'ETB'} • {taxiRoute.summary?.taxiSegments || 0} {t('stops')}
                                                        </Text>
                                                    </View>
                                                </View>
                                            )}

                                            {taxiRoute.destinationWalkRoute && (
                                                <View className="flex-row items-start">
                                                    <View className="w-8 items-center pt-1">
                                                        <Ionicons name="walk" size={18} color={theme.error} />
                                                    </View>
                                                    <View className="flex-1 ml-3">
                                                        <Text className="text-sm" style={{ color: theme.textSecondary }}>{t('walk-to-destination')}</Text>
                                                        <Text className="font-semibold text-sm mt-1" style={{ color: theme.textPrimary }}>
                                                            {destinationName}
                                                        </Text>
                                                        <Text className="text-xs" style={{ color: theme.textSecondary }}>
                                                            {formatDistance((taxiRoute.destinationWalkRoute?.trip?.summary?.length || 0) * 1000)} • {formatTime(taxiRoute.destinationWalkRoute?.trip?.summary?.time || 0)}
                                                        </Text>
                                                    </View>
                                                </View>
                                            )}
                                        </>
                                    )}
                                </View>
                            </View>
                        ) : null}
                    </ScrollView>

                    {!showRouteOptionCards && (
                    <View className="px-6 py-3 mb-2" style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
                        <View className="rounded-2xl p-4" style={{ backgroundColor: isDark ? theme.surface : '#E5E7EB' }}>
                            <View className="flex-row items-start justify-between">
                                <View className="flex-1 mr-3" style={{ opacity: isFetchingRoute && transportMode !== 'taxi' ? 0.4 : 1 }}>
                                    {transportMode === 'taxi' && taxiRoute && taxiRoute.summary ? (
                                        <>
                                            <Text className="text-3xl font-bold" style={{ color: colors.primary.main }}>
                                                {taxiRoute.summary?.estimatedFare || 0} {taxiRoute.summary?.currency || 'ETB'}
                                            </Text>
                                            <Text className="text-sm mt-1" style={{ color: theme.textSecondary }}>
                                                {t('taxi-fare')} • {formatTime(displayDuration)}
                                            </Text>
                                            <Text className="font-medium mt-1" style={{ color: theme.textPrimary }} numberOfLines={2} ellipsizeMode="tail">
                                                {destinationName}
                                            </Text>
                                        </>
                                    ) : (
                                        <>
                                            <View className="flex-row items-center">
                                                <Text className="text-3xl font-bold" style={{ color: theme.textPrimary }}>
                                                    {formatTime(duration)}
                                                </Text>
                                                {isFetchingRoute && (
                                                    <ActivityIndicator size="small" color={colors.primary.main} style={{ marginLeft: 10 }} />
                                                )}
                                            </View>
                                            <Text className="text-sm mt-1" style={{ color: theme.textSecondary }}>
                                                {t('eta')} {formatETA(duration)} • {formatDistance(distance)}
                                            </Text>
                                            <Text className="font-medium mt-1" style={{ color: theme.textPrimary }} numberOfLines={2} ellipsizeMode="tail">
                                                {destinationName}
                                            </Text>
                                        </>
                                    )}
                                </View>

                                <View className="flex-row items-center flex-shrink-0">
                                    {destination && (
                                        <>
                                            <TouchableOpacity
                                                onPress={savedPlace ? handleUnsavePlace : () => router.push({
                                                    pathname: '/places/save',
                                                    params: { lat: destination.latitude, lng: destination.longitude, name: destination.name },
                                                } as any)}
                                                className="rounded-2xl px-3 py-4 -mr-3"
                                            >
                                                <Ionicons
                                                    name={savedPlace ? "bookmark" : "bookmark-outline"}
                                                    size={24}
                                                    color={colors.primary.main}
                                                />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={async () => {
                                                    const { Share } = await import('react-native');
                                                    const url = `https://maps.gebeta.app/?lat=${destination.latitude}&lng=${destination.longitude}&name=${encodeURIComponent(destination.name)}`;
                                                    Share.share({
                                                        message: `Check out ${destination.name} on Gebeta Maps: ${url}`,
                                                        url: url,
                                                    });
                                                }}
                                                className="rounded-2xl px-3 py-4"
                                            >
                                                <Ionicons name="share-social" size={24} color={colors.primary.main} />
                                            </TouchableOpacity>
                                        </>
                                    )}

                                    <TouchableOpacity
                                        onPress={
                                            transportMode === 'taxi'
                                                ? handleStartNavigation
                                                : isCustomOrigin
                                                    ? handlePreviewPress
                                                    : handleStartNavigation
                                        }
                                        className="rounded-2xl px-8 py-4 shadow-lg"
                                        style={{
                                            backgroundColor: colors.primary.main,
                                            shadowColor: colors.primary.main,
                                            shadowOffset: { width: 0, height: 4 },
                                            shadowOpacity: 0.3,
                                            shadowRadius: 8,
                                            elevation: 8,
                                        }}
                                    >
                                        <Text className="text-white text-xl font-bold">
                                            {transportMode === 'taxi' || !isCustomOrigin ? t('go') : t('preview')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                    )}

                </View>
            </BlurView>
        </View>
    );
};
