import React from 'react';
import { View, ScrollView } from 'react-native';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { PlaceCardSkeleton } from './PlaceCardSkeleton';

export const CategorySkeleton: React.FC = () => {
    const { colors: theme, isDark } = useTheme();
    const pulse = isDark ? theme.border : '#E5E7EB';

    return (
        <View className="mb-6">
            <View className="flex-row items-center mb-3">
                <View className="rounded-full w-10 h-10 mr-2" style={{ backgroundColor: pulse }} />
                <View className="rounded h-5 w-32 flex-1" style={{ backgroundColor: pulse }} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <PlaceCardSkeleton />
                <PlaceCardSkeleton />
                <PlaceCardSkeleton />
            </ScrollView>
        </View>
    );
};
