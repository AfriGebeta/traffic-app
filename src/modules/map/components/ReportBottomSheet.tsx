import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BottomSheet, Button } from '../../../shared/components';
import { colors } from '../../../shared/theme/colors';
import { INCIDENT_TYPES } from '../../incidents/types/incident.types';

interface ReportBottomSheetProps {
    userLocation: { lat: number; lng: number } | null;
}

export const ReportBottomSheet: React.FC<ReportBottomSheetProps> = ({ userLocation }) => {
    const router = useRouter();
    const [showReportOptions, setShowReportOptions] = useState(false);

    const handleOptionPress = (optionId: string) => {
        const params = new URLSearchParams({
            type: optionId,
            lat: userLocation?.lat.toString() || '',
            lng: userLocation?.lng.toString() || '',
        });
        router.push(`/incident-report?${params.toString()}`);
        setShowReportOptions(false);
    };

    return (
        <BottomSheet>
            {!showReportOptions ? (
                <View>
                    <Button
                        title="Share what you see"
                        icon="+"
                        onPress={() => setShowReportOptions(true)}
                    />
                    <Text className="text-2xl font-bold text-gray-800 mt-6">
                        Recents
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
                                Tell what you see
                            </Text>
                            <Text className="text-gray-500 text-sm mt-1">
                                Select the type of incident to other drivers
                            </Text>
                        </View>
                    </View>

                    <View className="gap-3">
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
                                    {option.label}
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
