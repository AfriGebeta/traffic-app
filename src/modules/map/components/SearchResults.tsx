import React from 'react';
import { View, Text as RNText, TouchableOpacity, ScrollView, ActivityIndicator, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import type { RecentSearch } from '../../navigation/services/recentSearch.service';

const Text = RNText;

interface SearchResultsProps {
    results: GeocodingPlace[];
    recentSearches?: RecentSearch[];
    onSelectPlace: (place: GeocodingPlace) => void;
    onPrepareSelect?: () => void;
    onRemoveRecent?: (place: GeocodingPlace) => void;
    onClearRecent?: () => void;
    isLoading?: boolean;
    showContainer?: boolean;
    showRecentSearches?: boolean;
}

const PlaceListItem = ({
    place,
    icon,
    iconBgClass,
    onSelectPlace,
    onPrepareSelect,
    onRemoveRecent,
}: {
    place: GeocodingPlace;
    icon: keyof typeof Ionicons.glyphMap;
    iconBgClass: string;
    onSelectPlace: (place: GeocodingPlace) => void;
    onPrepareSelect?: () => void;
    onRemoveRecent?: (place: GeocodingPlace) => void;
}) => {
    const handleSelect = () => {
        onPrepareSelect?.();
        Keyboard.dismiss();
        onSelectPlace(place);
    };

    return (
        <View className="border-b border-gray-100 flex-row items-center">
            <TouchableOpacity
                className="flex-1 p-4 flex-row items-center active:bg-gray-50"
                onPressIn={handleSelect}
                activeOpacity={0.7}
            >
                <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${iconBgClass}`}>
                    <Ionicons name={icon} size={20} color={icon === 'time-outline' ? '#6B7280' : '#F59E0B'} />
                </View>
                <View className="flex-1">
                    <Text className="font-semibold text-gray-900" numberOfLines={1}>
                        {place.name}
                    </Text>
                    <Text className="text-sm text-gray-500" numberOfLines={1}>
                        {place.type} • {place.City}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            {onRemoveRecent && (
                <TouchableOpacity
                    onPress={() => onRemoveRecent(place)}
                    className="p-4"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="close" size={18} color="#9CA3AF" />
                </TouchableOpacity>
            )}
        </View>
    );
};

export const SearchResults: React.FC<SearchResultsProps> = ({
    results,
    recentSearches = [],
    onSelectPlace,
    onPrepareSelect,
    onRemoveRecent,
    onClearRecent,
    isLoading = false,
    showContainer = false,
    showRecentSearches = false,
}) => {
    const { t } = useTranslation();

    if (!showContainer) return null;

    const showRecents = showRecentSearches && !isLoading;

    return (
        <View className="mt-3 bg-white rounded-3xl shadow-lg max-h-96 overflow-hidden">
            {isLoading ? (
                <View className="p-8 items-center justify-center">
                    <ActivityIndicator size="large" color="#F59E0B" />
                    <Text className="text-gray-500 mt-2">{t('searching')}</Text>
                </View>
            ) : showRecents ? (
                recentSearches.length === 0 ? (
                    <View className="p-8 items-center justify-center">
                        <Ionicons name="time-outline" size={48} color="#D1D5DB" />
                        <Text className="text-gray-500 mt-2">{t('no-recent-searches')}</Text>
                    </View>
                ) : (
                    <View>
                        <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
                            <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                                {t('recent-searches')}
                            </Text>
                            {onClearRecent && (
                                <TouchableOpacity onPress={onClearRecent} activeOpacity={0.7}>
                                    <Text className="text-sm font-medium text-amber-600">{t('clear-recent')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <ScrollView className="max-h-80" keyboardShouldPersistTaps="always">
                            {recentSearches.map((place) => (
                                <PlaceListItem
                                    key={`${place.latitude}-${place.longitude}-${place.searchedAt}`}
                                    place={place}
                                    icon="time-outline"
                                    iconBgClass="bg-gray-100"
                                    onSelectPlace={onSelectPlace}
                                    onPrepareSelect={onPrepareSelect}
                                    onRemoveRecent={onRemoveRecent}
                                />
                            ))}
                        </ScrollView>
                    </View>
                )
            ) : results.length === 0 ? (
                <View className="p-8 items-center justify-center">
                    <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                    <Text className="text-gray-500 mt-2">{t('no-results-found')}</Text>
                </View>
            ) : (
                <ScrollView className="max-h-80" keyboardShouldPersistTaps="always">
                    {results.map((place, index) => (
                        <PlaceListItem
                            key={`${place.latitude}-${place.longitude}-${index}`}
                            place={place}
                            icon="location"
                            iconBgClass="bg-yellow-100"
                            onSelectPlace={onSelectPlace}
                            onPrepareSelect={onPrepareSelect}
                        />
                    ))}
                </ScrollView>
            )}
        </View>
    );
};
