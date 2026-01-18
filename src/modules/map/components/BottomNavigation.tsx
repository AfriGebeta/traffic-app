import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../shared/theme/colors';
import { useTranslation } from '../../../shared/hooks/useTranslation';

type TabId = 'explore' | 'contribute' | 'report';

interface Tab {
    id: TabId;
    translationKey: string;
    icon: keyof typeof Ionicons.glyphMap;
}

const tabs: Tab[] = [
    { id: 'explore', translationKey: 'explore', icon: 'compass' },
    { id: 'contribute', translationKey: 'contribute', icon: 'add-circle' },
    { id: 'report', translationKey: 'report-incidents', icon: 'warning' },
];

interface BottomNavigationProps {
    onTabPress?: (tabId: TabId) => void;
    onAddPress?: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
    onTabPress,
    onAddPress,
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabId | null>(null);

    const handleTabPress = (tabId: TabId) => {
        if (tabId === 'contribute') {
            onAddPress?.();
        } else {
            setActiveTab(tabId);
            onTabPress?.(tabId);
        }
    };

    return (
        <View className="absolute bottom-9 left-4 right-4">

            <View className="bg-gray-100 rounded-3xl shadow-2xl p-3">
                <View className="flex-row items-center justify-between gap-2">
                    {tabs.map((tab) => {
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => handleTabPress(tab.id)}
                                className="flex-1 bg-gray-50 rounded-2xl items-center py-5"
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={tab.icon}
                                    size={28}
                                    color={colors.primary.main}
                                />
                                <Text className="text-gray-800 text-sm font-medium mt-2">
                                    {t(tab.translationKey)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        </View>
    );
};
