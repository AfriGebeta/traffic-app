import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../../../shared/components';
import { INCIDENT_TYPES, IncidentType } from '../../incidents/types/incident.types';
import { getIncidentTranslationKey } from '../../incidents/utils/incidentTranslations';

interface IncidentReportSheetProps {
    isVisible: boolean;
    onClose: () => void;
    userLocation: { lat: number; lng: number } | null;
}

export const IncidentReportSheet: React.FC<IncidentReportSheetProps> = ({
    isVisible,
    onClose,
    userLocation,
}) => {
    const { t } = useTranslation();
    const router = useRouter();

    const handleIncidentOptionPress = React.useCallback(
        (optionId: string) => {
            const params = new URLSearchParams({
                type: optionId,
                lat: userLocation?.lat.toString() || '',
                lng: userLocation?.lng.toString() || '',
                refresh: 'true',
            });
            router.push(`/incident-report?${params.toString()}`);
            onClose();
        },
        [userLocation, router, onClose]
    );

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
                        <Text className="text-2xl font-bold text-gray-900">Share What You See</Text>
                        <Text className="text-gray-500 text-sm mt-1">
                            Help other drivers by reporting incidents
                        </Text>
                    </View>
                </View>

                {/* Incident Grid */}
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                    <View className="flex-row flex-wrap gap-3">
                        {INCIDENT_TYPES.map((option) => (
                            <TouchableOpacity
                                key={option.id}
                                className="bg-white rounded-2xl p-4 items-center border-2 border-gray-100 active:border-orange-200 active:bg-orange-50"
                                onPress={() => handleIncidentOptionPress(option.id)}
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
                                    style={{ backgroundColor: option.color + '15' }}
                                >
                                    <Ionicons name={option.icon} size={28} color={option.color} />
                                </View>
                                <Text className="text-base font-semibold text-gray-900 text-center">
                                    {t(getIncidentTranslationKey(option.id as IncidentType))}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </View>
        </BottomSheet>
    );
};
