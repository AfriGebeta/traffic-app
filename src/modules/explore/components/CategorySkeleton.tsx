import React from 'react';
import { View, ScrollView } from 'react-native';
import { PlaceCardSkeleton } from './PlaceCardSkeleton';

export const CategorySkeleton: React.FC = () => {
    return (
        <View className="mb-6">
            <View className="flex-row items-center mb-3">
                <View className="bg-gray-200 rounded-full w-10 h-10 mr-2" />
                <View className="bg-gray-200 rounded h-5 w-32 flex-1" />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <PlaceCardSkeleton />
                <PlaceCardSkeleton />
                <PlaceCardSkeleton />
            </ScrollView>
        </View>
    );
};
