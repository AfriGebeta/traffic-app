import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { taxiService } from '../services/taxi.service';
import { TaxiNode, TaxiNavigationRequest } from '../types/taxi.types';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useUserRegistration } from '../../register/hooks/useUserRegistration';
import LekfelPaymentModal from '../components/LekfelPaymentModal';
import LekfelPayCard from '../components/LekfelPayCard';
import { useLekfelPayment } from '../hooks/useLekfelPayment';

export default function TaxiSearchScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { userLocation } = useUserLocation();
    const { colors: theme, isDark } = useTheme();
    const { getStoredUser } = useUserRegistration();
    const { stage: paymentStage, errorMessage: paymentError, pay, reset: resetPayment } = useLekfelPayment();

    const [originName, setOriginName] = useState('');
    const [destinationName, setDestinationName] = useState('');
    const [stations, setStations] = useState<TaxiNode[]>([]);
    const [filteredOriginStations, setFilteredOriginStations] = useState<TaxiNode[]>([]);
    const [filteredStations, setFilteredStations] = useState<TaxiNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingStations, setLoadingStations] = useState(true);
    const [selectedOriginCoords, setSelectedOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [isSelectingOrigin, setIsSelectingOrigin] = useState(false);
    const [payerPhone, setPayerPhone] = useState('');
    const [receiverPhone, setReceiverPhone] = useState('');
    const [payAmount, setPayAmount] = useState('');
    const lastProcessedTimestamp = useRef<number>(0);
    const skipOriginFilter = useRef(false);
    const skipDestinationFilter = useRef(false);

    useEffect(() => {
        fetchStations();
    }, []);

    useEffect(() => {
        getStoredUser().then(storedUser => {
            if (storedUser?.phoneNumber) setPayerPhone(storedUser.phoneNumber);
        });
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            const coords = (globalThis as any).__taxiDestinationCoords;
            if (coords && coords.timestamp && coords.timestamp !== lastProcessedTimestamp.current) {
                setSelectedCoords({ lat: coords.lat, lng: coords.lng });
                setDestinationName(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
                lastProcessedTimestamp.current = coords.timestamp;
                delete (globalThis as any).__taxiDestinationCoords;
            }
        }, [])
    );

    useEffect(() => {
        if (skipOriginFilter.current) {
            skipOriginFilter.current = false;
            return;
        }
        if (originName.trim()) {
            const filtered = stations.filter((station) =>
                station.name.toLowerCase().includes(originName.toLowerCase()) ||
                station.routeName?.toLowerCase().includes(originName.toLowerCase())
            );
            setFilteredOriginStations(filtered);
        } else {
            setFilteredOriginStations([]);
        }
    }, [originName, stations]);

    useEffect(() => {
        if (skipDestinationFilter.current) {
            skipDestinationFilter.current = false;
            return;
        }
        if (destinationName.trim()) {
            const filtered = stations.filter((station) =>
                station.name.toLowerCase().includes(destinationName.toLowerCase()) ||
                station.routeName?.toLowerCase().includes(destinationName.toLowerCase())
            );
            setFilteredStations(filtered);
        } else {
            setFilteredStations([]);
        }
    }, [destinationName, stations]);

    const fetchStations = async () => {
        try {
            const response: any = await taxiService.getNodes();
            const allNodes = Array.isArray(response) ? response : response.data || [];
            setStations(allNodes);
        } catch (error) {
            console.error('Error fetching stations:', error);
        } finally {
            setLoadingStations(false);
        }
    };

    const handleSearch = async () => {
        const hasCustomOrigin = selectedOriginCoords !== null;

        if (!hasCustomOrigin && !userLocation) {
            Alert.alert(t('error'), t('location-unavailable'));
            return;
        }

        if (!destinationName.trim()) {
            Alert.alert(t('error'), t('please-enter-destination'));
            return;
        }

        setLoading(true);
        try {
            let requestData;
            let matchingStation = null;

            const originCoords = selectedOriginCoords || (userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null);

            if (!originCoords) {
                Alert.alert(t('error'), t('location-unavailable'));
                setLoading(false);
                return;
            }

            if (selectedCoords) {
                requestData = {
                    origin: [originCoords.lat, originCoords.lng] as [number, number],
                    destination: [selectedCoords.lat, selectedCoords.lng] as [number, number],
                };
            } else {
                matchingStation = stations.find(
                    s => s.name.toLowerCase() === destinationName.trim().toLowerCase()
                );

                if (matchingStation) {
                    requestData = {
                        origin: [originCoords.lat, originCoords.lng] as [number, number],
                        destination: [matchingStation.lat, matchingStation.lng] as [number, number],
                    };
                } else {
                    Alert.alert(
                        t('error'),
                        'Please select a destination from the available stations list'
                    );
                    setLoading(false);
                    return;
                }
            }


            const result: any = await taxiService.requestTaxiNavigation(requestData);

            if (result.success === false) {
                throw new Error(result.message || 'No route found');
            }

            if (!result || !result.startNode || !result.endNode) {
                throw new Error('Invalid response from server: missing route data');
            }

            const destinationCoords = result.destination || {
                lat: selectedCoords?.lat || matchingStation?.lat,
                lng: selectedCoords?.lng || matchingStation?.lng
            };

            const destination = {
                name: destinationName.trim(),
                latitude: destinationCoords.lat,
                longitude: destinationCoords.lng,
                type: 'destination' as const,
                City: '',
                Country: '',
            };

            // If custom origin is selected, we need to show preview mode
            if (hasCustomOrigin) {
                const origin = {
                    name: originName.trim() || 'Custom Origin',
                    latitude: selectedOriginCoords.lat,
                    longitude: selectedOriginCoords.lng,
                    type: 'origin' as const,
                    City: '',
                    Country: '',
                };

                (globalThis as any).__taxiRouteData = {
                    ...result,
                    timestamp: Date.now(),
                    customOrigin: origin,
                };
            } else {
                (globalThis as any).__taxiRouteData = {
                    ...result,
                    timestamp: Date.now(),
                };
            }

            router.back();

            setTimeout(() => {
                router.setParams({
                    taxiDestLat: destination.latitude.toString(),
                    taxiDestLng: destination.longitude.toString(),
                    taxiDestName: destination.name,
                    showTaxiMode: 'true',
                });
            }, 100);
        } catch (error: any) {
            console.error('Error requesting taxi navigation:', error);
            console.error('Error response:', error.response?.data);

            const errorMessage = error.response?.data?.message
                || error.response?.data?.error
                || error.message
                || t('failed-to-find-route');

            Alert.alert(t('error'), errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const hasOrigin = selectedOriginCoords !== null || userLocation !== null;
    const hasValidDestination = selectedCoords !== null
        || stations.some(s => s.name.toLowerCase() === destinationName.trim().toLowerCase());
    const canSearch = hasOrigin && hasValidDestination && !loading;
    const showNoMatch = !loadingStations
        && !isSelectingOrigin
        && destinationName.trim().length > 0
        && !hasValidDestination
        && filteredStations.length === 0;

    const canPay = payerPhone.trim().length > 0
        && receiverPhone.trim().length > 0
        && Number(payAmount.trim()) > 0;

    const handlePay = () => {
        const now = new Date();
        const originCoords = selectedOriginCoords
            || (userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null);
        const resolvedOriginName = originName.trim() || t('current-location');

        pay({
            payerPhone: payerPhone.trim(),
            receiverPhone: receiverPhone.trim(),
            amount: Number(payAmount.trim()),
            description: `${t('taxi-ride')} ${resolvedOriginName} -> ${destinationName.trim()}`,
            originName: resolvedOriginName,
            originLat: originCoords?.lat,
            originLng: originCoords?.lng,
            destinationName: destinationName.trim(),
            destinationLat: selectedCoords?.lat,
            destinationLng: selectedCoords?.lng,
            tripDayOfWeek: now.getDay(),
            tripMinutesOfDay: now.getHours() * 60 + now.getMinutes(),
        });
    };

    const handleDismissPayment = () => {
        if (paymentStage === 'success') {
            setReceiverPhone('');
            setPayAmount('');
        }
        resetPayment();
    };

    const handleStationSelect = (station: TaxiNode) => {
        if (isSelectingOrigin) {
            skipOriginFilter.current = true;
            setOriginName(station.name);
            setSelectedOriginCoords({ lat: station.lat, lng: station.lng });
            setFilteredOriginStations([]);
        } else {
            skipDestinationFilter.current = true;
            setDestinationName(station.name);
            setSelectedCoords({ lat: station.lat, lng: station.lng });
            setFilteredStations([]);
        }
    };

    const handleUseMyLocation = () => {
        setOriginName('');
        setSelectedOriginCoords(null);
        setFilteredOriginStations([]);
        setIsSelectingOrigin(false);
    };

    const handleMapPicker = () => {
        router.push('/taxi/destination-picker');
    };

    const handleAddStation = () => {
        router.push({
            pathname: '/taxi/add-station',
            params: { prefillName: destinationName.trim() },
        } as any);
    };

    return (
        <KeyboardAvoidingView
            className="flex-1"
            style={{ paddingTop: insets.top, backgroundColor: theme.background }}
            behavior="padding"
            keyboardVerticalOffset={0}
        >
            <View className="px-4 py-6" style={{ backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4" activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={28} color="#FFA500" />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold" style={{ color: theme.textPrimary }}>{t('taxi-navigation')}</Text>
                </View>
                <Text className="mt-2" style={{ color: theme.textSecondary }}>{t('find-taxi-route-to-destination')}</Text>
            </View>

            <ScrollView
                className="flex-1 p-4"
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 40 }}
            >
                <View className="rounded-2xl p-6 shadow-sm" style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                    <View className="mb-4">
                        <Text className="font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('from')}</Text>

                        {!selectedOriginCoords && !isSelectingOrigin ? (
                            <TouchableOpacity
                                className="rounded-xl px-4 py-3 flex-row items-center justify-between"
                                style={{ backgroundColor: isDark ? theme.greenMuted : '#F0FDF4', borderWidth: 1, borderColor: theme.green }}
                                onPress={() => {
                                    setIsSelectingOrigin(true);
                                }}
                                activeOpacity={0.7}
                            >
                                <View className="flex-row items-center flex-1">
                                    <Ionicons name="location" size={20} color={theme.green} />
                                    <Text className="ml-2 flex-1" style={{ color: theme.green }}>
                                        {userLocation
                                            ? t('current-location')
                                            : t('waiting-for-location')}
                                    </Text>
                                </View>
                                <Text className="text-xs font-semibold" style={{ color: theme.green }}>
                                    {t('change')}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <View>
                                <TextInput
                                    className="rounded-xl px-4 py-3 mb-2"
                                    style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary }}
                                    placeholderTextColor={theme.textSecondary}
                                    placeholder={t('enter-origin-station')}
                                    value={originName}
                                    onChangeText={(text) => {
                                        setOriginName(text);
                                        setSelectedOriginCoords(null);
                                        setIsSelectingOrigin(true);
                                    }}
                                    onFocus={() => setIsSelectingOrigin(true)}
                                />

                                {filteredOriginStations.length > 0 && isSelectingOrigin && (
                                    <View className="mb-2 rounded-xl overflow-hidden" style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }}>
                                        <View className="px-4 py-2" style={{ backgroundColor: theme.blueMuted, borderBottomWidth: 1, borderBottomColor: theme.blue }}>
                                            <Text className="font-semibold text-sm" style={{ color: theme.blue }}>
                                                {t('available-stations')}
                                            </Text>
                                        </View>
                                        <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
                                            {filteredOriginStations.slice(0, 10).map((station) => (
                                                <TouchableOpacity
                                                    key={station.id}
                                                    className="px-4 py-3"
                                                    style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}
                                                    onPress={() => handleStationSelect(station)}
                                                >
                                                    <Text className="font-semibold" style={{ color: theme.textPrimary }}>{station.name}</Text>
                                                    {station.routeName && (
                                                        <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                                                            {station.routeName}
                                                        </Text>
                                                    )}
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                <TouchableOpacity
                                    className="flex-row items-center justify-center py-2"
                                    onPress={handleUseMyLocation}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="locate" size={16} color={theme.green} />
                                    <Text className="text-sm font-semibold ml-2" style={{ color: theme.green }}>
                                        {t('use-my-location')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <View className="mb-4">
                        <Text className="font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('to')} *</Text>
                        <TextInput
                            className="rounded-xl px-4 py-3"
                            style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary }}
                            placeholderTextColor={theme.textSecondary}
                            placeholder={t('enter-destination-name')}
                            value={destinationName}
                            onChangeText={(text) => {
                                setDestinationName(text);
                                setSelectedCoords(null);
                                setIsSelectingOrigin(false);
                            }}
                            onFocus={() => setIsSelectingOrigin(false)}
                        />

                        {filteredStations.length > 0 && !isSelectingOrigin && (
                            <View className="mt-2 rounded-xl overflow-hidden" style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border }}>
                                <View className="px-4 py-2" style={{ backgroundColor: theme.blueMuted, borderBottomWidth: 1, borderBottomColor: theme.blue }}>
                                    <Text className="font-semibold text-sm" style={{ color: theme.blue }}>
                                        {t('available-stations')}
                                    </Text>
                                </View>
                                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
                                    {filteredStations.slice(0, 10).map((station) => (
                                        <TouchableOpacity
                                            key={station.id}
                                            className="px-4 py-3"
                                            style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}
                                            onPress={() => handleStationSelect(station)}
                                        >
                                            <Text className="font-semibold" style={{ color: theme.textPrimary }}>{station.name}</Text>
                                            {station.routeName && (
                                                <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                                                    {station.routeName}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {showNoMatch && (
                            <TouchableOpacity
                                className="mt-2 rounded-xl px-4 py-3 flex-row items-center"
                                style={{ backgroundColor: theme.background, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }}
                                onPress={handleAddStation}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="add-circle-outline" size={20} color="#FFA500" />
                                <View className="ml-2 flex-1">
                                    <Text className="font-semibold" numberOfLines={1} style={{ color: theme.textPrimary }}>
                                        {t('add')} "{destinationName.trim()}"
                                    </Text>
                                    <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                                        {t('no-station-matches')}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <TouchableOpacity
                        className="rounded-xl p-4 flex-row items-center justify-center mb-6"
                        style={{ backgroundColor: theme.surface, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.border }}
                        onPress={handleMapPicker}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="map" size={24} color="#FFA500" />
                        <Text className="ml-2" style={{ color: theme.textSecondary }}>{t('or-pick-on-map')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="py-4 rounded-xl"
                        style={{ backgroundColor: canSearch ? '#F97316' : theme.border }}
                        onPress={handleSearch}
                        disabled={!canSearch}
                        activeOpacity={0.7}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white text-center font-bold text-lg">
                                {selectedOriginCoords ? t('preview-route') : t('find-taxi-route')}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                <LekfelPayCard
                    payerPhone={payerPhone}
                    onPayerPhoneChange={setPayerPhone}
                    receiverPhone={receiverPhone}
                    onReceiverPhoneChange={setReceiverPhone}
                    amount={payAmount}
                    onAmountChange={setPayAmount}
                    currency="ETB"
                    canPay={canPay}
                    onPay={handlePay}
                    disabled={destinationName.trim().length === 0}
                    disabledHint={t('set-destination-to-pay')}
                />
            </ScrollView>

            <LekfelPaymentModal
                stage={paymentStage}
                errorMessage={paymentError}
                amount={payAmount}
                currency="ETB"
                onRetry={resetPayment}
                onDismiss={handleDismissPayment}
            />
        </KeyboardAvoidingView>
    );
}
