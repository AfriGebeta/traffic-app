import React, { useCallback, useState } from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useUserRegistration } from '../../register/hooks/useUserRegistration';

interface SearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    onClear: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
    placeholder?: string;
    onProfilePress?: () => void;
    isLoading?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    value,
    onChangeText,
    onClear,
    onFocus,
    onBlur,
    placeholder = 'Search Location...',
    onProfilePress,
    isLoading = false,
}) => {
    const { colors: theme } = useTheme();
    const { getStoredUser } = useUserRegistration();
    const [profileImage, setProfileImage] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            getStoredUser().then((user) => {
                setProfileImage(user?.profileImage ?? null);
            });
        }, [getStoredUser])
    );

    return (
        <View className="flex-row items-center gap-3">
            <TouchableOpacity
                className="rounded-2xl shadow-lg overflow-hidden"
                style={{ backgroundColor: theme.surface, width: 39, height: 39, alignItems: 'center', justifyContent: 'center' }}
                onPress={onProfilePress}
                activeOpacity={0.7}
            >
                {profileImage ? (
                    <Image source={{ uri: profileImage }} style={{ width: 39, height: 39 }} />
                ) : (
                    <Ionicons name="person" size={23} color={theme.textPrimary} />
                )}
            </TouchableOpacity>

            <View
                className="flex-1 rounded-2xl shadow-lg flex-row items-center px-3 py-0.5"
                style={{ backgroundColor: theme.surface }}
            >
                <Ionicons name="search" size={16} color={theme.textSecondary} />
                <TextInput
                    className="flex-1 ml-3 text-base"
                    placeholder={placeholder}
                    placeholderTextColor={theme.textSecondary}
                    value={value}
                    onChangeText={onChangeText}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    style={{ paddingVertical: 8, color: theme.textPrimary }}
                />
                {isLoading && (
                    <ActivityIndicator size="small" color={theme.primary} style={{ marginRight: 8 }} />
                )}
                {value.length > 0 && !isLoading && (
                    <TouchableOpacity onPress={onClear} className="mr-2">
                        <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};
