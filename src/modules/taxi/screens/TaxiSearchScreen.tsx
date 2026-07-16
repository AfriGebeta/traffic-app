import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { taxiService } from '../services/taxi.service';
import { TaxiNode, TaxiNavigationRequest } from '../types/taxi.types';
import { useTheme } from '../../../shared/theme/ThemeContext';

export default function TaxiSearchScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { userLocation } = useUserLocation();
    const { colors: theme, isDark } = useTheme();

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
        <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
            <View className="px-4 py-6" style={{ backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4" activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={28} color="#FFA500" />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold" style={{ color: theme.textPrimary }}>{t('taxi-navigation')}</Text>
                </View>
                <Text className="mt-2" style={{ color: theme.textSecondary }}>{t('find-taxi-route-to-destination')}</Text>
            </View>

            <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
                <View className="rounded-2xl p-6 shadow-sm" style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                    <View className="mb-4">
                        <Text className="font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('from')}</Text>

                        {!selectedOriginCoords && !isSelectingOrigin ? (
                            <TouchableOpacity
                                className="rounded-xl px-4 py-3 flex-row items-center justify-between"
                                style={{ backgroundColor: isDark ? theme.greenMuted : '#F0FDF4', borderWidth: 1, borderColor: theme.green }}
                                onPress={() => {
                                    setIsSelectingOrigin(true);
                                }}
                                activeOpacity={0.7}
                            >
                                <View className="flex-row items-center flex-1">
                                    <Ionicons name="location" size={20} color={theme.green} />
                                    <Text className="ml-2 flex-1" style={{ color: theme.green }}>
                                        {userLocation
                                            ? t('current-location')
                                            : t('waiting-for-location')}
                                    </Text>
                                </View>
                                <Text className="text-xs font-semibold" style={{ color: theme.green }}>
                                    {t('change')}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <View>
                                <TextInput
                                    className="rounded-xl px-4 py-3 mb-2"
                                    style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary }}
                                    placeholderTextColor={theme.textSecondary}
                                    placeholder={t('enter-origin-station')}
                                    value={originName}
                                    onChangeText={(text) => {
                                        setOriginName(text);
                                        setIsSelectingOrigin(true);
                                    }}
                                    onFocus={() => setIsSelectingOrigin(true)}
                                />

                                {filteredOriginStations.length > 0 && isSelectingOrigin && (
                                    <View className="mb-2 rounded-xl overflow-hidden" style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }}>
                                        <View className="px-4 py-2" style={{ backgroundColor: theme.blueMuted, borderBottomWidth: 1, borderBottomColor: theme.blue }}>
                                            <Text className="font-semibold text-sm" style={{ color: theme.blue }}>
                                                {t('available-stations')}
                                            </Text>
                                        </View>
                                        <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                                            {filteredOriginStations.slice(0, 10).map((station) => (
                                                <TouchableOpacity
                                                    key={station.id}
                                                    className="px-4 py-3"
                                                    style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}
                                                    onPress={() => handleStationSelect(station)}
                                                >
                                                    <Text className="font-semibold" style={{ color: theme.textPrimary }}>{station.name}</Text>
                                                    {station.routeName && (
                                                        <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>
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
                                    <Ionicons name="locate" size={16} color={theme.green} />
                                    <Text className="text-sm font-semibold ml-2" style={{ color: theme.green }}>
                                        {t('use-my-location')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <View className="mb-4">
                        <Text className="font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('to')} *</Text>
                        <TextInput
                            className="rounded-xl px-4 py-3"
                            style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary }}
                            placeholderTextColor={theme.textSecondary}
                            placeholder={t('enter-destination-name')}
                            value={destinationName}
                            onChangeText={(text) => {
                                setDestinationName(text);
                                setIsSelectingOrigin(false);
                            }}
                            onFocus={() => setIsSelectingOrigin(false)}
                        />

                        {filteredStations.length > 0 && !isSelectingOrigin && (
                            <View className="mt-2 rounded-xl overflow-hidden" style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }}>
                                <View className="px-4 py-2" style={{ backgroundColor: theme.blueMuted, borderBottomWidth: 1, borderBottomColor: theme.blue }}>
                                    <Text className="font-semibold text-sm" style={{ color: theme.blue }}>
                                        {t('available-stations')}
                                    </Text>
                                </View>
                                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                                    {filteredStations.slice(0, 10).map((station) => (
                                        <TouchableOpacity
                                            key={station.id}
                                            className="px-4 py-3"
                                            style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}
                                            onPress={() => handleStationSelect(station)}
                                        >
                                            <Text className="font-semibold" style={{ color: theme.textPrimary }}>{station.name}</Text>
                                            {station.routeName && (
                                                <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                                                    {station.routeName}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {loadingStations && (
                            <Text className="text-sm mt-2" style={{ color: theme.textSecondary }}>{t('loading-stations')}</Text>
                        )}
                    </View>

                    <TouchableOpacity
                        className="rounded-xl p-4 flex-row items-center justify-center mb-6"
                        style={{ backgroundColor: theme.surface, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.border }}
                        onPress={handleMapPicker}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="map" size={24} color="#FFA500" />
                        <Text className="ml-2" style={{ color: theme.textSecondary }}>{t('or-pick-on-map')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="py-4 rounded-xl"
                        style={{ backgroundColor: loading || (!selectedOriginCoords && !userLocation) ? theme.border : '#F97316' }}
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
