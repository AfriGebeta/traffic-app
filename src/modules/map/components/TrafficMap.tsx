import React, { useRef, useState } from 'react';
import { View, Alert } from 'react-native';
import GebetaMap, { GebetaMapRef } from '@gebeta/tiles-react-native';
import { Input } from '../../../shared/components';
import { ReportBottomSheet } from './ReportBottomSheet';

export default function TrafficMap() {
    const mapRef = useRef<GebetaMapRef>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const handleMapClick = (lngLat: [number, number]) => {
        Alert.alert(
            'Map Clicked',
            `Longitude: ${lngLat[0].toFixed(6)}\nLatitude: ${lngLat[1].toFixed(6)}`
        );
    };

    const handleMapLoaded = () => {
        console.log('Map loaded successfully!');
        if (mapRef.current) {
            mapRef.current.addImageMarker(
                [38.7463, 9.0223],
                'https://via.placeholder.com/32x32/007cbf/ffffff?text=M',
                [32, 32],
                () => {
                    Alert.alert('Marker Clicked', 'You clicked on Addis Ababa!');
                }
            );
        }
    };

    return (
        <View className="flex-1">
            <GebetaMap
                ref={mapRef}
                apiKey={process.env.EXPO_PUBLIC_GEBETA_API_KEY!}
                center={[38.7463, 9.0223]}
                zoom={12}
                onMapClick={handleMapClick}
                onMapLoaded={handleMapLoaded}
            />

            <View className="absolute top-12 left-4 right-4">
                <View className="bg-white rounded-2xl shadow-lg">
                    <Input
                        placeholder="Where to go?"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        icon="search"
                    />
                </View>
            </View>

            <ReportBottomSheet />
        </View>
    );
}
