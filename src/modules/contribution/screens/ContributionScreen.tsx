import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../shared/theme/ThemeContext';

export default function ContributionScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();

    const contributionOptions = [
        {
            id: 'places',
            titleKey: 'contribute-place',
            descriptionKey: 'contribute-place-description',
            image: require('../../../../assets/images/places.png'),
            route: '/places/contribute',
        },
        {
            id: 'neighborhoods',
            titleKey: 'contribute-neighborhood',
            descriptionKey: 'contribute-neighborhood-description',
            image: require('../../../../assets/images/neighborhood.png'),
            route: '/neighborhoods/contribute',
        },
        {
            id: 'rules',
            titleKey: 'report-traffic-rule',
            descriptionKey: 'report-traffic-rule-description',
            image: require('../../../../assets/images/rules.png'),
            route: '/rules/contribute',
        },
        {
            id: 'taxi',
            titleKey: 'contribute-taxi-info',
            descriptionKey: 'contribute-taxi-info-description',
            image: require('../../../../assets/images/taxi-station-place.png'),
            route: '/taxi/build-route',
        },
    ];

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: theme.background }}>
            <View className="px-4 py-6" style={{ borderBottomWidth: 1, borderBottomColor: theme.background }}>
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="mr-4"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={28} color={theme.primary} />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold" style={{ color: theme.textPrimary }}>{t('contribute')}</Text>
                </View>
                <Text className="mt-2" style={{ color: theme.textSecondary }}>{t('choose-what-to-contribute')}</Text>
            </View>

            <ScrollView className="flex-1 p-4">
                <View className="gap-4">
                    {contributionOptions.map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            className="rounded-2xl p-6 shadow-sm"
                            style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
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
                                    <Text className="text-xl font-semibold mb-1" style={{ color: theme.textPrimary }}>
                                        {t(option.titleKey)}
                                    </Text>
                                    <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                        {t(option.descriptionKey)}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={24} color={theme.textSecondary} />
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
