import { useState, useRef, useEffect, useCallback } from 'react';
import { navigationService } from '../../navigation/services/navigation.service';
import { recentSearchService, type RecentSearch } from '../../navigation/services/recentSearch.service';
import { placeService } from '../../places/services/place.service';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import type { SavedPlace } from '../../places/types/place.types';
import { showToast } from '../../../shared/utils/toast';
import { dashboardEventsService } from '../../../shared/services/dashboard-events.service';

const parseCoordinates = (query: string): { lat: number; lng: number } | null => {
    const cleaned = query.trim().replace(/\s+/g, ' ');

    const patterns = [
        /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/,  //lat,lng
        /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/,  //lat lng
    ];

    for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                return { lat, lng };
            }
        }
    }

    return null;
};

export const useSearch = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<GeocodingPlace[]>([]);
    const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
    const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchContainer, setShowSearchContainer] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [showRecentSearches, setShowRecentSearches] = useState(false);

    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const skipSearchRef = useRef(false);
    const isSearchFocusedRef = useRef(false);

    const loadRecentSearches = useCallback(async () => {
        const recents = await recentSearchService.getRecentSearches();
        setRecentSearches(recents);
        return recents;
    }, []);

    const loadSavedPlaces = useCallback(async () => {
        try {
            const places = await placeService.getSavedPlaces();
            setSavedPlaces(places);
        } catch {
        }
    }, []);

    useEffect(() => {
        void loadRecentSearches();
        void loadSavedPlaces();
    }, [loadRecentSearches, loadSavedPlaces]);

    const handleSearch = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        dashboardEventsService.search(query.trim());
        setIsSearching(true);
        setShowRecentSearches(false);

        try {
            const coords = parseCoordinates(query);

            if (coords) {
                const result = await navigationService.reverseGeocode(coords.lat, coords.lng);
                setSearchResults([result]);
            } else {
                const results = await navigationService.geocodePlace(query);
                setSearchResults(results);
            }
        } catch {
            showToast('Search failed: Could not find location');
        } finally {
            setIsSearching(false);
        }
    };

    const updateSearchContainerVisibility = useCallback((focused: boolean, query: string) => {
        if (query.trim()) {
            setShowSearchContainer(true);
            setShowRecentSearches(false);
            return;
        }

        if (focused) {
            setShowSearchContainer(true);
            setShowRecentSearches(true);
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setShowSearchContainer(false);
        setShowRecentSearches(false);
    }, []);

    useEffect(() => {
        isSearchFocusedRef.current = isSearchFocused;
    }, [isSearchFocused]);

    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (skipSearchRef.current) {
            skipSearchRef.current = false;
            setShowSearchContainer(false);
            setShowRecentSearches(false);
            return;
        }

        if (searchQuery.trim()) {
            setShowSearchContainer(true);
            setShowRecentSearches(false);

            import('../../navigation/services/searchLog.service').then(({ searchLogService }) => {
                searchLogService.setSearchQuery(searchQuery);
            });

            searchTimeoutRef.current = setTimeout(() => {
                handleSearch(searchQuery);
            }, 500);
        } else {
            setSearchResults([]);
            setIsSearching(false);
            updateSearchContainerVisibility(isSearchFocusedRef.current, '');
        }

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery, updateSearchContainerVisibility]);

    const handleSearchFocus = useCallback(() => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }

        setIsSearchFocused(true);
        updateSearchContainerVisibility(true, searchQuery);
        void loadRecentSearches();
        void loadSavedPlaces();
    }, [loadRecentSearches, loadSavedPlaces, searchQuery, updateSearchContainerVisibility]);

    const handleSearchBlur = useCallback(() => {
        blurTimeoutRef.current = setTimeout(() => {
            setIsSearchFocused(false);
            if (!searchQuery.trim()) {
                setShowSearchContainer(false);
                setShowRecentSearches(false);
            }
        }, 150);
    }, [searchQuery]);

    const prepareSearchSelection = useCallback(() => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
    }, []);

    const dismissSearchPanel = useCallback(() => {
        prepareSearchSelection();
        isSearchFocusedRef.current = false;
        setIsSearchFocused(false);
        setShowSearchContainer(false);
        setShowRecentSearches(false);
    }, [prepareSearchSelection]);

    const recordRecentSearch = useCallback(async (place: GeocodingPlace, query?: string) => {
        const updated = await recentSearchService.addRecentSearch(place, query);
        setRecentSearches(updated);
    }, []);

    const removeRecentSearch = useCallback(async (place: GeocodingPlace) => {
        const updated = await recentSearchService.removeRecentSearch(place);
        setRecentSearches(updated);
    }, []);

    const clearRecentSearches = useCallback(async () => {
        await recentSearchService.clearRecentSearches();
        setRecentSearches([]);
    }, []);

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setShowSearchContainer(isSearchFocused);
        setShowRecentSearches(isSearchFocused);
    };

    return {
        searchQuery,
        setSearchQuery,
        searchResults,
        setSearchResults,
        recentSearches,
        savedPlaces,
        isSearching,
        showSearchContainer,
        setShowSearchContainer,
        showRecentSearches,
        isSearchFocused,
        skipSearchRef,
        clearSearch,
        handleSearchFocus,
        handleSearchBlur,
        prepareSearchSelection,
        dismissSearchPanel,
        recordRecentSearch,
        removeRecentSearch,
        clearRecentSearches,
        loadRecentSearches,
    };
};
