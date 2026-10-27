import React, { useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { showToast } from '../../../shared/utils/toast';
import { IncidentFiltersModal } from '../../incidents/components/IncidentFiltersModal';
import { useRulePreferences } from '../../rules/hooks/useRulePreferences';
import { NAV_MARKER_OPTIONS, setNavMarker, useNavMarker } from '../store/navMarkerStore';
import IncidentFiltersIcon from '../../../../assets/images/profile-incident-filters.svg';
import RulesIcon from '../../../../assets/images/profile-rules.svg';

const TILE_WIDTH = 76;
const TILE_HEIGHT = 64;

export default function PreferencesScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme, isDark } = useTheme();
    const selected = useNavMarker();
    const [showFiltersModal, setShowFiltersModal] = useState(false);
    const { preferences: rulePreferences, toggleShowOnMap } = useRulePreferences();

    const cardStyle = {
        backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isDark ? 0.35 : 0.08,
        shadowRadius: 8,
        elevation: 3,
    };

    const dividerStyle = {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    };

    return (
        <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
            <View className="px-4 py-4 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4" activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={26} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text className="text-xl font-bold flex-1" style={{ color: theme.textPrimary }} numberOfLines={1}>
                    {t('preferences')}
                </Text>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}>
                <Text className="font-bold text-base mb-3" style={{ color: theme.textPrimary }}>
                    {t('navigation-marker')}
                </Text>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginHorizontal: -20 }}
                    contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
                >
                    {NAV_MARKER_OPTIONS.map((option) => {
                        const isSelected = option.id === selected.id;
                        return (
                            <TouchableOpacity
                                key={option.id}
                                activeOpacity={0.7}
                                onPress={() => setNavMarker(option.id)}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: isSelected }}
                                accessibilityLabel={t(option.labelKey)}
                                style={{
                                    width: TILE_WIDTH,
                                    height: TILE_HEIGHT,
                                    borderRadius: 14,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: isSelected
                                        ? (isDark ? 'rgba(59, 130, 246, 0.22)' : '#E6F0FF')
                                        : theme.surface,
                                }}
                            >
                                <Image
                                    source={option.image}
                                    style={option.id === 'puck' ? { width: 30, height: 30 } : { width: 52, height: 52 }}
                                    resizeMode="contain"
                                />
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                <Text className="font-bold text-base mt-8 mb-3" style={{ color: theme.textPrimary }}>
                    {t('map-preferences')}
                </Text>
                <View className="overflow-hidden" style={cardStyle}>
                    <TouchableOpacity
                        className="flex-row items-center justify-between px-4 py-4"
                        activeOpacity={0.7}
                        onPress={() => setShowFiltersModal(true)}
                    >
                        <View className="flex-row items-center flex-1 mr-2">
                            <View className="mr-3">
                                <IncidentFiltersIcon width={18} height={18} color="#EF4444" />
                            </View>
                            <Text className="text-sm font-medium" style={{ color: theme.textPrimary }} numberOfLines={1}>
                                {t('incident-filters') || 'Incident Filters'}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>

                    <View className="h-px mx-4" style={dividerStyle} />

                    <TouchableOpacity
                        className="flex-row items-center justify-between px-4 py-4"
                        activeOpacity={0.7}
                        onPress={async () => {
                            try {
                                const newValue = await toggleShowOnMap();
                                showToast(
                                    newValue
                                        ? t('rules-shown-on-map')
                                        : t('rules-hidden-on-map')
                                );
                            } catch {
                                showToast(t('failed-to-update-settings'));
                            }
                        }}
                    >
                        <View className="flex-row items-center flex-1 mr-2">
                            <View className="mr-3">
                                <RulesIcon width={18} height={18} color="#F59E0B" />
                            </View>
                            <Text className="text-sm font-medium" style={{ color: theme.textPrimary }} numberOfLines={1}>
                                {t('show-rules-on-map')}
                            </Text>
                        </View>
                        <View
                            className="w-11 h-6 rounded-full justify-center"
                            style={{ backgroundColor: rulePreferences.showOnMap ? '#F59E0B' : (isDark ? '#333333' : '#E5E7EB') }}
                        >
                            <View className={`w-5 h-5 rounded-full bg-white ${rulePreferences.showOnMap ? 'ml-5' : 'ml-0.5'}`} />
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <IncidentFiltersModal
                visible={showFiltersModal}
                onClose={() => setShowFiltersModal(false)}
            />
        </View>
    );
}
