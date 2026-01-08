import React from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    onClear: () => void;
    placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    value,
    onChangeText,
    onClear,
    placeholder = 'Search Location...'
}) => {
    return (
        <View className="bg-white rounded-full shadow-lg flex-row items-center px-4 py-3">
            <Ionicons name="search" size={20} color="#F59E0B" />
            <TextInput
                className="flex-1 ml-3 text-gray-700 text-base"
                placeholder={placeholder}
                placeholderTextColor="#9CA3AF"
                value={value}
                onChangeText={onChangeText}
            />
            {value.length > 0 && (
                <TouchableOpacity onPress={onClear}>
                    <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
            )}
            <View className="ml-3 flex-row gap-2">
                <TouchableOpacity className="bg-yellow-50 rounded-full p-2">
                    <Ionicons name="mic" size={18} color="#F59E0B" />
                </TouchableOpacity>
            </View>
        </View>
    );
};
