import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input, Button } from '../../../shared/components';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { useNeighborhoodContribution } from '../hooks/useNeighborhoodContribution';
import { dashboardEventsService } from '../../../shared/services/dashboard-events.service';
import { BoundingBox } from '../types/neighborhood.types';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useLocalSearchParams } from 'expo-router';

export default function NeighborhoodContributionScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();
    const params = useLocalSearchParams();
    const { userLocation } = useUserLocation();
    const { contributeNeighborhood, loading } = useNeighborhoodContribution();

    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [description, setDescription] = useState('');
    const [city, setCity] = useState('');
    const [subcity, setSubcity] = useState('');
    const [woreda, setWoreda] = useState('');
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
    const [boundingBox, setBoundingBox] = useState<BoundingBox | null>(null);
    const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);

    useFocusEffect(
        React.useCallback(() => {
            if (params.savedBoundingBox) {
                try {
                    const box = JSON.parse(params.savedBoundingBox as string);
                    setBoundingBox(box);
                    router.setParams({ savedBoundingBox: undefined });
                } catch (error) {
                    console.error('failed to parse bounding box:', error);
                }
            }
        }, [params.savedBoundingBox])
    );

    const handleNameChange = (value: string) => {
        setName(value);
        const generatedSlug = value
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '');
        setSlug(generatedSlug);
    };

    const handleUseCurrentLocation = () => {
        if (!userLocation) {
            showToast.error(t('location-unavailable'), t('please-wait-for-location'));
            return;
        }

        setCoordinates(userLocation);
        setUsingCurrentLocation(true);
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            showToast.error(t('name-required'), t('please-enter-neighborhood-name'));
            return;
        }

        if (!slug.trim()) {
            showToast.error(t('slug-required'), t('please-enter-slug'));
            return;
        }

        if (!coordinates) {
            showToast.error(t('location-required'), t('please-pick-location'));
            return;
        }

        try {
            const contributionData = {
                name: name.trim(),
                slug: slug.trim(),
                description: description.trim() || undefined,
                lat: coordinates.lat,
                lng: coordinates.lng,
                boundingBox: boundingBox || undefined,
                city: city.trim() || undefined,
                subcity: subcity.trim() || undefined,
                woreda: woreda.trim() || undefined,
                verified: false,
            };

            await contributeNeighborhood(contributionData);

            dashboardEventsService.contribute();
            showToast.success(t('success'), t('neighborhood-contribution-submitted'));
            router.back();
        } catch (error) {
            console.error('Submit error:', error);
            const errorMessage = error instanceof Error ? error.message : t('could-not-submit-contribution');
            showToast.error(t('failed'), errorMessage);
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
                    <Text className="text-xl font-bold" style={{ color: theme.textPrimary }}>{t('add-neighborhood')}</Text>
                </View>
            </View>

            <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                <View className="gap-5 pb-6 mt-6">
                    <View>
                        <Text className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>
                            {t('neighborhood-name')} <Text style={{ color: theme.primary }}>*</Text>
                        </Text>
                        <Input
                            placeholder={t('neighborhood-name-placeholder')}
                            value={name}
                            onChangeText={handleNameChange}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>
                            {t('slug')} <Text style={{ color: theme.primary }}>*</Text>
                        </Text>
                        <Input
                            placeholder={t('slug-placeholder')}
                            value={slug}
                            onChangeText={setSlug}
                        />
                        <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>{t('auto-generated-from-name')}</Text>
                    </View>

                    <View>
                        <Text className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('description')}</Text>
                        <Input
                            placeholder={t('add-details-about-neighborhood')}
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>
                            {t('location')} <Text style={{ color: theme.primary }}>*</Text>
                        </Text>
                        {coordinates ? (
                            <View className="rounded-xl p-4" style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-1">
                                        <Text className="font-semibold" style={{ color: theme.textPrimary }}>
                                            {usingCurrentLocation ? t('current-location') : t('location-selected')}
                                        </Text>
                                        <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                            {coordinates.lat.toFixed(7)}, {coordinates.lng.toFixed(7)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => { setCoordinates(null); setUsingCurrentLocation(false); }}>
                                        <Ionicons name="close-circle" size={24} color={theme.error} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
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
                        )}
                    </View>

                    <View>
                        <Text className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('city')}</Text>
                        <Input
                            placeholder={t('city-placeholder')}
                            value={city}
                            onChangeText={setCity}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('subcity')}</Text>
                        <Input
                            placeholder={t('subcity-placeholder')}
                            value={subcity}
                            onChangeText={setSubcity}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('woreda')}</Text>
                        <Input
                            placeholder={t('woreda-placeholder')}
                            value={woreda}
                            onChangeText={setWoreda}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('bounding-box-optional')}</Text>
                        <TouchableOpacity
                            className="rounded-2xl p-4 flex-row items-center justify-between"
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
                            onPress={() => {
                                const centerCoords = coordinates || { lat: 9.0105, lng: 38.7636 };
                                router.push({
                                    pathname: '/neighborhoods/bounding-box',
                                    params: {
                                        boundingBox: boundingBox ? JSON.stringify(boundingBox) : '',
                                        lat: centerCoords.lat.toString(),
                                        lng: centerCoords.lng.toString(),
                                    }
                                });
                            }}
                            activeOpacity={0.7}
                        >
                            <View className="flex-row items-center flex-1">
                                <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: isDark ? theme.background : '#F3F4F6' }}>
                                    <Ionicons name="resize-outline" size={20} color={boundingBox ? theme.primary : theme.textSecondary} />
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className="text-sm font-medium" style={{ color: theme.textPrimary }}>
                                        {boundingBox ? t('edit-bounding-box') : t('draw-bounding-box')}
                                    </Text>
                                    {boundingBox && (
                                        <Text className="text-xs mt-1" style={{ color: theme.textSecondary }}>{t('bounding-box-set')}</Text>
                                    )}
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                        </TouchableOpacity>

                        {boundingBox && (
                            <View className="mt-3 rounded-xl p-3" style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                                <Text className="text-xs font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('bounding-box-coordinates')}</Text>
                                <View className="gap-1">
                                    <Text className="text-xs" style={{ color: theme.textSecondary }}>
                                        {t('north')}: {boundingBox.north.toFixed(6)}
                                    </Text>
                                    <Text className="text-xs" style={{ color: theme.textSecondary }}>
                                        {t('south')}: {boundingBox.south.toFixed(6)}
                                    </Text>
                                    <Text className="text-xs" style={{ color: theme.textSecondary }}>
                                        {t('east')}: {boundingBox.east.toFixed(6)}
                                    </Text>
                                    <Text className="text-xs" style={{ color: theme.textSecondary }}>
                                        {t('west')}: {boundingBox.west.toFixed(6)}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            <View className="px-6 pt-4" style={{ paddingBottom: insets.bottom + 16, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border }}>
                <Button
                    title={loading ? t('submitting') : t('submit-contribution')}
                    onPress={handleSubmit}
                    disabled={loading || !name.trim() || !slug.trim() || !coordinates}
                />
            </View>
        </View>
    );
}
