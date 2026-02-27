import React from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    onClear: () => void;
    placeholder?: string;
    onProfilePress?: () => void;
    isLoading?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    value,
    onChangeText,
    onClear,
    placeholder = 'Search Location...',
    onProfilePress,
    isLoading = false,
}) => {
    return (
        <View className="flex-row items-center gap-3">
            <TouchableOpacity
                className="bg-white rounded-2xl shadow-lg p-2"
                onPress={onProfilePress}
                activeOpacity={0.7}
            >
                <Ionicons name="person" size={23} color="#374151" />
            </TouchableOpacity>

            <View className="flex-1 bg-white rounded-2xl shadow-lg flex-row items-center px-3 py-0.5">
                <Ionicons name="search" size={16} color="#9CA3AF" />
                <TextInput
                    className="flex-1 ml-3 text-gray-700 text-base"
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    value={value}
                    onChangeText={onChangeText}
                    style={{ paddingVertical: 8 }}
                />
                {isLoading && (
                    <ActivityIndicator size="small" color="#FFA500" style={{ marginRight: 8 }} />
                )}
                {value.length > 0 && !isLoading && (
                    <TouchableOpacity onPress={onClear} className="mr-2">
                        <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};
