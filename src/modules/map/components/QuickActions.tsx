import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
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

    return (
        <View className="flex-row items-center mt-1.5">
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 4 }}
                className="flex-1"
            >
                {categories.map((category) => (
                    <TouchableOpacity
                        key={category.id}
                        onPress={() => handleSelect(category.id)}
                        className={`mr-2 px-4 py-2 rounded-full flex-row items-center ${selectedCategory === category.id
                            ? 'bg-orange-400 border-2 border-orange-400'
                            : 'bg-white border-2 border-gray-200'
                            }`}
                    >
                        {isLoading && selectedCategory === category.id ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : null}
                        <Text
                            className={`text-sm font-medium ${selectedCategory === category.id ? 'text-white' : 'text-gray-700'
                                }`}
                        >
                            {t(category.nameKey)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {selectedCategory && (
                <TouchableOpacity
                    onPress={() => handleSelect(selectedCategory)}
                    className="ml-2 mr-4 bg-white rounded-full p-2.5 border border-gray-200 shadow-sm"
                    activeOpacity={0.7}
                >
                    <Ionicons name="close" size={18} color="#9CA3AF" />
                </TouchableOpacity>
            )}
        </View>
    );
};
