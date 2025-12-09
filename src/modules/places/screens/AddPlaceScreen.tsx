import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Input, Button } from '../../../shared/components';
import { PLACE_TYPES, PlaceType } from '../types/place.types';
import { uploadToCloudinary } from '../../../shared/utils/cloudinary';
import { placeService } from '../services/place.service';
import { showToast } from '../../../shared/utils/toast';
import { useLocation } from '../../../shared/contexts/LocationContext';
import { useTranslation } from 'react-i18next';
import { getPlaceTranslationKey } from '../utils/placeTranslations';

export default function AddPlaceScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const params = useLocalSearchParams();
    const placeType = params.type as PlaceType;
    const { selectedLocation, setSelectedLocation } = useLocation();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
    const [images, setImages] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const placeInfo = PLACE_TYPES.find(p => p.id === placeType);

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
            const url = await uploadToCloudinary(uri);
            setImages(prev => [...prev, url]);
            showToast.success('Image uploaded', 'Photo added successfully');
        } catch (error) {
            showToast.error('Upload failed', 'Could not upload image');
        } finally {
            setUploading(false);
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
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
            console.log('Submitting place:', {
                name: name.trim(),
                type: placeType,
                lat: coordinates.lat,
                lng: coordinates.lng,
                description: description.trim(),
                images,
            });

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
        <View className="flex-1 bg-gray-50 ">
            <View className="bg-white px-4 py-6 border-b border-gray-200">
                <View className="flex-row items-center">
                    <View
                        className="w-12 h-12 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: `${placeInfo?.color}20` }}
                    >
                        <Text className="text-2xl">{placeInfo?.emoji}</Text>
                    </View>
                    <View>
                        <Text className="text-xl font-bold text-gray-900">
                            {placeType ? t(getPlaceTranslationKey(placeType)) : placeInfo?.label}
                        </Text>
                        <Text className="text-gray-600 text-sm">{t('fill-in-the-details')}</Text>
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1 p-4">
                <View className="gap-4">
                    <View>
                        <Text className="text-sm font-medium text-gray-700 mb-2">{t('place-name')} *</Text>
                        <Input
                            placeholder={t('place-name-placeholder')}
                            value={name}
                            onChangeText={setName}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-medium text-gray-700 mb-2">{t('description')}</Text>
                        <Input
                            placeholder={t('add-details-about-place')}
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-medium text-gray-700 mb-2">{t('location')}</Text>
                        <TouchableOpacity
                            className="bg-white border border-gray-300 rounded-xl p-4 flex-row items-center justify-between"
                            onPress={handlePickLocation}
                            activeOpacity={0.7}
                        >
                            <View className="flex-row items-center flex-1" pointerEvents="none">
                                <Ionicons name="location" size={24} color={coordinates ? '#10B981' : '#9CA3AF'} />
                                <Text className={`ml-3 ${coordinates ? 'text-gray-900' : 'text-gray-500'}`}>
                                    {coordinates
                                        ? `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`
                                        : t('pick-location-on-map')
                                    }
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>

                    <View>
                        <Text className="text-sm font-medium text-gray-700 mb-2">{t('photos')}</Text>

                        <View className="flex-row gap-3 mb-3">
                            <TouchableOpacity
                                className="bg-white border-2 border-dashed border-gray-300 rounded-xl w-24 h-24 items-center justify-center"
                                onPress={takePhoto}
                                disabled={uploading}
                            >
                                <Ionicons name="camera" size={32} color="#9CA3AF" />
                                <Text className="text-xs text-gray-500 mt-1">{t('camera')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                className="bg-white border-2 border-dashed border-gray-300 rounded-xl w-24 h-24 items-center justify-center"
                                onPress={pickImage}
                                disabled={uploading}
                            >
                                <Ionicons name="images" size={32} color="#9CA3AF" />
                                <Text className="text-xs text-gray-500 mt-1">{t('gallery')}</Text>
                            </TouchableOpacity>
                        </View>

                        {uploading && (
                            <View className="flex-row items-center mb-3">
                                <ActivityIndicator size="small" color="#3B82F6" />
                                <Text className="text-sm text-gray-600 ml-2">{t('uploading')}</Text>
                            </View>
                        )}

                        {images.length > 0 && (
                            <View className="flex-row flex-wrap gap-3">
                                {images.map((uri, index) => (
                                    <View key={index} className="relative">
                                        <Image
                                            source={{ uri }}
                                            className="w-24 h-24 rounded-xl"
                                        />
                                        <TouchableOpacity
                                            className="absolute -top-2 -right-2 bg-red-500 rounded-full w-6 h-6 items-center justify-center"
                                            onPress={() => removeImage(index)}
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

            <View className="bg-white p-4 border-t border-gray-200">
                <Button
                    title={submitting ? t('submitting') : t('submit-contribution')}
                    onPress={handleSubmit}
                    disabled={submitting || !name.trim() || !coordinates}
                />
            </View>
        </View>
    );
}
