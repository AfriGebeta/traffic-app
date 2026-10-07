import React, { useCallback, useState } from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useGlass } from '../../../shared/theme/glass';
import { GlassSheen } from '../../../shared/components/GlassSheen';
import { useUserRegistration } from '../../register/hooks/useUserRegistration';
import { useResolvedImageUri } from '../../../shared/hooks/useResolvedImageUri';

interface SearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    onClear: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
    placeholder?: string;
    onProfilePress?: () => void;
    isLoading?: boolean;
    hideProfile?: boolean;
}

export const ProfileButton: React.FC<{ onPress?: () => void; size?: number }> = ({ onPress, size = 39 }) => {
    const { colors: theme } = useTheme();
    const glass = useGlass();
    const { getStoredUser } = useUserRegistration();
    const [storedImage, setStoredImage] = useState<string | null>(null);
    const [localImage, setLocalImage] = useState<string | null>(null);
    const profileImage = useResolvedImageUri(storedImage) ?? localImage;

    useFocusEffect(
        useCallback(() => {
            getStoredUser().then((user) => {
                setStoredImage(user?.profileImage ?? null);
                setLocalImage(user?.profileImageLocal ?? null);
            });
        }, [])
    );

    return (
        <TouchableOpacity
            className="rounded-2xl"
            style={[glass.surface, { width: size, height: size, alignItems: 'center', justifyContent: 'center' }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <GlassSheen radius={16} />
            {profileImage ? (
                <Image source={{ uri: profileImage }} style={{ width: size, height: size, borderRadius: 16 }} />
            ) : (
                <Ionicons name="person" size={Math.round(size * 0.6)} color={theme.textPrimary} />
            )}
        </TouchableOpacity>
    );
};

export const SearchBar: React.FC<SearchBarProps> = ({
    value,
    onChangeText,
    onClear,
    onFocus,
    onBlur,
    placeholder = 'Search Location...',
    onProfilePress,
    isLoading = false,
    hideProfile = false,
}) => {
    const { colors: theme } = useTheme();
    const glass = useGlass();

    return (
        <View className="flex-row items-center gap-3">
            {!hideProfile && <ProfileButton onPress={onProfilePress} />}

            <View
                className="flex-1 rounded-2xl flex-row items-center px-3 py-0.5"
                style={glass.panel}
            >
                <GlassSheen streak radius={16} strength="thick" />
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
