import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Dimensions, FlatList, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../../shared/theme/colors';
import { dashboardEventsService } from '../../../shared/services/dashboard-events.service';

const { width } = Dimensions.get('window');

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
}

const steps: OnboardingStep[] = [
    {
        id: '1',
        title: 'Navigate with Ease',
        description: 'Get real-time directions and traffic updates to reach your destination faster.',
        icon: 'navigate-circle',
    },
    {
        id: '2',
        title: 'Explore Places',
        description: 'Discover restaurants, gas stations, parking spots, and more around you.',
        icon: 'compass',
    },
    {
        id: '3',
        title: 'Contribute & Report',
        description: 'Help the community by reporting incidents and adding new places to the map.',
        icon: 'people',
    },
];

export const OnboardingScreen: React.FC = () => {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    const handleNext = () => {
        if (currentIndex < steps.length - 1) {
            const nextIndex = currentIndex + 1;
            flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
            setCurrentIndex(nextIndex);
        } else {
            handleGetStarted();
        }
    };

    const handleSkip = () => {
        handleGetStarted();
    };

    const handleGetStarted = async () => {
        await AsyncStorage.setItem('hasSeenOnboarding', 'true');
        dashboardEventsService.onboardComplete();
        router.replace('/select-language');
    };

    const renderItem = ({ item }: { item: OnboardingStep }) => (
        <View style={{ width }} className="flex-1 items-center justify-center px-8">
            <View
                className="w-32 h-32 rounded-full items-center justify-center mb-8"
                style={{ backgroundColor: colors.primary.main }}
            >
                <Ionicons name={item.icon} size={64} color="#fff" />
            </View>
            <Text className="text-3xl font-bold text-gray-900 mb-4 text-center">
                {item.title}
            </Text>
            <Text className="text-base text-gray-600 text-center leading-6">
                {item.description}
            </Text>
        </View>
    );

    return (
        <View className="flex-1 bg-white">
            <FlatList
                ref={flatListRef}
                data={steps}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                    const index = Math.round(event.nativeEvent.contentOffset.x / width);
                    setCurrentIndex(index);
                }}
                scrollEnabled={true}
            />

            <View className="px-8 pb-12">
                <View className="flex-row justify-center mb-8">
                    {steps.map((_, index) => (
                        <View
                            key={index}
                            className="h-2 rounded-full mx-1"
                            style={{
                                width: currentIndex === index ? 24 : 8,
                                backgroundColor:
                                    currentIndex === index ? colors.primary.main : '#D1D5DB',
                            }}
                        />
                    ))}
                </View>

                <View className="flex-row items-center justify-between mb-4">
                    {currentIndex < steps.length - 1 ? (
                        <TouchableOpacity onPress={handleSkip} className="py-3 px-6">
                            <Text className="text-gray-600 text-base font-medium">Skip</Text>
                        </TouchableOpacity>
                    ) : (
                        <View />
                    )}

                    <TouchableOpacity
                        onPress={handleNext}
                        className="rounded-2xl py-3 px-8"
                        style={{ backgroundColor: colors.primary.main }}
                    >
                        <Text className="text-white text-lg font-bold">
                            {currentIndex === steps.length - 1 ? 'Get Started' : 'Next'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};
