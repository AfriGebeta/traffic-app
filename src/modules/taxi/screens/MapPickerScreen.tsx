import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    ScrollView,
} from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '../../../shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GebetaMap from '../../../components/GebetaMap';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { useRouteBuilder } from '../contexts/RouteBuilderContext';
import { taxiService } from '../services/taxi.service';
import { TaxiNode } from '../types/taxi.types';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { showToast } from '../../../shared/utils/toast';
import { useRemoteConfig } from '../../../shared/contexts/RemoteConfigContext';

export default function MapPickerScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { setPendingStop } = useRouteBuilder();
    const mapRef = useRef<GebetaMapRef>(null);
    const { userLocation } = useUserLocation();
    const { apiKey } = useRemoteConfig();

    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [stopName, setStopName] = useState('');
    const [stopType, setStopType] = useState<'station' | 'stop'>(() =>
        params.type === 'intermediate' ? 'stop' : 'station'
    );
    const [stopLandmark, setStopLandmark] = useState('');
    const [nearbyStations, setNearbyStations] = useState<TaxiNode[]>([]);
    const [allStations, setAllStations] = useState<TaxiNode[]>([]);
    const [filteredStations, setFilteredStations] = useState<TaxiNode[]>([]);
    const [selectedExisting, setSelectedExisting] = useState<TaxiNode | null>(null);
    const [loadingStations, setLoadingStations] = useState(false);
    const keyboard = useAnimatedKeyboard();
    const sheetAnimatedStyle = useAnimatedStyle(() => ({
        marginBottom: keyboard.height.value,
    }));

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

    useEffect(() => {
        const fetchAllStations = async () => {
            console.log('[MapPicker] Fetching all stations...');
            setLoadingStations(true);
            try {
                const response: any = await taxiService.getAllNodes();
                console.log('[MapPicker] Response:', response);
                const allNodes = Array.isArray(response) ? response : response.data || [];
                console.log('[MapPicker] All nodes count:', allNodes.length);

                if (!Array.isArray(allNodes)) {
                    setAllStations([]);
                    return;
                }

                const isIntermediate = params.type === 'intermediate';
                const stations = allNodes.filter((node: TaxiNode) =>
                    isIntermediate ? true : (node.nodeType === 'station' || node.nodeType === 'stop')
                );

                console.log('[MapPicker] Filtered stations count:', stations.length);
                setAllStations(stations);
            } catch (error) {
                console.error('[MapPicker] Error fetching all stations:', error);
                setAllStations([]);
            } finally {
                setLoadingStations(false);
            }
        };

        fetchAllStations();
    }, [params.type]);

    useEffect(() => {
        if (selectedLocation) {
            fetchNearbyStations();
        }
    }, [selectedLocation]);

    const fetchNearbyStations = async () => {
        if (!selectedLocation) return;

        setLoadingStations(true);
        try {
            const response: any = await taxiService.getNodes(500);
            const allNodes = Array.isArray(response) ? response : response.data || [];

            if (!Array.isArray(allNodes)) {
                setNearbyStations([]);
                return;
            }

            const isIntermediate = params.type === 'intermediate';
            const nearby = allNodes
                .filter((node: TaxiNode) =>
                    isIntermediate ? true : (node.nodeType === 'station' || node.nodeType === 'stop')
                )
                .map((node: TaxiNode) => ({
                    ...node,
                    distance: calculateDistance(selectedLocation, { lat: node.lat, lng: node.lng }),
                }))
                .filter((node: any) => node.distance < 1000) // 1km radius
                .sort((a: any, b: any) => a.distance - b.distance);

            setNearbyStations(nearby as TaxiNode[]);
            setFilteredStations(nearby as TaxiNode[]);
        } catch (error) {
            console.error('Error fetching nearby stations:', error);
            setNearbyStations([]);
        } finally {
            setLoadingStations(false);
        }
    };

    useEffect(() => {
        if (stopName.trim()) {
            const filtered = nearbyStations.filter((station) =>
                station.name.toLowerCase().includes(stopName.toLowerCase())
            );
            setFilteredStations(filtered);
        } else {
            setFilteredStations(nearbyStations);
        }
    }, [stopName, nearbyStations]);

    const handleSelectExisting = (station: TaxiNode) => {
        setSelectedExisting(station);
        setStopName(station.name);
        setFilteredStations([]);
    };

    const handleMapClick = (lngLat: [number, number]) => {
        const location = { lng: lngLat[0], lat: lngLat[1] };
        setSelectedLocation(location);
    };

    const handleLocationPress = () => {
        if (!userLocation) {
            showToast(`${t('location-unavailable')}: ${t('please-wait-for-location')}`);
            return;
        }

        if (!mapRef.current) {
            showToast(`${t('map-not-ready')}: ${t('please-try-again')}`);
            return;
        }

        mapRef.current.flyTo({
            center: [userLocation.lng, userLocation.lat],
            zoom: 15,
            duration: 1000,
        });
    };

    const handleConfirm = () => {
        if (!selectedLocation) {
            Alert.alert(t('error'), t('please-select-location-on-map'));
            return;
        }

        if (!stopName.trim()) {
            Alert.alert(t('error'), t('please-enter-stop-name'));
            return;
        }

        setPendingStop({
            id: Date.now().toString(),
            name: stopName.trim(),
            lat: selectedLocation.lat,
            lng: selectedLocation.lng,
            type: stopType,
            existingNodeId: selectedExisting?.id,
            isExisting: !!selectedExisting,
            landmark: !selectedExisting && stopLandmark.trim() ? stopLandmark.trim() : undefined,
        });

        router.back();
    };

    const getTitle = () => {
        switch (params.type) {
            case 'start':
                return t('pick-start-station');
            case 'end':
                return t('pick-end-station');
            case 'intermediate':
                return t('pick-intermediate-stop');
            default:
                return t('pick-location');
        }
    };

    return (
        <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
            <View className="px-4 py-4 bg-white border-b border-gray-200">
                <View className="flex-row items-center justify-between">
                    <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={28} color="#FFA500" />
                    </TouchableOpacity>
                    <Text className="text-lg font-bold text-gray-900">{getTitle()}</Text>
                    <View style={{ width: 28 }} />
                </View>
            </View>

            <View className="flex-1">
                <GebetaMap
                    ref={mapRef}
                    apiKey={apiKey!}
                    mapStyleUrl={`https://tiles.gebeta.app/styles/standard/style.json?apiKey=${apiKey}`}
                    center={[38.7525, 9.0192]}
                    zoom={13}
                    onMapClick={handleMapClick}
                    selectedLocation={selectedLocation}
                    userLocation={userLocation}
                    showUserLocationMarker={true}
                    taxiStations={allStations.map((station) => ({
                        id: station.id,
                        name: station.name,
                        lat: station.lat,
                        lng: station.lng,
                        type: 'intermediate' as const,
                    }))}
                    externalCameraControl={true}
                />

                <View className="absolute top-4 left-4 right-4 bg-white rounded-xl p-4 shadow-lg">
                    <Text className="text-gray-700 text-center">{t('tap-map-to-select-location')}</Text>
                </View>

                <TouchableOpacity
                    className="absolute top-24 right-4 bg-white rounded-full w-12 h-12 items-center justify-center shadow-lg"
                    onPress={handleLocationPress}
                    activeOpacity={0.7}
                >
                    <Ionicons name="locate" size={24} color="#FFA500" />
                </TouchableOpacity>

            </View>

            {selectedLocation && (
                <Animated.View
                    className="bg-white border-t border-gray-200"
                    style={[{ paddingBottom: insets.bottom + 16 }, sheetAnimatedStyle]}
                >
                            <ScrollView
                                style={{ maxHeight: 350 }}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ padding: 16 }}
                            >
                                <View className="mb-3">
                                    <Text className="text-gray-700 font-semibold mb-2">{t('stop-name')} *</Text>
                                    {selectedExisting && (
                                        <View className="bg-green-50 border border-green-200 rounded-xl p-3 mb-2 flex-row items-center justify-between">
                                            <View className="flex-1">
                                                <Text className="text-green-700 font-semibold"> {t('using-existing-station')}</Text>
                                                <Text className="text-green-600 text-sm">{selectedExisting.name}</Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    setSelectedExisting(null);
                                                    setStopName('');
                                                }}
                                            >
                                                <Ionicons name="close-circle" size={24} color="#10B981" />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                    <TextInput
                                        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                                        placeholder={t('enter-stop-name')}
                                        value={stopName}
                                        onChangeText={setStopName}
                                        editable={!selectedExisting}
                                    />

                                    {!selectedExisting && filteredStations.length > 0 && (
                                        <View className="mt-2 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                                            <View className="bg-blue-50 px-4 py-2 border-b border-blue-200">
                                                <Text className="text-orange-500 font-semibold text-sm">{t('nearby-existing-stations')}</Text>
                                            </View>
                                            <View>
                                                {filteredStations.slice(0, 5).map((station) => (
                                                    <TouchableOpacity
                                                        key={station.id}
                                                        className="px-4 py-3 border-b border-gray-100"
                                                        onPress={() => handleSelectExisting(station)}
                                                    >
                                                        <View className="flex-row items-center">
                                                            <Text className="text-gray-900 font-semibold flex-1">{station.name}</Text>
                                                            {station.nodeType && (
                                                                <View className="px-2 py-1 rounded bg-orange-100">
                                                                    <Text className="text-xs font-medium text-orange-700">
                                                                        {station.nodeType}
                                                                    </Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                        <Text className="text-gray-500 text-xs mt-1">
                                                            {(station as any).distance}m away
                                                            {station.routeName && ` • ${station.routeName}`}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    )}

                                    {loadingStations && <Text className="text-gray-500 text-sm mt-2">{t('loading-nearby-stations-and-stops') || 'Loading nearby stations & stops...'}</Text>}
                                </View>

                                {params.type !== 'intermediate' && !selectedExisting && (
                                    <View className="mb-3">
                                        <Text className="text-gray-700 font-semibold mb-2">{t('type')}</Text>
                                        <View className="flex-row gap-3">
                                            <TouchableOpacity
                                                className={`flex-1 py-3 rounded-xl border-2 ${stopType === 'station' ? 'bg-orange-50 border-orange-500' : 'bg-gray-50 border-gray-200'
                                                    }`}
                                                onPress={() => setStopType('station')}
                                            >
                                                <Text
                                                    className={`text-center font-semibold ${stopType === 'station' ? 'text-orange-500' : 'text-gray-600'
                                                        }`}
                                                >
                                                    {t('station')}
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                className={`flex-1 py-3 rounded-xl border-2 ${stopType === 'stop' ? 'bg-orange-50 border-orange-500' : 'bg-gray-50 border-gray-200'
                                                    }`}
                                                onPress={() => setStopType('stop')}
                                            >
                                                <Text
                                                    className={`text-center font-semibold ${stopType === 'stop' ? 'text-orange-500' : 'text-gray-600'}`}
                                                >
                                                    {t('stop')}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}

                                {!selectedExisting && (
                                    <View className="mb-3">
                                        <Text className="text-gray-700 font-semibold mb-2">{t('landmark')}</Text>
                                        <TextInput
                                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                                            placeholder={t('enter-landmark-description')}
                                            value={stopLandmark}
                                            onChangeText={setStopLandmark}
                                            multiline
                                            numberOfLines={2}
                                        />
                                    </View>
                                )}

                                <TouchableOpacity
                                    className="py-4 rounded-xl mt-2"
                                    style={{ backgroundColor: colors.primary.main }}
                                    onPress={handleConfirm}
                                    activeOpacity={0.7}
                                >
                                    <Text className="text-white text-center font-bold text-lg">{t('confirm-location')}</Text>
                                </TouchableOpacity>
                            </ScrollView>
                </Animated.View>
            )}
        </View>
    );
}
