import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Animated } from 'react-native';
// import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface Category {
    id: string;
    nameKey: string;
    icon: keyof typeof Ionicons.glyphMap;
}

const categories: Category[] = [
    { id: 'restaurants', nameKey: 'restaurants', icon: 'restaurant' },
    { id: 'gas', nameKey: 'gas-station', icon: 'water' },
    { id: 'parking', nameKey: 'parking', icon: 'car' },
    { id: 'hospital', nameKey: 'hospital', icon: 'medical' },
    { id: 'repair', nameKey: 'repair-shop', icon: 'construct' },
    { id: 'bank', nameKey: 'bank', icon: 'business' },
    { id: 'atm', nameKey: 'atm', icon: 'cash' },
];

interface QuickActionsProps {
    onSelectCategory?: (categoryId: string) => void;
    isLoading?: boolean;
    selectedCategory?: string | null;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
    onSelectCategory,
    isLoading = false,
    selectedCategory: externalSelectedCategory
}) => {
    const { t } = useTranslation();
    const [internalSelectedCategory, setInternalSelectedCategory] = useState<string | null>(null);
    const scrollX = useRef(new Animated.Value(0)).current;
    const [isScrolling, setIsScrolling] = useState(false);
    const [scrollViewWidth, setScrollViewWidth] = useState(0);
    const [contentWidth, setContentWidth] = useState(0);

    const selectedCategory = externalSelectedCategory !== undefined
        ? externalSelectedCategory
        : internalSelectedCategory;

    const handleSelect = (categoryId: string) => {
        const newSelection = selectedCategory === categoryId ? null : categoryId;
        if (externalSelectedCategory === undefined) {
            setInternalSelectedCategory(newSelection);
        }
        onSelectCategory?.(categoryId);
    };

    const handleScroll = Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        {
            useNativeDriver: false,
        }
    );

    const handleScrollEnd = () => {
        setIsScrolling(false);
    };

    const maxScroll = Math.max(0, contentWidth - scrollViewWidth);
    const indicatorWidth = 60;
    const maxIndicatorTranslate = scrollViewWidth - indicatorWidth - 32; 

    return (
        <View className="mt-1.5 -mx-4">
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingLeft: 14, paddingRight: 14, paddingBottom: 8 }}
                onScroll={handleScroll}
                onScrollBeginDrag={() => setIsScrolling(true)}
                onScrollEndDrag={handleScrollEnd}
                onMomentumScrollEnd={handleScrollEnd}
                scrollEventThrottle={1}
                onLayout={(e) => setScrollViewWidth(e.nativeEvent.layout.width)}
                onContentSizeChange={(width) => setContentWidth(width)}
            >
                {categories.map((category, index) => (
                    <View
                        key={category.id}
                        className={index === categories.length - 1 ? "" : "mr-2"}
                    >
                        <TouchableOpacity
                            onPress={() => handleSelect(category.id)}
                            activeOpacity={0.8}
                        >
                            <View
                                className={`px-4 py-2 flex-row items-center rounded-full  ${selectedCategory === category.id
                                    ? 'bg-orange-500'
                                    : 'bg-white/90'
                                    }`}
                                style={{
                                    borderWidth: 0.5,
                                    borderColor: selectedCategory === category.id
                                        ? 'rgba(59, 130, 246, 0.3)'
                                        : 'rgba(156, 163, 175, 0.3)',
                                    borderRadius: 9999,
                                }}
                            >
                                <Text
                                    className={`text-sm font-medium ${selectedCategory === category.id ? 'text-white' : 'text-gray-800'
                                        }`}
                                >
                                    {t(category.nameKey)}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>
            {isScrolling && maxScroll > 0 && (
                <View className="absolute bottom-0 left-4 right-4 h-1 bg-gray-300 rounded-full">
                    <Animated.View
                        className="h-full rounded-full"
                        style={{
                            width: indicatorWidth,
                            backgroundColor: '#F59E0B',
                            transform: [{
                                translateX: scrollX.interpolate({
                                    inputRange: [0, maxScroll],
                                    outputRange: [0, maxIndicatorTranslate],
                                    extrapolate: 'clamp'
                                })
                            }]
                        }}
                    />
                </View>
            )}
        </View>
    );
};
