import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { showToast } from '../../../shared/utils/toast';

export const QuickActions: React.FC = () => {
    const { t } = useTranslation();

    return (
        <View className="flex-row gap-2 mt-2 justify-around">
            <TouchableOpacity
                className="bg-white rounded-full px-3 py-2 shadow-md flex-row items-center gap-1.5"
                onPress={() => showToast.info(t('coming-soon'), t('gas-station'))}
            >
                <Ionicons name="water" size={16} color="#EF4444" />
                <Text className="text-xs font-medium text-gray-700">{t('gas-station')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
                className="bg-white rounded-full px-3 py-2 shadow-md flex-row items-center gap-1.5"
                onPress={() => showToast.info(t('coming-soon'), t('taxi-station'))}
            >
                <Ionicons name="car" size={16} color="#3B82F6" />
                <Text className="text-xs font-medium text-gray-700">{t('taxi-station')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
                className="bg-white rounded-full px-3 py-2 shadow-md flex-row items-center gap-1.5"
                onPress={() => showToast.info(t('coming-soon'), t('repair-shop'))}
            >
                <Ionicons name="construct" size={16} color="#F59E0B" />
                <Text className="text-xs font-medium text-gray-700">{t('repair-shop')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
                className="bg-white rounded-full px-3 py-2 shadow-md flex-row items-center gap-1.5"
                onPress={() => showToast.info(t('coming-soon'), t('restaurants'))}
            >
                <Ionicons name="fast-food-outline" size={16} color="#EC4899" />
                <Text className="text-xs font-medium text-gray-700">{t('restaurants')}</Text>
            </TouchableOpacity>
        </View>
    );
};
