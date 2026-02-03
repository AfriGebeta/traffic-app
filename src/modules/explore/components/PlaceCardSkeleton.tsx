import React from 'react';
import { View } from 'react-native';

export const PlaceCardSkeleton: React.FC = () => {
    return (
        <View className="bg-white rounded-xl mr-3 border border-gray-200 w-52 overflow-hidden">
            <View className="w-full h-24 bg-gray-200" />

            <View className="p-3">
                <View className="bg-gray-200 rounded h-4 w-full mb-2" />
                <View className="bg-gray-200 rounded h-3 w-3/4" />
            </View>
        </View>
    );
};
