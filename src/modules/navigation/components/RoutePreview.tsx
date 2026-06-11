import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { colors } from '../../../shared/theme/colors';
import type { GeocodingPlace, Maneuver } from '../types/navigation.types';
import { SavePlaceModal } from '../../places/components/SavePlaceModal';
import { placeService } from '../../places/services/place.service';
import { showToast } from '../../../shared/utils/toast';
import type { SavedPlaceType, SavedPlace } from '../../places/types/place.types';
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
}) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [showSaveModal, setShowSaveModal] = useState(false);
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

    const handleSavePlace = async (type: SavedPlaceType, label: string, isPrivate: boolean) => {
        if (!destination) return;

        try {
            const saved = await placeService.savePlace({
                type,
                lat: destination.latitude,
                lng: destination.longitude,
                label,
                isPrivate,
            });
            setSavedPlace(saved);
            showToast.success(t('place-saved-successfully'));
        } catch (error) {
            showToast.error(t('failed-to-save-place'));
            console.error('Error saving place:', error);
        }
    };

    const handleUnsavePlace = async () => {
        if (!savedPlace) return;

        try {
            await placeService.deleteSavedPlace(savedPlace.id);
            setSavedPlace(null);
            showToast.success(t('place-removed'));
        } catch (error) {
            showToast.error(t('failed-to-remove-place'));
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
                showToast.error('Error', 'No taxi route available');
            }
        } else {
            onStartNavigation();
        }
    };

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
            <BlurView intensity={100} tint="light" style={{ flex: 1, borderRadius: 24 }}>
                <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.4)', borderRadius: 24 }}>
                    <View className="px-6 pt-4 border-b" style={{ borderBottomColor: 'rgba(229, 231, 235, 0.5)' }}>
                        <View className="flex-row items-center justify-between mb-2">
                            <Text className="text-2xl font-bold text-gray-900">{t('directions')}</Text>
                            <TouchableOpacity
                                onPress={onCancel}
                                className="w-10 h-10 items-center justify-center rounded-full bg-gray-100"
                            >
                                <Ionicons name="close" size={24} color="#374151" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View className="px-6 py-3 border-b border-gray-100">
                        <View className="flex-row bg-gray-100 rounded-xl p-1">
                            <TouchableOpacity
                                onPress={() => handleModeChange('driving')}
                                className="flex-1 flex-row items-center justify-center py-2 rounded-lg"
                                style={{
                                    backgroundColor: transportMode === 'driving' ? 'white' : 'transparent',
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
                                        color: transportMode === 'driving' ? colors.primary.main : '#6B7280',
                                    }}
                                >
                                    {t('driving')}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleModeChange('walking')}
                                className="flex-1 flex-row items-center justify-center py-2 rounded-lg"
                                style={{
                                    backgroundColor: transportMode === 'walking' ? 'white' : 'transparent',
                                }}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name="walk"
                                    size={20}
                                    color={transportMode === 'walking' ? colors.primary.main : '#6B7280'}
                                />
                                <Text
                                    className="ml-2 font-semibold text-xs"
                                    style={{
                                        color: transportMode === 'walking' ? colors.primary.main : '#6B7280',
                                    }}
                                >
                                    {t('walking')}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleModeChange('taxi')}
                                className="flex-1 flex-row items-center justify-center py-2 rounded-lg"
                                style={{
                                    backgroundColor: transportMode === 'taxi' ? 'white' : 'transparent',
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
                                        color: transportMode === 'taxi' ? colors.primary.main : '#6B7280',
                                    }}
                                >
                                    {t('taxi-mode')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {__DEV__ && (
                        <View className="px-6 py-3 border-b border-gray-100">
                            <TouchableOpacity
                                onPress={onSimulateToggle}
                                className="flex-row items-center justify-between"
                            >
                                <View className="flex-row items-center">
                                    <Ionicons
                                        name={simulateMovement ? "checkmark-circle" : "ellipse-outline"}
                                        size={24}
                                        color={simulateMovement ? colors.primary.main : "#9CA3AF"}
                                    />
                                    <Text className="text-gray-700 font-medium ml-3">
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
                                <Text className="text-gray-600 mt-2">{t('loading-taxi-route')}</Text>
                            </View>
                        ) : taxiRouteError ? (
                            <View className="px-6 py-6">
                                <View className="rounded-2xl p-4" style={{ backgroundColor: `${colors.primary.main}15` }}>
                                    <Text className="text-gray-900 font-semibold text-base mb-1">
                                        {t('no-taxi-route-found')}
                                    </Text>
                                    <Text className="text-sm" style={{ color: colors.primary.main }}>
                                        {taxiRouteError}
                                    </Text>
                                </View>
                            </View>
                        ) : transportMode === 'taxi' && taxiRoute ? (
                            <View className="px-6 py-3">
                                <View className="bg-gray-200 rounded-2xl p-4">

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
                                                            <Ionicons name="walk" size={18} color="#EF4444" />
                                                            {!isLastSegment && <View className="w-0.5 h-8 bg-gray-400 my-1" />}
                                                        </View>
                                                        <View className="flex-1 ml-3">
                                                            <Text className="text-gray-600 text-sm">
                                                                {isOrigin ? t('walk-to-boarding-point') : t('walk-to-destination')}
                                                            </Text>
                                                            <Text className="text-gray-900 font-semibold text-sm mt-1">
                                                                {isOrigin
                                                                    ? (segment.toNode?.name || taxiRoute.startNode?.name || 'Boarding Point')
                                                                    : destinationName
                                                                }
                                                            </Text>
                                                            <Text className="text-gray-500 text-xs">
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
                                                            {!isLastSegment && <View className="w-0.5 h-8 bg-gray-400 my-1" />}
                                                        </View>
                                                        <View className="flex-1 ml-3">
                                                            <Text className="text-gray-600 text-sm">{t('taxi-ride')}</Text>
                                                            <Text className="text-gray-900 font-semibold text-sm mt-1">
                                                                {segment.fromNode?.name || taxiRoute.startNode?.name || 'Start'} → {segment.toNode?.name || taxiRoute.endNode?.name || 'End'}
                                                            </Text>
                                                            <Text className="text-gray-500 text-xs">
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
                                                        <Ionicons name="walk" size={18} color="#EF4444" />
                                                        <View className="w-0.5 h-8 bg-gray-400 my-1" />
                                                    </View>
                                                    <View className="flex-1 ml-3">
                                                        <Text className="text-gray-600 text-sm">{t('walk-to-boarding-point')}</Text>
                                                        <Text className="text-gray-900 font-semibold text-sm mt-1">
                                                            {taxiRoute.startNode?.name || 'Boarding Point'}
                                                        </Text>
                                                        <Text className="text-gray-500 text-xs">
                                                            {formatDistance((taxiRoute.originWalkRoute?.trip?.summary?.length || 0) * 1000)} • {formatTime(taxiRoute.originWalkRoute?.trip?.summary?.time || 0)}
                                                        </Text>
                                                    </View>
                                                </View>
                                            )}

                                            {taxiRoute.startNode && taxiRoute.endNode && (
                                                <View className="flex-row items-start mb-3">
                                                    <View className="w-8 items-center pt-1">
                                                        <Ionicons name="car" size={18} color={colors.primary.main} />
                                                        <View className="w-0.5 h-8 bg-gray-400 my-1" />
                                                    </View>
                                                    <View className="flex-1 ml-3">
                                                        <Text className="text-gray-600 text-sm">{t('taxi-ride')}</Text>
                                                        <Text className="text-gray-900 font-semibold text-sm mt-1">
                                                            {taxiRoute.formattedPath || `${taxiRoute.startNode?.name || 'Start'} → ${taxiRoute.endNode?.name || 'End'}`}
                                                        </Text>
                                                        <Text className="text-gray-500 text-xs">
                                                            {taxiRoute.summary?.estimatedFare || 0} {taxiRoute.summary?.currency || 'ETB'} • {taxiRoute.summary?.taxiSegments || 0} {t('stops')}
                                                        </Text>
                                                    </View>
                                                </View>
                                            )}

                                            {taxiRoute.destinationWalkRoute && (
                                                <View className="flex-row items-start">
                                                    <View className="w-8 items-center pt-1">
                                                        <Ionicons name="walk" size={18} color="#EF4444" />
                                                    </View>
                                                    <View className="flex-1 ml-3">
                                                        <Text className="text-gray-600 text-sm">{t('walk-to-destination')}</Text>
                                                        <Text className="text-gray-900 font-semibold text-sm mt-1">
                                                            {destinationName}
                                                        </Text>
                                                        <Text className="text-gray-500 text-xs">
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

                    <View className="px-6 py-3 border-t border-gray-100 mb-2">
                        <View className="bg-gray-200 rounded-2xl p-4 ">
                            <View className="flex-row items-start justify-between">
                                <View className="flex-1 mr-3">
                                    {transportMode === 'taxi' && taxiRoute && taxiRoute.summary ? (
                                        <>
                                            <Text className="text-3xl font-bold" style={{ color: colors.primary.main }}>
                                                {taxiRoute.summary?.estimatedFare || 0} {taxiRoute.summary?.currency || 'ETB'}
                                            </Text>
                                            <Text className="text-gray-500 text-sm mt-1">
                                                {t('taxi-fare')} • {formatTime(displayDuration)}
                                            </Text>
                                            <Text className="text-gray-900 font-medium mt-1" numberOfLines={2} ellipsizeMode="tail">
                                                {destinationName}
                                            </Text>
                                        </>
                                    ) : (
                                        <>
                                            <Text className="text-3xl font-bold text-gray-900">
                                                {formatTime(duration)}
                                            </Text>
                                            <Text className="text-gray-500 text-sm mt-1">
                                                {t('eta')} {formatETA(duration)} • {formatDistance(distance)}
                                            </Text>
                                            <Text className="text-gray-900 font-medium mt-1" numberOfLines={2} ellipsizeMode="tail">
                                                {destinationName}
                                            </Text>
                                        </>
                                    )}
                                </View>

                                <View className="flex-row items-center flex-shrink-0">
                                    {destination && (
                                        <>
                                            <TouchableOpacity
                                                onPress={savedPlace ? handleUnsavePlace : () => setShowSaveModal(true)}
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

                    {destination && (
                        <SavePlaceModal
                            visible={showSaveModal}
                            onClose={() => setShowSaveModal(false)}
                            onSave={handleSavePlace}
                            placeName={destination.name}
                        />
                    )}
                </View>
            </BlurView>
        </View>
    );
};
