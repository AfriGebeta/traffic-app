import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SearchBar } from './SearchBar';
import { QuickActions } from './QuickActions';
import { SearchResults } from './SearchResults';
import { DestinationCard } from './DestinationCard';
import { FloatingActions } from './FloatingActions';
import { BottomNavigation } from './BottomNavigation';
import { MapThemeSelector } from './MapThemeSelector';
import { showToast } from '../../../shared/utils/toast';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import type { GebetaMapRef } from '../../../lib/gebeta-map/GebetaMap';

interface MapOverlayProps {
    searchQuery: string;
    onSearchChange: (text: string) => void;
    onSearchClear: () => void;
    searchResults: GeocodingPlace[];
    isSearching: boolean;
    showSearchContainer: boolean;
    onSelectPlace: (place: GeocodingPlace) => void;
    onCloseSearch: () => void;
    selectedDestination: GeocodingPlace | null;
    isNavigating: boolean;
    simulateMovement: boolean;
    onSimulateToggle: () => void;
    onNavigate: () => void;
    onClearRoute: () => void;
    userLocation: { lat: number; lng: number } | null;
    mapRef: React.RefObject<GebetaMapRef | null>;
    onReportPress: () => void;
    onAddPlacePress: () => void;
    onLocationPress?: () => void;
    onVoicePress?: () => void;
    onVoiceRelease?: () => void;
    isRecording?: boolean;
    isProcessingVoice?: boolean;
    voiceNavigationData?: any;
}

export const MapOverlay: React.FC<MapOverlayProps> = ({
    searchQuery,
    onSearchChange,
    onSearchClear,
    searchResults,
    isSearching,
    showSearchContainer,
    onSelectPlace,
    onCloseSearch,
    selectedDestination,
    isNavigating,
    simulateMovement,
    onSimulateToggle,
    onNavigate,
    onClearRoute,
    userLocation,
    mapRef,
    onReportPress,
    onAddPlacePress,
    onLocationPress,
    onVoicePress,
    onVoiceRelease,
    isRecording,
    isProcessingVoice,
    voiceNavigationData,
}) => {
    const { t } = useTranslation();
    const router = useRouter();
    const [showThemeSelector, setShowThemeSelector] = useState(false);

    const handleProfilePress = () => {
        router.push('/profile');
    };

    return (
        <>
            <View className="absolute top-8 left-4 right-4">
                <SearchBar
                    value={searchQuery}
                    onChangeText={onSearchChange}
                    onClear={onSearchClear}
                    placeholder={t('where-to-go')}
                    onProfilePress={handleProfilePress}
                />

                <QuickActions
                    onSelectCategory={(categoryId) => {
                        showToast.info(t('coming-soon'), categoryId);
                    }}
                />

                <SearchResults
                    results={searchResults}
                    onSelectPlace={onSelectPlace}
                    onClose={onCloseSearch}
                    isLoading={isSearching}
                    showContainer={showSearchContainer}
                />

            </View>

            <FloatingActions
                onLocationPress={onLocationPress}
                onThemePress={() => setShowThemeSelector(true)}
                onVoicePressIn={onVoicePress}
                onVoicePressOut={onVoiceRelease}
                isRecording={isRecording}
                isProcessingVoice={isProcessingVoice}
            />

            <BottomNavigation
                onTabPress={(tabId) => {
                    if (tabId === 'report') {
                        onReportPress();
                    } else {
                        showToast.info(t('coming-soon'), tabId);
                    }
                }}
                onAddPress={onAddPlacePress}
            />

            <MapThemeSelector
                visible={showThemeSelector}
                onClose={() => setShowThemeSelector(false)}
            />
        </>
    );
};
