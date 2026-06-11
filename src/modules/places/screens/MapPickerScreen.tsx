import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CustomGebetaMap from '../../../components/GebetaMap';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { useLocation } from '../../../shared/contexts/LocationContext';
import { Button } from '../../../shared/components';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigationService } from '../../navigation/services/navigation.service';
import { colors } from '../../../shared/theme/colors';

export default function MapPickerScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const mode = (params.mode as 'stop' | 'origin') || 'stop';
    const insets = useSafeAreaInsets();
    const mapRef = useRef<GebetaMapRef>(null);
    const { userLocation } = useUserLocation();
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

    const handleMapClick = (lngLat: [number, number]) => {
        const location = { lng: lngLat[0], lat: lngLat[1] };
        setSelectedLocation(location);
    };

    const handleConfirm = async () => {
        if (!selectedLocation) return;

        setIsReverseGeocoding(true);
        try {
            
            const place = await navigationService.reverseGeocode(
                selectedLocation.lat,
                selectedLocation.lng
            );

            if (place && place.name) {
                const fullPlace: any = {
                    ...place,

                    latitude: selectedLocation.lat,
                    longitude: selectedLocation.lng,
                    location: {
                        lat: selectedLocation.lat,
                        lng: selectedLocation.lng,
                    },
                };

                (globalThis as any).__mapPickerData = {
                    place: fullPlace,
                    mode: mode,
                    timestamp: Date.now()
                };

                router.back();
            } else {
                const fallbackPlace: any = {
                    id: `${selectedLocation.lat},${selectedLocation.lng}`,
                    name: `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`,
                    display_name: `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`,
                    category: 'location',
                    location: {
                        lat: selectedLocation.lat,
                        lng: selectedLocation.lng,
                    },
                    address: {
                        country: '',
                        country_code: '',
                    },
                    latitude: selectedLocation.lat,
                    longitude: selectedLocation.lng,
                    Country: '',
                    City: '',
                    type: 'point',
                };


                (globalThis as any).__mapPickerData = {
                    place: fallbackPlace,
                    mode: mode,
                    timestamp: Date.now()
                };

                router.back();
            }
        } catch (error) {
            console.error('error reverse geocoding:', error);

            const fallbackPlace: any = {
                id: `${selectedLocation.lat},${selectedLocation.lng}`,
                name: `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`,
                display_name: `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`,
                category: 'location',
                location: {
                    lat: selectedLocation.lat,
                    lng: selectedLocation.lng,
                },
                address: {
                    country: '',
                    country_code: '',
                },
                latitude: selectedLocation.lat,
                longitude: selectedLocation.lng,
                Country: '',
                City: '',
                type: 'point',
            };

            (globalThis as any).__mapPickerData = {
                place: fallbackPlace,
                mode: mode,
                timestamp: Date.now()
            };

            router.back();
        } finally {
            setIsReverseGeocoding(false);
        }
    };

    const handleLocationPress = () => {
        if (!userLocation) {
            showToast.error(t('location-unavailable'), t('please-wait-for-location'));
            return;
        }

        if (!mapRef.current) {
            showToast.error(t('map-not-ready'), t('please-try-again'));
            return;
        }

        mapRef.current.flyTo({
            center: [userLocation.lng, userLocation.lat],
            zoom: 15,
            duration: 1000,
        });
    };

    return (
        <View className="flex-1">
            <CustomGebetaMap
                ref={mapRef}
                apiKey={process.env.EXPO_PUBLIC_GEBETA_API_KEY!}
                mapStyleUrl={`https://tiles.gebeta.app/styles/standard/style.json?apiKey=${process.env.EXPO_PUBLIC_GEBETA_API_KEY}`}
                center={[38.7463, 9.0223]}
                zoom={12}
                onMapClick={handleMapClick}
                selectedLocation={selectedLocation}
            />

            <View className="absolute top-12 left-4 right-4 bg-white rounded-2xl p-4 shadow-lg">
                <View className="flex-row items-center">
                    <Ionicons name="information-circle" size={24} color="#3B82F6" />
                    <Text className="text-sm text-gray-700 ml-2 flex-1">
                        {mode === 'origin' ? t('tap-to-select-start') : t('tap-on-map-to-select-location')}
                    </Text>
                </View>
            </View>

            <TouchableOpacity
                className="absolute top-32 right-4 bg-white rounded-full w-12 h-12 items-center justify-center shadow-lg"
                onPress={handleLocationPress}
                activeOpacity={0.7}
            >
                <Ionicons name="locate" size={24} color="#FFA500" />
            </TouchableOpacity>

            {selectedLocation && (
                <View className="absolute left-4 right-4" style={{ bottom: insets.bottom + 32 }}>
                    <View className="bg-white rounded-2xl p-4 shadow-lg mb-3">
                        <Text className="text-sm font-medium text-gray-700">{t('selected-location')}</Text>
                        <Text className="text-gray-600 mt-1">
                            {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                        </Text>
                    </View>

                    {isReverseGeocoding ? (
                        <TouchableOpacity
                            disabled
                            style={{
                                backgroundColor: colors.primary.main,
                                borderRadius: 12,
                                padding: 16,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: 0.7,
                            }}
                        >
                            <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
                                {t('loading')}...
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <Button title={t('confirm-location')} onPress={handleConfirm} />
                    )}
                </View>
            )}
        </View>
    );
}
