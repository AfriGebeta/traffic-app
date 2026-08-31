import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input, Button } from '../../../shared/components';
import { ruleService } from '../services/rule.service';
import { showToast } from '../../../shared/utils/toast';
import { dashboardEventsService } from '../../../shared/services/dashboard-events.service';
import { useLocation } from '../../../shared/contexts/LocationContext';
import { useTranslation } from 'react-i18next';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';

export default function AddRuleReportScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { colors: theme, isDark } = useTheme();
    const params = useLocalSearchParams();
    const { typeId, typeName, typeDescription, typeImg } = params;
    const { selectedLocation, setSelectedLocation } = useLocation();
    const { userLocation } = useUserLocation();

    const isNavigating = params.isNavigating === 'true';
    const navLat = parseFloat(params.lat as string);
    const navLng = parseFloat(params.lng as string);
    const navCoordinates = !isNaN(navLat) && !isNaN(navLng) ? { lat: navLat, lng: navLng } : null;

    const insets = useSafeAreaInsets();
    const [punishment, setPunishment] = useState('');
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(
        isNavigating ? navCoordinates ?? null : null
    );
    const [submitting, setSubmitting] = useState(false);
    const [usingCurrentLocation, setUsingCurrentLocation] = useState(isNavigating && !!navCoordinates);

    const autoFilledLocation = React.useRef(false);

    React.useEffect(() => {
        if (autoFilledLocation.current || coordinates || !userLocation) return;
        autoFilledLocation.current = true;
        setCoordinates(userLocation);
        setUsingCurrentLocation(true);
    }, [coordinates, userLocation]);

    useFocusEffect(
        React.useCallback(() => {
            if (selectedLocation) {
                setCoordinates(selectedLocation);
                setUsingCurrentLocation(false);
                setSelectedLocation(null);
            }
        }, [selectedLocation, setSelectedLocation])
    );

    const handlePickLocation = () => {
        router.push('/rules/map-picker');
    };

    const handleUseCurrentLocation = () => {
        if (!userLocation) {
            showToast(`${t('location-unavailable')}: ${t('please-wait-for-location')}`);
            return;
        }

        setCoordinates(userLocation);
        setUsingCurrentLocation(true);
    };

    const handleSubmit = async () => {
        if (!punishment.trim()) {
            showToast(`${t('punishment-required')}: ${t('enter-punishment-details')}`);
            return;
        }

        if (!coordinates) {
            showToast(`${t('location-required')}: ${t('pick-location')}`);
            return;
        }

        setSubmitting(true);
        try {
            await ruleService.reportRule({
                lat: coordinates.lat,
                lng: coordinates.lng,
                typeId: typeId as string,
                punishment: punishment.trim(),
            });

            dashboardEventsService.contribute();
            showToast(t('traffic-rule-report-submitted'));
            router.back();
            router.back();
        } catch (error) {
            console.error('Submit error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Could not submit report';
            showToast(errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <View className="px-6 pt-16 pb-4" style={{ backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <View className="flex-row items-center">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="mr-4"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold" style={{ color: theme.textPrimary }}>{t('report-traffic-rule')}</Text>
                </View>
            </View>

            <View className="mx-6 mt-6 mb-4 rounded-2xl p-4" style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                <View className="flex-row items-center">
                    <View className="w-14 h-14 items-center justify-center mr-4 rounded-xl overflow-hidden" style={{ backgroundColor: isDark ? '#FFFFFF' : '#F3F4F6' }}>
                        {typeImg && typeof typeImg === 'string' && typeImg.length > 0 ? (
                            <Image
                                source={{ uri: typeImg }}
                                style={{ width: 48, height: 48 }}
                                resizeMode="contain"
                            />
                        ) : (
                            <Ionicons name="shield-checkmark" size={32} color="#EF4444" />
                        )}
                    </View>
                    <View className="flex-1">
                        <Text className="text-lg font-bold" style={{ color: theme.textPrimary }}>{typeName || 'Traffic Rule'}</Text>
                        <Text className="text-sm" style={{ color: theme.textSecondary }} numberOfLines={2}>
                            {typeDescription || 'Report a traffic rule violation'}
                        </Text>
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                <View className="gap-5 pb-6">
                    <View>
                        <Text className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>
                            {t('punishment')} <Text style={{ color: theme.primary }}>*</Text>
                        </Text>
                        <Input
                            placeholder={t('punishment-placeholder')}
                            value={punishment}
                            onChangeText={setPunishment}
                            multiline
                            numberOfLines={3}
                        />
                        <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                            {t('punishment-description')}
                        </Text>
                    </View>

                    <View>
                        <Text className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>
                            {t('location')} <Text style={{ color: theme.primary }}>*</Text>
                        </Text>
                        {coordinates ? (
                            <View>
                                <View className="rounded-xl p-4" style={{ backgroundColor: isDark ? theme.greenMuted : '#F0FDF4', borderWidth: 1, borderColor: theme.green }}>
                                    <View className="flex-row items-center justify-between">
                                        <View className="flex-1">
                                            <Text className="font-semibold" style={{ color: theme.textPrimary }}>
                                                {usingCurrentLocation ? t('current-location') : t('location-selected')}
                                            </Text>
                                            <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                                {coordinates.lat.toFixed(7)}, {coordinates.lng.toFixed(7)}
                                            </Text>
                                        </View>
                                        {!isNavigating && (
                                            <TouchableOpacity onPress={() => { setCoordinates(null); setUsingCurrentLocation(false); }}>
                                                <Ionicons name="close-circle" size={24} color={theme.error} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                                {!isNavigating && (
                                    <>
                                        <View className="flex-row items-center justify-center my-2">
                                            <View className="flex-1 h-px" style={{ backgroundColor: theme.border }} />
                                            <Text className="text-sm mx-3" style={{ color: theme.textSecondary }}>{t('or')}</Text>
                                            <View className="flex-1 h-px" style={{ backgroundColor: theme.border }} />
                                        </View>
                                        <TouchableOpacity
                                            className="rounded-2xl px-4 py-2 flex-row items-center justify-between"
                                            onPress={handlePickLocation}
                                            activeOpacity={0.7}
                                            style={{
                                                backgroundColor: theme.surface,
                                                borderWidth: 2,
                                                borderColor: theme.border,
                                                shadowColor: '#000',
                                                shadowOffset: { width: 0, height: 1 },
                                                shadowOpacity: 0.05,
                                                shadowRadius: 4,
                                                elevation: 1,
                                            }}
                                        >
                                            <View className="flex-row items-center flex-1">
                                                <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: isDark ? theme.background : '#F3F4F6' }}>
                                                    <Ionicons name="map" size={20} color={theme.textSecondary} />
                                                </View>
                                                <View className="ml-3 flex-1">
                                                    <Text className="text-sm font-medium" style={{ color: theme.textSecondary }}>
                                                        {t('pick-location-on-map')}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        ) : (
                            <View>
                                {!isNavigating && (
                                    <TouchableOpacity
                                        className="rounded-2xl px-4 py-2 flex-row items-center justify-between mb-2"
                                        onPress={handlePickLocation}
                                        activeOpacity={0.7}
                                        style={{
                                            backgroundColor: theme.surface,
                                            borderWidth: 2,
                                            borderColor: theme.border,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.05,
                                            shadowRadius: 4,
                                            elevation: 1,
                                        }}
                                    >
                                        <View className="flex-row items-center flex-1">
                                            <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: isDark ? theme.background : '#F3F4F6' }}>
                                                <Ionicons name="map" size={20} color={theme.textSecondary} />
                                            </View>
                                            <View className="ml-3 flex-1">
                                                <Text className="text-sm font-medium" style={{ color: theme.textSecondary }}>
                                                    {t('pick-location-on-map')}
                                                </Text>
                                            </View>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                                    </TouchableOpacity>
                                )}
                                {!isNavigating && (
                                    <View className="flex-row items-center justify-center my-2">
                                        <View className="flex-1 h-px" style={{ backgroundColor: theme.border }} />
                                        <Text className="text-sm mx-3" style={{ color: theme.textSecondary }}>{t('or')}</Text>
                                        <View className="flex-1 h-px" style={{ backgroundColor: theme.border }} />
                                    </View>
                                )}
                                <TouchableOpacity
                                    className="py-3 rounded-xl flex-row items-center justify-center"
                                    style={{ backgroundColor: colors.primary.main }}
                                    onPress={handleUseCurrentLocation}
                                    activeOpacity={0.7}
                                    disabled={!userLocation}
                                >
                                    <Ionicons name="locate" size={20} color="white" />
                                    <Text className="text-white font-semibold ml-2">{t('use-current-location')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            <View className="px-6 pt-4" style={{ paddingBottom: insets.bottom + 16, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border }}>
                <Button
                    title={submitting ? t('submitting') : t('submit-report')}
                    onPress={handleSubmit}
                    disabled={submitting || !punishment.trim() || !coordinates}
                />
            </View>
        </View>
    );
}
