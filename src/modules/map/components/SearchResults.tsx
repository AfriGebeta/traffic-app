import React from 'react';
import { View, Text as RNText, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GeocodingPlace } from '../../navigation/services/navigation.service';

const Text = RNText;

interface SearchResultsProps {
    results: GeocodingPlace[];
    onSelectPlace: (place: GeocodingPlace) => void;
    onClose: () => void;
    isLoading?: boolean;
    showContainer?: boolean;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
    results,
    onSelectPlace,
    onClose,
    isLoading = false,
    showContainer = false
}) => {
    if (!showContainer) return null;

    return (
        <View className="mt-2 bg-white rounded-2xl shadow-lg max-h-96">
            <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
                <Text className="text-lg font-semibold">Search Results</Text>
                <TouchableOpacity onPress={onClose}>
                    <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View className="p-8 items-center justify-center">
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text className="text-gray-500 mt-2">Searching...</Text>
                </View>
            ) : results.length === 0 ? (
                <View className="p-8 items-center justify-center">
                    <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                    <Text className="text-gray-500 mt-2">No results found</Text>
                </View>
            ) : (
                <ScrollView className="max-h-80">
                    {results.map((place, index) => (
                        <TouchableOpacity
                            key={index}
                            className="p-4 border-b border-gray-100 flex-row items-center"
                            onPress={() => onSelectPlace(place)}
                        >
                            <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                                <Ionicons name="location" size={20} color="#3B82F6" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-semibold text-gray-900" numberOfLines={1}>
                                    {place.name}
                                </Text>
                                <Text className="text-sm text-gray-500" numberOfLines={1}>
                                    {place.type} • {place.City}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}
        </View>
    );
};
