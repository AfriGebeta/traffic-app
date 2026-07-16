import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../../shared/theme/ThemeContext';

export const PlaceCardSkeleton: React.FC = () => {
    const { colors: theme, isDark } = useTheme();
    const pulse = isDark ? theme.border : '#E5E7EB';

    return (
        <View className="rounded-xl mr-3 w-52 overflow-hidden" style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
            <View className="w-full h-24" style={{ backgroundColor: pulse }} />

            <View className="p-3">
                <View className="rounded h-4 w-full mb-2" style={{ backgroundColor: pulse }} />
                <View className="rounded h-3 w-3/4" style={{ backgroundColor: pulse }} />
            </View>
        </View>
    );
};
