import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
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
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onSelectCategory }) => {
    const { t } = useTranslation();
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const handleSelect = (categoryId: string) => {
        const newSelection = selectedCategory === categoryId ? null : categoryId;
        setSelectedCategory(newSelection);
        onSelectCategory?.(categoryId);
    };

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3"
            contentContainerStyle={{ paddingHorizontal: 4 }}
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
                    <Ionicons
                        name={category.icon}
                        size={16}
                        color={selectedCategory === category.id ? '#FFFFFF' : '#6B7280'}
                    />
                    <Text
                        className={`ml-2 text-sm font-medium ${selectedCategory === category.id ? 'text-white' : 'text-gray-700'
                            }`}
                    >
                        {t(category.nameKey)}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
};
