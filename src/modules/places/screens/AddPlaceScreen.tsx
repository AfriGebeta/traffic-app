import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Input, Button } from '../../../shared/components';
import { PLACE_TYPES, PlaceType } from '../types/place.types';
import { uploadToMinio } from '../../../shared/utils/minio';
import { placeService } from '../services/place.service';
import { showToast } from '../../../shared/utils/toast';
import { useLocation } from '../../../shared/contexts/LocationContext';
import { useTranslation } from 'react-i18next';
import { getPlaceTranslationKey } from '../utils/placeTranslations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dashboardEventsService } from '../../../shared/services/dashboard-events.service';
import { useUserLocation } from '../../map/hooks/useUserLocation';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';

import GasStationLight from '../../../../assets/images/contribute-place-gas-station-light.svg';
import GasStationDark from '../../../../assets/images/contribute-place-gas-station-dark.svg';
import TaxiLight from '../../../../assets/images/contribute-place-taxi-light.svg';
import TaxiDark from '../../../../assets/images/contribute-place-taxi-dark.svg';
import RestaurantLight from '../../../../assets/images/contribute-place-restaurant-light.svg';
import RestaurantDark from '../../../../assets/images/contribute-place-restaurant-dark.svg';
import ParkingLight from '../../../../assets/images/contribute-place-parking-light.svg';
import ParkingDark from '../../../../assets/images/contribute-place-parking-dark.svg';
import HospitalLight from '../../../../assets/images/contribute-place-hospital-light.svg';
import HospitalDark from '../../../../assets/images/contribute-place-hospital-dark.svg';
import BuildingLight from '../../../../assets/images/contribute-place-building-light.svg';
import BuildingDark from '../../../../assets/images/contribute-place-building-dark.svg';
import CompanyLight from '../../../../assets/images/contribute-place-company-light.svg';
import CompanyDark from '../../../../assets/images/contribute-place-company-dark.svg';
import GovernmentLight from '../../../../assets/images/contribute-place-government-light.svg';
import GovernmentDark from '../../../../assets/images/contribute-place-government-dark.svg';
import MallLight from '../../../../assets/images/contribute-place-mall-light.svg';
import MallDark from '../../../../assets/images/contribute-place-mall-dark.svg';
import ShopLight from '../../../../assets/images/contribute-place-shop-light.svg';
import ShopDark from '../../../../assets/images/contribute-place-shop-dark.svg';
import MoreLight from '../../../../assets/images/contribute-place-more-light.svg';
import MoreDark from '../../../../assets/images/contribute-place-more-dark.svg';

