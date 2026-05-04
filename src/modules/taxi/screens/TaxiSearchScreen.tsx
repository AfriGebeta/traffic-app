import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
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

    const [destinationName, setDestinationName] = useState('');
    const [stations, setStations] = useState<TaxiNode[]>([]);
    const [filteredStations, setFilteredStations] = useState<TaxiNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingStations, setLoadingStations] = useState(true);

    useEffect(() => {
        fetchStations();
    }, []);

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
        if (!userLocation) {
            Alert.alert(t('error'), t('location-unavailable'));
            return;
        }

        if (!destinationName.trim()) {
            Alert.alert(t('error'), t('please-enter-destination'));
            return;
        }

        setLoading(true);
        try {
   
            const matchingStation = stations.find(
                s => s.name.toLowerCase() === destinationName.trim().toLowerCase()
            );

            let requestData: TaxiNavigationRequest;

            if (matchingStation) {
                requestData = {
                    origin: [userLocation.lat, userLocation.lng] as [number, number],
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

            console.log('[TaxiSearch] Sending request:', requestData);

            const result: any = await taxiService.requestTaxiNavigation(requestData);

            console.log('[TaxiSearch] API result:', JSON.stringify(result, null, 2));

            if (result.success === false) {
                throw new Error(result.message || 'No route found');
            }

            if (!result || !result.startNode || !result.endNode) {
                throw new Error('Invalid response from server: missing route data');
            }

            const destinationCoords = result.destination || {
                lat: matchingStation.lat,
                lng: matchingStation.lng
            };

            const destination = {
                name: destinationName.trim(),
                latitude: destinationCoords.lat,
                longitude: destinationCoords.lng,
                type: 'destination' as const,
                City: '',
                Country: '',
            };

            router.back();

            setTimeout(() => {
                router.setParams({
                    taxiDestLat: destination.latitude.toString(),
                    taxiDestLng: destination.longitude.toString(),
                    taxiDestName: destination.name,
                    showTaxiMode: 'true',
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
        setDestinationName(station.name);
        setFilteredStations([]);
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
                        <View className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex-row items-center">
                            <Ionicons name="location" size={20} color="#10B981" />
                            <Text className="text-green-700 ml-2 flex-1">
                                {userLocation
                                    ? t('current-location')
                                    : t('waiting-for-location')}
                            </Text>
                        </View>
                    </View>

                    <View className="mb-4">
                        <Text className="text-gray-700 font-semibold mb-2">{t('to')} *</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                            placeholder={t('enter-destination-name')}
                            value={destinationName}
                            onChangeText={setDestinationName}
                        />

                        {filteredStations.length > 0 && (
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
                        className={`py-4 rounded-xl ${loading || !userLocation ? 'bg-gray-400' : 'bg-orange-500'}`}
                        onPress={handleSearch}
                        disabled={loading || !userLocation}
                        activeOpacity={0.7}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white text-center font-bold text-lg">
                                {t('find-taxi-route')}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}
