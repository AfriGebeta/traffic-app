import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { usePlaceCategories } from '../hooks/usePlaceCategories';

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
    const { i18n } = useTranslation();
    const { colors: theme } = useTheme();
    const { categories } = usePlaceCategories();
    const [internalSelectedCategory, setInternalSelectedCategory] = useState<string | null>(null);

    const lang = i18n.language === 'am' ? 'am' : 'en';

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
                        key={category.slug}
                        className={index === categories.length - 1 ? "" : "mr-2"}
                    >
                        <TouchableOpacity
                            onPress={() => handleSelect(category.slug)}
                            activeOpacity={0.8}
                        >
                            <View
                                className="px-4 py-2 flex-row items-center rounded-full"
                                style={{
                                    backgroundColor: selectedCategory === category.slug
                                        ? theme.primary
                                        : theme.surface,
                                    borderWidth: 0.5,
                                    borderColor: selectedCategory === category.slug
                                        ? theme.primaryHover
                                        : theme.border,
                                    borderRadius: 9999,
                                }}
                            >
                                <Text
                                    className="text-sm font-medium"
                                    style={{
                                        color: selectedCategory === category.slug
                                            ? '#FFFFFF'
                                            : theme.textPrimary,
                                    }}
                                >
                                    {category.label[lang]}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};
