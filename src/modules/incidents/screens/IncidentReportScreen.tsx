import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../shared/components';
import { useIncidentReport } from '../hooks/useIncidentReport';
import { colors } from '../../../shared/theme/colors';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { getIncidentTranslationKey } from '../utils/incidentTranslations';

export default function IncidentReportScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const params = useLocalSearchParams();
    const incidentTypeId = params.typeId as string;
    const incidentTypeName = params.typeName as string;
    const passedLat = params.lat ? parseFloat(params.lat as string) : null;
    const passedLng = params.lng ? parseFloat(params.lng as string) : null;

    const [description, setDescription] = useState('');
    const [direction, setDirection] = useState('');
    const { reportIncident, loading, error } = useIncidentReport();

    const location = passedLat && passedLng ? { lat: passedLat, lng: passedLng } : null;

    const handleSubmit = async () => {
        if (!location) {
            showToast.error('Location not available');
            return;
        }

        const incident = await reportIncident(
            incidentTypeId,
            description.trim() || 'No description provided',
            location,
            direction.trim() || undefined
        );

        if (incident) {
            showToast.success(t('incident-reported-successfully'));
            setTimeout(() => {
                router.back();
            }, 500);
        } else if (error) {
            showToast.error(error);
        }
    };

    const iconName = incidentTypeName ? (incidentTypeName.toLowerCase().replace('_', '-')) : 'other';
    const color = colors.primary.main;

    return (
        <ScrollView className="flex-1 bg-white">
            <View className="px-6 pt-12 pb-6">
                <View
                    className="w-16 h-16 rounded-full items-center justify-center mb-4"
                    style={{ backgroundColor: color + '20' }}
                >
                    <Ionicons name="warning" size={32} color={color} />
                </View>

                <Text className="text-3xl font-bold text-gray-800 mb-2">
                    {t('report')}: {t(getIncidentTranslationKey(iconName))}
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
                    className="bg-gray-50 border-2 rounded-xl p-4 text-base text-gray-800 min-h-32 mb-4"
                    style={{ borderColor: colors.gray[200], textAlignVertical: 'top' }}
                    placeholder={t('describe-situation')}
                    placeholderTextColor={colors.gray[500]}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={6}
                    maxLength={500}
                />

                <Text className="text-gray-400 text-xs mb-4">
                    {description.length}/500 {t('characters')}
                </Text>

                <Text className="text-sm font-semibold text-gray-700 mb-2">
                    Direction (Optional)
                </Text>

                <TextInput
                    className="bg-gray-50 border-2 rounded-xl p-4 text-base text-gray-800 mb-6"
                    style={{ borderColor: colors.gray[200] }}
                    placeholder="e.g., North, South"
                    placeholderTextColor={colors.gray[500]}
                    value={direction}
                    onChangeText={setDirection}
                    maxLength={50}
                />

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
