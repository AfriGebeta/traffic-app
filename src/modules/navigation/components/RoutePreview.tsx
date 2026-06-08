import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image, Modal, TextInput, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
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
import { useRouter } from 'expo-router';

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
    const router = useRouter();
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [savedPlace, setSavedPlace] = useState<SavedPlace | null>(null);

    const [transportMode, setTransportMode] = useState<'driving' | 'taxi' | 'walking'>(initialMode);
    const [taxiRoute, setTaxiRoute] = useState<TaxiNavigationResponse | null>(null);
    const [loadingTaxiRoute, setLoadingTaxiRoute] = useState(false);
    const [taxiRouteError, setTaxiRouteError] = useState<string | null>(null);
    const [walkingRoute, setWalkingRoute] = useState<{ distance: number; duration: number } | null>(null);
    const [loadingWalkingRoute, setLoadingWalkingRoute] = useState(false);

    const [showPlaceSearch, setShowPlaceSearch] = useState(false);
    const [placeSearchMode, setPlaceSearchMode] = useState<'origin' | 'stop'>('stop');
    const [placeSearchQuery, setPlaceSearchQuery] = useState('');
    const [placeSearchResults, setPlaceSearchResults] = useState<GeocodingPlace[]>([]);
    const [isSearchingPlace, setIsSearchingPlace] = useState(false);
    const placeSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            console.log('[RoutePreview] Taxi route fetched:', result);

            if (!result.startNode || !result.endNode) {
                setTaxiRouteError(t('taxi-route-unavailable'));
                setTaxiRoute(null);
                onTaxiRouteChange?.(null);
            } else {
                setTaxiRoute(result);
                setTaxiRouteError(null);
                console.log('[RoutePreview] Calling onTaxiRouteChange with:', result);
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

    const handlePlaceSearchChange = (query: string) => {
        setPlaceSearchQuery(query);
        if (placeSearchDebounce.current) clearTimeout(placeSearchDebounce.current);
        if (query.length < 2) {
            setPlaceSearchResults([]);
            return;
        }
        placeSearchDebounce.current = setTimeout(async () => {
            setIsSearchingPlace(true);
            try {
                const results = await navigationService.geocodePlace(query);
                setPlaceSearchResults(results);
            } catch {
                setPlaceSearchResults([]);
            } finally {
                setIsSearchingPlace(false);
            }
        }, 350);
    };

    const openPlaceSearch = (mode: 'origin' | 'stop') => {
        setPlaceSearchMode(mode);
        setPlaceSearchQuery('');
        setPlaceSearchResults([]);
        setShowPlaceSearch(true);
    };

    const closePlaceSearch = () => {
        setShowPlaceSearch(false);
        setPlaceSearchQuery('');
        setPlaceSearchResults([]);
    };

    const handleSelectSearchPlace = (place: GeocodingPlace) => {
        if (placeSearchMode === 'origin') {
            onOriginChange?.(place);
        } else {
            const updated = [...waypoints, place];
            onWaypointsChange?.(updated);
        }
        closePlaceSearch();
    };

    const handleUseMyLocation = () => {
        onOriginChange?.(null);
        closePlaceSearch();
    };

    const handlePreviewPress = () => {
        onPreviewPress?.();
    };

    const handleRemoveStop = (index: number) => {
        const updated = waypoints.filter((_, i) => i !== index);
        onWaypointsChange?.(updated);
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
                        ) : (
                            <View className="px-6 py-3">
                                <View className="bg-gray-200 rounded-2xl p-4">
                                    <View className="flex-row items-start mb-1">
                                        <View className="w-8 items-center pt-1">
                                            <View className="w-3 h-3 rounded-full bg-blue-500" />
                                            <View className="w-0.5 bg-gray-400 my-1" style={{ height: waypoints.length > 0 ? 24 : 24 }} />
                                        </View>
                                        <TouchableOpacity
                                            className="flex-1 ml-3 pb-2 flex-row items-center"
                                            onPress={() => openPlaceSearch('origin')}
                                            activeOpacity={0.7}
                                        >
                                            <Text className="text-gray-900 font-semibold text-sm flex-1" numberOfLines={1}>
                                                {origin ? origin.name : t('your-location')}
                                            </Text>
                                            <Text
                                                className="text-xs font-semibold ml-2"
                                                style={{ color: colors.primary.main }}
                                            >
                                                {t('change-start')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    {waypoints.map((wp, index) => (
                                        <View key={index}>

                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <View style={{ width: 32, alignItems: 'center' }}>
                                                    <Image
                                                        source={require('../../../../assets/images/location-pin-2.png')}
                                                        style={{ width: 20, height: 20 }}
                                                        resizeMode="contain"
                                                    />
                                                </View>
                                                <View style={{ flex: 1, marginLeft: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#1F2937', flex: 1 }} numberOfLines={1}>
                                                        {wp.name}
                                                    </Text>
                                                    <TouchableOpacity
                                                        onPress={() => handleRemoveStop(index)}
                                                        style={{ marginLeft: 8, padding: 4 }}
                                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                    >
                                                        <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            <View style={{ flexDirection: 'row', height: 14 }}>
                                                <View style={{ width: 32, alignItems: 'center' }}>
                                                    <View style={{ width: 1, flex: 1, backgroundColor: '#9CA3AF' }} />
                                                </View>
                                            </View>
                                        </View>
                                    ))}

                                    {transportMode !== 'taxi' && (
                                        <View>
                                            <TouchableOpacity
                                                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2 }}
                                                onPress={() => openPlaceSearch('stop')}
                                                activeOpacity={0.7}
                                            >
                                                <View style={{ width: 32, alignItems: 'center' }}>
                                                    <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.primary.main}20` }}>
                                                        <Ionicons name="add" size={14} color={colors.primary.main} />
                                                    </View>
                                                </View>
                                                <Text style={{ marginLeft: 12, fontSize: 14, fontWeight: '500', color: colors.primary.main }}>
                                                    Add stop
                                                </Text>
                                            </TouchableOpacity>

                                            <View style={{ flexDirection: 'row', height: 14 }}>
                                                <View style={{ width: 32, alignItems: 'center' }}>
                                                    <View style={{ width: 1, flex: 1, backgroundColor: '#9CA3AF' }} />
                                                </View>
                                            </View>
                                        </View>
                                    )}

                                    <View className="flex-row items-start">
                                        <View className="w-8 items-center pt-1">
                                            <Ionicons name="location" size={20} color={colors.primary.main} />
                                        </View>
                                        <View className="flex-1 ml-3">
                                            <Text className="text-gray-900 font-semibold text-base">{destinationName}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        )}
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

            <Modal
                visible={showPlaceSearch}
                animationType="slide"
                transparent
                onRequestClose={closePlaceSearch}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'position' : undefined}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={0}
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
                        <View style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingBottom: 16, overflow: 'hidden', marginHorizontal: 16, marginBottom: insets.bottom > 0 ? insets.bottom : 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
                                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 }}>
                                    {placeSearchMode === 'origin' ? t('set-starting-point') : 'Add a stop'}
                                </Text>
                                <TouchableOpacity
                                    onPress={closePlaceSearch}
                                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <Ionicons name="close" size={20} color="#374151" />
                                </TouchableOpacity>
                            </View>

                            {placeSearchMode === 'origin' && (
                                <TouchableOpacity
                                    onPress={handleUseMyLocation}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        marginHorizontal: 20,
                                        marginBottom: 8,
                                        paddingVertical: 14,
                                        borderBottomWidth: 1,
                                        borderBottomColor: '#F3F4F6',
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={{
                                        width: 36, height: 36, borderRadius: 18,
                                        backgroundColor: `${colors.primary.main}15`,
                                        alignItems: 'center', justifyContent: 'center', marginRight: 14,
                                    }}>
                                        <Ionicons name="locate" size={18} color={colors.primary.main} />
                                    </View>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                                        {t('your-location')}
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                onPress={() => {
                                    closePlaceSearch();
                                    router.push({
                                        pathname: '/places/map-picker',
                                        params: {
                                            mode: placeSearchMode,
                                        }
                                    });
                                }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginHorizontal: 20,
                                    marginBottom: 8,
                                    paddingVertical: 14,
                                    borderBottomWidth: 1,
                                    borderBottomColor: '#F3F4F6',
                                }}
                                activeOpacity={0.7}
                            >
                                <View style={{
                                    width: 36, height: 36, borderRadius: 18,
                                    backgroundColor: `${colors.primary.main}15`,
                                    alignItems: 'center', justifyContent: 'center', marginRight: 14,
                                }}>
                                    <Ionicons name="map-outline" size={18} color={colors.primary.main} />
                                </View>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                                    {placeSearchMode === 'origin' ? t('pick-on-map') : t('pick-stop-on-map')}
                                </Text>
                            </TouchableOpacity>

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 8, backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }}>
                                <Ionicons name="search" size={18} color="#9CA3AF" />
                                <TextInput
                                    autoFocus
                                    placeholder={placeSearchMode === 'origin' ? t('search-starting-point') : 'Search for a place...'}
                                    placeholderTextColor="#9CA3AF"
                                    value={placeSearchQuery}
                                    onChangeText={handlePlaceSearchChange}
                                    style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#111827' }}
                                    returnKeyType="search"
                                />
                                {placeSearchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => { setPlaceSearchQuery(''); setPlaceSearchResults([]); }}>
                                        <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {isSearchingPlace ? (
                                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                                    <ActivityIndicator size="small" color={colors.primary.main} />
                                </View>
                            ) : (
                                <FlatList
                                    data={placeSearchResults}
                                    keyExtractor={(_, i) => i.toString()}
                                    style={{ maxHeight: 320 }}
                                    keyboardShouldPersistTaps="handled"
                                    ListEmptyComponent={
                                        placeSearchQuery.length >= 2 ? (
                                            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                                                <Text style={{ color: '#9CA3AF', fontSize: 14 }}>No results found</Text>
                                            </View>
                                        ) : null
                                    }
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            onPress={() => handleSelectSearchPlace(item)}
                                            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}
                                            activeOpacity={0.7}
                                        >
                                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.primary.main}15`, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                                                <Ionicons name="location-outline" size={18} color={colors.primary.main} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }} numberOfLines={1}>{item.name}</Text>
                                                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }} numberOfLines={1}>{[item.City, item.Country].filter(Boolean).join(', ')}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                />
                            )}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};
