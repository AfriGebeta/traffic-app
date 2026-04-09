import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { placeService } from '../services/place.service';
import type { SavedPlace, SavedPlaceType } from '../types/place.types';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from '../../../shared/hooks/useTranslation';

type TabType = 'ALL' | SavedPlaceType;

export const SavedPlacesScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('ALL');

    useEffect(() => {
        loadSavedPlaces();
    }, []);

    const loadSavedPlaces = async () => {
        try {
            const places = await placeService.getSavedPlaces();
            setSavedPlaces(places);
        } catch (error) {
            console.error('Error loading saved places:', error);
            showToast.error(t('error'), t('failed-to-load-saved-places'));
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePlace = (placeId: string, label: string) => {
        Alert.alert(
            t('delete-place'),
            `${t('delete-place-confirm')} "${label}"?`,
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('delete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await placeService.deleteSavedPlace(placeId);
                            setSavedPlaces(savedPlaces.filter(p => p.id !== placeId));
                            showToast.success(t('place-deleted'));
                        } catch (error) {
                            console.error('Error deleting place:', error);
                            showToast.error(t('failed-to-delete-place'));
                        }
                    },
                },
            ]
        );
    };

    const handleNavigateToPlace = (place: SavedPlace) => {
        router.push({
            pathname: '/',
            params: {
                lat: place.lat,
                lng: place.lng,
                name: place.label,
            },
        });
    };

    const getPlaceIcon = (type: string) => {
        switch (type) {
            case 'HOME':
                return 'home';
            case 'WORK':
                return 'briefcase';
            case 'FAVORITE':
                return 'heart';
            default:
                return 'location';
        }
    };

    const getPlaceColor = (type: string) => {
        switch (type) {
            case 'HOME':
                return colors.primary.main;
            case 'WORK':
                return '#3B82F6';
            case 'FAVORITE':
                return '#EC4899';
            default:
                return '#6B7280';
        }
    };

    const tabs: { id: TabType; label: string; icon: string }[] = [
        { id: 'ALL', label: t('all'), icon: 'apps' },
        { id: 'HOME', label: t('home'), icon: 'home' },
        { id: 'WORK', label: t('work'), icon: 'briefcase' },
        { id: 'FAVORITE', label: t('favorites'), icon: 'heart' },
    ];

    const filteredPlaces = activeTab === 'ALL'
        ? savedPlaces
        : savedPlaces.filter(place => place.type === activeTab);

    const getPlaceCount = (type: TabType) => {
        if (type === 'ALL') return savedPlaces.length;
        return savedPlaces.filter(place => place.type === type).length;
    };

    if (loading) {
        return (
            <View className="flex-1 bg-white">
                <View className="px-6 pt-12 pb-6 flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#1f2937" />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-gray-900 ml-4">
                        {t('saved-places')}
                    </Text>
                </View>
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={colors.primary.main} />
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-white">
            <View className="px-6 pt-12 pb-4 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#1f2937" />
                </TouchableOpacity>
                <Text className="text-2xl font-bold text-gray-900 ml-4">
                    {t('saved-places')}
                </Text>
            </View>

            <View className="mb-4">
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingLeft: 24, paddingRight: 24 }}
                >
                    {tabs.map((tab, index) => {
                        const count = getPlaceCount(tab.id);
                        const isActive = activeTab === tab.id;
                        return (
                            <View
                                key={tab.id}
                                className={index === tabs.length - 1 ? "" : "mr-2"}
                            >
                                <TouchableOpacity
                                    onPress={() => setActiveTab(tab.id)}
                                    activeOpacity={0.8}
                                >
                                    <View
                                        className={`px-4 py-2 flex-row items-center rounded-full ${isActive ? 'bg-orange-400' : 'bg-white/90'
                                            }`}
                                        style={{
                                            borderWidth: 0.5,
                                            borderColor: isActive
                                                ? 'rgba(249, 115, 22, 0.3)'
                                                : 'rgba(156, 163, 175, 0.3)',
                                            borderRadius: 9999,
                                        }}
                                    >
                                        <Ionicons
                                            name={tab.icon as any}
                                            size={16}
                                            color={isActive ? '#fff' : '#6B7280'}
                                        />
                                        <Text
                                            className={`text-sm font-medium ml-1.5 ${isActive ? 'text-white' : 'text-gray-800'
                                                }`}
                                        >
                                            {tab.label}
                                        </Text>
                                        {count > 0 && (
                                            <View
                                                className={`ml-1.5 px-1.5 py-0.5 rounded-full min-w-[18px] items-center ${isActive ? 'bg-white/20' : 'bg-gray-200'
                                                    }`}
                                            >
                                                <Text
                                                    className={`text-xs font-bold ${isActive ? 'text-white' : 'text-gray-600'
                                                        }`}
                                                >
                                                    {count}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </ScrollView>
            </View>

            {filteredPlaces.length === 0 ? (
                <View className="flex-1 items-center justify-center px-8 -mt-20">
                    <View
                        className="rounded-full w-24 h-24 items-center justify-center mb-6"
                        style={{ backgroundColor: colors.primary.main + '20' }}
                    >
                        <Ionicons name="bookmark-outline" size={48} color={colors.primary.main} />
                    </View>
                    <Text className="text-2xl font-bold text-gray-900 mb-3">
                        {t('no-saved-places')}
                    </Text>
                    <Text className="text-gray-500 text-center text-base">
                        {t('save-favorite-locations')}
                    </Text>
                </View>
            ) : (
                <ScrollView
                    className="flex-1 px-6"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                >
                    {filteredPlaces.map((place) => (
                        <TouchableOpacity
                            key={place.id}
                            onPress={() => handleNavigateToPlace(place)}
                            className="bg-gray-50 rounded-2xl p-4 mb-3 flex-row items-center"
                        >
                            <View
                                className="w-12 h-12 rounded-full items-center justify-center mr-4"
                                style={{ backgroundColor: getPlaceColor(place.type) + '20' }}
                            >
                                <Ionicons
                                    name={getPlaceIcon(place.type) as any}
                                    size={24}
                                    color={getPlaceColor(place.type)}
                                />
                            </View>
                            <View className="flex-1">
                                <View className="flex-row items-center mb-1">
                                    <Text className="text-base font-semibold text-gray-900 flex-1">
                                        {place.label}
                                    </Text>
                                    {place.isPrivate && (
                                        <View className="flex-row items-center ml-2">
                                            <Ionicons name="lock-closed" size={14} color="#6B7280" />
                                            <Text className="text-xs text-gray-500 ml-1">{t('private')}</Text>
                                        </View>
                                    )}
                                </View>
                                <Text className="text-sm text-gray-500">
                                    {place.type}
                                </Text>
                                <Text className="text-xs text-gray-400 mt-1">
                                    {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => handleDeletePlace(place.id, place.label)}
                                className="p-2"
                            >
                                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}
        </View>
    );
};

export default SavedPlacesScreen;
