import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { BottomSheet } from '../../../shared/components';
import { INCIDENT_TYPES } from '../../incidents/types/incident.types';
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
        (typeId: string, typeName: string) => {
            const params = new URLSearchParams({
                typeId: typeId,
                typeName: typeName,
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
                        <Text className="text-2xl font-bold text-gray-900">{t('share-what-you-see')}</Text>
                        <Text className="text-gray-500 text-sm mt-1">
                            {t('help-other-drivers-by-reporting-incidents')}
                        </Text>
                    </View>
                </View>

                {/* Incident Grid */}
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                    <View className="flex-row flex-wrap gap-3">
                        {INCIDENT_TYPES.map((incidentType) => {
                            return (
                                <TouchableOpacity
                                    key={incidentType.name}
                                    className="bg-white rounded-2xl p-4 items-center border-2 border-gray-100 active:border-orange-200 active:bg-orange-50"
                                    onPress={() => handleIncidentOptionPress(incidentType.id, incidentType.name)}
                                    activeOpacity={0.7}
                                    style={{
                                        width: '48%',
                                        minHeight: 120,
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.05,
                                        shadowRadius: 8,
                                        elevation: 2,
                                    }}
                                >
                                    <View
                                        className="w-16 h-16 rounded-2xl items-center justify-center mb-3"
                                        style={{ backgroundColor: incidentType.color + '15' }}
                                    >
                                        <Ionicons name={incidentType.icon} size={28} color={incidentType.color} />
                                    </View>
                                    <View style={{ width: '100%', paddingHorizontal: 4 }}>
                                        <Text
                                            className="text-sm font-semibold text-gray-900 text-center"
                                            numberOfLines={2}
                                            ellipsizeMode="tail"
                                        >
                                            {t(getIncidentTranslationKey(incidentType.name))}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>
        </BottomSheet>
    );
};
