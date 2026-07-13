import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import DiscoveryIcon from '../../../../assets/images/Discovery.svg';
import PlusIcon from '../../../../assets/images/Plus.svg';
import BookmarkIcon from '../../../../assets/images/Bookmark.svg';
import DangerTriangleIcon from '../../../../assets/images/Danger Triangle.svg';
import { colors } from '../../../shared/theme/colors';
import { useTranslation } from '../../../shared/hooks/useTranslation';

type TabId = 'explore' | 'contribute' | 'ai' | 'saved' | 'report';

interface Tab {
    id: TabId;
    translationKey: string;
    icon?: number;
    SvgIcon?: React.FC<{ width?: number; height?: number }>;
}

const tabs: Tab[] = [
    { id: 'explore', translationKey: 'explore', SvgIcon: DiscoveryIcon },
    { id: 'contribute', translationKey: 'contribute', SvgIcon: PlusIcon },
    { id: 'ai', translationKey: '', icon: require('../../../../assets/images/home-ai.png') },
    { id: 'saved', translationKey: 'saved', SvgIcon: BookmarkIcon },
    { id: 'report', translationKey: 'report', SvgIcon: DangerTriangleIcon },
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
    const insets = useSafeAreaInsets();
    const [fontsLoaded] = useFonts({
        'PlusJakartaSans-Light': require('../../../../assets/fonts/plus-jakarta-sans/PlusJakartaSans-Light.ttf'),
    });

    const handleTabPress = (tabId: TabId) => {
        if (tabId === 'contribute') {
            onAddPress?.();
        } else {
            setActiveTab(tabId);
            onTabPress?.(tabId);
        }
    };

    return (
        <View
            className="absolute left-4 right-4"
            style={{ bottom: Math.max(insets.bottom + 8, 36) }}
        >
            <View
                className="rounded-3xl bg-white flex-row items-center justify-between px-3 py-3"
                style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 10,
                    elevation: 8,
                }}
            >
                {tabs.map((tab) => {
                    const isAi = tab.id === 'ai';
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            onPress={() => handleTabPress(tab.id)}
                            className="flex-1 items-center"
                            activeOpacity={0.7}
                        >
                            {isAi ? (
                                <View
                                    className="items-center justify-center rounded-full"
                                    style={{ width: 60, height: 60, backgroundColor: colors.primary.main }}
                                >
                                    <Image
                                        source={tab.icon}
                                        style={{ width: 60, height: 60 }}
                                        resizeMode="contain"
                                    />
                                </View>
                            ) : (
                                <>
                                    {tab.SvgIcon ? (
                                        <tab.SvgIcon width={30} height={30} />
                                    ) : (
                                        <Image
                                            source={tab.icon}
                                            style={{ width: 30, height: 30 }}
                                            resizeMode="contain"
                                        />
                                    )}
                                    <Text
                                        className="text-gray-700 text-xs mt-1.5"
                                        numberOfLines={1}
                                        style={fontsLoaded ? { fontFamily: 'PlusJakartaSans-Light' } : undefined}
                                    >
                                        {t(tab.translationKey)}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};
