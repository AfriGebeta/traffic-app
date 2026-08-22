import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useRouteBuilder } from '../contexts/RouteBuilderContext';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { showToast } from '../../../shared/utils/toast';
import { taxiService } from '../services/taxi.service';
import { TaxiNode } from '../types/taxi.types';

const NEARBY_RADIUS_METERS = 300;

export default function AddStationScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();
    const { pendingStop, setPendingStop, pickType, setPickType } = useRouteBuilder();
    const { userLocation } = useUserLocation();
    const keyboard = useAnimatedKeyboard();
    const keyboardAnimatedStyle = useAnimatedStyle(() => ({
        marginBottom: keyboard.height.value,
    }));

    const [name, setName] = useState('');
    const [landmark, setLandmark] = useState('');
    const [nodeType, setNodeType] = useState<'station' | 'stop'>('station');
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationSource, setLocationSource] = useState<'current' | 'map' | null>(null);
    const [nearby, setNearby] = useState<(TaxiNode & { distance: number })[]>([]);
    const [loadingNearby, setLoadingNearby] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const calculateDistance = (point1: { lat: number; lng: number }, point2: { lat: number; lng: number }) => {
        const R = 6371e3;
        const lat1Rad = (point1.lat * Math.PI) / 180;
        const lat2Rad = (point2.lat * Math.PI) / 180;
        const deltaLat = ((point2.lat - point1.lat) * Math.PI) / 180;
        const deltaLng = ((point2.lng - point1.lng) * Math.PI) / 180;

        const a =
            Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return Math.round(R * c);
    };

    useEffect(() => {
        if (pendingStop && pickType === 'station') {
            setLocation({ lat: pendingStop.lat, lng: pendingStop.lng });
            setLocationSource('map');
            setPendingStop(null);
            setPickType(null);
        }
    }, [pendingStop, pickType, setPendingStop, setPickType]);

    useEffect(() => {
        const fetchNearby = async () => {
            if (!location) {
                setNearby([]);
                return;
            }

            setLoadingNearby(true);
            try {
                const response: any = await taxiService.getNodes();
                const allNodes = Array.isArray(response) ? response : response.data || [];

                if (!Array.isArray(allNodes)) {
                    setNearby([]);
                    return;
                }

                const found = allNodes
                    .map((node: TaxiNode) => ({
                        ...node,
                        distance: calculateDistance(location, { lat: node.lat, lng: node.lng }),
                    }))
                    .filter((node: any) => node.distance < NEARBY_RADIUS_METERS)
                    .sort((a: any, b: any) => a.distance - b.distance)
                    .slice(0, 5);

                setNearby(found as (TaxiNode & { distance: number })[]);
            } catch (error) {
                console.error('[AddStation] Error fetching nearby nodes:', error);
                setNearby([]);
            } finally {
                setLoadingNearby(false);
            }
        };

        fetchNearby();
    }, [location]);

    const handleUseCurrentLocation = () => {
        if (!userLocation) {
            showToast(`${t('location-unavailable')}: ${t('please-wait-for-location')}`);
            return;
        }

        setLocation({ lat: userLocation.lat, lng: userLocation.lng });
        setLocationSource('current');
    };

    const handlePickOnMap = () => {
        setPickType('station');
        router.push({
            pathname: '/taxi/map-picker',
            params: { type: 'station', mode: 'coords' },
        });
    };

    const handleSubmit = async () => {
        if (!location) {
            Alert.alert(t('error'), t('please-select-station-location'));
            return;
        }

        if (!name.trim()) {
            Alert.alert(t('error'), t('please-enter-stop-name'));
            return;
        }

        setSubmitting(true);
        try {
            await taxiService.createNodeForRoute({
                name: name.trim(),
                lat: location.lat,
                lng: location.lng,
                nodeType,
                landmark: landmark.trim() || undefined,
            });

            showToast(t('station-created-successfully'));
            router.back();
        } catch (error: any) {
            console.error('[AddStation] Error creating node:', error);
            Alert.alert(t('error'), error?.message || t('failed-to-create-station'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
            <View className="px-4 py-6" style={{ borderBottomWidth: 1, borderBottomColor: theme.background }}>
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4" activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={28} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold" style={{ color: theme.textPrimary }}>{t('contribute-taxi-station')}</Text>
                </View>
                <Text className="mt-2" style={{ color: theme.textSecondary }}>{t('contribute-taxi-station-description')}</Text>
            </View>

            <Animated.View style={[{ flex: 1 }, keyboardAnimatedStyle]}>
                <ScrollView
                    className="flex-1 p-4"
                    contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View className="rounded-2xl p-6 shadow-sm" style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                        <View className="mb-6">
                            <Text className="font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('location')} *</Text>

                            {location ? (
                                <View className="rounded-xl p-4" style={{ backgroundColor: theme.primaryMuted, borderWidth: 1, borderColor: theme.primary }}>
                                    <View className="flex-row items-center justify-between">
                                        <View className="flex-1">
                                            <Text className="font-semibold" style={{ color: theme.textPrimary }}>
                                                {locationSource === 'current' ? t('using-current-location') : t('picked-on-map')}
                                            </Text>
                                            <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                                {location.lat.toFixed(7)}, {location.lng.toFixed(7)}
                                            </Text>
                                        </View>
                                        <TouchableOpacity onPress={() => { setLocation(null); setLocationSource(null); }}>
                                            <Ionicons name="close-circle" size={24} color={theme.error} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View>
                                    <TouchableOpacity
                                        className="py-3 rounded-xl mb-2 flex-row items-center justify-center"
                                        style={{ backgroundColor: colors.primary.main }}
                                        onPress={handleUseCurrentLocation}
                                        activeOpacity={0.7}
                                        disabled={!userLocation}
                                    >
                                        <Ionicons name="locate" size={20} color="white" />
                                        <Text className="text-white font-semibold ml-2">{t('use-current-location')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        className="rounded-xl p-4 flex-row items-center justify-center"
                                        style={{ backgroundColor: theme.surface, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.border }}
                                        onPress={handlePickOnMap}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="map" size={24} color={colors.primary.main} />
                                        <Text className="ml-2" style={{ color: theme.textSecondary }}>{t('or-pick-on-map')}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {location && nearby.length > 0 && (
                            <View className="mb-6 rounded-xl overflow-hidden" style={{ borderWidth: 1, borderColor: theme.border }}>
                                <View className="px-4 py-2" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
                                    <Text className="font-semibold text-xs" style={{ color: theme.textPrimary }}>{t('nearby-existing-stations')}</Text>
                                    <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>{t('avoid-duplicate-station')}</Text>
                                </View>
                                {nearby.map((station) => (
                                    <View key={station.id} className="px-4 py-2" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
                                        <View className="flex-row items-center">
                                            <Text className="font-semibold flex-1 text-sm" style={{ color: theme.textPrimary }}>{station.name}</Text>
                                            {station.nodeType && (
                                                <View className="px-2 py-1 rounded" style={{ backgroundColor: theme.primaryMuted }}>
                                                    <Text className="text-xs font-medium" style={{ color: theme.primary }}>{station.nodeType}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                                            {station.distance}m away
                                            {station.routeName ? ` • ${station.routeName}` : ''}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {location && loadingNearby && (
                            <Text className="text-xs mb-6" style={{ color: theme.textSecondary }}>{t('loading-nearby-stations')}</Text>
                        )}

                        <View className="mb-6">
                            <Text className="font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('station-name')} *</Text>
                            <TextInput
                                className="rounded-xl px-4 py-3"
                                style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary }}
                                placeholderTextColor={theme.textSecondary}
                                placeholder={t('enter-station-name')}
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View className="mb-6">
                            <Text className="font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('type')}</Text>
                            <View className="flex-row gap-3">
                                <TouchableOpacity
                                    className="flex-1 py-3 rounded-xl border-2"
                                    style={{ backgroundColor: nodeType === 'station' ? theme.primaryMuted : theme.background, borderColor: nodeType === 'station' ? theme.primary : theme.border }}
                                    onPress={() => setNodeType('station')}
                                >
                                    <Text className="text-center font-semibold" style={{ color: nodeType === 'station' ? theme.primary : theme.textSecondary }}>
                                        {t('station')}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className="flex-1 py-3 rounded-xl border-2"
                                    style={{ backgroundColor: nodeType === 'stop' ? theme.primaryMuted : theme.background, borderColor: nodeType === 'stop' ? theme.primary : theme.border }}
                                    onPress={() => setNodeType('stop')}
                                >
                                    <Text className="text-center font-semibold" style={{ color: nodeType === 'stop' ? theme.primary : theme.textSecondary }}>
                                        {t('stop')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View className="mb-6">
                            <Text className="font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('landmark')}</Text>
                            <TextInput
                                className="rounded-xl px-4 py-3"
                                style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary }}
                                placeholderTextColor={theme.textSecondary}
                                placeholder={t('enter-landmark-description')}
                                value={landmark}
                                onChangeText={setLandmark}
                                multiline
                                numberOfLines={2}
                            />
                        </View>

                        <TouchableOpacity
                            className="py-4 rounded-xl flex-row items-center justify-center"
                            style={{ backgroundColor: colors.primary.main, opacity: submitting ? 0.7 : 1 }}
                            onPress={handleSubmit}
                            disabled={submitting}
                            activeOpacity={0.7}
                        >
                            {submitting && <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />}
                            <Text className="text-white text-center font-bold text-lg">
                                {submitting ? t('submitting') : t('submit')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </Animated.View>
        </View>
    );
}
