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
}

export const SearchBar: React.FC<SearchBarProps> = ({
    value,
    onChangeText,
    onClear,
    placeholder = 'Search Location...',
    onVoicePress,
    isRecording = false,
    isProcessingVoice = false,
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
                editable={!isRecording && !isProcessingVoice}
            />
            {value.length > 0 && !isRecording && !isProcessingVoice && (
                <TouchableOpacity onPress={onClear}>
                    <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
            )}
            <View className="ml-3 flex-row gap-2">
                {isProcessingVoice ? (
                    <View className="bg-yellow-50 rounded-full p-2">
                        <ActivityIndicator size="small" color="#F59E0B" />
                    </View>
                ) : (
                    <TouchableOpacity 
                        className={'rounded-full p-2 ' + (isRecording ? 'bg-red-500' : 'bg-yellow-50')}
                        onPress={onVoicePress}
                        disabled={isProcessingVoice}
                    >
                        <Ionicons 
                            name={isRecording ? 'stop' : 'mic'} 
                            size={18} 
                            color={isRecording ? '#FFFFFF' : '#F59E0B'} 
                        />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};
