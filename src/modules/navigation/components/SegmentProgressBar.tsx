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
        <View className="flex-row items-center justify-between">
            {segments.map((segment, index) => {
                const isActive = index === currentIndex;
                const isCompleted = index < currentIndex;
                const isWalk = segment.type === 'walk';

                return (
                    <React.Fragment key={index}>
                        <View className="items-center">
                            <View
                                className="w-10 h-10 rounded-full items-center justify-center"
                                style={{
                                    backgroundColor: isActive
                                        ? isWalk
                                            ? '#3B82F6'
                                            : colors.primary.main
                                        : isCompleted
                                            ? '#10B981'
                                            : 'rgba(255, 255, 255, 0.2)'
                                }}
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
                                        ? 'text-white'
                                        : 'text-gray-400'
                                    }`}
                            >
                                {segment.label}
                            </Text>
                        </View>

                        {index < segments.length - 1 && (
                            <View
                                className="flex-1 h-1 mx-2"
                                style={{ backgroundColor: isCompleted ? '#10B981' : 'rgba(255, 255, 255, 0.2)' }}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </View>
    );
};
