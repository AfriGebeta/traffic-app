import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { taxiService } from '../services/taxi.service';
import { colors } from '../../../shared/theme/colors';
import { routeCacheService } from '../services/route-cache.service';
import { showToast } from '../../../shared/utils/toast';

interface RouteStop {
    id: string;
    name: string;
    lat: number;
    lng: number;
    type: 'station' | 'stop';
    existingNodeId?: number;
    isExisting?: boolean;
    landmark?: string;
}

interface EdgePrice {
    from: number;
    to: number;
    fromName: string;
    toName: string;
    cost: string;
}

export default function SetPricingScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();

    const [stops, setStops] = useState<RouteStop[]>([]);
    const [routeName, setRouteName] = useState('');
    const [edgePrices, setEdgePrices] = useState<EdgePrice[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadRouteData = async () => {
            if (params.stops && params.routeName) {
                const parsedStops = JSON.parse(params.stops as string);
                setStops(parsedStops);
                setRouteName(params.routeName as string);

                const edges: EdgePrice[] = [];
                for (let i = 0; i < parsedStops.length; i++) {
                    for (let j = i + 1; j < parsedStops.length; j++) {
                        edges.push({
                            from: i,
                            to: j,
                            fromName: parsedStops[i].name,
                            toName: parsedStops[j].name,
                            cost: '',
                        });
                    }
                }

                edges.sort((a, b) => {
                    const isMainA = a.from === 0 && a.to === parsedStops.length - 1;
                    const isMainB = b.from === 0 && b.to === parsedStops.length - 1;
                    if (isMainA) return -1;
                    if (isMainB) return 1;
                    return 0;
                });

                setEdgePrices(edges);
            } else {
                const cached = await routeCacheService.getRouteCache();
                if (cached && cached.currentStep === 'pricing' && cached.edgePrices) {
                    setRouteName(cached.routeName);
                    setStops([cached.startStation!, ...cached.intermediateStops, cached.endStation!].filter(Boolean));
                    setEdgePrices(cached.edgePrices);
                    showToast.success(t('restored'), t('pricing-progress-restored'));
                }
            }
        };

        loadRouteData();
    }, [params.stops, params.routeName]);

    useEffect(() => {
        const saveProgress = async () => {
            if (stops.length > 0 && routeName) {
                await routeCacheService.saveRouteCache({
                    routeName,
                    startStation: stops[0],
                    endStation: stops[stops.length - 1],
                    intermediateStops: stops.slice(1, -1),
                    edgePrices,
                    currentStep: 'pricing',
                    timestamp: Date.now(),
                });
            }
        };

        const timeoutId = setTimeout(saveProgress, 500);
        return () => clearTimeout(timeoutId);
    }, [edgePrices, stops, routeName]);

    const updateEdgePrice = (index: number, cost: string) => {
        const updated = [...edgePrices];
        updated[index].cost = cost;
        setEdgePrices(updated);
    };

    const handleSubmit = async () => {
        const mainRoute = edgePrices.find((e) => e.from === 0 && e.to === stops.length - 1);
        if (!mainRoute || !mainRoute.cost || parseFloat(mainRoute.cost) <= 0) {
            Alert.alert(t('error'), t('please-enter-main-route-cost'));
            return;
        }

        setLoading(true);
        try {
            console.log('Creating route:', routeName);
            console.log('Stops:', stops);

            const route = await taxiService.createRoute({
                name: routeName,
                color: '#f97316',
                type: 'minibus',
            });
            console.log('created route:', route);

            const nodeIds: number[] = [];
            for (const stop of stops) {
                if (stop.isExisting && stop.existingNodeId) {
                    console.log('Using existing node:', stop.existingNodeId);
                    nodeIds.push(stop.existingNodeId);
                } else {
                    console.log('Creating new node:', {
                        name: stop.name,
                        lat: stop.lat,
                        lng: stop.lng,
                        nodeType: stop.type,
                        routeName: routeName,
                        landmark: stop.landmark,
                    });
                    const node = await taxiService.createNodeForRoute({
                        name: stop.name,
                        lat: stop.lat,
                        lng: stop.lng,
                        nodeType: stop.type,
                        routeName: routeName,
                        landmark: stop.landmark,
                    });
                    console.log('Created node response:', node);
                    const unwrappedNode = (node as any).data || node;
                    console.log('Extracted node:', unwrappedNode);
                    nodeIds.push(unwrappedNode.id);
                }
            }

            console.log('All node IDs:', nodeIds);

            const stopFares: number[] = [];

            stopFares.push(0);

            for (let i = 1; i < stops.length; i++) {
                const edge = edgePrices.find(e => e.from === 0 && e.to === i);
                if (edge && edge.cost && parseFloat(edge.cost) > 0) {
                    stopFares.push(parseFloat(edge.cost));
                } else {
                    const mainCost = parseFloat(mainRoute.cost);
                    const proportionalFare = (mainCost / (stops.length - 1)) * i;
                    stopFares.push(Math.round(proportionalFare * 100) / 100);
                }
            }

            console.log('calculated fares:', stopFares);

            for (let i = 0; i < nodeIds.length; i++) {
                const stopData = {
                    nodeId: nodeIds[i],
                    fareFromStart: stopFares[i],
                };
                try {
                    const stopResult = await taxiService.addStopToRoute(route.id, stopData);
                    console.log(`stop ${i + 1} added successfully:`, stopResult);
                } catch (stopError: any) {
                    console.error(`failed to add stop ${i + 1}:`, stopError);
                    console.error('stop data:', stopData);
                    console.error('routeid:', route.id);
                    throw stopError;
                }
            }

            console.log('Route creation complete!');
            showToast.success(t('success'), t('route-created-successfully'));

            const segments = [];
            for (let i = 0; i < stops.length - 1; i++) {
                segments.push({
                    from: i,
                    to: i + 1,
                    fromName: stops[i].name,
                    toName: stops[i + 1].name,
                });
            }

            router.push({
                pathname: '/taxi/set-availability',
                params: {
                    routeId: route.id.toString(),
                    routeName: routeName,
                    segments: JSON.stringify(segments),
                },
            });
        } catch (error: any) {
            console.error('Route creation error:', error);
            console.error('Error response:', error.response?.data);
            console.error('Error status:', error.response?.status);
            Alert.alert(
                t('error'),
                error.response?.data?.message || error.message || t('failed-to-create-route')
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
            <View className="px-4 py-6 border-b border-gray-50">
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4" activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={28} color={colors.primary.main} />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-gray-900">{t('set-prices')}</Text>
                </View>
                <Text className="text-gray-600 mt-2">{t('set-prices-description')}</Text>
            </View>

            <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
                <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <Text className="text-lg font-bold text-gray-900 mb-4">
                        {routeName} ({stops.length} {t('stops')})
                    </Text>

                    {edgePrices.map((edge, index) => {
                        const isMainRoute = edge.from === 0 && edge.to === stops.length - 1;
                        return (
                            <View
                                key={index}
                                className={`mb-4 p-4 rounded-xl ${isMainRoute ? 'bg-white border' : 'bg-gray-50'
                                    }`}
                                style={isMainRoute ? { borderColor: colors.primary.main } : undefined}
                            >
                                <View className="flex-row items-center justify-between mb-2">
                                    <View className="flex-1">
                                        <Text className="text-gray-900 font-semibold">
                                            {edge.fromName} → {edge.toName}
                                        </Text>
                                        {isMainRoute && (
                                            <Text className="text-xs mt-1" style={{ color: colors.primary.dark }}>
                                                {t('main-route-required')} *
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                <TextInput
                                    className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                                    placeholder={isMainRoute ? t('required') : t('optional')}
                                    value={edge.cost}
                                    onChangeText={(text) => updateEdgePrice(index, text)}
                                    keyboardType="decimal-pad"
                                />
                            </View>
                        );
                    })}

                    <TouchableOpacity
                        className={`py-4 rounded-xl mt-4 ${loading ? 'bg-gray-400' : ''}`}
                        style={!loading ? { backgroundColor: colors.primary.main } : undefined}
                        onPress={handleSubmit}
                        disabled={loading}
                        activeOpacity={0.7}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white text-center font-bold text-lg">
                                {t('create-route')}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}
