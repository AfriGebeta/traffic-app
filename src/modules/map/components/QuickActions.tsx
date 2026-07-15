import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';

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
    const { colors: theme } = useTheme();
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
        <View className="mt-1.5 -mx-4">
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingLeft: 14, paddingRight: 14, paddingBottom: 8 }}
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
                                className="px-4 py-2 flex-row items-center rounded-full"
                                style={{
                                    backgroundColor: selectedCategory === category.id
                                        ? theme.primary
                                        : theme.surface,
                                    borderWidth: 0.5,
                                    borderColor: selectedCategory === category.id
                                        ? theme.primaryHover
                                        : theme.border,
                                    borderRadius: 9999,
                                }}
                            >
                                <Text
                                    className="text-sm font-medium"
                                    style={{
                                        color: selectedCategory === category.id
                                            ? '#FFFFFF'
                                            : theme.textPrimary,
                                    }}
                                >
                                    {t(category.nameKey)}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};
