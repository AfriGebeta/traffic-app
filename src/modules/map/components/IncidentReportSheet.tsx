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
import { ReportLocation } from '../../../shared/utils/reportHeading';
import { FONT_MEDIUM, RADIUS, RADIUS_SM } from '../../campaigns/components/CampaignUi';

interface IncidentReportSheetProps {
    isVisible: boolean;
    onClose: () => void;
    userLocation: ReportLocation | null;
    isNavigating?: boolean;
    onNavigateToReport?: () => void;
    onIncidentReported?: () => void;
}

export const IncidentReportSheet: React.FC<IncidentReportSheetProps> = ({
    isVisible,
    onClose,
    userLocation,
    isNavigating = false,
    onNavigateToReport,
    onIncidentReported,
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
                heading: userLocation?.heading?.toString() ?? '',
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
                onIncidentReported={onIncidentReported}
            />
        );
    }

    return (
        <BottomSheet expandWhenOpen={true} onBackdropPress={onClose}>
            <View className="flex-1 pb-4">
                <View className="flex-row items-start mb-5">
                    <TouchableOpacity
                        onPress={onClose}
                        className="mr-3 items-center justify-center"
                        style={{ width: 36, height: 36, borderRadius: RADIUS_SM, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}
                        activeOpacity={0.7}
                        hitSlop={6}
                    >
                        <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <View className="flex-1">
                        <Text style={{ color: theme.textPrimary, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 }}>{t('share-what-you-see')}</Text>
                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
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
                                    className="p-4 items-center justify-center"
                                    onPress={() => handleIncidentOptionPress(incidentType.name)}
                                    activeOpacity={0.7}
                                    // flat tiles: hairline border, no shadow
                                    style={{
                                        borderRadius: RADIUS,
                                        backgroundColor: theme.surface,
                                        borderWidth: 1,
                                        borderColor: theme.border,
                                        width: '48%',
                                        minHeight: 116,
                                    }}
                                >
                                    <View
                                        className="w-14 h-14 items-center justify-center mb-2"
                                    >
                                        {IncidentSvgIcon ? (
                                            <IncidentSvgIcon width={44} height={44} />
                                        ) : (
                                            <Ionicons name={incidentType.icon} size={28} color={incidentType.color} />
                                        )}
                                    </View>
                                    <View style={{ width: '100%', paddingHorizontal: 4 }}>
                                        <Text
                                            className="text-sm text-center"
                                            style={{ color: theme.textPrimary, fontFamily: FONT_MEDIUM }}
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
