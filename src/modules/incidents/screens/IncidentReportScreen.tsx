import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../shared/components';
import { useIncidentReport } from '../hooks/useIncidentReport';
import { IncidentType, INCIDENT_TYPES } from '../types/incident.types';
import { colors } from '../../../shared/theme/colors';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { getIncidentTranslationKey } from '../utils/incidentTranslations';

export default function IncidentReportScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const params = useLocalSearchParams();
    const incidentType = params.type as IncidentType;
    const passedLat = params.lat ? parseFloat(params.lat as string) : null;
    const passedLng = params.lng ? parseFloat(params.lng as string) : null;

    const [description, setDescription] = useState('');
    const { reportIncident, loading, error } = useIncidentReport();

    const incidentInfo = INCIDENT_TYPES.find((t) => t.id === incidentType);
    const location = passedLat && passedLng ? { lat: passedLat, lng: passedLng } : null;

    const handleSubmit = async () => {
        if (!location) {
            showToast.error('Location not available');
            return;
        }

        const incident = await reportIncident(incidentType, description.trim() || 'no description provided', location);

        if (incident) {
            showToast.success(t('incident-reported-successfully'));
            setTimeout(() => {
                router.push('/?refresh=true');
            }, 1000);
        } else if (error) {
            showToast.error(error);
        }
    };

    if (!incidentInfo) {
        return null;
    }

    return (
        <ScrollView className="flex-1 bg-white">
            <View className="px-6 pt-12 pb-6">
                <View
                    className="w-16 h-16 rounded-full items-center justify-center mb-4"
                    style={{ backgroundColor: incidentInfo.color + '20' }}
                >
                    <Ionicons name={incidentInfo.icon} size={32} color={incidentInfo.color} />
                </View>

                <Text className="text-3xl font-bold text-gray-800 mb-2">
                    {t('report')}: {t(getIncidentTranslationKey(incidentType))}
                </Text>

                {location ? (
                    <Text className="text-gray-500 mb-6">
                        {t('location')}: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                    </Text>
                ) : (
                    <Text className="text-gray-400 mb-6">{t('getting-location')}</Text>
                )}

                <Text className="text-sm font-semibold text-gray-700 mb-2">
                    {t('description')}
                </Text>

                <TextInput
                    className="bg-gray-50 border-2 rounded-xl p-4 text-base text-gray-800 min-h-32"
                    style={{ borderColor: colors.gray[200], textAlignVertical: 'top' }}
                    placeholder={t('describe-situation')}
                    placeholderTextColor={colors.gray[500]}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={6}
                    maxLength={500}
                />

                <Text className="text-gray-400 text-xs mt-2 mb-6">
                    {description.length}/500 {t('characters')}
                </Text>

                <Button
                    title={t('submit-report')}
                    onPress={handleSubmit}
                    disabled={!location}
                    loading={loading}
                />

                <Button
                    title={t('cancel')}
                    variant="outline"
                    onPress={() => router.back()}
                    style={{ marginTop: 12 }}
                />
            </View>
        </ScrollView>
    );
}
