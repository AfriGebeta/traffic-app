import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, Keyboard, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { navigationService } from '../../modules/navigation/services/navigation.service';
import type { GeocodingPlace } from '../../modules/navigation/types/navigation.types';
import { parseCoordinates } from '../utils/coordinates';
import { colors } from '../theme/colors';

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
            <View className="bg-white rounded-2xl px-4 shadow-lg flex-row items-center">
                <Ionicons name="search" size={20} color="#6B7280" />
                <TextInput
                    className="flex-1 ml-2 py-3 text-gray-900"
                    placeholder={t('search-place-or-coordinates')}
                    placeholderTextColor="#9CA3AF"
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
                        <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                ) : null}
            </View>

            {coordMatch ? (
                <TouchableOpacity
                    className="bg-white rounded-2xl mt-2 px-4 py-3 shadow-lg flex-row items-center"
                    onPress={() => selectLocation(coordMatch)}
                    activeOpacity={0.7}
                >
                    <Ionicons name="navigate-outline" size={20} color={colors.primary.main} />
                    <View className="ml-3 flex-1">
                        <Text className="font-semibold text-gray-900">{t('go-to-coordinates')}</Text>
                        <Text className="text-xs text-gray-500 mt-0.5">
                            {coordMatch.lat.toFixed(6)}, {coordMatch.lng.toFixed(6)}
                        </Text>
                    </View>
                </TouchableOpacity>
            ) : searchResults.length > 0 ? (
                <View className="bg-white rounded-2xl mt-2 shadow-lg overflow-hidden">
                    <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                        {searchResults.map((place, index) => (
                            <TouchableOpacity
                                key={`${place.id}-${index}`}
                                className="px-4 py-3 flex-row items-center border-b border-gray-100"
                                onPress={() => selectLocation({ lat: place.location.lat, lng: place.location.lng })}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="location-outline" size={20} color={colors.primary.main} />
                                <View className="ml-3 flex-1">
                                    <Text className="font-semibold text-gray-900" numberOfLines={1}>{place.name}</Text>
                                    {!!place.display_name && place.display_name !== place.name && (
                                        <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>{place.display_name}</Text>
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            ) : noResults ? (
                <View className="bg-white rounded-2xl mt-2 px-4 py-3 shadow-lg">
                    <Text className="text-sm text-gray-500">{t('no-results-found')}</Text>
                </View>
            ) : hint ? (
                <View className="bg-white rounded-2xl mt-2 px-4 py-3 shadow-lg flex-row items-center">
                    <Ionicons name="information-circle" size={20} color="#3B82F6" />
                    <Text className="text-sm text-gray-700 ml-2 flex-1">{hint}</Text>
                </View>
            ) : null}
        </View>
    );
});

MapSearchBar.displayName = 'MapSearchBar';
