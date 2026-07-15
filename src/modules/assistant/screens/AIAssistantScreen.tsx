import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AiIcon from '../../../../assets/images/ai-icon.svg';

export default function AIAssistantScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    return (
        <View className="flex-1 bg-white" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
            <View className="flex-row items-center justify-between px-4 py-4">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="flex-row items-center"
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back" size={22} color="#111827" />
                    <Text className="text-base text-gray-900 ml-1">{t('welcome')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    className="rounded-full border border-gray-200 px-4 py-2"
                    activeOpacity={0.7}
                >
                    <Text className="text-xs text-gray-700">{t('language-model')}</Text>
                </TouchableOpacity>
            </View>

            <View className="flex-1 items-center justify-center px-8">
                <AiIcon width={100} height={106} />

                <Text className="text-4xl font-extrabold text-center mt-6 leading-[44px]">
                    <Text className="text-gray-900">{t('ai-greeting-part1')}</Text>
                    <Text style={{ color: '#FFA500' }}>{t('ai-greeting-highlight1')}</Text>
                    <Text className="text-gray-900">{t('ai-greeting-part2')}</Text>
                    <Text style={{ color: '#FFA500' }}>{t('ai-greeting-highlight2')}</Text>
                    <Text className="text-gray-900">{t('ai-greeting-part3')}</Text>
                </Text>
            </View>

            <View className="items-center pb-6">
                <TouchableOpacity
                    className="items-center justify-center rounded-full"
                    style={{ width: 72, height: 72, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FFA500' }}
                    activeOpacity={0.7}
                >
                    <Ionicons name="mic" size={30} color="#FFA500" />
                </TouchableOpacity>
            </View>
        </View>
    );
}
