import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
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

export default function AddPlaceScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const placeType = params.type as PlaceType;
    const { selectedLocation } = useLocation();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
    const [images, setImages] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const placeInfo = PLACE_TYPES.find((p) => p.id === placeType);

    useFocusEffect(
        React.useCallback(() => {
            if (selectedLocation) {
                setCoordinates(selectedLocation);
            }
        }, [selectedLocation])
    );

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            showToast.error('Permission denied', 'Camera roll permission required');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            await uploadImage(result.assets[0].uri);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();

        if (status !== 'granted') {
            showToast.error('Permission denied', 'Camera permission required');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            await uploadImage(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri: string) => {
        setUploading(true);
        try {
            const url = await uploadToMinio(uri, 'places');
            setImages((prev) => [...prev, url]);
            showToast.success('Image uploaded', 'Photo added successfully');
        } catch (error) {
            showToast.error('Upload failed', 'Could not upload image');
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

    const handleSubmit = async () => {
        if (!name.trim()) {
            showToast.error('Name required', 'Please enter a place name');
            return;
        }

        if (!coordinates) {
            showToast.error('Location required', 'Please pick a location on the map');
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
                images,
            });

            showToast.success('Success!', 'Place contribution submitted');
            router.back();
            router.back();
        } catch (error) {
            console.error('Submit error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Could not submit contribution';
            showToast.error('Failed', errorMessage);
        } finally {
            setSubmitting(false);
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
                    <Text className="text-xl font-bold text-gray-900">{t('add-place-details')}</Text>
                </View>
            </View>

            <View className="bg-white mx-6 mt-6 mb-4 rounded-2xl p-4 flex-row items-center border border-gray-100">
                <View className="w-14 h-14 items-center justify-center mr-4">
                    {(() => {
                        const placeImageMap: Record<string, any> = {
                            'gas_station': require('../../../../assets/images/gas-station-place.png'),
                            'taxi_station': require('../../../../assets/images/taxi-station-place.png'),
                            'repair_shop': require('../../../../assets/images/repair-shop-place.png'),
                            'restaurant': require('../../../../assets/images/restaurant-place.png'),
                            'parking': require('../../../../assets/images/parking-place.png'),
                            'hospital': require('../../../../assets/images/hospital-place.png'),
                            'other': require('../../../../assets/images/other-place.png'),
                        };

                        const imageSource = placeImageMap[placeType];

                        return (
                            <Image
                                source={imageSource}
                                style={{ width: 48, height: 48 }}
                                resizeMode="contain"
                            />
                        );
                    })()}
                </View>
                <View className="flex-1">
                    <Text className="text-lg font-bold text-gray-900">
                        {placeType ? t(getPlaceTranslationKey(placeType)) : placeInfo?.label}
                    </Text>
                    <Text className="text-gray-500 text-sm">{t('fill-in-the-details')}</Text>
                </View>
            </View>

            <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                <View className="gap-5 pb-6">

                    <View>
                        <Text className="text-sm font-semibold text-gray-700 mb-2">
                            {t('place-name')} <Text className="text-orange-500">*</Text>
                        </Text>
                        <Input placeholder={t('place-name-placeholder')} value={name} onChangeText={setName} />
                    </View>

                    <View>
                        <Text className="text-sm font-semibold text-gray-700 mb-2">{t('description')}</Text>
                        <Input
                            placeholder={t('add-details-about-place')}
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
                        <TouchableOpacity
                            className="bg-white border-2 border-gray-200 rounded-2xl p-4 flex-row items-center justify-between active:border-orange-200"
                            onPress={handlePickLocation}
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
                                <View
                                    className={`w-10 h-10 rounded-full items-center justify-center ${coordinates ? 'bg-green-100' : 'bg-gray-100'
                                        }`}
                                >
                                    <Ionicons name="location" size={20} color={coordinates ? '#10B981' : '#9CA3AF'} />
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text className={`text-sm font-medium ${coordinates ? 'text-gray-900' : 'text-gray-500'}`}>
                                        {coordinates ? 'Location Selected' : t('pick-location-on-map')}
                                    </Text>
                                    {coordinates && (
                                        <Text className="text-xs text-gray-500 mt-0.5">
                                            {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                        </TouchableOpacity>
                    </View>

                    {/* Photos */}
                    <View>
                        <Text className="text-sm font-semibold text-gray-700 mb-2">{t('photos')}</Text>

                        <View className="flex-row gap-3 mb-3">
                            <TouchableOpacity
                                className="bg-white border-2 border-dashed border-gray-300 rounded-2xl w-28 h-28 items-center justify-center active:border-orange-300 active:bg-orange-50"
                                onPress={takePhoto}
                                disabled={uploading}
                                activeOpacity={0.7}
                            >
                                <View className="bg-gray-100 rounded-full p-3 mb-2">
                                    <Ionicons name="camera" size={24} color="#6B7280" />
                                </View>
                                <Text className="text-xs font-medium text-gray-600">{t('camera')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                className="bg-white border-2 border-dashed border-gray-300 rounded-2xl w-28 h-28 items-center justify-center active:border-orange-300 active:bg-orange-50"
                                onPress={pickImage}
                                disabled={uploading}
                                activeOpacity={0.7}
                            >
                                <View className="bg-gray-100 rounded-full p-3 mb-2">
                                    <Ionicons name="images" size={24} color="#6B7280" />
                                </View>
                                <Text className="text-xs font-medium text-gray-600">{t('gallery')}</Text>
                            </TouchableOpacity>
                        </View>

                        {uploading && (
                            <View className="flex-row items-center mb-3 bg-blue-50 rounded-xl p-3">
                                <ActivityIndicator size="small" color="#3B82F6" />
                                <Text className="text-sm text-blue-700 ml-2 font-medium">{t('uploading')}</Text>
                            </View>
                        )}

                        {images.length > 0 && (
                            <View className="flex-row flex-wrap gap-3">
                                {images.map((uri, index) => (
                                    <View key={index} className="relative">
                                        <Image source={{ uri }} className="w-28 h-28 rounded-2xl" />
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
                        )}
                    </View>
                </View>
            </ScrollView>

            <View className="bg-white px-6 pt-4 border-t border-gray-100" style={{ paddingBottom: insets.bottom + 16 }}>
                <Button
                    title={submitting ? t('submitting') : t('submit-contribution')}
                    onPress={handleSubmit}
                    disabled={submitting || !name.trim() || !coordinates}
                />
            </View>
        </View>
    );
}
