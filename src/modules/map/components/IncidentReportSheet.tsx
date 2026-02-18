import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, BackHandler } from 'react-native';
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
    const [incidentTypes, setIncidentTypes] = React.useState(INCIDENT_TYPES);

    React.useEffect(() => {
        if (!isVisible) return;

        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            onClose();
            return true; 
        });

        return () => backHandler.remove();
    }, [isVisible, onClose]);

    React.useEffect(() => {
        const fetchIncidentTypes = async () => {
            try {
                const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/incidents/types`);
                if (response.ok) {
                    const types = await response.json();

                    const mappedTypes = types.map((type: any) => {
                        return {
                            id: type.id,
                            name: type.name,
                            label: type.label,
                            icon: INCIDENT_TYPES.find(t => t.name === type.name)?.icon || 'alert-circle',
                            color: INCIDENT_TYPES.find(t => t.name === type.name)?.color || '#F97316',
                        };
                    });
                    const sortedTypes = mappedTypes.sort((a: any, b: any) => {
                        if (a.name === 'OTHER') return 1;
                        if (b.name === 'OTHER') return -1;
                        return 0;
                    });

                    setIncidentTypes(sortedTypes);
                }
            } catch (error) {
                console.error('Failed to fetch incident types:', error);
            }
        };

        fetchIncidentTypes();
    }, []);

    const handleIncidentOptionPress = React.useCallback(
        (typeName: string) => {
            const params = new URLSearchParams({
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

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                    <View className="flex-row flex-wrap gap-3">
                        {incidentTypes.map((incidentType) => {
                            const incidentImageMap: Record<string, any> = {
                                'ROAD_CLOSURE': require('../../../../assets/images/closure.png'),
                                'ACCIDENT': require('../../../../assets/images/accident.png'),
                                'TRAFFIC_JAM': require('../../../../assets/images/traffic-jam.png'),
                                'BAD_WEATHER': require('../../../../assets/images/bad-weather.png'),
                                'HAZARD': require('../../../../assets/images/hazard.png'),
                                'CRASH': require('../../../../assets/images/crash.png'),
                                'GATED_COMMUNITY': require('../../../../assets/images/gated-community.png'),
                                'BROKEN_ROAD': require('../../../../assets/images/broken-road.png'),
                                'OTHER': require('../../../../assets/images/other.png'),
                            };

                            const imageSource = incidentImageMap[incidentType.name];

                            return (
                                <TouchableOpacity
                                    key={incidentType.name}
                                    className="bg-white rounded-2xl p-4 items-center border-2 border-gray-100 active:border-orange-200 active:bg-orange-50"
                                    onPress={() => handleIncidentOptionPress(incidentType.name)}
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
                                        className="w-16 h-16 items-center justify-center mb-3"
                                    >
                                        {imageSource ? (
                                            <Image
                                                source={imageSource}
                                                style={{
                                                    width: 48,
                                                    height: 48,
                                                }}
                                                resizeMode="contain"
                                            />
                                        ) : (
                                            <Ionicons name={incidentType.icon} size={28} color={incidentType.color} />
                                        )}
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
