import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GeocodingPlace } from '../../navigation/services/navigation.service';

interface NavigationBarProps {
    destination: GeocodingPlace;
    onStop: () => void;
    simulateMovement?: boolean;
    userLocation?: { lat: number; lng: number } | null;
}

const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const formatDistance = (km: number): string => {
    if (km < 1) {
        return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1)} km`;
};

export const NavigationBar: React.FC<NavigationBarProps> = ({
    destination,
    onStop,
    simulateMovement,
    userLocation,
}) => {
    const [distance, setDistance] = useState<number>(0);

    useEffect(() => {
        if (userLocation) {
            const dist = calculateDistance(
                userLocation.lat,
                userLocation.lng,
                destination.latitude,
                destination.longitude
            );
            setDistance(dist);
        }
    }, [userLocation, destination]);

    return (
        <View className="absolute top-12 left-4 right-4">
            <View className="bg-blue-600 rounded-2xl shadow-lg p-4">
                <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                        <Text className="text-white text-3xl font-bold">
                            {formatDistance(distance)}
                        </Text>
                        <Text className="text-blue-100 text-sm mt-1">
                            {destination.name}
                        </Text>
                        {simulateMovement && (
                            <View className="bg-blue-500 rounded-lg px-2 py-1 mt-2 self-start">
                                <Text className="text-white text-xs font-semibold">
                                   Simulation Mode
                                </Text>
                            </View>
                        )}
                    </View>
                    <TouchableOpacity
                        className="bg-white rounded-full p-3"
                        onPress={onStop}
                    >
                        <Ionicons name="close" size={24} color="#2563EB" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};
