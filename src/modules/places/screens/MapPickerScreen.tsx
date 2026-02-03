import React, { useState, useRef } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CustomGebetaMap from '../../../components/GebetaMap';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { useLocation } from '../../../shared/contexts/LocationContext';
import { Button } from '../../../shared/components';

export default function MapPickerScreen() {
    const router = useRouter();
    const mapRef = useRef<GebetaMapRef>(null);
    const { setSelectedLocation: setGlobalLocation } = useLocation();
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);

    const handleMapClick = (lngLat: [number, number]) => {
        console.log('🗺️ Map clicked at:', lngLat);

        const location = { lng: lngLat[0], lat: lngLat[1] };
        setSelectedLocation(location);
    };

    const handleConfirm = () => {
        if (selectedLocation) {
            setGlobalLocation(selectedLocation);
            router.back();
        }
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
                        Tap on the map to select location
                    </Text>
                </View>
            </View>

            {selectedLocation && (
                <View className="absolute bottom-8 left-4 right-4">
                    <View className="bg-white rounded-2xl p-4 shadow-lg mb-3">
                        <Text className="text-sm font-medium text-gray-700">Selected Location</Text>
                        <Text className="text-gray-600 mt-1">
                            {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                        </Text>
                    </View>

                    <Button title="Confirm Location" onPress={handleConfirm} />
                </View>
            )}
        </View>
    );
}
