import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, BackHandler } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { BottomSheet } from '../../../shared/components';
import { INCIDENT_TYPES } from '../../incidents/types/incident.types';
import { getIncidentTranslationKey } from '../../incidents/utils/incidentTranslations';
import { getAppCheckToken } from '../../../shared/utils/appCheck';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { INCIDENT_SVG_ICON_MAP as INCIDENT_ICON_MAP } from './incidentIcons';
import { QuickReportSheet } from './QuickReportSheet';

interface IncidentReportSheetProps {
    isVisible: boolean;
    onClose: () => void;
    userLocation: { lat: number; lng: number } | null;
    isNavigating?: boolean;
    onNavigateToReport?: () => void;
}

export const IncidentReportSheet: React.FC<IncidentReportSheetProps> = ({
    isVisible,
    onClose,
    userLocation,
    isNavigating = false,
    onNavigateToReport,
}) => {
    const { t } = useTranslation();
    const router = useRouter();
    const { colors: theme, isDark } = useTheme();
    const [incidentTypes, setIncidentTypes] = React.useState(INCIDENT_TYPES);
    React.useEffect(() => {
        // navigation mode: QuickReportSheet owns the back button
        if (!isVisible || isNavigating) return;

        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            onClose();
            return true;
        });

        return () => backHandler.remove();
    }, [isVisible, onClose, isNavigating]);

    React.useEffect(() => {
        const fetchIncidentTypes = async () => {
            try {
                const appCheckToken = await getAppCheckToken();
                const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/incidents/types`, {
                    headers: {
                        ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
                    },
                });
                if (response.ok) {
                    const types = await response.json();

                    const mappedTypes = types
                        .filter((type: any) => INCIDENT_ICON_MAP[type.name])
                        .map((type: any) => {
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
                isNavigating: isNavigating.toString(),
            });
            onNavigateToReport?.();
            router.push(`/incident-report?${params.toString()}`);
            onClose();
        },
        [userLocation, router, onClose, isNavigating, onNavigateToReport]
    );

    if (!isVisible) return null;

    if (isNavigating) {
        return (
            <QuickReportSheet
                incidentTypes={incidentTypes}
                onClose={onClose}
                userLocation={userLocation}
                onNavigateToReport={onNavigateToReport}
            />
        );
    }

    return (
        <BottomSheet expandWhenOpen={true}>
            <View className="flex-1 pb-4">
                <View className="flex-row items-center mb-6">
                    <TouchableOpacity
                        onPress={onClose}
                        className="mr-4 rounded-full p-2"
                        style={{ backgroundColor: isDark ? theme.surface : '#F3F4F6' }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <View className="flex-1">
                        <Text className="text-2xl font-bold" style={{ color: theme.textPrimary }}>{t('share-what-you-see')}</Text>
                        <Text className="text-sm mt-1" style={{ color: theme.textSecondary }}>
                            {t('help-other-drivers-by-reporting-incidents')}
                        </Text>
                    </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                    <View className="flex-row flex-wrap gap-3">
                        {incidentTypes.map((incidentType) => {
                            const iconPair = INCIDENT_ICON_MAP[incidentType.name];
                            const IncidentSvgIcon = iconPair ? (isDark ? iconPair.dark : iconPair.light) : null;

                            return (
                                <TouchableOpacity
                                    key={incidentType.name}
                                    className="rounded-2xl p-4 items-center"
                                    onPress={() => handleIncidentOptionPress(incidentType.name)}
                                    activeOpacity={0.7}
                                    style={{
                                        backgroundColor: theme.surface,
                                        borderWidth: 2,
                                        borderColor: theme.border,
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
                                        {IncidentSvgIcon ? (
                                            <IncidentSvgIcon width={48} height={48} />
                                        ) : (
                                            <Ionicons name={incidentType.icon} size={28} color={incidentType.color} />
                                        )}
                                    </View>
                                    <View style={{ width: '100%', paddingHorizontal: 4 }}>
                                        <Text
                                            className="text-sm font-semibold text-center"
                                            style={{ color: theme.textPrimary }}
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
