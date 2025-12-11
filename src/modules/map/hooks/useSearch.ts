import { useState, useRef, useEffect } from 'react';
import { navigationService, GeocodingPlace } from '../../navigation/services/navigation.service';
import { showToast } from '../../../shared/utils/toast';

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
            const results = await navigationService.geocodePlace(query);
            setSearchResults(results);
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
