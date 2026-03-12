import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../../shared/hooks/useTranslation';
import { useIncidentFiltersContext } from '../context/IncidentFiltersContext';
import { INCIDENT_TYPES } from '../types/incident.types';
import { getIncidentTranslationKey } from '../utils/incidentTranslations';
import { colors } from '../../../shared/theme/colors';

interface IncidentFiltersModalProps {
    visible: boolean;
    onClose: () => void;
}

export const IncidentFiltersModal = ({ visible, onClose }: IncidentFiltersModalProps) => {
    const { t } = useTranslation();
    const { toggleType, isTypeEnabled, loading: filtersLoading } = useIncidentFiltersContext();
    const insets = useSafeAreaInsets();

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-white rounded-t-3xl" style={{ maxHeight: '80%' }}>
                    <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                        <View className="flex-row items-center">
                            <Ionicons name="filter" size={24} color="#1f2937" />
                            <Text className="text-xl font-bold text-gray-900 ml-3">
                                {t('incident-filters') || 'Incident Filters'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2">
                            <Ionicons name="close" size={24} color="#6b7280" />
                        </TouchableOpacity>
                    </View>

                    <View className="px-6 pt-4 pb-2">
                        <Text className="text-gray-600 text-sm">
                            {t('select-incidents-to-see') || 'Select which incident types you want to see on the map'}
                        </Text>
                    </View>

                    <ScrollView
                        className="px-6 py-4"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 5 }}
                    >
                        <View className="flex-row flex-wrap gap-3">
                            {INCIDENT_TYPES.map((type) => {
                                const enabled = isTypeEnabled(type.name);
                                return (
                                    <TouchableOpacity
                                        key={type.name}
                                        onPress={() => toggleType(type.name)}
                                        className="px-4 py-3 flex-row items-center bg-white"
                                        style={{
                                            borderWidth: 2,
                                            borderColor: enabled ? colors.primary.main : '#e5e7eb',
                                            borderRadius: 999,
                                            width: '48%',
                                        }}
                                        disabled={filtersLoading}
                                    >
                                        <Ionicons
                                            name={enabled ? 'checkmark-circle' : 'ellipse-outline'}
                                            size={18}
                                            color={enabled ? colors.primary.main : '#9ca3af'}
                                        />
                                        <View style={{ flex: 1, paddingLeft: 8 }}>
                                            <Text
                                                className="text-sm font-semibold"
                                                style={{
                                                    color: enabled ? colors.primary.main : '#6b7280',
                                                }}
                                                numberOfLines={2}
                                                ellipsizeMode="tail"
                                            >
                                                {t(getIncidentTranslationKey(type.name))}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>

                    <View
                        className="px-6 border-t border-gray-100"
                        style={{ paddingTop: 16, paddingBottom: Math.max(insets.bottom + 16, 47) }}
                    >
                        <TouchableOpacity
                            onPress={onClose}
                            className="rounded-full py-4 px-8 items-center justify-center"
                            style={{ backgroundColor: colors.primary.main, minWidth: '100%' }}
                        >
                            <Text
                                className="text-white font-semibold text-base"
                                numberOfLines={1}
                                adjustsFontSizeToFit
                            >
                                {t('ok')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
