import { useState, useRef, useEffect } from 'react';
import { navigationService } from '../../navigation/services/navigation.service';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import { showToast } from '../../../shared/utils/toast';

//parse input
const parseCoordinates = (query: string): { lat: number; lng: number } | null => {
    const cleaned = query.trim().replace(/\s+/g, ' ');


    const patterns = [
        /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/,  // lat, lng
        /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/,       // lat lng
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
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchContainer, setShowSearchContainer] = useState(false);

    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const skipSearchRef = useRef(false);

    const handleSearch = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        try {
            //checking query for coordinates
            const coords = parseCoordinates(query);

            if (coords) {
                //rev geocode
                const result = await navigationService.reverseGeocode(coords.lat, coords.lng);
                setSearchResults([result]);
            } else {
                // regular geocode
                const results = await navigationService.geocodePlace(query);
                setSearchResults(results);
            }
        } catch (error) {
            showToast.error('Search failed', 'Could not find location');
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (skipSearchRef.current) {
            skipSearchRef.current = false;
            setShowSearchContainer(false);
            return;
        }

        if (searchQuery.trim()) {
            setShowSearchContainer(true);
            searchTimeoutRef.current = setTimeout(() => {
                handleSearch(searchQuery);
            }, 500);
        } else {
            setSearchResults([]);
            setIsSearching(false);
            setShowSearchContainer(false);
        }

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery]);

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setShowSearchContainer(false);
    };

    return {
        searchQuery,
        setSearchQuery,
        searchResults,
        setSearchResults,
        isSearching,
        showSearchContainer,
        setShowSearchContainer,
        skipSearchRef,
        clearSearch,
    };
};
