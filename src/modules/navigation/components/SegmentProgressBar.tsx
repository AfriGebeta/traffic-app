import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';

interface SegmentProgressBarProps {
    segments: Array<{ type: 'walk' | 'taxi'; label: string }>;
    currentIndex: number;
}

export const SegmentProgressBar: React.FC<SegmentProgressBarProps> = ({
    segments,
    currentIndex,
}) => {
    return (
        <View className="flex-row items-center justify-between px-4 py-3 bg-white">
            {segments.map((segment, index) => {
                const isActive = index === currentIndex;
                const isCompleted = index < currentIndex;
                const isWalk = segment.type === 'walk';

                return (
                    <React.Fragment key={index}>
                        <View className="items-center">
                            <View
                                className={`w-10 h-10 rounded-full items-center justify-center ${isActive
                                        ? isWalk
                                            ? 'bg-blue-500'
                                            : 'bg-orange-500'
                                        : isCompleted
                                            ? 'bg-green-500'
                                            : 'bg-gray-300'
                                    }`}
                            >
                                <Ionicons
                                    name={
                                        isCompleted
                                            ? 'checkmark'
                                            : isWalk
                                                ? 'walk'
                                                : 'car'
                                    }
                                    size={20}
                                    color="white"
                                />
                            </View>
                            <Text
                                className={`text-xs mt-1 ${isActive ? 'font-bold' : 'font-normal'
                                    } ${isActive || isCompleted
                                        ? 'text-gray-900'
                                        : 'text-gray-400'
                                    }`}
                            >
                                {segment.label}
                            </Text>
                        </View>

                        {index < segments.length - 1 && (
                            <View
                                className={`flex-1 h-1 mx-2 ${isCompleted ? 'bg-green-500' : 'bg-gray-300'
                                    }`}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </View>
    );
};
