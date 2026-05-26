import React from 'react';
import { View, Text as RNText, TouchableOpacity, ScrollView, ActivityIndicator, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import type { RecentSearch } from '../../navigation/services/recentSearch.service';
import type { SavedPlace, SavedPlaceType } from '../../places/types/place.types';
import { colors } from '../../../shared/theme/colors';

const Text = RNText;

const SAVED_PLACE_CONFIG: Record<SavedPlaceType, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
    HOME:     { icon: 'home',      label: 'Home' },
    WORK:     { icon: 'briefcase', label: 'Work' },
    FAVORITE: { icon: 'heart',     label: 'Favorite' },
};

const CHIP_ORDER: SavedPlaceType[] = ['HOME', 'WORK', 'FAVORITE'];

const normalizeSavedPlaceType = (type: string): SavedPlaceType | null => {
    const normalized = type.toUpperCase();
    if (normalized === 'HOME' || normalized === 'WORK' || normalized === 'FAVORITE') {
        return normalized;
    }
    return null;
};

const savedPlaceToGeocodingPlace = (place: SavedPlace): GeocodingPlace => ({
    name: place.label,
    latitude: place.lat,
    longitude: place.lng,
    Country: '',
    City: '',
    type: place.type,
});

interface SearchResultsProps {
    results: GeocodingPlace[];
    recentSearches?: RecentSearch[];
    savedPlaces?: SavedPlace[];
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
                onPress={handleSelect}
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

const SavedPlaceChips = ({
    savedPlaces,
    onSelectPlace,
    onPrepareSelect,
}: {
    savedPlaces: SavedPlace[];
    onSelectPlace: (place: GeocodingPlace) => void;
    onPrepareSelect?: () => void;
}) => {
    const router = useRouter();
    const [selectedType, setSelectedType] = React.useState<SavedPlaceType | null>(null);

    const placesByType = React.useMemo(() => {
        const map: Partial<Record<SavedPlaceType, SavedPlace[]>> = {};
        for (const p of savedPlaces) {
            const type = normalizeSavedPlaceType(p.type);
            if (!type) continue;
            if (!map[type]) map[type] = [];
            map[type]!.push(p);
        }
        return map;
    }, [savedPlaces]);

    const handleChipPress = (type: SavedPlaceType) => {
        const places = placesByType[type];
        if (!places || places.length === 0) {
            Keyboard.dismiss();
            router.push('/saved-places');
            return;
        }
        setSelectedType(prev => (prev === type ? null : type));
    };

    const handleSelectPlace = (place: SavedPlace) => {
        onPrepareSelect?.();
        Keyboard.dismiss();
        setSelectedType(null);
        onSelectPlace(savedPlaceToGeocodingPlace(place));
    };

    const expandedPlaces = selectedType ? (placesByType[selectedType] ?? []) : [];

    return (
        <View>
            <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, gap: 8 }}>
                {CHIP_ORDER.map((type) => {
                    const config = SAVED_PLACE_CONFIG[type];
                    const isExpanded = selectedType === type;

                    return (
                        <TouchableOpacity
                            key={type}
                            onPress={() => handleChipPress(type)}
                            activeOpacity={0.75}
                            style={{
                                flex: 1,
                                alignItems: 'center',
                                paddingVertical: 10,
                                paddingHorizontal: 6,
                                borderRadius: 12,
                                backgroundColor: isExpanded ? `${colors.primary.main}10` : colors.gray[50],
                                borderWidth: 1,
                                borderColor: isExpanded ? colors.primary.main : colors.gray[200],
                            }}
                        >
                            <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 5 }}>
                                <Ionicons
                                    name={config.icon}
                                    size={22}
                                    color={colors.primary.main}
                                />
                            </View>
                            <Text
                                style={{
                                    fontSize: 12,
                                    fontWeight: '600',
                                    color: colors.primary.dark,
                                    textAlign: 'center',
                                }}
                                numberOfLines={1}
                            >
                                {config.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {expandedPlaces.length > 0 && (
                <View style={{ borderTopWidth: 1, borderTopColor: colors.gray[100] }}>
                    {expandedPlaces.map((place) => (
                        <TouchableOpacity
                            key={place.id}
                            onPress={() => handleSelectPlace(place)}
                            activeOpacity={0.7}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 16,
                                paddingVertical: 12,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.gray[100],
                            }}
                        >
                            <Ionicons name="location-outline" size={18} color={colors.primary.main} style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.gray[800] }} numberOfLines={1}>
                                    {place.label}
                                </Text>
                                <Text style={{ fontSize: 12, color: colors.gray[500], marginTop: 1 }} numberOfLines={1}>
                                    {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.gray[500]} />
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
};

export const SearchResults: React.FC<SearchResultsProps> = ({
    results,
    recentSearches = [],
    savedPlaces = [],
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
    const hasRecentSearches = recentSearches.length > 0;

    return (
        <View className="mt-3 bg-white rounded-3xl shadow-lg max-h-96 overflow-hidden">
            {isLoading ? (
                <View className="p-8 items-center justify-center">
                    <ActivityIndicator size="large" color="#F59E0B" />
                    <Text className="text-gray-500 mt-2">{t('searching')}</Text>
                </View>
            ) : showRecents ? (
                <ScrollView className="max-h-80" keyboardShouldPersistTaps="always">
                    <SavedPlaceChips
                        savedPlaces={savedPlaces}
                        onSelectPlace={onSelectPlace}
                        onPrepareSelect={onPrepareSelect}
                    />

                    {hasRecentSearches ? (
                        <>
                            <View className="px-4 pb-2 flex-row items-center justify-between">
                                <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                    {t('recent-searches')}
                                </Text>
                                {onClearRecent && (
                                    <TouchableOpacity onPress={onClearRecent} activeOpacity={0.7}>
                                        <Text className="text-sm font-medium text-amber-600">{t('clear-recent')}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
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
                        </>
                    ) : (
                        <View className="px-4 pb-6 items-center">
                            <Text className="text-gray-400 text-sm">{t('no-recent-searches')}</Text>
                        </View>
                    )}
                </ScrollView>
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
