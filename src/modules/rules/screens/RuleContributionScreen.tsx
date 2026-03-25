import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ruleService } from '../services/rule.service';
import { TrafficRuleType } from '../types/rule.types';
import { useTranslation } from 'react-i18next';
import { RULE_TRANSLATION_MAP } from '../utils/ruleTranslations';

export default function RuleContributionScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const [ruleTypes, setRuleTypes] = useState<TrafficRuleType[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadRuleTypes();
    }, []);

    const loadRuleTypes = async () => {
        try {
            const types = await ruleService.getRuleTypes();
            setRuleTypes(types);
        } catch (error) {
            console.error('Failed to load rule types:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRuleTypeSelect = (ruleType: TrafficRuleType) => {
        const translationKeys = RULE_TRANSLATION_MAP[ruleType.name];
        const displayName = translationKeys ? t(translationKeys.name) : ruleType.name;
        const displayDescription = translationKeys ? t(translationKeys.description) : ruleType.description;

        router.push({
            pathname: '/rules/add',
            params: {
                typeId: ruleType.id,
                typeName: displayName,
                typeDescription: displayDescription,
                typeImg: ruleType.img,
            },
        });
    };

    if (loading) {
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
                        <Text className="text-2xl font-bold text-gray-900">{t('report-traffic-rule')}</Text>
                    </View>
                    <Text className="text-gray-600 mt-2">{t('report-traffic-rule-violations')}</Text>
                </View>

                <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 100 }}>
                    <View className="gap-3">
                        {[1, 2, 3, 4, 5, 6].map((index) => (
                            <View
                                key={index}
                                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex-row items-center"
                            >
                                <View className="w-16 h-16 mr-4 bg-gray-200 rounded-xl animate-pulse" />
                                <View className="flex-1 gap-2">
                                    <View className="h-5 bg-gray-200 rounded w-3/4 animate-pulse" />
                                    <View className="h-4 bg-gray-200 rounded w-full animate-pulse" />
                                </View>
                                <View className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </View>
        );
    }

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
                    <Text className="text-2xl font-bold text-gray-900">{t('report-traffic-rule')}</Text>
                </View>
                <Text className="text-gray-600 mt-2">{t('report-traffic-rule-violations')}</Text>
            </View>

            <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 100 }}>
                <View className="gap-3">
                    {ruleTypes.map((ruleType) => {
                        const translationKeys = RULE_TRANSLATION_MAP[ruleType.name];
                        const displayName = translationKeys ? t(translationKeys.name) : ruleType.name;
                        const displayDescription = translationKeys ? t(translationKeys.description) : ruleType.description;

                        return (
                            <TouchableOpacity
                                key={ruleType.id}
                                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex-row items-center"
                                onPress={() => handleRuleTypeSelect(ruleType)}
                            >
                                <View className="w-16 h-16 items-center justify-center mr-4 bg-gray-100 rounded-xl overflow-hidden">
                                    <Image
                                        source={{ uri: ruleType.img }}
                                        style={{ width: 48, height: 48 }}
                                        resizeMode="contain"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-lg font-semibold text-gray-900">
                                        {displayName}
                                    </Text>
                                    <Text className="text-gray-500 text-sm mt-1" numberOfLines={2}>
                                        {displayDescription}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
}
