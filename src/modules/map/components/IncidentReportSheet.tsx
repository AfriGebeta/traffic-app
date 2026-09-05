import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, BackHandler } from 'react-native';

import AccidentLightIcon from '../../../../assets/images/accident-light.svg';
import AccidentDarkIcon from '../../../../assets/images/accident-dark.svg';
import BadWeatherLightIcon from '../../../../assets/images/bad-weather-light.svg';
import BadWeatherDarkIcon from '../../../../assets/images/bad-weather-dark.svg';
import BrokenRoadLightIcon from '../../../../assets/images/broken-road-light.svg';
import BrokenRoadDarkIcon from '../../../../assets/images/broken-road-dark.svg';
import ClosureLightIcon from '../../../../assets/images/closure-light.svg';
import ClosureDarkIcon from '../../../../assets/images/closure-dark.svg';
import CrashLightIcon from '../../../../assets/images/crash-light.svg';
import CrashDarkIcon from '../../../../assets/images/crash-dark.svg';
import GatedCommunityLightIcon from '../../../../assets/images/gated-community-light.svg';
import GatedCommunityDarkIcon from '../../../../assets/images/gated-community-dark.svg';
import HazardLightIcon from '../../../../assets/images/hazard-light.svg';

import HazardDarkIcon from '../../../../assets/images/hazard-dark.svg';
import OtherLightIcon from '../../../../assets/images/other-light.svg';
import OtherDarkIcon from '../../../../assets/images/other-dark.svg';
import RadarLightIcon from '../../../../assets/images/radar-light.svg';
import RadarDarkIcon from '../../../../assets/images/radar-dark.svg';
import TrafficJamLightIcon from '../../../../assets/images/traffic-jam-light.svg';
import TrafficJamDarkIcon from '../../../../assets/images/traffic-jam-dark.svg';
import FloodLightIcon from '../../../../assets/images/flood-light.svg';
import FloodDarkIcon from '../../../../assets/images/flood-dark.svg';
import DangerTriangleIcon from '../../../../assets/images/Danger Triangle.svg';
import DarkDangerTriangleIcon from '../../../../assets/images/dark-report.svg';
import TrafficLightIcon from '../../../../assets/images/contribute-traffic-light.svg';
import TrafficDarkIcon from '../../../../assets/images/contribute-traffic-dark.svg';

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { BottomSheet } from '../../../shared/components';
import { INCIDENT_TYPES } from '../../incidents/types/incident.types';
import { getIncidentTranslationKey } from '../../incidents/utils/incidentTranslations';
import { getAppCheckToken } from '../../../shared/utils/appCheck';
import { useTheme } from '../../../shared/theme/ThemeContext';

type IncidentIcon = React.FC<{ width?: number; height?: number }>;

const INCIDENT_ICON_MAP: Record<string, { light: IncidentIcon; dark: IncidentIcon }> = {
    'ROAD_CLOSURE': { light: ClosureLightIcon, dark: ClosureDarkIcon },
    'ACCIDENT': { light: AccidentLightIcon, dark: AccidentDarkIcon },
    'TRAFFIC_JAM': { light: TrafficJamLightIcon, dark: TrafficJamDarkIcon },
    'BAD_WEATHER': { light: BadWeatherLightIcon, dark: BadWeatherDarkIcon },
    'HAZARD': { light: HazardLightIcon, dark: HazardDarkIcon },
    'CRASH': { light: CrashLightIcon, dark: CrashDarkIcon },
    'GATED_COMMUNITY': { light: GatedCommunityLightIcon, dark: GatedCommunityDarkIcon },
    'BROKEN_ROAD': { light: BrokenRoadLightIcon, dark: BrokenRoadDarkIcon },
    'RADAR': { light: RadarLightIcon, dark: RadarDarkIcon },
    'FLOOD': { light: FloodLightIcon, dark: FloodDarkIcon },
    'OTHER': { light: OtherLightIcon, dark: OtherDarkIcon },
};

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
    const [step, setStep] = React.useState<'choose' | 'incident'>(isNavigating ? 'choose' : 'incident');

    React.useEffect(() => {
        if (!isVisible) return;
        setStep(isNavigating ? 'choose' : 'incident');
    }, [isVisible, isNavigating]);

    React.useEffect(() => {
        if (!isVisible) return;

        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (isNavigating && step === 'incident') {
                setStep('choose');
                return true;
            }
            onClose();
            return true;
        });

        return () => backHandler.remove();
    }, [isVisible, onClose, isNavigating, step]);

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

    const handleContributeRulesPress = React.useCallback(() => {
        const params = new URLSearchParams({
            isNavigating: isNavigating.toString(),
            lat: userLocation?.lat.toString() || '',
            lng: userLocation?.lng.toString() || '',
        });
        onNavigateToReport?.();
        router.push(`/rules/contribute?${params.toString()}`);
        onClose();
    }, [router, onClose, onNavigateToReport, isNavigating, userLocation]);

    if (!isVisible) return null;

    if (step === 'choose') {
        const IncidentCardIcon = isDark ? DarkDangerTriangleIcon : DangerTriangleIcon;
        const RuleCardIcon = isDark ? TrafficDarkIcon : TrafficLightIcon;

        const chooserOptions = [
            {
                id: 'incident',
                titleKey: 'report-incidents',
                descriptionKey: 'help-other-drivers-by-reporting-incidents',
                Icon: IncidentCardIcon,
                onPress: () => setStep('incident'),
            },
            {
                id: 'rules',
                titleKey: 'report-traffic-rule',
                descriptionKey: 'report-traffic-rule-description',
                Icon: RuleCardIcon,
                onPress: handleContributeRulesPress,
            },
        ];

        return (
            <BottomSheet expandWhenOpen={true}>
                <View className="pb-4">
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
                                {t('choose-what-to-contribute')}
                            </Text>
                        </View>
                    </View>

                    <View className="gap-4">
                        {chooserOptions.map((option) => (
                            <TouchableOpacity
                                key={option.id}
                                className="rounded-2xl p-5"
                                style={{ backgroundColor: theme.surface, borderWidth: 2, borderColor: theme.border }}
                                onPress={option.onPress}
                                activeOpacity={0.7}
                            >
                                <View className="flex-row items-center">
                                    <View className="w-12 h-12 items-center justify-center mr-4">
                                        <option.Icon width={40} height={40} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-lg font-semibold mb-1" style={{ color: theme.textPrimary }}>
                                            {t(option.titleKey)}
                                        </Text>
                                        <Text className="text-sm" style={{ color: theme.textSecondary }}>
                                            {t(option.descriptionKey)}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={24} color={theme.textSecondary} />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </BottomSheet>
        );
    }

    return (
        <BottomSheet expandWhenOpen={true}>
            <View className="flex-1 pb-4">
                <View className="flex-row items-center mb-6">
                    <TouchableOpacity
                        onPress={() => (isNavigating ? setStep('choose') : onClose())}
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
