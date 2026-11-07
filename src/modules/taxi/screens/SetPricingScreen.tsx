import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { taxiService } from '../services/taxi.service';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { FONT_MEDIUM, RADIUS, RADIUS_SM, SectionLabel, tint } from '../../campaigns/components/CampaignUi';
import { routeCacheService } from '../services/route-cache.service';
import { showToast } from '../../../shared/utils/toast';
import { ApiError, isRestrictedError } from '../../../shared/utils/apiErrors';
import { estimateCampaignPoints, showPointsPopup } from '../../campaigns/utils/pointsPopup';
import { askForNotifications } from '../../../shared/services/notificationPermission';

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
    const { colors: theme } = useTheme();

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

                const lastIndex = parsedStops.length - 1;
                const edges: EdgePrice[] = [
                    {
                        from: 0,
                        to: lastIndex,
                        fromName: parsedStops[0].name,
                        toName: parsedStops[lastIndex].name,
                        cost: '',
                    },
                ];

                setEdgePrices(edges);
            } else {
                const cached = await routeCacheService.getRouteCache();
                if (cached && cached.currentStep === 'pricing' && cached.edgePrices) {
                    setRouteName(cached.routeName);
                    const restoredStops = [cached.startStation!, ...cached.intermediateStops, cached.endStation!].filter(Boolean);
                    setStops(restoredStops);
                    // drafts from before keep only the start → end fare
                    setEdgePrices(cached.edgePrices.filter((edge) => edge.from === 0 && edge.to === restoredStops.length - 1));
                    showToast(t('pricing-progress-restored'));
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
            let pendingPoints = 0;
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
                    // a whole route shows one taxi-station's worth, whatever its stop count (product call);
                    // merged stops confirm an existing one and don't qualify
                    if (!node.merged) pendingPoints = Math.max(pendingPoints, estimateCampaignPoints('taxi_station', stop));
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
            showToast(t('route-created-successfully'));
            showPointsPopup(pendingPoints);
            void askForNotifications('contribution');

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
            // E0017 already shows a global toast
            if (error instanceof ApiError && isRestrictedError(error.code)) return;
            Alert.alert(
                t('error'),
                error.message || t('failed-to-create-route')
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
            <View className="px-6 pt-3 pb-2">
                <TouchableOpacity onPress={() => router.back()} className="self-start p-1 -ml-1" activeOpacity={0.7} hitSlop={8}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="mt-3" style={{ color: theme.textPrimary, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 }}>
                    {t('set-prices')}
                </Text>
                <Text className="text-sm mt-1" style={{ color: theme.textSecondary }}>{t('set-prices-description')}</Text>
            </View>

            <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 20 }}>
                <View>
                    <SectionLabel style={{ marginBottom: 4 }}>{`${stops.length} ${t('stops')}`}</SectionLabel>
                    <Text className="mb-4" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM, fontSize: 17 }}>
                        {routeName}
                    </Text>

                    {edgePrices.map((edge, index) => {
                        const isMainRoute = edge.from === 0 && edge.to === stops.length - 1;
                        return (
                            <View
                                key={index}
                                className="mb-3 p-4"
                                // main route is the one required price: brand border; the rest are plain
                                style={{
                                    borderRadius: RADIUS,
                                    borderWidth: 1,
                                    backgroundColor: isMainRoute ? tint(theme.primary, '12') : theme.surface,
                                    borderColor: isMainRoute ? tint(theme.primary, '80') : theme.border,
                                }}
                            >
                                <View className="flex-row items-center justify-between mb-2">
                                    <View className="flex-1">
                                        <Text className="text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>
                                            {edge.fromName} → {edge.toName}
                                        </Text>
                                        {isMainRoute && (
                                            <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                                                {t('main-route-required')} <Text style={{ color: theme.primary }}>*</Text>
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                <TextInput
                                    style={{
                                        borderRadius: RADIUS_SM,
                                        minHeight: 46,
                                        paddingHorizontal: 14,
                                        fontSize: 15,
                                        fontVariant: ['tabular-nums'],
                                        backgroundColor: theme.background,
                                        borderWidth: 1,
                                        borderColor: theme.border,
                                        color: theme.textPrimary,
                                    }}
                                    placeholderTextColor={theme.textSecondary}
                                    placeholder={isMainRoute ? t('required') : t('optional')}
                                    value={edge.cost}
                                    onChangeText={(text) => updateEdgePrice(index, text)}
                                    keyboardType="decimal-pad"
                                />
                            </View>
                        );
                    })}

                    <TouchableOpacity
                        className="mt-3 items-center justify-center"
                        style={{ height: 48, borderRadius: RADIUS_SM, backgroundColor: loading ? theme.border : theme.primary }}
                        onPress={handleSubmit}
                        disabled={loading}
                        activeOpacity={0.7}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-center" style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 16 }}>
                                {t('create-route')}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}
