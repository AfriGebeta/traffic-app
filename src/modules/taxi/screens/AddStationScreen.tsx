import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { FONT_MEDIUM, RADIUS, RADIUS_SM, tint } from '../../campaigns/components/CampaignUi';
import { FieldLabel } from '../../../shared/components/FieldLabel';
import { useRouteBuilder } from '../contexts/RouteBuilderContext';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { showToast } from '../../../shared/utils/toast';
import { taxiService } from '../services/taxi.service';
import { TaxiNode } from '../types/taxi.types';
import { ApiError, ApiErrorCode, getCampaignFailures, isRestrictedError } from '../../../shared/utils/apiErrors';
import { showCampaignPointsEstimate } from '../../campaigns/utils/pointsPopup';
import { useScoringCampaign } from '../../campaigns/hooks/useScoringCampaign';
import { PhotoPicker, UploadedPhoto } from '../../../shared/components/PhotoPicker';
import { PHOTO_PIN_LIMIT_M, deviceFieldsFromFix, latestPhotoFix, photoPinGap } from '../../../shared/utils/photoFix';
import { isRouteSlot } from '../utils/routeStationHandoff';
import { askForNotifications } from '../../../shared/services/notificationPermission';

const NEARBY_RADIUS_METERS = 300;

interface DestinationEntry {
    key: string;
    name: string;
    toNodeId?: number;
    newStop?: { name: string; lat: number; lng: number };
}

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

    const params = useLocalSearchParams<{
        prefillName?: string;
        prefillLat?: string;
        prefillLng?: string;
        prefillType?: string;
        prefillLandmark?: string;
        prefillSource?: string;
        routeSlot?: string;
    }>();
    // opened from the route builder for a new stop: the created station goes back to that slot
    const routeSlot = isRouteSlot(params.routeSlot) ? params.routeSlot : null;
    const prefillLat = Number(params.prefillLat);
    const prefillLng = Number(params.prefillLng);
    const prefillLocation =
        params.prefillLat !== undefined && Number.isFinite(prefillLat) && Number.isFinite(prefillLng) ? { lat: prefillLat, lng: prefillLng } : null;

    const [name, setName] = useState(typeof params.prefillName === 'string' ? params.prefillName : '');
    const [landmark, setLandmark] = useState(typeof params.prefillLandmark === 'string' ? params.prefillLandmark : '');
    const [nodeType, setNodeType] = useState<'station' | 'stop'>(params.prefillType === 'stop' ? 'stop' : 'station');
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(prefillLocation);
    const [locationSource, setLocationSource] = useState<'current' | 'map' | 'photo' | null>(
        prefillLocation ? (params.prefillSource === 'map' ? 'map' : 'current') : null
    );
    const [images, setImages] = useState<UploadedPhoto[]>([]);
    const inCampaign = !!useScoringCampaign('taxi_station');
    const [allNodes, setAllNodes] = useState<TaxiNode[]>([]);
    const [loadingNodes, setLoadingNodes] = useState(true);
    const [destinations, setDestinations] = useState<DestinationEntry[]>([]);
    const [destinationQuery, setDestinationQuery] = useState('');
    const pendingDestinationName = useRef('');
    const createdNodeId = useRef<number | null>(null);
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
        if (pendingStop && pickType === 'destination') {
            const newName = pendingDestinationName.current;
            if (newName) {
                setDestinations((prev) => [
                    ...prev,
                    { key: `new-${Date.now()}`, name: newName, newStop: { name: newName, lat: pendingStop.lat, lng: pendingStop.lng } },
                ]);
                setDestinationQuery('');
            }
            pendingDestinationName.current = '';
            setPendingStop(null);
            setPickType(null);
        }
    }, [pendingStop, pickType, setPendingStop, setPickType]);

    useEffect(() => {
        const fetchNodes = async () => {
            try {
                const response: any = await taxiService.getNodes();
                const nodes = Array.isArray(response) ? response : response.data || [];
                setAllNodes(Array.isArray(nodes) ? nodes : []);
            } catch (error) {
                console.error('[AddStation] Error fetching nodes:', error);
                setAllNodes([]);
            } finally {
                setLoadingNodes(false);
            }
        };

        fetchNodes();
    }, []);

    // a new photo moves the pin to where it was taken, unless the user placed the pin on the map
    const photoFix = latestPhotoFix(images);
    const photoFixTime = photoFix?.timestamp;
    useEffect(() => {
        if (!photoFix || locationSource === 'map') return;
        setLocation({ lat: photoFix.lat, lng: photoFix.lng });
        setLocationSource('photo');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [photoFixTime]);
    const pinGap = inCampaign ? photoPinGap(location, photoFix, PHOTO_PIN_LIMIT_M.taxi_station) : null;

    const nearby = useMemo(() => {
        if (!location) return [];
        return allNodes
            .map((node) => ({
                ...node,
                distance: calculateDistance(location, { lat: node.lat, lng: node.lng }),
            }))
            .filter((node) => node.distance < NEARBY_RADIUS_METERS)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5);
    }, [allNodes, location]);

    const trimmedDestinationQuery = destinationQuery.trim();

    const destinationMatches = useMemo(() => {
        const q = trimmedDestinationQuery.toLowerCase();
        if (!q) return [];
        const picked = new Set(destinations.map((d) => d.toNodeId).filter((id) => id != null));
        return allNodes
            .filter((node) =>
                !picked.has(node.id) &&
                (node.name.toLowerCase().includes(q) || node.routeName?.toLowerCase().includes(q))
            )
            .slice(0, 10);
    }, [allNodes, destinations, trimmedDestinationQuery]);

    const hasExactDestinationMatch =
        destinationMatches.some((node) => node.name.trim().toLowerCase() === trimmedDestinationQuery.toLowerCase()) ||
        destinations.some((d) => d.name.trim().toLowerCase() === trimmedDestinationQuery.toLowerCase());

    const handleSelectDestination = (node: TaxiNode) => {
        setDestinations((prev) => [...prev, { key: `node-${node.id}`, name: node.name, toNodeId: node.id }]);
        setDestinationQuery('');
    };

    const handleAddNewDestination = () => {
        if (!trimmedDestinationQuery) return;
        pendingDestinationName.current = trimmedDestinationQuery;
        setPickType('destination');
        router.push({
            pathname: '/taxi/map-picker',
            params: { type: 'destination', mode: 'coords' },
        });
    };

    const handleRemoveDestination = (key: string) => {
        setDestinations((prev) => prev.filter((d) => d.key !== key));
    };

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

        // campaigns only accept stations with a photo
        if (inCampaign && images.length === 0) {
            showToast(t('campaign-photo-required'));
            return;
        }

        setSubmitting(true);
        try {
            let merged = false;
            let created: Awaited<ReturnType<typeof taxiService.createNodeForRoute>> | null = null;
            if (createdNodeId.current == null) {
                created = await taxiService.createNodeForRoute({
                    name: name.trim(),
                    lat: location.lat,
                    lng: location.lng,
                    nodeType,
                    landmark: landmark.trim() || undefined,
                    ...(images.length > 0 && { photos: images.map((img) => img.objectName) }),
                    ...(photoFix && deviceFieldsFromFix(photoFix)),
                });
                createdNodeId.current = created?.id ?? null;
                merged = created?.merged === true;
                if (!merged) showCampaignPointsEstimate('taxi_station', location, { hasPhoto: images.length > 0 });
                void askForNotifications('contribution');
            }

            if (routeSlot) {
                if (createdNodeId.current == null) throw new Error(t('failed-to-create-station'));
                // back to the route builder with this as an existing station (merged = the nearby one it matched)
                const node = created;
                setPickType(routeSlot);
                setPendingStop({
                    id: String(createdNodeId.current),
                    name: node?.name ?? name.trim(),
                    lat: node?.lat ?? location.lat,
                    lng: node?.lng ?? location.lng,
                    type: node?.nodeType === 'stop' || node?.nodeType === 'station' ? node.nodeType : nodeType,
                    existingNodeId: createdNodeId.current,
                    isExisting: true,
                });
                showToast(t(merged ? 'report-merged-thanks' : 'station-created-successfully'));
                router.back();
                return;
            }

            if (destinations.length > 0) {
                if (createdNodeId.current == null) {
                    throw new Error(t('failed-to-save-destinations'));
                }
                try {
                    await taxiService.createDestinations({
                        fromNodeId: createdNodeId.current,
                        destinations: destinations.map((d) =>
                            d.newStop ? { newStop: d.newStop } : { toNodeId: d.toNodeId as number }
                        ),
                    });
                } catch (error) {
                    console.error('[AddStation] Error saving destinations:', error);
                    throw new Error(t('failed-to-save-destinations'));
                }
            }

            showToast(t(merged ? 'report-merged-thanks' : 'station-created-successfully'));
            router.back();
        } catch (error: any) {
            console.error('[AddStation] Error creating node:', error);
            // E0017 already shows a global toast
            if (error instanceof ApiError && isRestrictedError(error.code)) return;
            if (error instanceof ApiError && error.code === ApiErrorCode.CampaignRulesNotMet) {
                const failures = getCampaignFailures(error.additional);
                Alert.alert(t('error'), failures.length > 0 ? failures.join('\n') : t('campaign-rules-not-met'));
                return;
            }
            Alert.alert(t('error'), error?.message || t('failed-to-create-station'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
            <View className="px-6 pt-3 pb-2">
                <TouchableOpacity onPress={() => router.back()} className="self-start p-1 -ml-1" activeOpacity={0.7} hitSlop={8}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="mt-3" style={{ color: theme.textPrimary, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 }}>
                    {t('contribute-taxi-station')}
                </Text>
                <Text className="text-sm mt-1" style={{ color: theme.textSecondary }}>{t('contribute-taxi-station-description')}</Text>
            </View>

            <Animated.View style={[{ flex: 1 }, keyboardAnimatedStyle]}>
                <ScrollView
                    className="flex-1 px-6"
                    contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 20 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View>
                        <View className="mb-6">
                            <FieldLabel label={t('location')} required />

                            {location ? (
                                <View className="px-4 py-3" style={{ borderRadius: RADIUS, backgroundColor: tint(theme.primary, '14'), borderWidth: 1, borderColor: tint(theme.primary, '66') }}>
                                    <View className="flex-row items-center justify-between">
                                        <Ionicons name="location" size={18} color={theme.primary} style={{ marginRight: 10 }} />
                                        <View className="flex-1">
                                            <Text className="text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>
                                                {locationSource === 'photo'
                                                    ? t('photo-location')
                                                    : locationSource === 'current'
                                                      ? t('using-current-location')
                                                      : t('picked-on-map')}
                                            </Text>
                                            <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
                                                {location.lat.toFixed(7)}, {location.lng.toFixed(7)}
                                            </Text>
                                        </View>
                                        <TouchableOpacity onPress={() => { setLocation(null); setLocationSource(null); }} hitSlop={8}>
                                            <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                    {pinGap != null && (
                                        <Text className="text-xs mt-2" style={{ color: theme.error }}>
                                            {t('photo-pin-too-far', { distance: pinGap, limit: PHOTO_PIN_LIMIT_M.taxi_station })}
                                        </Text>
                                    )}
                                </View>
                            ) : (
                                <View>
                                    <TouchableOpacity
                                        className="mb-2 flex-row items-center justify-center"
                                        style={{ height: 46, borderRadius: RADIUS_SM, backgroundColor: theme.primary, opacity: userLocation ? 1 : 0.5 }}
                                        onPress={handleUseCurrentLocation}
                                        activeOpacity={0.7}
                                        disabled={!userLocation}
                                    >
                                        <Ionicons name="locate" size={18} color="white" />
                                        <Text className="ml-2" style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 15 }}>{t('use-current-location')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        className="flex-row items-center justify-center"
                                        style={{ height: 46, borderRadius: RADIUS_SM, backgroundColor: theme.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.border }}
                                        onPress={handlePickOnMap}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="map-outline" size={18} color={theme.primary} />
                                        <Text className="ml-2 text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{t('or-pick-on-map')}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {location && nearby.length > 0 && (
                            <View className="mb-6 overflow-hidden" style={{ borderRadius: RADIUS, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
                                <View className="px-4 py-2.5" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
                                    <Text className="text-xs" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{t('nearby-existing-stations')}</Text>
                                    <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>{t('avoid-duplicate-station')}</Text>
                                </View>
                                {nearby.map((station) => (
                                    <View key={station.id} className="px-4 py-2.5">
                                        <View className="flex-row items-center">
                                            <Text className="flex-1 text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{station.name}</Text>
                                            {station.nodeType && (
                                                <View className="px-2 py-0.5" style={{ borderRadius: 4, backgroundColor: tint(theme.primary) }}>
                                                    <Text className="text-xs" style={{ color: theme.textPrimary }}>{station.nodeType}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
                                            {station.distance}m away
                                            {station.routeName ? ` • ${station.routeName}` : ''}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {location && loadingNodes && (
                            <Text className="text-xs mb-6" style={{ color: theme.textSecondary }}>{t('loading-nearby-stations')}</Text>
                        )}

                        <View className="mb-6">
                            <FieldLabel label={t('station-name')} required />
                            <TextInput
                                style={{ borderRadius: RADIUS_SM, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary }}
                                placeholderTextColor={theme.textSecondary}
                                placeholder={t('enter-station-name')}
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View className="mb-6">
                            <FieldLabel label={t('type')} />
                            <View className="flex-row gap-3">
                                <TouchableOpacity
                                    className="flex-1 py-3"
                                    style={{ borderRadius: RADIUS_SM, borderWidth: 1, backgroundColor: nodeType === 'station' ? tint(theme.primary, '1F') : theme.surface, borderColor: nodeType === 'station' ? theme.primary : theme.border }}
                                    onPress={() => setNodeType('station')}
                                >
                                    <Text className="text-center text-sm" style={{ color: nodeType === 'station' ? theme.textPrimary : theme.textSecondary, fontFamily: nodeType === 'station' ? FONT_MEDIUM : undefined }}>
                                        {t('station')}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className="flex-1 py-3"
                                    style={{ borderRadius: RADIUS_SM, borderWidth: 1, backgroundColor: nodeType === 'stop' ? tint(theme.primary, '1F') : theme.surface, borderColor: nodeType === 'stop' ? theme.primary : theme.border }}
                                    onPress={() => setNodeType('stop')}
                                >
                                    <Text className="text-center text-sm" style={{ color: nodeType === 'stop' ? theme.textPrimary : theme.textSecondary, fontFamily: nodeType === 'stop' ? FONT_MEDIUM : undefined }}>
                                        {t('stop')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View className="mb-6">
                            <FieldLabel label={t('landmark')} />
                            <TextInput
                                style={{ borderRadius: RADIUS_SM, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary }}
                                placeholderTextColor={theme.textSecondary}
                                placeholder={t('enter-landmark-description')}
                                value={landmark}
                                onChangeText={setLandmark}
                                multiline
                                numberOfLines={2}
                            />
                        </View>

                        <View className="mb-6">
                            <FieldLabel label={t('photos')} optional={!inCampaign} />
                            <PhotoPicker
                                photos={images}
                                onChange={setImages}
                                folder="stations"
                                horizontalPadding={80}
                                cameraOnly={inCampaign}
                                requireLocation={inCampaign}
                            />
                        </View>

                        {/* the route itself defines where a route-builder stop goes */}
                        {!routeSlot && (
                            <View className="mb-6">
                                <FieldLabel label={t('destinations-terminals')} hint={t('destinations-terminals-hint')} />

                                {destinations.length > 0 && (
                                    <View className="flex-row flex-wrap gap-2 mb-2">
                                        {destinations.map((d) => (
                                            <View
                                                key={d.key}
                                                className="flex-row items-center pl-2.5 pr-1 py-1"
                                                style={{ borderRadius: RADIUS_SM, backgroundColor: tint(theme.primary, '1F'), borderWidth: 1, borderColor: tint(theme.primary, '66') }}
                                            >
                                                {d.newStop && <Ionicons name="add-circle-outline" size={14} color={theme.primary} style={{ marginRight: 4 }} />}
                                                <Text className="text-sm" style={{ color: theme.textPrimary }}>{d.name}</Text>
                                                <TouchableOpacity onPress={() => handleRemoveDestination(d.key)} className="ml-1" hitSlop={8}>
                                                    <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                <TextInput
                                    style={{ borderRadius: RADIUS_SM, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary }}
                                    placeholderTextColor={theme.textSecondary}
                                    placeholder={t('search-destination-station')}
                                    value={destinationQuery}
                                    onChangeText={setDestinationQuery}
                                />

                                {destinationMatches.length > 0 && (
                                    <View className="mt-2 overflow-hidden" style={{ borderRadius: RADIUS_SM, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                                        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
                                            {destinationMatches.map((node) => (
                                                <TouchableOpacity
                                                    key={node.id}
                                                    className="px-4 py-2.5"
                                                    onPress={() => handleSelectDestination(node)}
                                                >
                                                    <Text className="text-sm" style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>{node.name}</Text>
                                                    {node.routeName && (
                                                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>{node.routeName}</Text>
                                                    )}
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                {trimmedDestinationQuery.length > 0 && !hasExactDestinationMatch && (
                                    <TouchableOpacity
                                        className="mt-2 px-3 py-2.5 flex-row items-center"
                                        style={{ borderRadius: RADIUS_SM, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                                        onPress={handleAddNewDestination}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
                                        <View className="ml-2 flex-1">
                                            <Text className="text-sm" numberOfLines={1} style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}>
                                                {`${t('add')} "${trimmedDestinationQuery}"`}
                                            </Text>
                                            <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                                                {t('pick-new-destination-on-map')}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        <TouchableOpacity
                            className="flex-row items-center justify-center"
                            style={{ height: 48, borderRadius: RADIUS_SM, backgroundColor: theme.primary, opacity: submitting ? 0.7 : 1 }}
                            onPress={handleSubmit}
                            disabled={submitting}
                            activeOpacity={0.7}
                        >
                            {submitting && <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />}
                            <Text className="text-center" style={{ color: '#fff', fontFamily: FONT_MEDIUM, fontSize: 16 }}>
                                {submitting ? t('submitting') : t('submit')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </Animated.View>
        </View>
    );
}
