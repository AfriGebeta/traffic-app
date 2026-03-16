import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input, Button } from '../../../shared/components';
import { ruleService } from '../services/rule.service';
import { showToast } from '../../../shared/utils/toast';
import { useLocation } from '../../../shared/contexts/LocationContext';
import { useTranslation } from 'react-i18next';

export default function AddRuleReportScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { typeId, typeName, typeDescription, typeImg } = params;
    const { selectedLocation } = useLocation();

    const insets = useSafeAreaInsets();
    const [punishment, setPunishment] = useState('');
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useFocusEffect(
        React.useCallback(() => {
            if (selectedLocation) {
                setCoordinates(selectedLocation);
            }
        }, [selectedLocation])
    );

    const handlePickLocation = () => {
        router.push('/rules/map-picker');
    };

    const handleSubmit = async () => {
        if (!punishment.trim()) {
            showToast.error(t('punishment-required'), t('enter-punishment-details'));
            return;
        }

        if (!coordinates) {
            showToast.error(t('location-required'), t('pick-location'));
            return;
        }

        setSubmitting(true);
        try {
            await ruleService.reportRule({
                lat: coordinates.lat,
                lng: coordinates.lng,
                typeId: typeId as string,
                punishment: punishment.trim(),
            });

            showToast.success(t('success'), t('traffic-rule-report-submitted'));
            router.back();
            router.back();
        } catch (error) {
            console.error('Submit error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Could not submit report';
            showToast.error(t('error'), errorMessage);
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
                    <Text className="text-xl font-bold text-gray-900">{t('report-traffic-rule')}</Text>
                </View>
            </View>

            <View className="bg-white mx-6 mt-6 mb-4 rounded-2xl p-4 border border-gray-100">
                <View className="flex-row items-center">
                    <View className="w-14 h-14 items-center justify-center mr-4 bg-gray-100 rounded-xl overflow-hidden">
                        {typeImg && typeof typeImg === 'string' && typeImg.length > 0 ? (
                            <Image
                                source={{ uri: typeImg }}
                                style={{ width: 48, height: 48 }}
                                resizeMode="contain"
                            />
                        ) : (
                            <Ionicons name="shield-checkmark" size={32} color="#EF4444" />
                        )}
                    </View>
                    <View className="flex-1">
                        <Text className="text-lg font-bold text-gray-900">{typeName || 'Traffic Rule'}</Text>
                        <Text className="text-gray-500 text-sm" numberOfLines={2}>
                            {typeDescription || 'Report a traffic rule violation'}
                        </Text>
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                <View className="gap-5 pb-6">
                    <View>
                        <Text className="text-sm font-semibold text-gray-700 mb-2">
                            {t('punishment')} <Text className="text-orange-500">*</Text>
                        </Text>
                        <Input
                            placeholder={t('punishment-placeholder')}
                            value={punishment}
                            onChangeText={setPunishment}
                            multiline
                            numberOfLines={3}
                        />
                        <Text className="text-xs text-gray-500 mt-1">
                            {t('punishment-description')}
                        </Text>
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
                                        {coordinates ? t('location-selected') : t('pick-location-on-map')}
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
                </View>
            </ScrollView>

            <View className="bg-white px-6 pt-4 border-t border-gray-100" style={{ paddingBottom: insets.bottom + 16 }}>
                <Button
                    title={submitting ? t('submitting') : t('submit-report')}
                    onPress={handleSubmit}
                    disabled={submitting || !punishment.trim() || !coordinates}
                />
            </View>
        </View>
    );
}
