import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import GebetaMap from '../../../components/GebetaMap';
import { colors } from '../../../shared/theme/colors';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { useRemoteConfig } from '../../../shared/contexts/RemoteConfigContext';
import { getAppConfig } from '../../../shared/config/remoteConfigValues';

export default function DestinationPickerScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { userLocation } = useUserLocation();
    const { apiKey } = useRemoteConfig();
    const mapRef = useRef<GebetaMapRef>(null);

    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number }>(
        userLocation
            ? { lat: userLocation.lat, lng: userLocation.lng }
            : { lat: 9.0223, lng: 38.7463 }
    );

    const handleLocationPress = () => {
        if (!userLocation || !mapRef.current) return;
        mapRef.current.flyTo({
            center: [userLocation.lng, userLocation.lat],
            zoom: 15,
            duration: 1000,
        });
    };

    const handleConfirm = () => {
        (globalThis as any).__taxiDestinationCoords = {
            lat: selectedLocation.lat,
            lng: selectedLocation.lng,
            timestamp: Date.now(),
        };

        router.back();
    };

    return (
        <View className="flex-1 bg-gray-50">
            <View className="flex-1">
                <GebetaMap
                    ref={mapRef}
                    apiKey={apiKey || ''}
                    mapStyleUrl={`https://tiles.gebeta.app/styles/standard/style.json?apiKey=${apiKey}`}
                    center={userLocation ? [userLocation.lng, userLocation.lat] : [getAppConfig().defaultMapCenterLng, getAppConfig().defaultMapCenterLat]}
                    zoom={15}
                    onRegionCenterChange={([lng, lat]) => setSelectedLocation({ lat, lng })}
                    externalCameraControl={true}
                />

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

                <TouchableOpacity
                    className="absolute right-4 bg-white rounded-full w-12 h-12 items-center justify-center shadow-lg"
                    style={{ top: insets.top + 16 }}
                    onPress={handleLocationPress}
                    activeOpacity={0.7}
                >
                    <Ionicons name="locate" size={24} color={colors.primary.main} />
                </TouchableOpacity>

                <View
                    className="absolute inset-0 items-center justify-center"
                    pointerEvents="none"
                >
                    <View style={{ marginBottom: 48 }}>
                        <Ionicons name="location" size={48} color={colors.primary.main} />
                    </View>
                </View>
            </View>

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
                    className="rounded-xl py-3"
                    style={{ backgroundColor: colors.primary.main }}
                    activeOpacity={0.8}
                >
                    <Text className="text-white text-center font-bold text-base">
                        {t('confirm')}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
