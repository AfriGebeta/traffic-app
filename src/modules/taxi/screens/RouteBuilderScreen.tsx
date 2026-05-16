import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouteBuilder } from '../contexts/RouteBuilderContext';
import { colors } from '../../../shared/theme/colors';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { showToast } from '../../../shared/utils/toast';
import { taxiService } from '../services/taxi.service';
import { TaxiNode } from '../types/taxi.types';

interface RouteStop {
    id: string;
    name: string;
    lat: number;
    lng: number;
    type: 'station' | 'stop';
    existingNodeId?: number;
    isExisting?: boolean;
}

export default function RouteBuilderScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { pendingStop, setPendingStop, pickType, setPickType } = useRouteBuilder();
    const { userLocation } = useUserLocation();

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
            const response: any = await taxiService.getNodes(500);
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
            showToast.error(t('location-unavailable'), t('please-wait-for-location'));
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
            showToast.error(t('location-unavailable'), t('please-wait-for-location'));
            return;
        }

        const name = type === 'start' ? startStationName : type === 'end' ? endStationName : intermediateStopName;

        if (!name.trim()) {
            Alert.alert(t('error'), t('please-enter-stop-name'));
            return;
        }

        const newStop: RouteStop = {
            id: selectedExisting ? selectedExisting.id.toString() : Date.now().toString(),
            name: name.trim(),
            lat: selectedExisting ? selectedExisting.lat : userLocation.lat,
            lng: selectedExisting ? selectedExisting.lng : userLocation.lng,
            type: type === 'intermediate' ? 'stop' : 'station',
            existingNodeId: selectedExisting?.id,
            isExisting: !!selectedExisting,
        };

        if (type === 'start') {
            setStartStation(newStop);
            setShowStartNameInput(false);
            setStartStationName('');
        } else if (type === 'end') {
            setEndStation(newStop);
            setShowEndNameInput(false);
            setEndStationName('');
        } else {
            setIntermediateStops((prev) => [...prev, newStop]);
            setShowIntermediateNameInput(false);
            setIntermediateStopName('');
        }

        setSelectedExisting(null);
        setNearbyStations([]);
    };

    const cancelCurrentLocation = (type: 'start' | 'end' | 'intermediate') => {
        if (type === 'start') {
            setShowStartNameInput(false);
            setStartStationName('');
        } else if (type === 'end') {
            setShowEndNameInput(false);
            setEndStationName('');
        } else {
            setShowIntermediateNameInput(false);
            setIntermediateStopName('');
        }

        setSelectedExisting(null);
        setNearbyStations([]);
    };

    const handleSubmit = () => {
        if (!routeName.trim()) {
            Alert.alert(t('error'), t('please-enter-route-name'));
            return;
        }

        if (!startStation || !endStation) {
            Alert.alert(t('error'), t('please-select-start-end-stations'));
            return;
        }

        router.push({
            pathname: '/taxi/set-pricing',
            params: {
                routeName: routeName.trim(),
                stops: JSON.stringify([startStation, ...intermediateStops, endStation]),
            },
        });
    };

    const removeIntermediateStop = (index: number) => {
        setIntermediateStops(intermediateStops.filter((_, i) => i !== index));
    };

    return (
        <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
            <View className="px-4 py-6 border-b border-gray-50">
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="mr-4"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={28} color={colors.primary.main} />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-gray-900">{t('build-route')}</Text>
                </View>
                <Text className="text-gray-600 mt-2">{t('create-route-with-stops')}</Text>
            </View>

            <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
                <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <View className="mb-6">
                        <Text className="text-gray-700 font-semibold mb-2">{t('route-name')} *</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                            placeholder={t('enter-route-name-example')}
                            value={routeName}
                            onChangeText={setRouteName}
                        />
                    </View>

                    <View className="mb-4">
                        <Text className="text-gray-700 font-semibold mb-2">{t('start-station')} *</Text>
                        {startStation ? (
                            <View className="bg-green-50 border border-green-200 rounded-xl p-4">
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-1">
                                        <Text className="text-gray-900 font-semibold">{startStation.name}</Text>
                                        <Text className="text-gray-500 text-sm">
                                            {startStation.lat.toFixed(7)}, {startStation.lng.toFixed(7)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setStartStation(null)}>
                                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : showStartNameInput ? (
                            <View className="bg-white border-2 rounded-xl p-4" style={{ borderColor: colors.primary.main }}>
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="location" size={20} color={colors.primary.main} />
                                    <Text className="font-semibold ml-2" style={{ color: colors.primary.main }}>{t('using-current-location')}</Text>
                                </View>
                                <Text className="text-xs mb-3" style={{ color: colors.primary.main }}>
                                    {userLocation ? `${userLocation.lat.toFixed(7)}, ${userLocation.lng.toFixed(7)}` : t('waiting-for-location')}
                                </Text>

                                {selectedExisting && (
                                    <View className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 flex-row items-center justify-between">
                                        <View className="flex-1">
                                            <Text className="text-green-700 font-semibold text-sm">{t('using-existing-station')}</Text>
                                            <Text className="text-green-600 text-xs">{selectedExisting.name}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => { setSelectedExisting(null); setStartStationName(''); }}>
                                            <Ionicons name="close-circle" size={20} color="#10B981" />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <TextInput
                                    className="bg-white border-2 rounded-lg px-4 py-3 text-gray-900 mb-3"
                                    style={{ borderColor: colors.primary.main }}
                                    placeholder={t('enter-station-name')}
                                    value={startStationName}
                                    onChangeText={setStartStationName}
                                    autoFocus
                                    editable={!selectedExisting}
                                />

                                {!selectedExisting && nearbyStations.length > 0 && (
                                    <View className="mb-3 bg-white border border-gray-200 rounded-lg overflow-hidden">
                                        <View className="bg-white px-3 py-2 border-b border-gray-200">
                                            <Text className="text-gray-700 font-semibold text-xs">{t('nearby-existing-stations')}</Text>
                                        </View>
                                        <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
                                            {nearbyStations.map((station) => (
                                                <TouchableOpacity
                                                    key={station.id}
                                                    className="px-3 py-2 border-b border-gray-100"
                                                    onPress={() => handleSelectExisting(station, 'start')}
                                                >
                                                    <View className="flex-row items-center">
                                                        <Text className="text-gray-900 font-semibold flex-1 text-sm">{station.name}</Text>
                                                        {station.nodeType && (
                                                            <View className="px-2 py-1 rounded bg-orange-100">
                                                                <Text className="text-xs font-medium text-orange-700">{station.nodeType}</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text className="text-gray-500 text-xs mt-1">{station.distance}m away</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                {loadingNearby && (
                                    <Text className="text-gray-500 text-xs mb-3">{t('loading-nearby-stations')}</Text>
                                )}

                                <View className="flex-row gap-2">
                                    <TouchableOpacity
                                        className="flex-1 bg-gray-200 py-2 rounded-lg"
                                        onPress={() => cancelCurrentLocation('start')}
                                    >
                                        <Text className="text-gray-700 text-center font-semibold">{t('cancel')}</Text>
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
                                    className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-4 flex-row items-center justify-center"
                                    onPress={() => handlePickLocation('start')}
                                >
                                    <Ionicons name="map" size={24} color={colors.primary.main} />
                                    <Text className="text-gray-600 ml-2">{t('or-pick-on-map')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <View className="mb-4">
                        <Text className="text-gray-700 font-semibold mb-2">
                            {t('intermediate-stops')} ({intermediateStops.length})
                        </Text>
                        {intermediateStops.map((stop, index) => (
                            <View key={stop.id} className="bg-white border-2 rounded-xl p-4 mb-2" style={{ borderColor: colors.primary.main }}>
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-1">
                                        <Text className="text-gray-900 font-semibold">{stop.name}</Text>
                                        <Text className="text-gray-500 text-sm">
                                            {stop.lat.toFixed(7)}, {stop.lng.toFixed(7)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => removeIntermediateStop(index)}>
                                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                        {showIntermediateNameInput ? (
                            <View className="bg-white border-2 rounded-xl p-4 mb-2" style={{ borderColor: colors.primary.main }}>
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="location" size={20} color={colors.primary.main} />
                                    <Text className="font-semibold ml-2" style={{ color: colors.primary.main }}>{t('using-current-location')}</Text>
                                </View>
                                <Text className="text-xs mb-3" style={{ color: colors.primary.main }}>
                                    {userLocation ? `${userLocation.lat.toFixed(7)}, ${userLocation.lng.toFixed(7)}` : t('waiting-for-location')}
                                </Text>

                                {selectedExisting && (
                                    <View className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 flex-row items-center justify-between">
                                        <View className="flex-1">
                                            <Text className="text-green-700 font-semibold text-sm">{t('using-existing-station')}</Text>
                                            <Text className="text-green-600 text-xs">{selectedExisting.name}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => { setSelectedExisting(null); setIntermediateStopName(''); }}>
                                            <Ionicons name="close-circle" size={20} color="#10B981" />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <TextInput
                                    className="bg-white border-2 rounded-lg px-4 py-3 text-gray-900 mb-3"
                                    placeholder={t('enter-stop-name')}
                                    value={intermediateStopName}
                                    onChangeText={setIntermediateStopName}
                                    autoFocus
                                    editable={!selectedExisting}
                                />

                                {!selectedExisting && nearbyStations.length > 0 && (
                                    <View className="mb-3 bg-white border border-gray-200 rounded-lg overflow-hidden">
                                        <View className="bg-white px-3 py-2 border-b border-gray-200">
                                            <Text className="text-gray-700 font-semibold text-xs">{t('nearby-existing-stations')}</Text>
                                        </View>
                                        <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
                                            {nearbyStations.map((station) => (
                                                <TouchableOpacity
                                                    key={station.id}
                                                    className="px-3 py-2 border-b border-gray-100"
                                                    onPress={() => handleSelectExisting(station, 'intermediate')}
                                                >
                                                    <View className="flex-row items-center">
                                                        <Text className="text-gray-900 font-semibold flex-1 text-sm">{station.name}</Text>
                                                        {station.nodeType && (
                                                            <View className="px-2 py-1 rounded bg-orange-100">
                                                                <Text className="text-xs font-medium text-orange-700">{station.nodeType}</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text className="text-gray-500 text-xs mt-1">{station.distance}m away</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                {loadingNearby && (
                                    <Text className="text-gray-500 text-xs mb-3">{t('loading-nearby-stations')}</Text>
                                )}

                                <View className="flex-row gap-2">
                                    <TouchableOpacity
                                        className="flex-1 bg-gray-200 py-2 rounded-lg"
                                        onPress={() => cancelCurrentLocation('intermediate')}
                                    >
                                        <Text className="text-gray-700 text-center font-semibold">{t('cancel')}</Text>
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
                                    className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-4 flex-row items-center justify-center"
                                    onPress={() => handlePickLocation('intermediate')}
                                >
                                    <Ionicons name="add-circle" size={24} color={colors.primary.main} />
                                    <Text className="text-gray-600 ml-2">{t('or-pick-on-map')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <View className="mb-6">
                        <Text className="text-gray-700 font-semibold mb-2">{t('end-station')} *</Text>
                        {endStation ? (
                            <View className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-1">
                                        <Text className="text-gray-900 font-semibold">{endStation.name}</Text>
                                        <Text className="text-gray-500 text-sm">
                                            {endStation.lat.toFixed(7)}, {endStation.lng.toFixed(7)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setEndStation(null)}>
                                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : showEndNameInput ? (
                            <View className="bg-white border-2 rounded-xl p-4" style={{ borderColor: colors.primary.main }}>
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="location" size={20} color={colors.primary.main} />
                                    <Text className="font-semibold ml-2" style={{ color: colors.primary.main }}>{t('using-current-location')}</Text>
                                </View>
                                <Text className="text-xs mb-3" style={{ color: colors.primary.main }}>
                                    {userLocation ? `${userLocation.lat.toFixed(7)}, ${userLocation.lng.toFixed(7)}` : t('waiting-for-location')}
                                </Text>

                                {selectedExisting && (
                                    <View className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 flex-row items-center justify-between">
                                        <View className="flex-1">
                                            <Text className="text-green-700 font-semibold text-sm">{t('using-existing-station')}</Text>
                                            <Text className="text-green-600 text-xs">{selectedExisting.name}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => { setSelectedExisting(null); setEndStationName(''); }}>
                                            <Ionicons name="close-circle" size={20} color="#10B981" />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <TextInput
                                    className="bg-white border border-blue-300 rounded-lg px-4 py-3 text-gray-900 mb-3"
                                    placeholder={t('enter-station-name')}
                                    value={endStationName}
                                    onChangeText={setEndStationName}
                                    autoFocus
                                    editable={!selectedExisting}
                                />

                                {!selectedExisting && nearbyStations.length > 0 && (
                                    <View className="mb-3 bg-white border border-gray-200 rounded-lg overflow-hidden">
                                        <View className="bg-white px-3 py-2 border-b border-gray-200">
                                            <Text className="text-gray-700 font-semibold text-xs">{t('nearby-existing-stations')}</Text>
                                        </View>
                                        <ScrollView style={{ maxHeight: 120 }} nestedScrollEnabled>
                                            {nearbyStations.map((station) => (
                                                <TouchableOpacity
                                                    key={station.id}
                                                    className="px-3 py-2 border-b border-gray-100"
                                                    onPress={() => handleSelectExisting(station, 'end')}
                                                >
                                                    <View className="flex-row items-center">
                                                        <Text className="text-gray-900 font-semibold flex-1 text-sm">{station.name}</Text>
                                                        {station.nodeType && (
                                                            <View className="px-2 py-1 rounded bg-orange-100">
                                                                <Text className="text-xs font-medium text-orange-700">{station.nodeType}</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <Text className="text-gray-500 text-xs mt-1">{station.distance}m away</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                {loadingNearby && (
                                    <Text className="text-gray-500 text-xs mb-3">{t('loading-nearby-stations')}</Text>
                                )}

                                <View className="flex-row gap-2">
                                    <TouchableOpacity
                                        className="flex-1 bg-gray-200 py-2 rounded-lg"
                                        onPress={() => cancelCurrentLocation('end')}
                                    >
                                        <Text className="text-gray-700 text-center font-semibold">{t('cancel')}</Text>
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
                                    className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-4 flex-row items-center justify-center"
                                    onPress={() => handlePickLocation('end')}
                                >
                                    <Ionicons name="map" size={24} color={colors.primary.main} />
                                    <Text className="text-gray-600 ml-2">{t('or-pick-on-map')}</Text>
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
        </View >
    );
}


