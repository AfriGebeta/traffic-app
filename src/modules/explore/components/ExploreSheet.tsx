import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { CategorySection } from './CategorySection';
import { CategorySkeleton } from './CategorySkeleton';
import { useExploreCategories } from '../hooks/useExploreCategories';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import type { ExploreCategoryId } from '../types/explore.types';

interface ExploreSheetProps {
    visible: boolean;
    onClose: () => void;
    userLocation: { lat: number; lng: number } | null;
    onPlaceSelect: (place: GeocodingPlace) => void;
}

export const ExploreSheet: React.FC<ExploreSheetProps> = ({
    visible,
    onClose,
    userLocation,
    onPlaceSelect,
}) => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { colors: theme } = useTheme();
    const { isLoading, categories, error, fetchCategories, fetchMorePlaces } =
        useExploreCategories(userLocation);
    const [expandedCategories, setExpandedCategories] = useState<Set<ExploreCategoryId>>(new Set());

    useEffect(() => {
        if (visible && userLocation) {
            fetchCategories();
        }
    }, [visible]);

    const handleSeeMore = async (categoryId: ExploreCategoryId) => {
        setExpandedCategories(prev => new Set(prev).add(categoryId));
        await fetchMorePlaces(categoryId);
    };

    const handleSeeLess = (categoryId: ExploreCategoryId) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            newSet.delete(categoryId);
            return newSet;
        });
    };

    const handlePlaceSelect = (place: GeocodingPlace) => {
        onPlaceSelect(place);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
                <Pressable
                    className="rounded-t-3xl max-h-[85%]"
                    style={{ paddingBottom: insets.bottom, backgroundColor: theme.background }}
                    onPress={(e) => e.stopPropagation()}
                >
                    <View className="p-6" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
                        <View className="w-12 h-1 rounded-full self-center mb-4" style={{ backgroundColor: theme.border }} />
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <Ionicons name="compass" size={24} color={colors.primary.main} />
                                <Text className="text-2xl font-bold ml-2" style={{ color: theme.textPrimary }}>
                                    {t('explore-nearby')}
                                </Text>
                            </View>
                            <Pressable onPress={onClose} className="p-2">
                                <Ionicons name="close" size={24} color={theme.textSecondary} />
                            </Pressable>
                        </View>
                    </View>

                    <ScrollView
                        className="px-6 py-4"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    >
                        {isLoading ? (
                            <>
                                <CategorySkeleton />
                                <CategorySkeleton />
                                <CategorySkeleton />
                                <CategorySkeleton />
                                <CategorySkeleton />
                            </>
                        ) : error ? (
                            <View className="py-20 items-center">
                                <Ionicons name="alert-circle" size={48} color={theme.error} />
                                <Text className="mt-4" style={{ color: theme.textSecondary }}>{error}</Text>
                            </View>
                        ) : (
                            <>
                                <CategorySection
                                    categoryId="museum"
                                    places={categories.museum}
                                    onPlacePress={handlePlaceSelect}
                                    onSeeMore={handleSeeMore}
                                    onSeeLess={handleSeeLess}
                                    isExpanded={expandedCategories.has('museum')}
                                />
                                <CategorySection
                                    categoryId="hotel"
                                    places={categories.hotel}
                                    onPlacePress={handlePlaceSelect}
                                    onSeeMore={handleSeeMore}
                                    onSeeLess={handleSeeLess}
                                    isExpanded={expandedCategories.has('hotel')}
                                />
                                <CategorySection
                                    categoryId="park"
                                    places={categories.park}
                                    onPlacePress={handlePlaceSelect}
                                    onSeeMore={handleSeeMore}
                                    onSeeLess={handleSeeLess}
                                    isExpanded={expandedCategories.has('park')}
                                />
                                <CategorySection
                                    categoryId="restaurant"
                                    places={categories.restaurant}
                                    onPlacePress={handlePlaceSelect}
                                    onSeeMore={handleSeeMore}
                                    onSeeLess={handleSeeLess}
                                    isExpanded={expandedCategories.has('restaurant')}
                                />
                                <CategorySection
                                    categoryId="mall"
                                    places={categories.mall}
                                    onPlacePress={handlePlaceSelect}
                                    onSeeMore={handleSeeMore}
                                    onSeeLess={handleSeeLess}
                                    isExpanded={expandedCategories.has('mall')}
                                />
                            </>
                        )}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
};
