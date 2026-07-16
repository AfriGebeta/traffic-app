import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { PlaceCard } from './PlaceCard';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import type { ExploreCategoryId } from '../types/explore.types';

interface CategorySectionProps {
    categoryId: ExploreCategoryId;
    places: GeocodingPlace[];
    onPlacePress: (place: GeocodingPlace) => void;
    onSeeMore: (categoryId: ExploreCategoryId) => void;
    onSeeLess: (categoryId: ExploreCategoryId) => void;
    isExpanded?: boolean;
}

const CATEGORY_ICONS: Record<ExploreCategoryId, keyof typeof Ionicons.glyphMap> = {
    museum: 'business',
    hotel: 'bed',
    park: 'leaf',
    restaurant: 'restaurant',
    mall: 'cart',
};

export const CategorySection: React.FC<CategorySectionProps> = ({
    categoryId,
    places,
    onPlacePress,
    onSeeMore,
    onSeeLess,
    isExpanded = false,
}) => {
    const { t } = useTranslation();
    const { colors: theme } = useTheme();
    const displayPlaces = isExpanded ? places : places.slice(0, 5);

    if (places.length === 0) {
        return null;
    }

    return (
        <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center flex-1">
                    <Text className="text-lg font-bold" style={{ color: theme.textPrimary }}>
                        {t(`${categoryId}-nearby`)}
                    </Text>
                </View>
                {places.length > 5 && (
                    <TouchableOpacity
                        onPress={() => isExpanded ? onSeeLess(categoryId) : onSeeMore(categoryId)}
                        className="flex-row items-center"
                    >
                        <Text style={{ color: colors.primary.main }} className="font-semibold text-sm mr-1">
                            {isExpanded ? t('see-less') : t('see-more')}
                        </Text>
                        <Ionicons
                            name={isExpanded ? "chevron-back" : "chevron-forward"}
                            size={16}
                            color={colors.primary.main}
                        />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {displayPlaces.map((place, index) => (
                    <PlaceCard key={`${place.name}-${index}`} place={place} onPress={onPlacePress} />
                ))}
            </ScrollView>
        </View>
    );
};
