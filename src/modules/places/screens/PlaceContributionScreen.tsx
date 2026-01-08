import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PLACE_TYPES } from '../types/place.types';
import { useTranslation } from 'react-i18next';
import { getPlaceTranslationKey } from '../utils/placeTranslations';

export default function PlaceContributionScreen() {
    const router = useRouter();
    const { t } = useTranslation();

    const handlePlaceTypeSelect = (placeType: string) => {
        router.push({
            pathname: '/places/add',
            params: { type: placeType },
        });
    };

    return (
        <View className="flex-1 bg-gray-50 mt-8">
            <View className="px-4 py-6 border-b border-gray-50">
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="mr-4"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={28} color="#FFA500" />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-gray-900">{t('contribute-a-place')}</Text>
                </View>
                <Text className="text-gray-600 mt-2">{t('help-others-by-adding-useful-locations')}</Text>
            </View>

            <ScrollView className="flex-1 p-4">
                <View className="gap-3">
                    {PLACE_TYPES.map((placeType) => (
                        <TouchableOpacity
                            key={placeType.id}
                            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex-row items-center"
                            onPress={() => handlePlaceTypeSelect(placeType.id)}
                        >
                            <View
                                className="w-16 h-16 rounded-full items-center justify-center mr-4"
                                style={{ backgroundColor: `${placeType.color}20` }}
                            >
                                <Text className="text-3xl">{placeType.emoji}</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="text-lg font-semibold text-gray-900">
                                    {t(getPlaceTranslationKey(placeType.id))}
                                </Text>
                                <Text className="text-gray-500 text-sm mt-1">
                                    {t('add-new')} {t(getPlaceTranslationKey(placeType.id)).toLowerCase()}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
