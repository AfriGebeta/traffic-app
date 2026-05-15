import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { taxiService } from '../services/taxi.service';
import { colors } from '../../../shared/theme/colors';

interface RouteStop {
    id: string;
    name: string;
    lat: number;
    lng: number;
    type: 'station' | 'stop';
    existingNodeId?: number;
    isExisting?: boolean;
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
        }
    }, [params.stops, params.routeName]);

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

            const createdNodes = [];
            for (const stop of stops) {
                if (stop.isExisting && stop.existingNodeId) {
                    console.log('Using existing node:', stop.existingNodeId);
                    createdNodes.push({ id: stop.existingNodeId });
                } else {
                    console.log('Creating new node:', {
                        name: stop.name,
                        lat: stop.lat,
                        lng: stop.lng,
                        nodeType: stop.type,
                        routeName,
                    });
                    const node = await taxiService.createNode({
                        name: stop.name,
                        lat: stop.lat,
                        lng: stop.lng,
                        nodeType: stop.type,
                        routeName,
                    });
                    console.log('Created node response:', node);
                    const unwrappedNode = (node as any).data || node;
                    console.log('Extracted node:', unwrappedNode);
                    createdNodes.push(unwrappedNode);
                }
            }

            console.log('All nodes created:', createdNodes);
            console.log('Creating edges:', edgePrices);

            const createdEdges = [];

            for (const edge of edgePrices) {
                if (edge.cost && parseFloat(edge.cost) > 0) {
                    const edgeData = {
                        startNodeId: createdNodes[edge.from].id,
                        endNodeId: createdNodes[edge.to].id,
                        cost: parseFloat(edge.cost),
                        connection: 'taxi' as const,
                    };
                    console.log('Creating edge:', edgeData);
                    await taxiService.createEdge(edgeData);
                    createdEdges.push({
                        startNodeId: createdNodes[edge.from].id,
                        endNodeId: createdNodes[edge.to].id,
                        fromName: edge.fromName,
                        toName: edge.toName,
                    });
                }
            }

            if (stops.length > 2) {
                console.log(' Creating intermediate edges for consecutive stops');

                for (let i = 0; i < stops.length - 1; i++) {
                    const fromNode = createdNodes[i];
                    const toNode = createdNodes[i + 1];

                    const alreadyExists = createdEdges.some(
                        e => e.startNodeId === fromNode.id && e.endNodeId === toNode.id
                    );

                    if (!alreadyExists) {
                       
                        const mainRoute = edgePrices.find(e => e.from === 0 && e.to === stops.length - 1);
                        const mainCost = mainRoute && mainRoute.cost ? parseFloat(mainRoute.cost) : 0;

                        const segmentCost = mainCost > 0 ? mainCost / (stops.length - 1) : 10; 

                        const edgeData = {
                            startNodeId: fromNode.id,
                            endNodeId: toNode.id,
                            cost: segmentCost,
                            connection: 'taxi' as const,
                        };

                        console.log('Creating intermediate edge:', {
                            from: stops[i].name,
                            to: stops[i + 1].name,
                            cost: segmentCost
                        });

                        await taxiService.createEdge(edgeData);
                        createdEdges.push({
                            startNodeId: fromNode.id,
                            endNodeId: toNode.id,
                            fromName: stops[i].name,
                            toName: stops[i + 1].name,
                        });
                    }
                }

                console.log(`Total edges created: ${createdEdges.length}`);
            }

            router.push({
                pathname: '/taxi/set-availability',
                params: {
                    routeName,
                    edges: JSON.stringify(createdEdges),
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
                                className={`mb-4 p-4 rounded-xl ${isMainRoute ? 'border-2' : 'bg-gray-50'
                                    }`}
                                style={isMainRoute ? { backgroundColor: colors.primary.light, borderColor: colors.primary.main } : undefined}
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
