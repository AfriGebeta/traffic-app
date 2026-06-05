import React, { useState, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../shared/components';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BoundingBox } from '../types/neighborhood.types';
import CustomGebetaMap from '../../../components/GebetaMap';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { colors } from '../../../shared/theme/colors';

export default function NeighborhoodBoundingBoxScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const mapRef = useRef<GebetaMapRef>(null);
    const { userLocation } = useUserLocation();

    const existingBox = params.boundingBox ? JSON.parse(params.boundingBox as string) : null;

    const initialCenter = useMemo(() => {
        const centerLat = params.lat ? parseFloat(params.lat as string) : 9.0105;
        const centerLng = params.lng ? parseFloat(params.lng as string) : 38.7636;
        return [centerLng, centerLat] as [number, number];
    }, []);


    const getInitialBox = (): BoundingBox => {
        if (existingBox) {
            return existingBox;
        }

        const offset = 0.02;
        const [centerLng, centerLat] = initialCenter;
        return {
            north: centerLat + offset,
            south: centerLat - offset,
            east: centerLng + offset,
            west: centerLng - offset,
        };
    };

    const [boundingBox, setBoundingBox] = useState<BoundingBox>(getInitialBox());
    const [activeCorner, setActiveCorner] = useState<'nw' | 'ne' | 'se' | 'sw' | null>(null);

    const handleMapClick = (lngLat: [number, number]) => {
        if (!activeCorner) return;

        const lng = lngLat[0];
        const lat = lngLat[1];

        setBoundingBox((prev) => {
            const updated = { ...prev };

            switch (activeCorner) {
                case 'nw': 
                    updated.north = lat;
                    updated.west = lng;
                    break;
                case 'ne': 
                    updated.north = lat;
                    updated.east = lng;
                    break;
                case 'se': 
                    updated.south = lat;
                    updated.east = lng;
                    break;
                case 'sw':
                    updated.south = lat;
                    updated.west = lng;
                    break;
            }

            return updated;
        });
    };

    const handleSave = () => {
        if (boundingBox.north <= boundingBox.south) {
            showToast.error(t('invalid-bounds'), t('north-must-be-greater-than-south'));
            return;
        }

        if (boundingBox.east <= boundingBox.west) {
            showToast.error(t('invalid-bounds'), t('east-must-be-greater-than-west'));
            return;
        }

        router.back();
        setTimeout(() => {
            router.setParams({ savedBoundingBox: JSON.stringify(boundingBox) });
        }, 100);
        showToast.success(t('success'), t('bounding-box-saved'));
    };

    const handleReset = () => {
        const offset = 0.02;
        const [centerLng, centerLat] = initialCenter;
        const resetBox: BoundingBox = {
            north: centerLat + offset,
            south: centerLat - offset,
            east: centerLng + offset,
            west: centerLng - offset,
        };
        setBoundingBox(resetBox);
        showToast.info(t('reset'), t('bounding-box-reset'));
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
            zoom: 13,
            duration: 1000,
        });
    };

    return (
        <View className="flex-1 bg-gray-50">
            <CustomGebetaMap
                ref={mapRef}
                apiKey={process.env.EXPO_PUBLIC_GEBETA_API_KEY!}
                mapStyleUrl={`https://tiles.gebeta.app/styles/standard/dark.json?apiKey=${process.env.EXPO_PUBLIC_GEBETA_API_KEY}`}
                center={initialCenter}
                zoom={13}
                onMapClick={handleMapClick}
                boundingBox={boundingBox}
                externalCameraControl={true}
            />

            <View className="absolute top-0 left-0 right-0 z-10 bg-white px-6 pb-4 border-b border-gray-100" style={{ paddingTop: insets.top + 16 }}>
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="mr-4"
                            activeOpacity={0.7}
                        >
                            <Ionicons name="arrow-back" size={24} color="#000000" />
                        </TouchableOpacity>
                        <View className="flex-1">
                            <Text className="text-lg font-bold text-gray-900">{t('draw-bounding-box')}</Text>
                            <Text className="text-xs text-gray-500">{t('tap-corners-then-map')}</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={handleReset}
                        className="bg-gray-100 rounded-xl px-3 py-2"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="refresh" size={20} color="#6B7280" />
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity
                className="absolute right-4 bg-white rounded-full w-12 h-12 items-center justify-center shadow-lg"
                style={{ top: insets.top + 100 }}
                onPress={handleLocationPress}
                activeOpacity={0.7}
            >
                <Ionicons name="locate" size={24} color={colors.primary.main} />
            </TouchableOpacity>

            <View className="absolute right-4 bg-white rounded-2xl p-3 shadow-lg" style={{ top: insets.top + 160 }}>
                <Text className="text-xs font-semibold text-gray-700 mb-2 text-center">{t('select-corner')}</Text>
                <View className="gap-2">
                    <View className="flex-row gap-2">
                        <TouchableOpacity
                            className={`w-12 h-12 rounded-xl items-center justify-center ${activeCorner === 'nw' ? 'bg-orange-500' : 'bg-gray-100'
                                }`}
                            onPress={() => setActiveCorner(activeCorner === 'nw' ? null : 'nw')}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="arrow-up"
                                size={16}
                                color={activeCorner === 'nw' ? 'white' : '#6B7280'}
                                style={{ transform: [{ rotate: '-45deg' }] }}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            className={`w-12 h-12 rounded-xl items-center justify-center ${activeCorner === 'ne' ? 'bg-orange-500' : 'bg-gray-100'
                                }`}
                            onPress={() => setActiveCorner(activeCorner === 'ne' ? null : 'ne')}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="arrow-up"
                                size={16}
                                color={activeCorner === 'ne' ? 'white' : '#6B7280'}
                                style={{ transform: [{ rotate: '45deg' }] }}
                            />
                        </TouchableOpacity>
                    </View>
                    <View className="flex-row gap-2">
                        <TouchableOpacity
                            className={`w-12 h-12 rounded-xl items-center justify-center ${activeCorner === 'sw' ? 'bg-orange-500' : 'bg-gray-100'
                                }`}
                            onPress={() => setActiveCorner(activeCorner === 'sw' ? null : 'sw')}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="arrow-down"
                                size={16}
                                color={activeCorner === 'sw' ? 'white' : '#6B7280'}
                                style={{ transform: [{ rotate: '45deg' }] }}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            className={`w-12 h-12 rounded-xl items-center justify-center ${activeCorner === 'se' ? 'bg-orange-500' : 'bg-gray-100'
                                }`}
                            onPress={() => setActiveCorner(activeCorner === 'se' ? null : 'se')}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="arrow-down"
                                size={16}
                                color={activeCorner === 'se' ? 'white' : '#6B7280'}
                                style={{ transform: [{ rotate: '-45deg' }] }}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
                {activeCorner && (
                    <Text className="text-xs text-orange-500 mt-2 text-center font-medium">
                        {t('tap-map-to-move')}
                    </Text>
                )}
            </View>

            <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl px-6 pt-4 shadow-2xl" style={{ paddingBottom: insets.bottom + 16 }}>
                <View className="rounded-xl p-3 mb-4" style={{ backgroundColor: 'rgba(255, 165, 0, 0.1)', borderColor: colors.primary.main, borderWidth: 1 }}>
                    <Text className="text-xs" style={{ color: colors.primary.main }}>
                        {t('bounding-box-tap-instruction')}
                    </Text>
                </View>

                <Button
                    title={t('save-bounding-box')}
                    onPress={handleSave}
                />
            </View>
        </View>
    );
}
