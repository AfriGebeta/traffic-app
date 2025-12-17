import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { getIncidentColor } from '../../incidents/utils/incidentIcons';
import { IncidentType } from '../../incidents/types/incident.types';

interface IncidentAlertProps {
    incidentName: string;
    distance: string;
    incidentType: IncidentType;
}

export const IncidentAlert: React.FC<IncidentAlertProps> = ({ incidentName, distance, incidentType }) => {
    const color = getIncidentColor(incidentType);

    console.log('incident alert:', { incidentName, distance, incidentType });

    return (
        <Animated.View
            entering={FadeInDown.duration(300)}
            exiting={FadeOutUp.duration(300)}
            style={{
                position: 'absolute',
                top: 130,
                left: 16,
                right: 16,
                zIndex: 9999,
                elevation: 10,
            }}
        >
            <View
                className="rounded-2xl p-5 shadow-2xl flex-row items-center"
                style={{ backgroundColor: color }}
            >
                <View className="bg-white/30 rounded-full p-3 mr-4">
                    <Ionicons name="warning" size={32} color="white" />
                </View>
                <View className="flex-1">
                    <Text className="text-white text-2xl font-bold mb-1">
                        {incidentName}
                    </Text>
                    <Text className="text-white text-lg font-semibold">
                        {distance}
                    </Text>
                </View>
            </View>
        </Animated.View>
    );
};
