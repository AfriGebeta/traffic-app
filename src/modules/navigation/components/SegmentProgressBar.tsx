import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface SegmentProgressBarProps {
    segments: Array<{ type: 'walk' | 'taxi'; label: string }>;
    currentIndex: number;
}

export const SegmentProgressBar: React.FC<SegmentProgressBarProps> = ({
    segments,
    currentIndex,
}) => {
    const { colors: theme, isDark } = useTheme();
    const futureColor = isDark ? theme.border : '#E5E7EB';

    return (
        <View className="flex-row items-center justify-between">
            {segments.map((segment, index) => {
                const isActive = index === currentIndex;
                const isCompleted = index < currentIndex;
                const isFuture = index > currentIndex;
                const isWalk = segment.type === 'walk';

                return (
                    <React.Fragment key={index}>
                        <View className="items-center">
                            <View
                                className="w-10 h-10 rounded-full items-center justify-center"
                                style={{
                                    backgroundColor: isActive
                                        ? isWalk
                                            ? theme.blue
                                            : colors.primary.main
                                        : isCompleted
                                            ? theme.green
                                            : futureColor
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
                                    color={isFuture ? theme.textSecondary : 'white'}
                                />
                            </View>
                            <Text
                                className={`text-xs mt-1 ${isActive ? 'font-bold' : 'font-normal'}`}
                                style={{
                                    color: isActive || isCompleted ? theme.textPrimary : theme.textSecondary
                                }}
                            >
                                {segment.label}
                            </Text>
                        </View>

                        {index < segments.length - 1 && (
                            <View
                                className="flex-1 h-1 mx-2"
                                style={{ backgroundColor: isCompleted ? theme.green : futureColor }}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </View>
    );
};
