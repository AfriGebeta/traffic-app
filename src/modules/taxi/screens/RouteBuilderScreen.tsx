import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouteBuilder } from '../contexts/RouteBuilderContext';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { showToast } from '../../../shared/utils/toast';
import { taxiService } from '../services/taxi.service';
import { TaxiNode } from '../types/taxi.types';
import { routeCacheService } from '../services/route-cache.service';

interface RouteStop {
    id: string;
    name: string;
    lat: number;
    lng: number;
    type: 'station' | 'stop';
    existingNodeId?: number;
    isExisting?: boolean;
    landmark?: string;
}

export default function RouteBuilderScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();
    const {
        pendingStop,
        setPendingStop,
        pickType,
        setPickType,
        cachedRoute,
        clearCache,
        setIsCollecting,
        setCurrentRouteName,
        isCollecting,
        endCollectorTracking,
    } = useRouteBuilder();
    const { userLocation } = useUserLocation();
    const keyboard = useAnimatedKeyboard();
    const keyboardAnimatedStyle = useAnimatedStyle(() => ({
        marginBottom: keyboard.height.value,
    }));

    const [routeName, setRouteName] = useState('');
    const [startStation, setStartStation] = useState<RouteStop | null>(null);
    const [endStation, setEndStation] = useState<RouteStop | null>(null);
    const [intermediateStops, setIntermediateStops] = useState<RouteStop[]>([]);
    const [startStationName, setStartStationName] = useState('');
    const [endStationName, setEndStationName] = useState('');
    const [intermediateStopName, setIntermediateStopName] = useState('');
    const [showStartNameInput, setShowStartNameInput] = useState(false);
    const [showEndNameInput, setShowEndNameInput] = useState(false);
    const [showIntermediateNameInput, setShowIntermediateNameInput] = useState(false);
    const [nearbyStations, setNearbyStations] = useState<(TaxiNode & { distance: number })[]>([]);
    const [loadingNearby, setLoadingNearby] = useState(false);
    const [selectedExisting, setSelectedExisting] = useState<TaxiNode | null>(null);
    const [startStationType, setStartStationType] = useState<'station' | 'stop'>('station');
    const [endStationType, setEndStationType] = useState<'station' | 'stop'>('station');
    const [intermediateStopType, setIntermediateStopType] = useState<'station' | 'stop'>('stop');
    const [showRestorePrompt, setShowRestorePrompt] = useState(false);
    const [startStationLandmark, setStartStationLandmark] = useState('');
    const [endStationLandmark, setEndStationLandmark] = useState('');
    const [intermediateStopLandmark, setIntermediateStopLandmark] = useState('');

    useEffect(() => {
        if (startStation && !isCollecting) {
            setIsCollecting(true);
            if (routeName) {
                setCurrentRouteName(routeName);
            }
            
        }
    }, [startStation, isCollecting, setIsCollecting, routeName, setCurrentRouteName]);


    useEffect(() => {
        return () => {
            if (isCollecting) {
                endCollectorTracking();
                setIsCollecting(false);
            }
        };
    }, [isCollecting, endCollectorTracking, setIsCollecting]);

    useEffect(() => {
        if (cachedRoute && cachedRoute.currentStep === 'builder') {
            setShowRestorePrompt(true);
        }
    }, [cachedRoute]);

    const restoreCachedRoute = () => {
        if (cachedRoute) {
            setRouteName(cachedRoute.routeName);
            setStartStation(cachedRoute.startStation);
            setEndStation(cachedRoute.endStation);
            setIntermediateStops(cachedRoute.intermediateStops);
            setShowRestorePrompt(false);
            showToast(`${t('restored')}: ${t('route-progress-restored')}`);
        }
    };

    const dismissRestorePrompt = async () => {
        setShowRestorePrompt(false);
        await clearCache();
    };

    useEffect(() => {
        const saveProgress = async () => {
            if (routeName || startStation || endStation || intermediateStops.length > 0) {
                await routeCacheService.saveRouteCache({
                    routeName,
                    startStation,
                    endStation,
                    intermediateStops,
                    currentStep: 'builder',
                    timestamp: Date.now(),
                });
            }
        };

        const timeoutId = setTimeout(saveProgress, 500);
        return () => clearTimeout(timeoutId);
    }, [routeName, startStation, endStation, intermediateStops]);

    useEffect(() => {
        if (pendingStop && pickType) {
            if (pickType === 'start') {
                setStartStation(pendingStop);
            } else if (pickType === 'end') {
                setEndStation(pendingStop);
            } else if (pickType === 'intermediate') {
                setIntermediateStops((prev) => [...prev, pendingStop]);
            }

            setPendingStop(null);
            setPickType(null);
        }
    }, [pendingStop, pickType, setPendingStop, setPickType]);

    const handlePickLocation = (type: 'start' | 'end' | 'intermediate') => {
        setPickType(type);
        router.push({
            pathname: '/taxi/map-picker',
            params: { type, routeName },
        });
    };

    const calculateDistance = (point1: { lat: number; lng: number }, point2: { lat: number; lng: number }) => {
        const R = 6371e3;
        const lat1Rad = (point1.lat * Math.PI) / 180;
        const lat2Rad = (point2.lat * Math.PI) / 180;
        const deltaLat = ((point2.lat - point1.lat) * Math.PI) / 180;
        const deltaLng = ((point2.lng - point1.lng) * Math.PI) / 180;

        const a =
            Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return Math.round(R * c);
    };

    const fetchNearbyStations = async () => {
        if (!userLocation) return;

        setLoadingNearby(true);
        try {
            const response: any = await taxiService.getNodes();
            const allNodes = Array.isArray(response) ? response : response.data || [];

            if (!Array.isArray(allNodes)) {
                setNearbyStations([]);
                return;
            }

            const nearby = allNodes
                .filter((node: TaxiNode) => node.nodeType === 'station' || node.nodeType === 'stop')
                .map((node: TaxiNode) => ({
                    ...node,
                    distance: calculateDistance(userLocation, { lat: node.lat, lng: node.lng }),
                }))
                .filter((node: any) => node.distance < 1000) // 1km radius
                .sort((a: any, b: any) => a.distance - b.distance)
                .slice(0, 5); //top 5 near

            setNearbyStations(nearby as (TaxiNode & { distance: number })[]);
        } catch (error) {
            console.error('Error fetching nearby stations:', error);
            setNearbyStations([]);
        } finally {
            setLoadingNearby(false);
        }
    };

    const handleUseCurrentLocation = (type: 'start' | 'end' | 'intermediate') => {
        if (!userLocation) {
            showToast(`${t('location-unavailable')}: ${t('please-wait-for-location')}`);
            return;
        }

        if (type === 'start') {
            setShowStartNameInput(true);
        } else if (type === 'end') {
            setShowEndNameInput(true);
        } else {
            setShowIntermediateNameInput(true);
        }

        //fetch nearby
        fetchNearbyStations();
        setSelectedExisting(null);
    };

    const handleSelectExisting = (station: TaxiNode, type: 'start' | 'end' | 'intermediate') => {
        setSelectedExisting(station);

        if (type === 'start') {
            setStartStationName(station.name);
        } else if (type === 'end') {
            setEndStationName(station.name);
        } else {
            setIntermediateStopName(station.name);
        }
    };

    const confirmCurrentLocation = (type: 'start' | 'end' | 'intermediate') => {
        if (!userLocation) {
            showToast(`${t('location-unavailable')}: ${t('please-wait-for-location')}`);
            return;
        }

        const name = type === 'start' ? startStationName : type === 'end' ? endStationName : intermediateStopName;

        if (!name.trim()) {
            Alert.alert(t('error'), t('please-enter-stop-name'));
            return;
        }

        const stopType = type === 'start' ? startStationType : type === 'end' ? endStationType : intermediateStopType;

        const landmarkValue = type === 'start' ? startStationLandmark : type === 'end' ? endStationLandmark : intermediateStopLandmark;

        const newStop: RouteStop = {
            id: selectedExisting ? selectedExisting.id.toString() : Date.now().toString(),
            name: name.trim(),
            lat: selectedExisting ? selectedExisting.lat : userLocation.lat,
            lng: selectedExisting ? selectedExisting.lng : userLocation.lng,
            type: selectedExisting ? (selectedExisting.nodeType as 'station' | 'stop') : stopType,
            existingNodeId: selectedExisting?.id,
            isExisting: !!selectedExisting,
            landmark: !selectedExisting && landmarkValue.trim() ? landmarkValue.trim() : undefined,
        };

        if (type === 'start') {
            setStartStation(newStop);
            setShowStartNameInput(false);
            setStartStationName('');
            setStartStationLandmark('');
        } else if (type === 'end') {
            setEndStation(newStop);
            setShowEndNameInput(false);
            setEndStationName('');
            setEndStationLandmark('');
        } else {
            setIntermediateStops((prev) => [...prev, newStop]);
            setShowIntermediateNameInput(false);
            setIntermediateStopName('');
            setIntermediateStopLandmark('');
        }

        setSelectedExisting(null);
        setNearbyStations([]);
    };

    const cancelCurrentLocation = (type: 'start' | 'end' | 'intermediate') => {
        if (type === 'start') {
            setShowStartNameInput(false);
            setStartStationName('');
            setStartStationLandmark('');
        } else if (type === 'end') {
            setShowEndNameInput(false);
            setEndStationName('');
            setEndStationLandmark('');
        } else {
            setShowIntermediateNameInput(false);
            setIntermediateStopName('');
            setIntermediateStopLandmark('');
        }

        setSelectedExisting(null);
        setNearbyStations([]);
    };

    const handleSubmit = () => {
        const stops = [
            ...(startStation ? [startStation] : []),
            ...intermediateStops,
            ...(endStation ? [endStation] : []),
        ];

        if (!startStation || stops.length < 2) {
            Alert.alert(t('error'), t('please-select-start-and-one-more-stop'));
            return;
        }

        const finalRouteName =
            routeName.trim() || `${stops[0].name} - ${stops[stops.length - 1].name}`;

        router.push({
            pathname: '/taxi/set-pricing',
            params: {
                routeName: finalRouteName,
                stops: JSON.stringify(stops),
            },
        });
    };

    const removeIntermediateStop = (index: number) => {
        setIntermediateStops(intermediateStops.filter((_, i) => i !== index));
    };

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
            <View className="px-4 py-6" style={{ borderBottomWidth: 1, borderBottomColor: theme.background }}>
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="mr-4"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={28} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold" style={{ color: theme.textPrimary }}>{t('build-route')}</Text>
                </View>
                <Text className="mt-2" style={{ color: theme.textSecondary }}>{t('create-route-with-stops')}</Text>
            </View>

            {showRestorePrompt && cachedRoute && (
                <View className="mx-4 mt-4 rounded-xl p-4 shadow-sm" style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                    <View className="flex-row items-start mb-3">
                        <Ionicons name="information-circle" size={24} color={colors.primary.main} />
                        <View className="flex-1 ml-3">
                            <Text className="font-semibold text-base mb-1" style={{ color: theme.textPrimary }}>
                                {t('unfinished-route-found')}
                            </Text>
                            <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                {t('restore-route-description')}: "{cachedRoute.routeName}"
                            </Text>
                        </View>
                    </View>
                    <View className="flex-row gap-2">
                        <TouchableOpacity
                            className="flex-1 py-3 rounded-lg"
                            style={{ backgroundColor: isDark ? theme.background : '#F3F4F6' }}
                            onPress={dismissRestorePrompt}
                        >
                            <Text className="text-center font-semibold" style={{ color: theme.textPrimary }}>
                                {t('start-new')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-1 py-3 rounded-lg"
                            style={{ backgroundColor: colors.primary.main }}
                            onPress={restoreCachedRoute}
                        >
                            <Text className="text-white text-center font-semibold">{t('restore')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <Animated.View style={[{ flex: 1 }, keyboardAnimatedStyle]}>
            <ScrollView
                className="flex-1 p-4"
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                keyboardShouldPersistTaps="handled"
            >
                <View className="rounded-2xl p-6 shadow-sm" style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                    <View className="mb-6">
                        <Text className="font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('route-name')} ({t('optional')})</Text>
                        <TextInput
                            className="rounded-xl px-4 py-3"
                            style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary }}
                            placeholderTextColor={theme.textSecondary}
                            placeholder={t('enter-route-name-example')}
                            value={routeName}
                            onChangeText={setRouteName}
                        />
                    </View>

                    <View className="mb-4">
                        <Text className="font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('start-station')} *</Text>
                        {startStation ? (
                            <View className="rounded-xl p-4" style={{ backgroundColor: isDark ? theme.greenMuted : '#F0FDF4', borderWidth: 1, borderColor: theme.green }}>
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-1">
                                        <Text className="font-semibold" style={{ color: theme.textPrimary }}>{startStation.name}</Text>
                                        <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                            {startStation.lat.toFixed(7)}, {startStation.lng.toFixed(7)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setStartStation(null)}>
                                        <Ionicons name="close-circle" size={24} color={theme.error} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : showStartNameInput ? (
                            <View className="border-2 rounded-xl p-4" style={{ backgroundColor: theme.surface, borderColor: colors.primary.main }}>
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="location" size={20} color={colors.primary.main} />
                                    <Text className="font-semibold ml-2" style={{ color: colors.primary.main }}>{t('using-current-location')}</Text>
                                </View>
                                <Text className="text-xs mb-3" style={{ color: colors.primary.main }}>
                                    {userLocation ? `${userLocation.lat.toFixed(7)}, ${userLocation.lng.toFixed(7)}` : t('waiting-for-location')}
                                </Text>

                                {selectedExisting && (
                                    <View className="rounded-lg p-3 mb-3 flex-row items-center justify-between" style={{ backgroundColor: isDark ? theme.greenMuted : '#F0FDF4', borderWidth: 1, borderColor: theme.green }}>
                                        <View className="flex-1">
                                            <Text className="font-semibold text-sm" style={{ color: theme.green }}>{t('using-existing-station')}</Text>
                                            <Text className="text-xs" style={{ color: theme.green }}>{selectedExisting.name}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => { setSelectedExisting(null); setStartStationName(''); }}>
                                            <Ionicons name="close-circle" size={20} color={theme.green} />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <TextInput
                                    className="border-2 rounded-lg px-4 py-3 mb-3"
                                    style={{ backgroundColor: theme.background, borderColor: colors.primary.main, color: theme.textPrimary }}
                                    placeholderTextColor={theme.textSecondary}
                                    placeholder={t('enter-station-name')}
                                    value={startStationName}
                                    onChangeText={setStartStationName}
                                    autoFocus
                                    editable={!selectedExisting}
                                />

                                {!selectedExisting && nearbyStations.length > 0 && (
                                    <View className="mb-3 rounded-lg overflow-hidden" style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                                        <View className="px-3 py-2" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
                                            <Text className="font-semibold text-xs" style={{ color: theme.textPrimary }}>{t('nearby-existing-stations')}</Text>
                                        </View>
                                        <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
                                            {nearbyStations.map((station) => (
                                                <TouchableOpacity
                                                    key={station.id}
                                                    className="px-3 py-2"
                                                    style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}
                                                    onPress={() => handleSelectExisting(station, 'start')}
                                                >
                                                    <View className="flex-row items-center">
                                                        <Text className="font-semibold flex-1 text-sm" style={{ color: theme.textPrimary }}>{station.name}</Text>
                                                        {station.nodeType && (
                                                            <View className="px-2 py-1 rounded" style={{ backgroundColor: theme.primaryMuted }}>
                                                                <Text className="text-xs font-medium" style={{ color: isDark ? theme.primary : '#C2410C' }}>{station.nodeType}</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>{station.distance}m away</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                {loadingNearby && (
                                    <Text className="text-xs mb-3" style={{ color: theme.textSecondary }}>{t('loading-nearby-stations')}</Text>
                                )}

                                {!selectedExisting && (
                                    <View className="mb-3">
                                        <Text className="font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('type')}</Text>
                                        <View className="flex-row gap-3">
                                            <TouchableOpacity
                                                className="flex-1 py-3 rounded-xl border-2"
                                                style={{ backgroundColor: startStationType === 'station' ? theme.primaryMuted : theme.background, borderColor: startStationType === 'station' ? theme.primary : theme.border }}
                                                onPress={() => setStartStationType('station')}
                                            >
                                                <Text className="text-center font-semibold" style={{ color: startStationType === 'station' ? theme.primary : theme.textSecondary }}>
                                                    {t('station')}
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                className="flex-1 py-3 rounded-xl border-2"
                                                style={{ backgroundColor: startStationType === 'stop' ? theme.primaryMuted : theme.background, borderColor: startStationType === 'stop' ? theme.primary : theme.border }}
                                                onPress={() => setStartStationType('stop')}
                                            >
                                                <Text className="text-center font-semibold" style={{ color: startStationType === 'stop' ? theme.primary : theme.textSecondary }}>
                                                    {t('stop')}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}

                                {!selectedExisting && (
                                    <View className="mb-3">
                                        <Text className="font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('landmark')}</Text>
                                        <TextInput
                                            className="rounded-lg px-4 py-3"
                                            style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary }}
                                            placeholderTextColor={theme.textSecondary}
                                            placeholder={t('enter-landmark-description')}
                                            value={startStationLandmark}
                                            onChangeText={setStartStationLandmark}
                                            multiline
                                            numberOfLines={2}
                                        />
                                    </View>
                                )}

                                <View className="flex-row gap-2">
                                    <TouchableOpacity
                                        className="flex-1 py-2 rounded-lg"
                                        style={{ backgroundColor: isDark ? theme.background : '#E5E7EB' }}
                                        onPress={() => cancelCurrentLocation('start')}
                                    >
                                        <Text className="text-center font-semibold" style={{ color: theme.textPrimary }}>{t('cancel')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        className="flex-1 py-2 rounded-lg"
                                        style={{ backgroundColor: colors.primary.main }}
                                        onPress={() => confirmCurrentLocation('start')}
                                    >
                                        <Text className="text-white text-center font-semibold">{t('confirm')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View>
                                <TouchableOpacity
                                    className="py-3 rounded-xl mb-2 flex-row items-center justify-center"
                                    style={{ backgroundColor: colors.primary.main }}
                                    onPress={() => handleUseCurrentLocation('start')}
                                    activeOpacity={0.7}
                                    disabled={!userLocation}
                                >
                                    <Ionicons name="locate" size={20} color="white" />
                                    <Text className="text-white font-semibold ml-2">{t('use-current-location')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className="rounded-xl p-4 flex-row items-center justify-center"
                                    style={{ backgroundColor: theme.surface, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.border }}
                                    onPress={() => handlePickLocation('start')}
                                >
                                    <Ionicons name="map" size={24} color={colors.primary.main} />
                                    <Text className="ml-2" style={{ color: theme.textSecondary }}>{t('or-pick-on-map')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <View className="mb-4">
                        <Text className="font-semibold mb-2" style={{ color: theme.textPrimary }}>
                            {t('intermediate-stops')} ({intermediateStops.length})
                        </Text>
                        {intermediateStops.map((stop, index) => (
                            <View key={stop.id} className="border-2 rounded-xl p-4 mb-2" style={{ backgroundColor: theme.surface, borderColor: colors.primary.main }}>
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-1">
                                        <Text className="font-semibold" style={{ color: theme.textPrimary }}>{stop.name}</Text>
                                        <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                            {stop.lat.toFixed(7)}, {stop.lng.toFixed(7)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => removeIntermediateStop(index)}>
                                        <Ionicons name="close-circle" size={24} color={theme.error} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                        {showIntermediateNameInput ? (
                            <View className="border-2 rounded-xl p-4 mb-2" style={{ backgroundColor: theme.surface, borderColor: colors.primary.main }}>
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="location" size={20} color={colors.primary.main} />
                                    <Text className="font-semibold ml-2" style={{ color: colors.primary.main }}>{t('using-current-location')}</Text>
                                </View>
                                <Text className="text-xs mb-3" style={{ color: colors.primary.main }}>
                                    {userLocation ? `${userLocation.lat.toFixed(7)}, ${userLocation.lng.toFixed(7)}` : t('waiting-for-location')}
                                </Text>

                                {selectedExisting && (
                                    <View className="rounded-lg p-3 mb-3 flex-row items-center justify-between" style={{ backgroundColor: isDark ? theme.greenMuted : '#F0FDF4', borderWidth: 1, borderColor: theme.green }}>
                                        <View className="flex-1">
                                            <Text className="font-semibold text-sm" style={{ color: theme.green }}>{t('using-existing-station')}</Text>
                                            <Text className="text-xs" style={{ color: theme.green }}>{selectedExisting.name}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => { setSelectedExisting(null); setIntermediateStopName(''); }}>
                                            <Ionicons name="close-circle" size={20} color={theme.green} />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <TextInput
                                    className="border-2 rounded-lg px-4 py-3 mb-3"
                                    style={{ backgroundColor: theme.background, borderColor: colors.primary.main, color: theme.textPrimary }}
                                    placeholderTextColor={theme.textSecondary}
                                    placeholder={t('enter-stop-name')}
                                    value={intermediateStopName}
                                    onChangeText={setIntermediateStopName}
                                    autoFocus
                                    editable={!selectedExisting}
                                />

                                {!selectedExisting && nearbyStations.length > 0 && (
                                    <View className="mb-3 rounded-lg overflow-hidden" style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                                        <View className="px-3 py-2" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
                                            <Text className="font-semibold text-xs" style={{ color: theme.textPrimary }}>{t('nearby-existing-stations')}</Text>
                                        </View>
                                        <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
                                            {nearbyStations.map((station) => (
                                                <TouchableOpacity
                                                    key={station.id}
                                                    className="px-3 py-2"
                                                    style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}
                                                    onPress={() => handleSelectExisting(station, 'intermediate')}
                                                >
                                                    <View className="flex-row items-center">
                                                        <Text className="font-semibold flex-1 text-sm" style={{ color: theme.textPrimary }}>{station.name}</Text>
                                                        {station.nodeType && (
                                                            <View className="px-2 py-1 rounded" style={{ backgroundColor: theme.primaryMuted }}>
                                                                <Text className="text-xs font-medium" style={{ color: isDark ? theme.primary : '#C2410C' }}>{station.nodeType}</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>{station.distance}m away</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                {loadingNearby && (
                                    <Text className="text-xs mb-3" style={{ color: theme.textSecondary }}>{t('loading-nearby-stations')}</Text>
                                )}

                                {!selectedExisting && (
                                    <View className="mb-3">
                                        <Text className="font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('type')}</Text>
                                        <View className="flex-row gap-3">
                                            <TouchableOpacity
                                                className="flex-1 py-3 rounded-xl border-2"
                                                style={{ backgroundColor: intermediateStopType === 'station' ? theme.primaryMuted : theme.background, borderColor: intermediateStopType === 'station' ? theme.primary : theme.border }}
                                                onPress={() => setIntermediateStopType('station')}
                                            >
                                                <Text className="text-center font-semibold" style={{ color: intermediateStopType === 'station' ? theme.primary : theme.textSecondary }}>
                                                    {t('station')}
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                className="flex-1 py-3 rounded-xl border-2"
                                                style={{ backgroundColor: intermediateStopType === 'stop' ? theme.primaryMuted : theme.background, borderColor: intermediateStopType === 'stop' ? theme.primary : theme.border }}
                                                onPress={() => setIntermediateStopType('stop')}
                                            >
                                                <Text className="text-center font-semibold" style={{ color: intermediateStopType === 'stop' ? theme.primary : theme.textSecondary }}>
                                                    {t('stop')}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}

                                {!selectedExisting && (
                                    <View className="mb-3">
                                        <Text className="font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('landmark')}</Text>
                                        <TextInput
                                            className="rounded-lg px-4 py-3"
                                            style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary }}
                                            placeholderTextColor={theme.textSecondary}
                                            placeholder={t('enter-landmark-description')}
                                            value={intermediateStopLandmark}
                                            onChangeText={setIntermediateStopLandmark}
                                            multiline
                                            numberOfLines={2}
                                        />
                                    </View>
                                )}

                                <View className="flex-row gap-2">
                                    <TouchableOpacity
                                        className="flex-1 py-2 rounded-lg"
                                        style={{ backgroundColor: isDark ? theme.background : '#E5E7EB' }}
                                        onPress={() => cancelCurrentLocation('intermediate')}
                                    >
                                        <Text className="text-center font-semibold" style={{ color: theme.textPrimary }}>{t('cancel')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        className="flex-1 py-2 rounded-lg"
                                        style={{ backgroundColor: colors.primary.main }}
                                        onPress={() => confirmCurrentLocation('intermediate')}
                                    >
                                        <Text className="text-white text-center font-semibold">{t('confirm')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View>
                                <TouchableOpacity
                                    className="py-3 rounded-xl mb-2 flex-row items-center justify-center mt-2"
                                    style={{ backgroundColor: colors.primary.main }}
                                    onPress={() => handleUseCurrentLocation('intermediate')}
                                    activeOpacity={0.7}
                                    disabled={!userLocation}
                                >
                                    <Ionicons name="locate" size={20} color="white" />
                                    <Text className="text-white font-semibold ml-2">{t('use-current-location')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className="rounded-xl p-4 flex-row items-center justify-center"
                                    style={{ backgroundColor: theme.surface, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.border }}
                                    onPress={() => handlePickLocation('intermediate')}
                                >
                                    <Ionicons name="add-circle" size={24} color={colors.primary.main} />
                                    <Text className="ml-2" style={{ color: theme.textSecondary }}>{t('or-pick-on-map')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <View className="mb-6">
                        <Text className="font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('end-station')} ({t('optional')})</Text>
                        {endStation ? (
                            <View className="rounded-xl p-4" style={{ backgroundColor: isDark ? theme.surface : '#FEF2F2', borderWidth: 1, borderColor: theme.error }}>
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-1">
                                        <Text className="font-semibold" style={{ color: theme.textPrimary }}>{endStation.name}</Text>
                                        <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                            {endStation.lat.toFixed(7)}, {endStation.lng.toFixed(7)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setEndStation(null)}>
                                        <Ionicons name="close-circle" size={24} color={theme.error} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : showEndNameInput ? (
                            <View className="border-2 rounded-xl p-4" style={{ backgroundColor: theme.surface, borderColor: colors.primary.main }}>
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="location" size={20} color={colors.primary.main} />
                                    <Text className="font-semibold ml-2" style={{ color: colors.primary.main }}>{t('using-current-location')}</Text>
                                </View>
                                <Text className="text-xs mb-3" style={{ color: colors.primary.main }}>
                                    {userLocation ? `${userLocation.lat.toFixed(7)}, ${userLocation.lng.toFixed(7)}` : t('waiting-for-location')}
                                </Text>

                                {selectedExisting && (
                                    <View className="rounded-lg p-3 mb-3 flex-row items-center justify-between" style={{ backgroundColor: isDark ? theme.greenMuted : '#F0FDF4', borderWidth: 1, borderColor: theme.green }}>
                                        <View className="flex-1">
                                            <Text className="font-semibold text-sm" style={{ color: theme.green }}>{t('using-existing-station')}</Text>
                                            <Text className="text-xs" style={{ color: theme.green }}>{selectedExisting.name}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => { setSelectedExisting(null); setEndStationName(''); }}>
                                            <Ionicons name="close-circle" size={20} color={theme.green} />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <TextInput
                                    className="border rounded-lg px-4 py-3 mb-3"
                                    style={{ backgroundColor: theme.background, borderColor: theme.blue, color: theme.textPrimary }}
                                    placeholderTextColor={theme.textSecondary}
                                    placeholder={t('enter-station-name')}
                                    value={endStationName}
                                    onChangeText={setEndStationName}
                                    autoFocus
                                    editable={!selectedExisting}
                                />

                                {!selectedExisting && nearbyStations.length > 0 && (
                                    <View className="mb-3 rounded-lg overflow-hidden" style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                                        <View className="px-3 py-2" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
                                            <Text className="font-semibold text-xs" style={{ color: theme.textPrimary }}>{t('nearby-existing-stations')}</Text>
                                        </View>
                                        <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
                                            {nearbyStations.map((station) => (
                                                <TouchableOpacity
                                                    key={station.id}
                                                    className="px-3 py-2"
                                                    style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}
                                                    onPress={() => handleSelectExisting(station, 'end')}
                                                >
                                                    <View className="flex-row items-center">
                                                        <Text className="font-semibold flex-1 text-sm" style={{ color: theme.textPrimary }}>{station.name}</Text>
                                                        {station.nodeType && (
                                                            <View className="px-2 py-1 rounded" style={{ backgroundColor: theme.primaryMuted }}>
                                                                <Text className="text-xs font-medium" style={{ color: isDark ? theme.primary : '#C2410C' }}>{station.nodeType}</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>{station.distance}m away</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                {loadingNearby && (
                                    <Text className="text-xs mb-3" style={{ color: theme.textSecondary }}>{t('loading-nearby-stations')}</Text>
                                )}

                                {!selectedExisting && (
                                    <View className="mb-3">
                                        <Text className="font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('type')}</Text>
                                        <View className="flex-row gap-3">
                                            <TouchableOpacity
                                                className="flex-1 py-3 rounded-xl border-2"
                                                style={{ backgroundColor: endStationType === 'station' ? theme.primaryMuted : theme.background, borderColor: endStationType === 'station' ? theme.primary : theme.border }}
                                                onPress={() => setEndStationType('station')}
                                            >
                                                <Text className="text-center font-semibold" style={{ color: endStationType === 'station' ? theme.primary : theme.textSecondary }}>
                                                    {t('station')}
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                className="flex-1 py-3 rounded-xl border-2"
                                                style={{ backgroundColor: endStationType === 'stop' ? theme.primaryMuted : theme.background, borderColor: endStationType === 'stop' ? theme.primary : theme.border }}
                                                onPress={() => setEndStationType('stop')}
                                            >
                                                <Text className="text-center font-semibold" style={{ color: endStationType === 'stop' ? theme.primary : theme.textSecondary }}>
                                                    {t('stop')}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}

                                {!selectedExisting && (
                                    <View className="mb-3">
                                        <Text className="font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('landmark')}</Text>
                                        <TextInput
                                            className="rounded-lg px-4 py-3"
                                            style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary }}
                                            placeholderTextColor={theme.textSecondary}
                                            placeholder={t('enter-landmark-description')}
                                            value={endStationLandmark}
                                            onChangeText={setEndStationLandmark}
                                            multiline
                                            numberOfLines={2}
                                        />
                                    </View>
                                )}

                                <View className="flex-row gap-2">
                                    <TouchableOpacity
                                        className="flex-1 py-2 rounded-lg"
                                        style={{ backgroundColor: isDark ? theme.background : '#E5E7EB' }}
                                        onPress={() => cancelCurrentLocation('end')}
                                    >
                                        <Text className="text-center font-semibold" style={{ color: theme.textPrimary }}>{t('cancel')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        className="flex-1 py-2 rounded-lg"
                                        style={{ backgroundColor: colors.primary.main }}
                                        onPress={() => confirmCurrentLocation('end')}
                                    >
                                        <Text className="text-white text-center font-semibold">{t('confirm')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View>
                                <TouchableOpacity
                                    className="py-3 rounded-xl mb-2 flex-row items-center justify-center"
                                    style={{ backgroundColor: colors.primary.main }}
                                    onPress={() => handleUseCurrentLocation('end')}
                                    activeOpacity={0.7}
                                    disabled={!userLocation}
                                >
                                    <Ionicons name="locate" size={20} color="white" />
                                    <Text className="text-white font-semibold ml-2">{t('use-current-location')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className="rounded-xl p-4 flex-row items-center justify-center"
                                    style={{ backgroundColor: theme.surface, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.border }}
                                    onPress={() => handlePickLocation('end')}
                                >
                                    <Ionicons name="map" size={24} color={colors.primary.main} />
                                    <Text className="ml-2" style={{ color: theme.textSecondary }}>{t('or-pick-on-map')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        className="py-4 rounded-xl"
                        style={{ backgroundColor: colors.primary.main }}
                        onPress={handleSubmit}
                        activeOpacity={0.7}
                    >
                        <Text className="text-white text-center font-bold text-lg">{t('next')}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView >
            </Animated.View>
        </View >
    );
}


