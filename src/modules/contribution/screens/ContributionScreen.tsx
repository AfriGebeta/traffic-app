import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function ContributionScreen() {
    const router = useRouter();
    const { t } = useTranslation();

    const contributionOptions = [
        {
            id: 'places',
            titleKey: 'contribute-place',
            descriptionKey: 'contribute-place-description',
            image: require('../../../../assets/images/places.png'),
            route: '/places/contribute',
        },
        {
            id: 'rules',
            titleKey: 'report-traffic-rule',
            descriptionKey: 'report-traffic-rule-description',
            image: require('../../../../assets/images/rules.png'),
            route: '/rules/contribute',
        },
    ];

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
                    <Text className="text-2xl font-bold text-gray-900">{t('contribute')}</Text>
                </View>
                <Text className="text-gray-600 mt-2">{t('choose-what-to-contribute')}</Text>
            </View>

            <ScrollView className="flex-1 p-4">
                <View className="gap-4">
                    {contributionOptions.map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
                            onPress={() => router.push(option.route as any)}
                            activeOpacity={0.7}
                        >
                            <View className="flex-row items-center">
                                <View className="w-16 h-16 items-center justify-center mr-4">
                                    <Image
                                        source={option.image}
                                        style={{ width: 64, height: 64 }}
                                        resizeMode="contain"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-xl font-semibold text-gray-900 mb-1">
                                        {t(option.titleKey)}
                                    </Text>
                                    <Text className="text-gray-500 text-sm">
                                        {t(option.descriptionKey)}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
