import React from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    onClear: () => void;
    placeholder?: string;
    onVoicePress?: () => void;
    isRecording?: boolean;
    isProcessingVoice?: boolean;
    onProfilePress?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    value,
    onChangeText,
    onClear,
    placeholder = 'Search Location...',
    onVoicePress,
    isRecording = false,
    isProcessingVoice = false,
    onProfilePress,
}) => {
    return (
        <View className="flex-row items-center gap-3">
            <TouchableOpacity
                className="bg-white rounded-2xl shadow-lg p-3.5"
                onPress={onProfilePress}
                activeOpacity={0.7}
            >
                <Ionicons name="person" size={24} color="#374151" />
            </TouchableOpacity>

            <View className="flex-1 bg-white rounded-2xl shadow-lg flex-row items-center px-3 py-2">
                <Ionicons name="search" size={20} color="#9CA3AF" />
                <TextInput
                    className="flex-1 ml-3 text-gray-700 text-base"
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    value={value}
                    onChangeText={onChangeText}
                    editable={!isRecording && !isProcessingVoice}
                />
                {value.length > 0 && !isRecording && !isProcessingVoice && (
                    <TouchableOpacity onPress={onClear} className="mr-2">
                        <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                )}

                {isProcessingVoice ? (
                    <View className="p-2">
                        <ActivityIndicator size="small" color="#F59E0B" />
                    </View>
                ) : (
                    <TouchableOpacity
                        className={'rounded-full p-2 ' + (isRecording ? 'bg-red-500' : 'bg-gray-100')}
                        onPress={onVoicePress}
                        disabled={isProcessingVoice}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={isRecording ? 'stop' : 'mic'}
                            size={20}
                            color={isRecording ? '#FFFFFF' : '#374151'}
                        />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};
