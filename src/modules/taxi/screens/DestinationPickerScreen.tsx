import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import GebetaMap from '../../../components/GebetaMap';
import { colors } from '../../../shared/theme/colors';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { useMapTheme } from '../../map/context/MapThemeContext';
import { taxiService } from '../services/taxi.service';

export default function DestinationPickerScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { userLocation } = useUserLocation();
    const { currentTheme } = useMapTheme();

    const [mapReady, setMapReady] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [loading, setLoading] = useState(false);

    const handleMapClick = (lngLat: [number, number]) => {
        const [lng, lat] = lngLat;
        setSelectedLocation({ lat, lng });
    };

    const handleConfirm = async () => {
        if (!selectedLocation) {
            Alert.alert(t('error'), t('please-select-location-on-map'));
            return;
        }

        if (!userLocation) {
            Alert.alert(t('error'), t('location-unavailable'));
            return;
        }

        
        router.back(); 
        router.back(); 

        setTimeout(() => {
            router.setParams({
                taxiDestLat: selectedLocation.lat.toString(),
                taxiDestLng: selectedLocation.lng.toString(),
                taxiDestName: `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`,
                showTaxiMode: 'true',
            });
        }, 100);
    };

    return (
        <View className="flex-1 bg-gray-50">
            <View className="flex-1">
                <GebetaMap
                    apiKey={process.env.EXPO_PUBLIC_GEBETA_API_KEY || ''}
                    mapStyleUrl={currentTheme.styleUrl ? `${currentTheme.styleUrl}?apiKey=${process.env.EXPO_PUBLIC_GEBETA_API_KEY}` : undefined}
                    mapStyleJson={currentTheme.styleJson}
                    center={userLocation ? [userLocation.lng, userLocation.lat] : [38.74, 9.03]}
                    zoom={13}
                    onMapLoaded={() => setMapReady(true)}
                    onMapClick={handleMapClick}
                    clickedLocation={selectedLocation}
                />

                {!mapReady && (
                    <View className="absolute inset-0 items-center justify-center bg-gray-100">
                        <ActivityIndicator size="large" color={colors.primary.main} />
                    </View>
                )}

                <View
                    className="absolute left-4 bg-white rounded-full shadow-lg"
                    style={{ top: insets.top + 16 }}
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-12 h-12 items-center justify-center"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={24} color="#374151" />
                    </TouchableOpacity>
                </View>

                {!selectedLocation && (
                    <View className="absolute inset-0 items-center justify-center pointer-events-none">
                        <View style={{ marginBottom: 40 }}>
                            <Ionicons name="location" size={48} color={colors.primary.main} />
                        </View>
                    </View>
                )}

                {!selectedLocation && (
                    <View
                        className="absolute left-4 right-4 bg-white rounded-2xl shadow-lg p-4"
                        style={{ top: insets.top + 80 }}
                    >
                        <Text className="text-gray-700 text-center">
                            {t('tap-map-to-select-location')}
                        </Text>
                    </View>
                )}
            </View>

            {selectedLocation && (
                <View
                    className="absolute left-4 right-4 bg-white rounded-2xl shadow-lg p-4"
                    style={{ bottom: insets.bottom + 16 }}
                >
                    <View className="flex-row items-center mb-3">
                        <Ionicons name="location" size={24} color={colors.primary.main} />
                        <View className="flex-1 ml-3">
                            <Text className="text-gray-900 font-semibold">
                                {t('selected-location')}
                            </Text>
                            <Text className="text-gray-500 text-sm">
                                {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={handleConfirm}
                        disabled={loading}
                        className="rounded-xl py-3"
                        style={{ backgroundColor: colors.primary.main }}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white text-center font-bold text-base">
                                {t('find-taxi-route')}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}
