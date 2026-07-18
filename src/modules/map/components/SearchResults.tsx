import React from 'react';
import { View, Text as RNText, TouchableOpacity, ScrollView, ActivityIndicator, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import type { RecentSearch } from '../../navigation/services/recentSearch.service';
import type { SavedPlace, SavedPlaceType } from '../../places/types/place.types';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/colors';

const Text = RNText;

const SAVED_PLACE_CONFIG: Record<SavedPlaceType, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
    HOME: { icon: 'home', label: 'Home' },
    WORK: { icon: 'briefcase', label: 'Work' },
    FAVORITE: { icon: 'heart', label: 'Favorite' },
    CUSTOM: { icon: 'location', label: 'Custom' },
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
    id: `saved-${place.id}`,
    name: place.label,
    display_name: place.label,
    category: place.type,
    location: {
        lat: place.lat,
        lng: place.lng,
    },
    address: {
        city: '',
        country: '',
        country_code: '',
    },
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
    onClose?: () => void;
}

const PlaceListItem = ({
    place,
    icon,
    theme,
    onSelectPlace,
    onPrepareSelect,
    onRemoveRecent,
}: {
    place: GeocodingPlace;
    icon: keyof typeof Ionicons.glyphMap;
    theme: ThemeColors;
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
        <View className="flex-row items-center" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <TouchableOpacity
                className="flex-1 p-4 flex-row items-center"
                onPress={handleSelect}
                activeOpacity={0.7}
            >
                <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: icon === 'time-outline' ? theme.background : theme.primaryMuted }}
                >
                    <Ionicons name={icon} size={20} color={icon === 'time-outline' ? theme.textSecondary : theme.primary} />
                </View>
                <View className="flex-1">
                    <Text className="font-semibold" style={{ color: theme.textPrimary }} numberOfLines={1}>
                        {place.name}
                    </Text>
                    <Text className="text-sm" style={{ color: theme.textSecondary }} numberOfLines={1}>
                        {place.type} • {place.City}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
            {onRemoveRecent && (
                <TouchableOpacity
                    onPress={() => onRemoveRecent(place)}
                    className="p-4"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="close" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const SavedPlaceChips = ({
    savedPlaces,
    theme,
    onSelectPlace,
    onPrepareSelect,
}: {
    savedPlaces: SavedPlace[];
    theme: ThemeColors;
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
                                backgroundColor: isExpanded ? theme.primaryMuted : theme.background,
                                borderWidth: 1,
                                borderColor: isExpanded ? theme.primary : theme.border,
                            }}
                        >
                            <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 5 }}>
                                <Ionicons
                                    name={config.icon}
                                    size={22}
                                    color={theme.primary}
                                />
                            </View>
                            <Text
                                style={{
                                    fontSize: 12,
                                    fontWeight: '600',
                                    color: theme.primary,
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
                <View style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
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
                                borderBottomColor: theme.border,
                            }}
                        >
                            <Ionicons name="location-outline" size={18} color={theme.primary} style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary }} numberOfLines={1}>
                                    {place.label}
                                </Text>
                                <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 1 }} numberOfLines={1}>
                                    {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
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
    onClose,
}) => {
    const { t } = useTranslation();
    const { colors: theme } = useTheme();

    if (!showContainer) return null;

    const showRecents = showRecentSearches && !isLoading;
    const hasRecentSearches = recentSearches.length > 0;

    return (
        <View className="mt-3 rounded-3xl shadow-lg max-h-96 overflow-hidden" style={{ backgroundColor: theme.surface }}>
            {isLoading ? (
                <View className="p-8 items-center justify-center">
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text className="mt-2" style={{ color: theme.textSecondary }}>{t('searching')}</Text>
                </View>
            ) : showRecents ? (
                <>
                    {onClose && (
                        <View className="px-4 pt-3 pb-2 flex-row items-center justify-between" style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
                            <Text className="text-sm font-semibold" style={{ color: theme.textPrimary }}>{t('quick-access') || 'Quick Access'}</Text>
                            <TouchableOpacity
                                onPress={onClose}
                                activeOpacity={0.7}
                                className="p-1"
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="close" size={22} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    )}
                    <ScrollView className="max-h-80" keyboardShouldPersistTaps="always">
                        <SavedPlaceChips
                            savedPlaces={savedPlaces}
                            theme={theme}
                            onSelectPlace={onSelectPlace}
                            onPrepareSelect={onPrepareSelect}
                        />

                        {hasRecentSearches ? (
                            <>
                                <View className="px-4 pb-2 flex-row items-center justify-between">
                                    <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.textSecondary }}>
                                        {t('recent-searches')}
                                    </Text>
                                    {onClearRecent && (
                                        <TouchableOpacity onPress={onClearRecent} activeOpacity={0.7}>
                                            <Text className="text-sm font-medium" style={{ color: theme.primary }}>{t('clear-recent')}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                {recentSearches.map((place) => (
                                    <PlaceListItem
                                        key={`${place.latitude}-${place.longitude}-${place.searchedAt}`}
                                        place={place}
                                        icon="time-outline"
                                        theme={theme}
                                        onSelectPlace={onSelectPlace}
                                        onPrepareSelect={onPrepareSelect}
                                        onRemoveRecent={onRemoveRecent}
                                    />
                                ))}
                            </>
                        ) : (
                            <View className="px-4 pb-6 items-center">
                                <Text className="text-sm" style={{ color: theme.textSecondary }}>{t('no-recent-searches')}</Text>
                            </View>
                        )}
                    </ScrollView>
                </>
            ) : results.length === 0 ? (
                <View className="p-8 items-center justify-center">
                    <Ionicons name="search-outline" size={48} color={theme.border} />
                    <Text className="mt-2" style={{ color: theme.textSecondary }}>{t('no-results-found')}</Text>
                </View>
            ) : (
                <ScrollView className="max-h-80" keyboardShouldPersistTaps="always">
                    {results.map((place, index) => (
                        <PlaceListItem
                            key={`${place.latitude}-${place.longitude}-${index}`}
                            place={place}
                            icon="location"
                            theme={theme}
                            onSelectPlace={onSelectPlace}
                            onPrepareSelect={onPrepareSelect}
                        />
                    ))}
                </ScrollView>
            )}
        </View>
    );
};
