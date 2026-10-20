import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
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
import { MapSearchBar } from '../../../shared/components';
import { useLayout } from '../../../shared/layout/useLayout';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useMapTheme } from '../../map/context/MapThemeContext';
import { MapLayersButton } from '../../map/components/MapLayersButton';
import { MapThemeSelector } from '../../map/components/MapThemeSelector';

export default function DestinationPickerScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { panelPlacement } = useLayout();
    const { userLocation } = useUserLocation();
    const { apiKey } = useRemoteConfig();
    const mapRef = useRef<GebetaMapRef>(null);
    const { currentTheme } = useMapTheme();
    const { colors: theme } = useTheme();
    const { height: windowHeight } = useWindowDimensions();
    const [showThemeSelector, setShowThemeSelector] = useState(false);
    const [layersButtonBottom, setLayersButtonBottom] = useState(0);

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

    const handleSearchSelect = (location: { lat: number; lng: number }) => {
        setSelectedLocation(location);
        mapRef.current?.flyTo({
            center: [location.lng, location.lat],
            zoom: 17,
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
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <View className="flex-1">
                <GebetaMap
                    ref={mapRef}
                    apiKey={apiKey || ''}
                    mapStyleUrl={
                        !currentTheme.styleJson && currentTheme.styleUrl
                            ? `${currentTheme.styleUrl}?apiKey=${apiKey}`
                            : `https://tiles.gebeta.app/styles/standard/style.json?apiKey=${apiKey}`
                    }
                    mapStyleJson={currentTheme.styleJson}
                    center={userLocation ? [userLocation.lng, userLocation.lat] : [getAppConfig().defaultMapCenterLng, getAppConfig().defaultMapCenterLat]}
                    zoom={15}
                    onRegionCenterChange={([lng, lat]) => setSelectedLocation({ lat, lng })}
                    externalCameraControl={true}
                />

                <View
                    className="absolute left-4 rounded-full shadow-lg"
                    style={{ top: insets.top + 16, backgroundColor: theme.background }}
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-12 h-12 items-center justify-center"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    className="absolute right-4 rounded-full w-12 h-12 items-center justify-center shadow-lg"
                    style={{ top: insets.top + 80, backgroundColor: theme.background }}
                    onPress={handleLocationPress}
                    activeOpacity={0.7}
                >
                    <Ionicons name="locate" size={24} color={colors.primary.main} />
                </TouchableOpacity>

                <View className="absolute right-4" style={{ top: insets.top + 144 }}>
                    <MapLayersButton
                        onPress={({ y, height }) => {
                            setLayersButtonBottom(windowHeight - (y + height));
                            setShowThemeSelector(true);
                        }}
                    />
                </View>

                <MapSearchBar
                    onSelect={handleSearchSelect}
                    style={{ position: 'absolute', top: insets.top + 16, left: 76, right: 16 }}
                />

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
                className="absolute left-4 right-4 rounded-2xl shadow-lg p-4"
                style={[{ bottom: insets.bottom + 16, backgroundColor: theme.background }, panelPlacement()]}
            >
                <View className="flex-row items-center mb-3">
                    <Ionicons name="location" size={24} color={colors.primary.main} />
                    <View className="flex-1 ml-3">
                        <Text className="font-semibold" style={{ color: theme.textPrimary }}>
                            {t('selected-location')}
                        </Text>
                        <Text className="text-sm" style={{ color: theme.textSecondary }}>
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

            <MapThemeSelector
                visible={showThemeSelector}
                onClose={() => setShowThemeSelector(false)}
                bottomOffset={layersButtonBottom}
            />
        </View>
    );
}
