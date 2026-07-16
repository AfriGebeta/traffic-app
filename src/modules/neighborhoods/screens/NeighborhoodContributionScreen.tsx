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
import { useLocalSearchParams } from 'expo-router';

export default function NeighborhoodContributionScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
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
        <View className="flex-1 bg-gray-50">
            <View className="bg-white px-6 pt-16 pb-4 border-b border-gray-100">
                <View className="flex-row items-center">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="mr-4"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={24} color="#000000" />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold text-gray-900">{t('add-neighborhood')}</Text>
                </View>
            </View>

            <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                <View className="gap-5 pb-6 mt-6">
                    <View>
                        <Text className="text-sm font-semibold text-gray-700 mb-2">
                            {t('neighborhood-name')} <Text className="text-orange-500">*</Text>
                        </Text>
                        <Input
                            placeholder={t('neighborhood-name-placeholder')}
                            value={name}
                            onChangeText={handleNameChange}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-semibold text-gray-700 mb-2">
                            {t('slug')} <Text className="text-orange-500">*</Text>
                        </Text>
                        <Input
                            placeholder={t('slug-placeholder')}
                            value={slug}
                            onChangeText={setSlug}
                        />
                        <Text className="text-xs text-gray-500 mt-1">{t('auto-generated-from-name')}</Text>
                    </View>

                    <View>
                        <Text className="text-sm font-semibold text-gray-700 mb-2">{t('description')}</Text>
                        <Input
                            placeholder={t('add-details-about-neighborhood')}
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-semibold text-gray-700 mb-2">
                            {t('location')} <Text className="text-orange-500">*</Text>
                        </Text>
                        {coordinates ? (
                            <View className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-1">
                                        <Text className="text-gray-900 font-semibold">
                                            {usingCurrentLocation ? t('current-location') : t('location-selected')}
                                        </Text>
                                        <Text className="text-gray-500 text-sm">
                                            {coordinates.lat.toFixed(7)}, {coordinates.lng.toFixed(7)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => { setCoordinates(null); setUsingCurrentLocation(false); }}>
                                        <Ionicons name="close-circle" size={24} color="#EF4444" />
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
                        <Text className="text-sm font-semibold text-gray-700 mb-2">{t('city')}</Text>
                        <Input
                            placeholder={t('city-placeholder')}
                            value={city}
                            onChangeText={setCity}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-semibold text-gray-700 mb-2">{t('subcity')}</Text>
                        <Input
                            placeholder={t('subcity-placeholder')}
                            value={subcity}
                            onChangeText={setSubcity}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-semibold text-gray-700 mb-2">{t('woreda')}</Text>
                        <Input
                            placeholder={t('woreda-placeholder')}
                            value={woreda}
                            onChangeText={setWoreda}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-semibold text-gray-700 mb-2">{t('bounding-box-optional')}</Text>
                        <TouchableOpacity
                            className="bg-white border-2 border-gray-200 rounded-2xl p-4 flex-row items-center justify-between active:border-orange-200"
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
                            style={{
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.05,
                                shadowRadius: 4,
                                elevation: 1,
                            }}
                        >
                            <View className="flex-row items-center flex-1">
                                <View className="w-10 h-10 rounded-full items-center justify-center bg-gray-100">
                                    <Ionicons name="resize-outline" size={20} color={boundingBox ? "#FFA500" : "#9CA3AF"} />
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className="text-sm font-medium text-gray-700">
                                        {boundingBox ? t('edit-bounding-box') : t('draw-bounding-box')}
                                    </Text>
                                    {boundingBox && (
                                        <Text className="text-xs text-gray-500 mt-1">{t('bounding-box-set')}</Text>
                                    )}
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                        </TouchableOpacity>

                        {boundingBox && (
                            <View className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                                <Text className="text-xs font-semibold text-gray-700 mb-2">{t('bounding-box-coordinates')}</Text>
                                <View className="gap-1">
                                    <Text className="text-xs text-gray-600">
                                        {t('north')}: {boundingBox.north.toFixed(6)}
                                    </Text>
                                    <Text className="text-xs text-gray-600">
                                        {t('south')}: {boundingBox.south.toFixed(6)}
                                    </Text>
                                    <Text className="text-xs text-gray-600">
                                        {t('east')}: {boundingBox.east.toFixed(6)}
                                    </Text>
                                    <Text className="text-xs text-gray-600">
                                        {t('west')}: {boundingBox.west.toFixed(6)}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            <View className="bg-white px-6 pt-4 border-t border-gray-100" style={{ paddingBottom: insets.bottom + 16 }}>
                <Button
                    title={loading ? t('submitting') : t('submit-contribution')}
                    onPress={handleSubmit}
                    disabled={loading || !name.trim() || !slug.trim() || !coordinates}
                />
            </View>
        </View>
    );
}
