import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type TabId = 'home' | 'explore' | 'add' | 'you' | 'report';

interface Tab {
    id: TabId;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon: keyof typeof Ionicons.glyphMap;
}

const tabs: Tab[] = [
    { id: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
    { id: 'explore', label: 'Explore', icon: 'compass-outline', activeIcon: 'compass' },
    { id: 'add', label: '', icon: 'add', activeIcon: 'add' },
    { id: 'you', label: 'You', icon: 'person-outline', activeIcon: 'person' },
    { id: 'report', label: 'Report', icon: 'warning-outline', activeIcon: 'warning' },
];

interface BottomNavigationProps {
    onTabPress?: (tabId: TabId) => void;
    onAddPress?: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
    onTabPress,
    onAddPress,
}) => {
    const [activeTab, setActiveTab] = useState<TabId>('home');

    const handleTabPress = (tabId: TabId) => {
        if (tabId === 'add') {
            onAddPress?.();
        } else {
            setActiveTab(tabId);
            onTabPress?.(tabId);
        }
    };

    return (
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200">
            <View className="flex-row items-center justify-around py-2 px-4">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const isAddButton = tab.id === 'add';

                    if (isAddButton) {
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => handleTabPress(tab.id)}
                                className="items-center -mt-8"
                            >
                                <View className="bg-orange-400 rounded-full p-4 shadow-lg border-4 border-white">
                                    <Ionicons name={tab.icon} size={28} color="#FFFFFF" />
                                </View>
                            </TouchableOpacity>
                        );
                    }

                    return (
                        <TouchableOpacity
                            key={tab.id}
                            onPress={() => handleTabPress(tab.id)}
                            className="items-center py-2 flex-1"
                        >
                            <Ionicons
                                name={isActive ? tab.activeIcon : tab.icon}
                                size={24}
                                color={isActive ? '#FFA500' : '#9CA3AF'}
                            />
                            <Text
                                className={`text-xs mt-1 ${isActive ? 'text-orange-500 font-semibold' : 'text-gray-500'
                                    }`}
                            >
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};
