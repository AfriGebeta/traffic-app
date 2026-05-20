import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SearchBar } from './SearchBar';
import { QuickActions } from './QuickActions';
import { SearchResults } from './SearchResults';
import { DestinationCard } from './DestinationCard';
import { FloatingActions } from './FloatingActions';
import { BottomNavigation } from './BottomNavigation';
import { MapThemeSelector } from './MapThemeSelector';
import { showToast } from '../../../shared/utils/toast';
import { colors } from '../../../shared/theme/colors';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';

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
    onExplorePress: () => void;
    onLocationPress?: () => void;
    onVoicePress?: () => void;
    onVoiceRelease?: () => void;
    isRecording?: boolean;
    isProcessingVoice?: boolean;
    voiceNavigationData?: any;
    onExploreCategory?: (categoryId: string) => void;
    isExploring?: boolean;
    selectedExploreCategory?: string | null;
    isNavigationMinimized?: boolean;
    onRestoreNavigation?: () => void;
    navigationDestination?: GeocodingPlace | null;
    showRoutePreview?: boolean;
    showPlaceDetail?: boolean;
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
    onExplorePress,
    onLocationPress,
    onVoicePress,
    onVoiceRelease,
    isRecording,
    isProcessingVoice,
    voiceNavigationData,
    onExploreCategory,
    isExploring = false,
    selectedExploreCategory = null,
    isNavigationMinimized = false,
    onRestoreNavigation,
    navigationDestination,
    showRoutePreview = false,
    showPlaceDetail = false,
}) => {
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [showThemeSelector, setShowThemeSelector] = useState(false);

    const handleProfilePress = () => {
        router.push('/profile');
    };

    return (
        <>
            <View className="absolute left-4 right-4" style={{ top: insets.top + 10 }}>
                <SearchBar
                    value={searchQuery}
                    onChangeText={onSearchChange}
                    onClear={onSearchClear}
                    placeholder={t('where-to-go')}
                    onProfilePress={handleProfilePress}
                    isLoading={isExploring}
                />

                <QuickActions
                    onSelectCategory={onExploreCategory}
                    isLoading={isExploring}
                    selectedCategory={selectedExploreCategory}
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
                userLocation={userLocation}
                isRoutePreviewActive={showRoutePreview}
                isPlaceDetailActive={showPlaceDetail}
            />

            {isNavigationMinimized && navigationDestination && onRestoreNavigation && (
                <View className="absolute left-4 right-4" style={{ bottom: Math.max(insets.bottom + 120, 148) }}>
                    <TouchableOpacity
                        onPress={onRestoreNavigation}
                        className="rounded-2xl p-4 flex-row items-center justify-between shadow-lg"
                        style={{
                            backgroundColor: colors.primary.main,
                            shadowColor: colors.primary.main,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 8,
                        }}
                    >
                        <View className="flex-1">
                            <Text className="text-white text-sm font-semibold">{t('navigation-active') || 'Navigation Active'}</Text>
                            <Text className="text-white/80 text-xs" numberOfLines={1}>
                                {navigationDestination.name}
                            </Text>
                        </View>
                        <View className="bg-white/20 rounded-full px-3 py-1.5">
                            <Text className="text-white text-xs font-bold">{t('tap-to-return') || 'Tap to return'}</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            <BottomNavigation
                onTabPress={(tabId) => {
                    if (tabId === 'report') {
                        onReportPress();
                    } else if (tabId === 'explore') {
                        onExplorePress();
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