export default function AddPlaceScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();
    const { width: windowWidth } = useWindowDimensions();
    const tileSize = Math.floor((windowWidth - 48 - 24) / 3);
    const params = useLocalSearchParams();
    const placeType = params.type as PlaceType;
    const { selectedLocation, setSelectedLocation } = useLocation();
    const { userLocation } = useUserLocation();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
    const [images, setImages] = useState<{ localUri: string; objectName: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);

    const placeInfo = PLACE_TYPES.find((p) => p.id === placeType);

    useFocusEffect(
        React.useCallback(() => {
            if (selectedLocation) {
                setCoordinates(selectedLocation);
                setUsingCurrentLocation(false);
                setSelectedLocation(null);
            }
        }, [selectedLocation, setSelectedLocation])
    );

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            showToast('Camera roll permission required');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsMultipleSelection: true,
            selectionLimit: 0,
            quality: 0.8,
        });

        if (!result.canceled && result.assets.length > 0) {
            await uploadImages(result.assets.map((a) => a.uri));
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();

        if (status !== 'granted') {
            showToast('Camera permission required');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            await uploadImages([result.assets[0].uri]);
        }
    };

    const uploadImages = async (uris: string[]) => {
        setUploading(true);
        try {
            const uploaded = await Promise.all(
                uris.map(async (uri) => ({ localUri: uri, objectName: await uploadToMinio(uri, 'places') }))
            );
            setImages((prev) => [...prev, ...uploaded]);
            showToast('Photo added successfully');
        } catch (error) {
            showToast('Could not upload image');
        } finally {
            setUploading(false);
        }
    };

    const removeImage = (index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
    };

    const handlePickLocation = () => {
        router.push('/places/map-picker');
    };

    const handleUseCurrentLocation = () => {
        if (!userLocation) {
            showToast(t('please-wait-for-location'));
            return;
        }

        setCoordinates(userLocation);
        setUsingCurrentLocation(true);
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            return;
        }

        if (!coordinates) {
            return;
        }

        setSubmitting(true);
        try {
            await placeService.contributePlace({
                name: name.trim(),
                type: placeType,
                lat: coordinates.lat,
                lng: coordinates.lng,
                description: description.trim(),
                images: images.map((img) => img.objectName),
            });

            dashboardEventsService.contribute();
            router.back();
            router.back();
        } catch (error) {
            console.error('Submit error:', error);
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
                    <Text className="text-xl font-bold" style={{ color: theme.textPrimary }}>{t('add-place-details')}</Text>
                </View>
            </View>

            <View className="mx-6 mt-6 mb-4 rounded-2xl p-4 flex-row items-center" style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                <View className="w-12 h-12 items-center justify-center mr-4">
                    {(() => {
                        const placeIconMap: Record<string, React.FC<{ width?: number; height?: number }>> = {
                            'gas_station': isDark ? GasStationDark : GasStationLight,
                            'taxi_station': isDark ? TaxiDark : TaxiLight,
                            'restaurant': isDark ? RestaurantDark : RestaurantLight,
                            'parking': isDark ? ParkingDark : ParkingLight,
                            'hospital': isDark ? HospitalDark : HospitalLight,
                            'building': isDark ? BuildingDark : BuildingLight,
                            'company': isDark ? CompanyDark : CompanyLight,
                            'government': isDark ? GovernmentDark : GovernmentLight,
                            'mall': isDark ? MallDark : MallLight,
                            'shop': isDark ? ShopDark : ShopLight,
                            'other': isDark ? MoreDark : MoreLight,
                        };

                        const Icon = placeIconMap[placeType] ?? (isDark ? MoreDark : MoreLight);

                        return <Icon width={40} height={40} />;
                    })()}
                </View>
                <View className="flex-1">
                    <Text className="text-lg font-bold" style={{ color: theme.textPrimary }}>
                        {placeType ? t(getPlaceTranslationKey(placeType)) : placeInfo?.label}
                    </Text>
                    <Text className="text-sm" style={{ color: theme.textSecondary }}>{t('fill-in-the-details')}</Text>
                </View>
            </View>

            <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                <View className="gap-5 pb-6">

                    <View>
                        <Text className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>
                            {t('place-name')} <Text style={{ color: theme.primary }}>*</Text>
                        </Text>
                        <Input placeholder={t('place-name-placeholder')} value={name} onChangeText={setName} />
                    </View>

                    <View>
                        <Text className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('description')}</Text>
                        <Input
                            placeholder={t('add-details-about-place')}
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
                                    <TouchableOpacity onPress={() => { setCoordinates(null); setUsingCurrentLocation(false); }}>
                                        <Ionicons name="close-circle" size={24} color={theme.error} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View>
                                <TouchableOpacity
                                    className="rounded-2xl p-4 flex-row items-center justify-between mb-2"
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
                                <View className="flex-row items-center justify-center my-2">
                                    <View className="flex-1 h-px" style={{ backgroundColor: theme.border }} />
                                    <Text className="text-sm mx-3" style={{ color: theme.textSecondary }}>{t('or')}</Text>
                                    <View className="flex-1 h-px" style={{ backgroundColor: theme.border }} />
                                </View>
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

                    <View>
                        <Text className="text-sm font-semibold mb-2" style={{ color: theme.textPrimary }}>{t('photos')}</Text>

                        <View className="flex-row flex-wrap gap-3 mb-3">
                            <TouchableOpacity
                                className="rounded-2xl items-center justify-center"
                                style={{ width: tileSize, height: tileSize, backgroundColor: theme.surface, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.border }}
                                onPress={takePhoto}
                                disabled={uploading}
                                activeOpacity={0.7}
                            >
                                <View className="rounded-full p-3 mb-2" style={{ backgroundColor: isDark ? theme.background : '#F3F4F6' }}>
                                    <Ionicons name="camera" size={24} color={theme.textSecondary} />
                                </View>
                                <Text className="text-xs font-medium" style={{ color: theme.textSecondary }}>{t('camera')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                className="rounded-2xl items-center justify-center"
                                style={{ width: tileSize, height: tileSize, backgroundColor: theme.surface, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.border }}
                                onPress={pickImage}
                                disabled={uploading}
                                activeOpacity={0.7}
                            >
                                <View className="rounded-full p-3 mb-2" style={{ backgroundColor: isDark ? theme.background : '#F3F4F6' }}>
                                    <Ionicons name="images" size={24} color={theme.textSecondary} />
                                </View>
                                <Text className="text-xs font-medium" style={{ color: theme.textSecondary }}>{t('gallery')}</Text>
                            </TouchableOpacity>

                            {images.map((img, index) => (
                                <View key={index} className="relative">
                                    <Image
                                        source={{ uri: img.localUri }}
                                        style={{ width: tileSize, height: tileSize, borderRadius: 16 }}
                                        resizeMode="cover"
                                    />
                                    <TouchableOpacity
                                        className="absolute -top-2 -right-2 bg-red-500 rounded-full w-7 h-7 items-center justify-center shadow-lg"
                                        onPress={() => removeImage(index)}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="close" size={16} color="white" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>

                        {uploading && (
                            <View className="flex-row items-center mb-3 rounded-xl p-3" style={{ backgroundColor: theme.blueMuted }}>
                                <ActivityIndicator size="small" color={theme.blue} />
                                <Text className="text-sm ml-2 font-medium" style={{ color: theme.blue }}>{t('uploading')}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            <View className="px-6 pt-4" style={{ paddingBottom: insets.bottom + 16, backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border }}>
                <Button
                    title={submitting ? t('submitting') : t('submit-contribution')}
                    onPress={handleSubmit}
                    disabled={submitting || !name.trim() || !coordinates}
                />
            </View>
        </View>
    );
}
