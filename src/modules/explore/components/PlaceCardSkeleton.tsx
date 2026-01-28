import React from 'react';
import { View } from 'react-native';

export const PlaceCardSkeleton: React.FC = () => {
    return (
        <View className="bg-white rounded-xl p-5 mr-3 border border-gray-200 w-64 min-h-[80px]">
            <View className="flex-row items-start">
                
                <View className="flex-1">
                    <View className="bg-gray-200 rounded h-4 w-3/4 mb-2" />
                    <View className="bg-gray-200 rounded h-3 w-1/2" />
                </View>
            </View>
        </View>
    );
};
