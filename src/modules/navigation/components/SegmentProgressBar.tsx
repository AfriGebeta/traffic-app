import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface SegmentProgressBarProps {
    segments: Array<{ type: 'walk' | 'taxi'; label: string }>;
    currentIndex: number;
    compact?: boolean;
}

export const SegmentProgressBar: React.FC<SegmentProgressBarProps> = ({
    segments,
    currentIndex,
    compact = false,
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
                        <View className={compact ? "flex-row items-center gap-1" : "items-center"}>
                            <View
                                className={`${compact ? "w-6 h-6" : "w-10 h-10"} rounded-full items-center justify-center`}
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
                                    size={compact ? 14 : 20}
                                    color={isFuture ? theme.textSecondary : 'white'}
                                />
                            </View>
                            {(!compact || isActive) && <Text
                                className={`text-xs ${compact ? "" : "mt-1"} ${isActive ? 'font-bold' : 'font-normal'}`}
                                style={{
                                    color: isActive || isCompleted ? theme.textPrimary : theme.textSecondary
                                }}
                            >
                                {segment.label}
                            </Text>}
                        </View>

                        {index < segments.length - 1 && (
                            <View
                                className={`flex-1 h-1 ${compact ? "mx-1" : "mx-2"}`}
                                style={{ backgroundColor: isCompleted ? theme.green : futureColor }}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </View>
    );
};
