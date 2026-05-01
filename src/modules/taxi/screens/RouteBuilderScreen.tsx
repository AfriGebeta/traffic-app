import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { taxiService } from '../services/taxi.service';
import { useRouteBuilder } from '../contexts/RouteBuilderContext';

interface RouteStop {
    id: string;
    name: string;
    lat: number;
    lng: number;
    type: 'station' | 'stop';
    existingNodeId?: number;
    isExisting?: boolean;
}

export default function RouteBuilderScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { pendingStop, setPendingStop, pickType, setPickType } = useRouteBuilder();

    const [routeName, setRouteName] = useState('');
    const [startStation, setStartStation] = useState<RouteStop | null>(null);
    const [endStation, setEndStation] = useState<RouteStop | null>(null);
    const [intermediateStops, setIntermediateStops] = useState<RouteStop[]>([]);

    useEffect(() => {
        if (pendingStop && pickType) {
            if (pickType === 'start') {
                setStartStation(pendingStop);
            } else if (pickType === 'end') {
                setEndStation(pendingStop);
            } else if (pickType === 'intermediate') {
                setIntermediateStops((prev) => [...prev, pendingStop]);
            }

            setPendingStop(null);
            setPickType(null);
        }
    }, [pendingStop, pickType, setPendingStop, setPickType]);

    const handlePickLocation = (type: 'start' | 'end' | 'intermediate') => {
        setPickType(type);
        router.push({
            pathname: '/taxi/map-picker',
            params: { type, routeName },
        });
    };

    const handleSubmit = () => {
        if (!routeName.trim()) {
            Alert.alert(t('error'), t('please-enter-route-name'));
            return;
        }

        if (!startStation || !endStation) {
            Alert.alert(t('error'), t('please-select-start-end-stations'));
            return;
        }

        router.push({
            pathname: '/taxi/set-pricing',
            params: {
                routeName: routeName.trim(),
                stops: JSON.stringify([startStation, ...intermediateStops, endStation]),
            },
        });
    };

    const removeIntermediateStop = (index: number) => {
        setIntermediateStops(intermediateStops.filter((_, i) => i !== index));
    };

    return (
        <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
            <View className="px-4 py-6 border-b border-gray-50">
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="mr-4"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={28} color="#FFA500" />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-gray-900">{t('build-route')}</Text>
                </View>
                <Text className="text-gray-600 mt-2">{t('create-route-with-stops')}</Text>
            </View>

            <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
                <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <View className="mb-6">
                        <Text className="text-gray-700 font-semibold mb-2">{t('route-name')} *</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                            placeholder={t('enter-route-name-example')}
                            value={routeName}
                            onChangeText={setRouteName}
                        />
                    </View>

                    <View className="mb-4">
                        <Text className="text-gray-700 font-semibold mb-2">{t('start-station')} *</Text>
                        {startStation ? (
                            <View className="bg-green-50 border border-green-200 rounded-xl p-4">
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-1">
                                        <Text className="text-gray-900 font-semibold">{startStation.name}</Text>
                                        <Text className="text-gray-500 text-sm">
                                            {startStation.lat.toFixed(4)}, {startStation.lng.toFixed(4)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setStartStation(null)}>
                                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity
                                className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-4 flex-row items-center justify-center"
                                onPress={() => handlePickLocation('start')}
                            >
                                <Ionicons name="location" size={24} color="#FFA500" />
                                <Text className="text-gray-600 ml-2">{t('pick-on-map')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View className="mb-4">
                        <Text className="text-gray-700 font-semibold mb-2">
                            {t('intermediate-stops')} ({intermediateStops.length})
                        </Text>
                        {intermediateStops.map((stop, index) => (
                            <View key={stop.id} className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-2">
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-1">
                                        <Text className="text-gray-900 font-semibold">{stop.name}</Text>
                                        <Text className="text-gray-500 text-sm">
                                            {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => removeIntermediateStop(index)}>
                                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                        <TouchableOpacity
                            className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-4 flex-row items-center justify-center mt-2"
                            onPress={() => handlePickLocation('intermediate')}
                        >
                            <Ionicons name="add-circle" size={24} color="#FFA500" />
                            <Text className="text-gray-600 ml-2">{t('add-stop')}</Text>
                        </TouchableOpacity>
                    </View>

                    <View className="mb-6">
                        <Text className="text-gray-700 font-semibold mb-2">{t('end-station')} *</Text>
                        {endStation ? (
                            <View className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-1">
                                        <Text className="text-gray-900 font-semibold">{endStation.name}</Text>
                                        <Text className="text-gray-500 text-sm">
                                            {endStation.lat.toFixed(4)}, {endStation.lng.toFixed(4)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setEndStation(null)}>
                                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity
                                className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-4 flex-row items-center justify-center"
                                onPress={() => handlePickLocation('end')}
                            >
                                <Ionicons name="location" size={24} color="#FFA500" />
                                <Text className="text-gray-600 ml-2">{t('pick-on-map')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <TouchableOpacity
                        className="bg-orange-500 py-4 rounded-xl"
                        onPress={handleSubmit}
                        activeOpacity={0.7}
                    >
                        <Text className="text-white text-center font-bold text-lg">{t('next')}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}
