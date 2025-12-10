import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BottomSheet, Button } from '../../../shared/components';
import { colors } from '../../../shared/theme/colors';
import { INCIDENT_TYPES } from '../../incidents/types/incident.types';
import { useTranslation } from 'react-i18next';
import { getIncidentTranslationKey } from '../../incidents/utils/incidentTranslations';

interface ReportBottomSheetProps {
    userLocation: { lat: number; lng: number } | null;
    onIncidentReported?: () => void;
}

export const ReportBottomSheet: React.FC<ReportBottomSheetProps> = ({ userLocation, onIncidentReported }) => {
    const { t } = useTranslation();
    const router = useRouter();
    const [showReportOptions, setShowReportOptions] = useState(false);

    const handleOptionPress = (optionId: string) => {
        const params = new URLSearchParams({
            type: optionId,
            lat: userLocation?.lat.toString() || '',
            lng: userLocation?.lng.toString() || '',
            refresh: 'true',
        });
        router.push(`/incident-report?${params.toString()}`);
        setShowReportOptions(false);
    };

    return (
        <BottomSheet>
            {!showReportOptions ? (
                <View>
                    <Button
                        title={t('share-what-you-see')}
                        icon="+"
                        onPress={() => setShowReportOptions(true)}
                    />

                    <TouchableOpacity
                        className="bg-blue-500 rounded-xl py-4 items-center justify-center mt-3 "
                        onPress={() => router.push('/places/contribute')}
                        activeOpacity={0.8}
                    >
                        <Text className="text-white font-semibold text-xl">{t('contribute')}</Text>
                    </TouchableOpacity>

                    <Text className="text-2xl font-bold text-gray-800 mt-6">
                        {t('recents')}
                    </Text>
                </View>
            ) : (
                <View>
                    <View className="flex-row items-center mb-4">
                        <TouchableOpacity onPress={() => setShowReportOptions(false)} className="mr-3">
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

                    <View className="gap-2">
                        {INCIDENT_TYPES.map((option) => (
                            <TouchableOpacity
                                key={option.id}
                                className="bg-gray-50 rounded-xl p-4 flex-row items-center border-2"
                                style={{ borderColor: colors.primary.light }}
                                onPress={() => handleOptionPress(option.id)}
                                activeOpacity={0.7}
                            >
                                <View
                                    className="w-12 h-12 rounded-full items-center justify-center mr-3"
                                    style={{ backgroundColor: option.color + '20' }}
                                >
                                    <Ionicons name={option.icon} size={24} color={option.color} />
                                </View>
                                <Text className="text-lg font-bold text-gray-800 flex-1">
                                    {t(getIncidentTranslationKey(option.id as any))}
                                </Text>
                                <Ionicons name="chevron-forward" size={20} color={colors.primary.light} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}
        </BottomSheet>
    );
};
