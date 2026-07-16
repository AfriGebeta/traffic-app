import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ruleService } from '../services/rule.service';
import { TrafficRuleType } from '../types/rule.types';
import { useTranslation } from 'react-i18next';
import { RULE_TRANSLATION_MAP } from '../utils/ruleTranslations';
import { useTheme } from '../../../shared/theme/ThemeContext';

export default function RuleContributionScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { colors: theme, isDark } = useTheme();
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
            <View className="flex-1 pt-8" style={{ backgroundColor: theme.background }}>
                <View className="px-4 py-6" style={{ borderBottomWidth: 1, borderBottomColor: theme.background }}>
                    <View className="flex-row items-center mb-2">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="mr-4"
                            activeOpacity={0.7}
                        >
                            <Ionicons name="arrow-back" size={28} color={theme.primary} />
                        </TouchableOpacity>
                        <Text className="text-2xl font-bold" style={{ color: theme.textPrimary }}>{t('report-traffic-rule')}</Text>
                    </View>
                    <Text className="mt-2" style={{ color: theme.textSecondary }}>{t('report-traffic-rule-violations')}</Text>
                </View>

                <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 100 }}>
                    <View className="gap-3">
                        {[1, 2, 3, 4, 5, 6].map((index) => (
                            <View
                                key={index}
                                className="rounded-2xl p-6 shadow-sm flex-row items-center"
                                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                            >
                                <View className="w-16 h-16 mr-4 rounded-xl animate-pulse" style={{ backgroundColor: theme.border }} />
                                <View className="flex-1 gap-2">
                                    <View className="h-5 rounded w-3/4 animate-pulse" style={{ backgroundColor: theme.border }} />
                                    <View className="h-4 rounded w-full animate-pulse" style={{ backgroundColor: theme.border }} />
                                </View>
                                <View className="w-6 h-6 rounded animate-pulse" style={{ backgroundColor: theme.border }} />
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </View>
        );
    }

    return (
        <View className="flex-1 pt-8" style={{ backgroundColor: theme.background }}>
            <View className="px-4 py-6" style={{ borderBottomWidth: 1, borderBottomColor: theme.background }}>
                <View className="flex-row items-center mb-2">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="mr-4"
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={28} color={theme.primary} />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold" style={{ color: theme.textPrimary }}>{t('report-traffic-rule')}</Text>
                </View>
                <Text className="mt-2" style={{ color: theme.textSecondary }}>{t('report-traffic-rule-violations')}</Text>
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
                                className="rounded-2xl p-6 shadow-sm flex-row items-center"
                                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
                                onPress={() => handleRuleTypeSelect(ruleType)}
                            >
                                <View
                                    className="w-16 h-16 items-center justify-center mr-4 rounded-xl overflow-hidden"
                                    style={{ backgroundColor: isDark ? '#FFFFFF' : '#F3F4F6' }}
                                >
                                    <Image
                                        source={{ uri: ruleType.img }}
                                        style={{ width: 48, height: 48 }}
                                        resizeMode="contain"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-lg font-semibold" style={{ color: theme.textPrimary }}>
                                        {displayName}
                                    </Text>
                                    <Text className="text-sm mt-1" style={{ color: theme.textSecondary }} numberOfLines={2}>
                                        {displayDescription}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={24} color={theme.textSecondary} />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
}
