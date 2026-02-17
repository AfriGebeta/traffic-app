import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../../../shared/components';
import { PLACE_TYPES, PlaceType } from '../types/place.types';
import { getPlaceTranslationKey } from '../utils/placeTranslations';

interface PlaceContributionSheetProps {
    isVisible: boolean;
    onClose: () => void;
}

export const PlaceContributionSheet: React.FC<PlaceContributionSheetProps> = ({
    isVisible,
    onClose,
}) => {
    const { t } = useTranslation();
    const router = useRouter();

    const handlePlaceTypeSelect = (placeType: string) => {
        router.push({
            pathname: '/places/add',
            params: { type: placeType },
        });
        onClose();
    };

    if (!isVisible) return null;

    return (
        <BottomSheet expandWhenOpen={true}>
            <View className="pb-4">
                <View className="flex-row items-center mb-6">
                    <TouchableOpacity
                        onPress={onClose}
                        className="mr-4 bg-gray-100 rounded-full p-2"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={22} color="#374151" />
                    </TouchableOpacity>
                    <View className="flex-1">
                        <Text className="text-2xl font-bold text-gray-900">{t('contribute-a-place')}</Text>
                        <Text className="text-gray-500 text-sm mt-1">
                            {t('help-others-by-adding-useful-locations')}
                        </Text>
                    </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                    <View className="flex-row flex-wrap gap-3">
                        {PLACE_TYPES.map((placeType) => {
                            const placeImageMap: Record<string, any> = {
                                'gas_station': require('../../../../assets/images/gas-station-place.png'),
                                'taxi_station': require('../../../../assets/images/taxi-station-place.png'),
                                'repair_shop': require('../../../../assets/images/repair-shop-place.png'),
                                'restaurant': require('../../../../assets/images/restaurant-place.png'),
                                'parking': require('../../../../assets/images/parking-place.png'),
                                'hospital': require('../../../../assets/images/hospital-place.png'),
                                'other': require('../../../../assets/images/other-place.png'),
                            };

                            const imageSource = placeImageMap[placeType.id];

                            return (
                                <TouchableOpacity
                                    key={placeType.id}
                                    className="bg-white rounded-2xl p-4 items-center border-2 border-gray-100 active:border-orange-200 active:bg-orange-50"
                                    onPress={() => handlePlaceTypeSelect(placeType.id)}
                                    activeOpacity={0.7}
                                    style={{
                                        width: '48%',
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.05,
                                        shadowRadius: 8,
                                        elevation: 2,
                                    }}
                                >
                                    <View
                                        className="w-16 h-16 rounded-2xl items-center justify-center mb-3"
                                        style={{ backgroundColor: placeType.color + '15' }}
                                    >
                                        <Image
                                            source={imageSource}
                                            style={{ width: 48, height: 48 }}
                                            resizeMode="contain"
                                        />
                                    </View>
                                    <Text className="text-base font-semibold text-gray-900 text-center">
                                        {t(getPlaceTranslationKey(placeType.id as PlaceType))}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>
        </BottomSheet>
    );
};
