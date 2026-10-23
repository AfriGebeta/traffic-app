import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, Keyboard, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { navigationService } from '../../modules/navigation/services/navigation.service';
import type { GeocodingPlace } from '../../modules/navigation/types/navigation.types';
import { parseCoordinates } from '../utils/coordinates';
import { colors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

const SEARCH_DEBOUNCE_MS = 500;

export interface MapSearchBarRef {
    dismiss: () => void;
}

interface MapSearchBarProps {
    onSelect: (location: { lat: number; lng: number }) => void;
    hint?: string;
    style?: StyleProp<ViewStyle>;
}

export const MapSearchBar = forwardRef<MapSearchBarRef, MapSearchBarProps>(({ onSelect, hint, style }, ref) => {
    const { t } = useTranslation();
    const { colors: theme } = useTheme();
    const cardStyle = { backgroundColor: theme.background };
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<GeocodingPlace[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [noResults, setNoResults] = useState(false);
    const [coordMatch, setCoordMatch] = useState<{ lat: number; lng: number } | null>(null);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchRequestIdRef = useRef(0);

    const resetResults = () => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchRequestIdRef.current++;
        setSearchResults([]);
        setCoordMatch(null);
        setNoResults(false);
        setIsSearching(false);
    };

    useImperativeHandle(ref, () => ({
        dismiss: () => {
            resetResults();
            Keyboard.dismiss();
        },
    }));

    const selectLocation = (location: { lat: number; lng: number }) => {
        resetResults();
        Keyboard.dismiss();
        onSelect(location);
    };

    const runSearch = async (query: string, submit = false) => {
        const trimmed = query.trim();
        if (!trimmed) return;

        const coords = parseCoordinates(trimmed);
        if (coords) {
            if (submit) {
                selectLocation(coords);
            } else {
                resetResults();
                setCoordMatch(coords);
            }
            return;
        }
        setCoordMatch(null);

        const requestId = ++searchRequestIdRef.current;
        setIsSearching(true);
        try {
            const results = await navigationService.geocodePlace(trimmed);
            if (requestId !== searchRequestIdRef.current) return;
            setSearchResults(results);
            setNoResults(results.length === 0);
        } catch (error) {
            if (requestId !== searchRequestIdRef.current) return;
            console.error('error searching places:', error);
            setSearchResults([]);
            setNoResults(true);
        } finally {
            if (requestId === searchRequestIdRef.current) setIsSearching(false);
        }
    };

    useEffect(() => {
        resetResults();
        if (!searchQuery.trim()) return;

        searchTimeoutRef.current = setTimeout(() => runSearch(searchQuery), SEARCH_DEBOUNCE_MS);
        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [searchQuery]);

    const clearSearch = () => {
        resetResults();
        setSearchQuery('');
    };

    return (
        <View style={style}>
            <View className="rounded-2xl px-4 shadow-lg flex-row items-center" style={cardStyle}>
                <Ionicons name="search" size={20} color={theme.textSecondary} />
                <TextInput
                    className="flex-1 ml-2 py-3"
                    style={{ color: theme.textPrimary }}
                    placeholder={t('search-place-or-coordinates')}
                    placeholderTextColor={theme.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={() => runSearch(searchQuery, true)}
                    returnKeyType="search"
                    autoCorrect={false}
                />
                {isSearching ? (
                    <ActivityIndicator size="small" color={colors.primary.main} />
                ) : searchQuery.length > 0 ? (
                    <TouchableOpacity onPress={clearSearch} hitSlop={8}>
                        <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                ) : null}
            </View>

            {coordMatch ? (
                <TouchableOpacity
                    className="rounded-2xl mt-2 px-4 py-3 shadow-lg flex-row items-center"
                    style={cardStyle}
                    onPress={() => selectLocation(coordMatch)}
                    activeOpacity={0.7}
                >
                    <Ionicons name="navigate-outline" size={20} color={colors.primary.main} />
                    <View className="ml-3 flex-1">
                        <Text className="font-semibold" style={{ color: theme.textPrimary }}>{t('go-to-coordinates')}</Text>
                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                            {coordMatch.lat.toFixed(6)}, {coordMatch.lng.toFixed(6)}
                        </Text>
                    </View>
                </TouchableOpacity>
            ) : searchResults.length > 0 ? (
                <View className="rounded-2xl mt-2 shadow-lg overflow-hidden" style={cardStyle}>
                    <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                        {searchResults.map((place, index) => (
                            <TouchableOpacity
                                key={`${place.id}-${index}`}
                                className="px-4 py-3 flex-row items-center border-b"
                                style={{ borderColor: theme.border }}
                                onPress={() => selectLocation({ lat: place.location.lat, lng: place.location.lng })}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="location-outline" size={20} color={colors.primary.main} />
                                <View className="ml-3 flex-1">
                                    <Text className="font-semibold" style={{ color: theme.textPrimary }} numberOfLines={1}>{place.name}</Text>
                                    {!!place.display_name && place.display_name !== place.name && (
                                        <Text className="text-xs mt-0.5" style={{ color: theme.textSecondary }} numberOfLines={1}>{place.display_name}</Text>
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            ) : noResults ? (
                <View className="rounded-2xl mt-2 px-4 py-3 shadow-lg" style={cardStyle}>
                    <Text className="text-sm" style={{ color: theme.textSecondary }}>{t('no-results-found')}</Text>
                </View>
            ) : hint ? (
                <View className="rounded-2xl mt-2 px-4 py-3 shadow-lg flex-row items-center" style={cardStyle}>
                    <Ionicons name="information-circle" size={20} color={theme.blue} />
                    <Text className="text-sm ml-2 flex-1" style={{ color: theme.textPrimary }}>{hint}</Text>
                </View>
            ) : null}
        </View>
    );
});

MapSearchBar.displayName = 'MapSearchBar';
