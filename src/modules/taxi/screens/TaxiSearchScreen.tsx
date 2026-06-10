import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { taxiService } from '../services/taxi.service';
import { TaxiNode, TaxiNavigationRequest } from '../types/taxi.types';

export default function TaxiSearchScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { userLocation } = useUserLocation();

    const [originName, setOriginName] = useState('');
    const [destinationName, setDestinationName] = useState('');
    const [stations, setStations] = useState<TaxiNode[]>([]);
    const [filteredOriginStations, setFilteredOriginStations] = useState<TaxiNode[]>([]);
    const [filteredStations, setFilteredStations] = useState<TaxiNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingStations, setLoadingStations] = useState(true);
    const [selectedOriginCoords, setSelectedOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [isSelectingOrigin, setIsSelectingOrigin] = useState(false);
    const lastProcessedTimestamp = useRef<number>(0);

    useEffect(() => {
        fetchStations();
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            const coords = (globalThis as any).__taxiDestinationCoords;
            if (coords && coords.timestamp && coords.timestamp !== lastProcessedTimestamp.current) {
                setSelectedCoords({ lat: coords.lat, lng: coords.lng });
                setDestinationName(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
                lastProcessedTimestamp.current = coords.timestamp;
                delete (globalThis as any).__taxiDestinationCoords;
            }
        }, [])
    );

    useEffect(() => {
        if (originName.trim()) {
            const filtered = stations.filter((station) =>
                station.name.toLowerCase().includes(originName.toLowerCase()) ||
                station.routeName?.toLowerCase().includes(originName.toLowerCase())
            );
            setFilteredOriginStations(filtered);
        } else {
            setFilteredOriginStations([]);
        }
    }, [originName, stations]);

    useEffect(() => {
        if (destinationName.trim()) {
            const filtered = stations.filter((station) =>
                station.name.toLowerCase().includes(destinationName.toLowerCase()) ||
                station.routeName?.toLowerCase().includes(destinationName.toLowerCase())
            );
            setFilteredStations(filtered);
        } else {
            setFilteredStations([]);
        }
    }, [destinationName, stations]);

    const fetchStations = async () => {
        try {
            const response: any = await taxiService.getNodes(500);
            const allNodes = Array.isArray(response) ? response : response.data || [];
            setStations(allNodes);
        } catch (error) {
            console.error('Error fetching stations:', error);
        } finally {
            setLoadingStations(false);
        }
    };

    const handleSearch = async () => {
        const hasCustomOrigin = selectedOriginCoords !== null;

        if (!hasCustomOrigin && !userLocation) {
            Alert.alert(t('error'), t('location-unavailable'));
            return;
        }

        if (!destinationName.trim()) {
            Alert.alert(t('error'), t('please-enter-destination'));
            return;
        }

        setLoading(true);
        try {
            let requestData;
            let matchingStation = null;

            const originCoords = selectedOriginCoords || (userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null);

            if (!originCoords) {
                Alert.alert(t('error'), t('location-unavailable'));
                setLoading(false);
                return;
            }

            if (selectedCoords) {
                requestData = {
                    origin: [originCoords.lat, originCoords.lng] as [number, number],
                    destination: [selectedCoords.lat, selectedCoords.lng] as [number, number],
                };
            } else {
                matchingStation = stations.find(
                    s => s.name.toLowerCase() === destinationName.trim().toLowerCase()
                );

                if (matchingStation) {
                    requestData = {
                        origin: [originCoords.lat, originCoords.lng] as [number, number],
                        destination: [matchingStation.lat, matchingStation.lng] as [number, number],
                    };
                } else {
                    Alert.alert(
                        t('error'),
                        'Please select a destination from the available stations list'
                    );
                    setLoading(false);
                    return;
                }
            }


            const result: any = await taxiService.requestTaxiNavigation(requestData);

            if (result.success === false) {
                throw new Error(result.message || 'No route found');
            }

            if (!result || !result.startNode || !result.endNode) {
                throw new Error('Invalid response from server: missing route data');
            }

            const destinationCoords = result.destination || {
                lat: selectedCoords?.lat || matchingStation?.lat,
                lng: selectedCoords?.lng || matchingStation?.lng
            };

            const destination = {
                name: destinationName.trim(),
                latitude: destinationCoords.lat,
                longitude: destinationCoords.lng,
                type: 'destination' as const,
                City: '',
                Country: '',
            };

            // If custom origin is selected, we need to show preview mode
            if (hasCustomOrigin) {
                const origin = {
                    name: originName.trim() || 'Custom Origin',
                    latitude: selectedOriginCoords.lat,
                    longitude: selectedOriginCoords.lng,
                    type: 'origin' as const,
                    City: '',
                    Country: '',
                };

                (globalThis as any).__taxiRouteData = {
                    ...result,
                    timestamp: Date.now(),
                    customOrigin: origin,
                };
            } else {
                (globalThis as any).__taxiRouteData = {
                    ...result,
                    timestamp: Date.now(),
                };
            }

            router.back();

            setTimeout(() => {
                router.setParams({
                    taxiDestLat: destination.latitude.toString(),
                    taxiDestLng: destination.longitude.toString(),
                    taxiDestName: destination.name,
                    showTaxiMode: 'true',
                    ...(hasCustomOrigin && {
                        taxiOriginLat: selectedOriginCoords.lat.toString(),
                        taxiOriginLng: selectedOriginCoords.lng.toString(),
                        taxiOriginName: originName.trim() || 'Custom Origin',
                    }),
                });
            }, 100);
        } catch (error: any) {
            console.error('Error requesting taxi navigation:', error);
            console.error('Error response:', error.response?.data);

            const errorMessage = error.response?.data?.message
                || error.response?.data?.error
                || error.message
                || t('failed-to-find-route');

            Alert.alert(t('error'), errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleStationSelect = (station: TaxiNode) => {
        if (isSelectingOrigin) {
            setOriginName(station.name);
            setSelectedOriginCoords({ lat: station.lat, lng: station.lng });
            setFilteredOriginStations([]);
        } else {
            setDestinationName(station.name);
            setSelectedCoords({ lat: station.lat, lng: station.lng });
            setFilteredStations([]);
        }
    };

    const handleUseMyLocation = () => {
        setOriginName('');
        setSelectedOriginCoords(null);
        setFilteredOriginStations([]);
        setIsSelectingOrigin(false);
    };

    const handleMapPicker = () => {
        router.push('/taxi/destination-picker');
    };

    return (
        <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
            <View className="px-4 py-6 bg-white border-b border-gray-200">
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4" activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={28} color="#FFA500" />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-gray-900">{t('taxi-navigation')}</Text>
                </View>
                <Text className="text-gray-600 mt-2">{t('find-taxi-route-to-destination')}</Text>
            </View>

            <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
                <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <View className="mb-4">
                        <Text className="text-gray-700 font-semibold mb-2">{t('from')}</Text>

                        {!selectedOriginCoords && !isSelectingOrigin ? (
                            <TouchableOpacity
                                className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex-row items-center justify-between"
                                onPress={() => {
                                    setIsSelectingOrigin(true);
                                }}
                                activeOpacity={0.7}
                            >
                                <View className="flex-row items-center flex-1">
                                    <Ionicons name="location" size={20} color="#10B981" />
                                    <Text className="text-green-700 ml-2 flex-1">
                                        {userLocation
                                            ? t('current-location')
                                            : t('waiting-for-location')}
                                    </Text>
                                </View>
                                <Text className="text-green-600 text-xs font-semibold">
                                    {t('change')}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <View>
                                <TextInput
                                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-2"
                                    placeholder={t('enter-origin-station')}
                                    value={originName}
                                    onChangeText={(text) => {
                                        setOriginName(text);
                                        setIsSelectingOrigin(true);
                                    }}
                                    onFocus={() => setIsSelectingOrigin(true)}
                                />

                                {filteredOriginStations.length > 0 && isSelectingOrigin && (
                                    <View className="mb-2 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                                        <View className="bg-blue-50 px-4 py-2 border-b border-blue-200">
                                            <Text className="text-blue-700 font-semibold text-sm">
                                                {t('available-stations')}
                                            </Text>
                                        </View>
                                        <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                                            {filteredOriginStations.slice(0, 10).map((station) => (
                                                <TouchableOpacity
                                                    key={station.id}
                                                    className="px-4 py-3 border-b border-gray-100"
                                                    onPress={() => handleStationSelect(station)}
                                                >
                                                    <Text className="text-gray-900 font-semibold">{station.name}</Text>
                                                    {station.routeName && (
                                                        <Text className="text-gray-500 text-xs mt-1">
                                                            {station.routeName}
                                                        </Text>
                                                    )}
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                <TouchableOpacity
                                    className="flex-row items-center justify-center py-2"
                                    onPress={handleUseMyLocation}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="locate" size={16} color="#10B981" />
                                    <Text className="text-green-600 text-sm font-semibold ml-2">
                                        {t('use-my-location')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <View className="mb-4">
                        <Text className="text-gray-700 font-semibold mb-2">{t('to')} *</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                            placeholder={t('enter-destination-name')}
                            value={destinationName}
                            onChangeText={(text) => {
                                setDestinationName(text);
                                setIsSelectingOrigin(false);
                            }}
                            onFocus={() => setIsSelectingOrigin(false)}
                        />

                        {filteredStations.length > 0 && !isSelectingOrigin && (
                            <View className="mt-2 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                                <View className="bg-blue-50 px-4 py-2 border-b border-blue-200">
                                    <Text className="text-blue-700 font-semibold text-sm">
                                        {t('available-stations')}
                                    </Text>
                                </View>
                                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                                    {filteredStations.slice(0, 10).map((station) => (
                                        <TouchableOpacity
                                            key={station.id}
                                            className="px-4 py-3 border-b border-gray-100"
                                            onPress={() => handleStationSelect(station)}
                                        >
                                            <Text className="text-gray-900 font-semibold">{station.name}</Text>
                                            {station.routeName && (
                                                <Text className="text-gray-500 text-xs mt-1">
                                                    {station.routeName}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {loadingStations && (
                            <Text className="text-gray-500 text-sm mt-2">{t('loading-stations')}</Text>
                        )}
                    </View>

                    <TouchableOpacity
                        className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-4 flex-row items-center justify-center mb-6"
                        onPress={handleMapPicker}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="map" size={24} color="#FFA500" />
                        <Text className="text-gray-600 ml-2">{t('or-pick-on-map')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className={`py-4 rounded-xl ${loading || (!selectedOriginCoords && !userLocation) ? 'bg-gray-400' : 'bg-orange-500'}`}
                        onPress={handleSearch}
                        disabled={loading || (!selectedOriginCoords && !userLocation)}
                        activeOpacity={0.7}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white text-center font-bold text-lg">
                                {selectedOriginCoords ? t('preview-route') : t('find-taxi-route')}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}
