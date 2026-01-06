import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../../../shared/components';
import { INCIDENT_TYPES, IncidentType } from '../../incidents/types/incident.types';
import { getIncidentTranslationKey } from '../../incidents/utils/incidentTranslations';
import { colors } from '../../../shared/theme/colors';

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
            <View>
                <View className="flex-row items-center mb-4">
                    <TouchableOpacity onPress={onClose} className="mr-3">
                        <Ionicons name="arrow-back" size={24} color={colors.primary.main} />
                    </TouchableOpacity>
                    <View className="flex-1">
                        <Text className="text-2xl font-bold" style={{ color: colors.primary.main }}>
                            {t('share-what-you-see')}
                        </Text>
                        <Text className="text-gray-500 text-sm mt-1">
                            {t('select-the-type-of-incident-to-other-drivers')}
                        </Text>
                    </View>
                </View>

                <ScrollView className="gap-2">
                    {INCIDENT_TYPES.map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            className="bg-gray-50 rounded-xl p-4 flex-row items-center border-2 mb-2"
                            style={{ borderColor: colors.primary.light }}
                            onPress={() => handleIncidentOptionPress(option.id)}
                            activeOpacity={0.7}
                        >
                            <View
                                className="w-12 h-12 rounded-full items-center justify-center mr-3"
                                style={{ backgroundColor: option.color + '20' }}
                            >
                                <Ionicons name={option.icon} size={24} color={option.color} />
                            </View>
                            <Text className="text-lg font-bold text-gray-800 flex-1">
                                {t(getIncidentTranslationKey(option.id as IncidentType))}
                            </Text>
                            <Ionicons name="chevron-forward" size={20} color={colors.primary.light} />
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </BottomSheet>
    );
};
