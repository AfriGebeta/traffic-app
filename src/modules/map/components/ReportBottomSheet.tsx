import React, { useState } from 'react';
import { View, Alert, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet, Button } from '../../../shared/components';
import { colors } from '../../../shared/theme/colors';

const reportOptions = [
    { id: 'police', label: 'Police', icon: 'shield-checkmark' as const, color: '#F59E0B' },
    { id: 'traffic', label: 'Traffic', icon: 'car' as const, color: '#F59E0B' },
    { id: 'crash', label: 'Crash', icon: 'warning' as const, color: '#F59E0B' },
    { id: 'closure', label: 'Closure', icon: 'close-circle' as const, color: '#F59E0B' },
    { id: 'hazard', label: 'Hazard', icon: 'alert-circle' as const, color: '#F59E0B' },
    { id: 'weather', label: 'Bad Weather', icon: 'rainy' as const, color: '#F59E0B' },
];

export const ReportBottomSheet: React.FC = () => {
    const [showReportOptions, setShowReportOptions] = useState(false);

    const handleOptionPress = (optionId: string, optionLabel: string) => {
        Alert.alert('Selected', optionLabel);
        //handle option selection not done
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
                        {reportOptions.map((option) => (
                            <TouchableOpacity
                                key={option.id}
                                className="bg-gray-50 rounded-xl p-4 flex-row items-center border-2"
                                style={{ borderColor: colors.primary.light }}
                                onPress={() => handleOptionPress(option.id, option.label)}
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
