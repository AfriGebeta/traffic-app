import React, { useRef, useState, useEffect } from 'react';
import { View, LogBox, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import GebetaMap, { GebetaMapRef } from '../../../lib/gebeta-map/GebetaMap';
import { Input } from '../../../shared/components';
import { ReportBottomSheet } from './ReportBottomSheet';
import { useIncidents } from '../../incidents/hooks/useIncidents';
import { getIncidentIconUrl, getIncidentColor, getIncidentIconName } from '../../incidents/utils/incidentIcons';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

export default function TrafficMap() {
    const mapRef = useRef<GebetaMapRef>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [initialCenter] = useState<[number, number]>([38.7463, 9.0223]);
    const [initialZoom] = useState(12);
    const { incidents, refetch } = useIncidents();
    const params = useLocalSearchParams();
    const { t } = useTranslation();

    useEffect(() => {
        // suppress MapLibre sprite loading warnings
        LogBox.ignoreLogs([
            'MapLibre error',
            'Failed to load sprite',
        ]);

        getUserLocation();
    }, []);

    // refresh when returning from incident report
    useEffect(() => {
        if (params.refresh === 'true') {
            refetch();
        }
    }, [params.refresh, refetch]);

    const getUserLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                });
                setUserLocation({
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                });
            }
        } catch (error) {
            console.log('Error getting location:', error);
        }
    };

    const handleMapClick = (lngLat: [number, number]) => {
        // Add a default marker
        // const marker = mapRef.current?.addMarker();
        // const mapInstance = mapRef.current?.getMapInstance();
        // if (marker && mapInstance) {
        // marker.setLngLat(lngLat).addTo(mapInstance);

        // mapRef.current?.addImageMarker(
        //     lngLat,
        //     "https://cdn-icons-png.flaticon.com/512/3081/3081559.png",
        //     [40, 40],
        //     () => alert("Marker clicked!"),
        //     10,
        //     "<b>Custom Marker Popup</b>"
        // );

    }
    // };


    const handleMapLoaded = () => {
        // small delay
        setTimeout(() => {
            addIncidentMarkers();
        }, 1000);
    };

    const addIncidentMarkers = () => {
        if (!mapRef.current || incidents.length === 0) {
            return;
        }

        try {
            incidents.forEach((incident) => {
                const iconUrl = getIncidentIconUrl(incident.type);
                const color = getIncidentColor(incident.type);
                const iconName = getIncidentIconName(incident.type);

                mapRef.current?.addImageMarker(
                    [incident.lng, incident.lat],
                    iconUrl,
                    [40, 40],
                    () => {
                        showToast.info(
                            incident.description,
                            `${incident.type.charAt(0).toUpperCase() + incident.type.slice(1)} Incident`
                        );
                    },
                    10,
                    undefined,
                    color,
                    iconName
                );
            });
        } catch (error) {
            console.log('error adding markers:', error);
        }
    };

    //adding markers when loaded
    useEffect(() => {
        if (incidents.length > 0 && mapRef.current) {
            addIncidentMarkers();
        }

    }, [incidents]);

    return (
        <View className="flex-1">
            <GebetaMap
                ref={mapRef}
                apiKey={process.env.EXPO_PUBLIC_GEBETA_API_KEY!}
                mapStyleUrl={`https://tiles.gebeta.app/styles/standard/style.json?apiKey=${process.env.EXPO_PUBLIC_GEBETA_API_KEY}`}
                center={initialCenter}
                zoom={initialZoom}
                onMapClick={handleMapClick}
                onMapLoaded={handleMapLoaded}
            />

            <View className="absolute top-12 left-4 right-4">
                <View className="bg-white rounded-2xl shadow-lg">
                    <Input
                        placeholder={t('where-to-go')}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        icon="search"
                    />
                </View>
                <View className="flex-row gap-2 mt-2 justify-around">
                    <TouchableOpacity
                        className="bg-white rounded-full px-3 py-2 shadow-md flex-row items-center gap-1.5"
                        onPress={() => showToast.info(t('coming-soon'), t('gas-station'))}
                    >
                        <Ionicons name="water" size={16} color="#EF4444" />
                        <Text className="text-xs font-medium text-gray-700">{t('gas-station')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="bg-white rounded-full px-3 py-2 shadow-md flex-row items-center gap-1.5"
                        onPress={() => showToast.info(t('coming-soon'), t('taxi-station'))}
                    >
                        <Ionicons name="car" size={16} color="#3B82F6" />
                        <Text className="text-xs font-medium text-gray-700">{t('taxi-station')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="bg-white rounded-full px-3 py-2 shadow-md flex-row items-center gap-1.5"
                        onPress={() => showToast.info(t('coming-soon'), t('repair-shop'))}
                    >
                        <Ionicons name="construct" size={16} color="#F59E0B" />
                        <Text className="text-xs font-medium text-gray-700">{t('repair-shop')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="bg-white rounded-full px-3 py-2 shadow-md flex-row items-center gap-1.5"
                        onPress={() => showToast.info(t('coming-soon'), t('restaurants'))}
                    >
                        <Ionicons name="fast-food-outline" size={16} color="#EC4899" />
                        <Text className="text-xs font-medium text-gray-700">{t('restaurants')}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ReportBottomSheet userLocation={userLocation} onIncidentReported={refetch} />

            {/* for debug - if backend not responding*/}
            {/* <View className="absolute bottom-32 left-4 right-4 bg-white rounded-xl shadow-lg p-4 max-h-48">
                <Text className="font-bold text-lg mb-2">
                    Incidents ({incidents.length})
                </Text>
                <ScrollView>
                    {incidents.length === 0 ? (
                        <Text className="text-gray-500">No incidents found</Text>
                    ) : (
                        incidents.map((incident) => (
                            <View key={incident.id} className="mb-2 pb-2 border-b border-gray-200">
                                <Text className="font-semibold capitalize">{incident.type}</Text>
                                <Text className="text-sm text-gray-600">{incident.description}</Text>
                                <Text className="text-xs text-gray-400">
                                    {incident.lat.toFixed(4)}, {incident.lng.toFixed(4)}
                                </Text>
                            </View>
                        ))
                    )}
                </ScrollView>
            </View> */}
        </View>
    );
}