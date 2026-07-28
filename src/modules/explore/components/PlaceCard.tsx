import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useResolvedImageUri } from '../../../shared/hooks/useResolvedImageUri';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';

interface PlaceCardProps {
    place: GeocodingPlace;
    onPress: (place: GeocodingPlace) => void;
}

export const PlaceCard: React.FC<PlaceCardProps> = ({ place, onPress }) => {
    const { colors: theme, isDark } = useTheme();
    const imagePlaceholder = isDark ? theme.border : '#E5E7EB';
    const imageUri = useResolvedImageUri(place.image);

    return (
        <TouchableOpacity
            onPress={() => onPress(place)}
            className="rounded-xl mr-3 w-52 overflow-hidden"
            style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
        >
            {imageUri ? (
                <Image
                    source={{ uri: imageUri }}
                    className="w-full h-24"
                    style={{ backgroundColor: imagePlaceholder }}
                    resizeMode="cover"
                />
            ) : (
                <View className="w-full h-24 items-center justify-center" style={{ backgroundColor: imagePlaceholder }}>
                    <Ionicons name="image-outline" size={32} color={theme.textSecondary} />
                </View>
            )}

            <View className="p-3">
                <Text className="text-sm font-semibold mb-1" style={{ color: theme.textPrimary }} numberOfLines={2}>
                    {place.name}
                </Text>
                {(place.City || place.Country) && (
                    <Text className="text-xs" style={{ color: theme.textSecondary }} numberOfLines={1}>
                        {[place.City, place.Country].filter(Boolean).join(', ')}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );
};
