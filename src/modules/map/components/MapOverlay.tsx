import React, { useState } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SearchBar, ProfileButton } from './SearchBar';
import { QuickActions } from './QuickActions';
import { FreeDriveButton } from './FreeDriveButton';
import { SosButton } from './SosButton';
import { MapLayersButton } from './MapLayersButton';
import { SearchResults } from './SearchResults';
import { DestinationCard } from './DestinationCard';
import { FloatingActions } from './FloatingActions';
import { BottomNavigation } from './BottomNavigation';
import { MapThemeSelector } from './MapThemeSelector';
import { RoutePointsBar } from '../../navigation/components/RoutePointsBar';
import { showToast } from '../../../shared/utils/toast';
import { useAuthGate } from '../../register/hooks/useAuthGate';
import { colors } from '../../../shared/theme/colors';
import { useLayout, PANEL_WIDTH, LAYOUT_GUTTER } from '../../../shared/layout/useLayout';
import type { RecentSearch } from '../../navigation/services/recentSearch.service';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import type { SavedPlace } from '../../places/types/place.types';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';

interface MapOverlayProps {
    searchQuery: string;
    onSearchChange: (text: string) => void;
    onSearchClear: () => void;
    onSearchFocus?: () => void;
    onSearchBlur?: () => void;
    searchResults: GeocodingPlace[];
    recentSearches?: RecentSearch[];
    savedPlaces?: SavedPlace[];
    isSearching: boolean;
    showSearchContainer: boolean;
    showRecentSearches?: boolean;
    onSelectPlace: (place: GeocodingPlace) => void;
    onPrepareSearchSelect?: () => void;
    onRemoveRecentSearch?: (place: GeocodingPlace) => void;
    onClearRecentSearches?: () => void;
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
    onTaxiPress?: () => void;
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
    showExploreResults?: boolean;
    routeOrigin?: GeocodingPlace | null;
    routeWaypoints?: GeocodingPlace[];
    routeDestination?: GeocodingPlace | null;
    onRouteOriginChange?: (place: GeocodingPlace | null) => void;
    onRouteWaypointsChange?: (waypoints: GeocodingPlace[]) => void;
    routeTransportMode?: 'driving' | 'taxi' | 'walking';
}

export const MapOverlay: React.FC<MapOverlayProps> = ({
    searchQuery,
    onSearchChange,
    onSearchClear,
    onSearchFocus,
    onSearchBlur,
    searchResults,
    recentSearches = [],

    savedPlaces = [],
    isSearching,
    showSearchContainer,
    showRecentSearches = false,
    onSelectPlace,
    onPrepareSearchSelect,
    onRemoveRecentSearch,
    onClearRecentSearches,
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
    onTaxiPress,
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
    showExploreResults = false,
    routeOrigin,
    routeWaypoints = [],
    routeDestination,
    onRouteOriginChange,
    
    onRouteWaypointsChange,
    routeTransportMode = 'driving',
}) => {
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { requireAuth } = useAuthGate();
    const [showThemeSelector, setShowThemeSelector] = useState(false);
    const [layersButtonBottom, setLayersButtonBottom] = useState(0);
    const [searchBarHeight, setSearchBarHeight] = useState(0);
    const [chipRowHeight, setChipRowHeight] = useState(0);
    const { height: windowHeight } = useWindowDimensions();
    const { isCompact, isMedium, isWide, centeredInset, panelLeft } = useLayout();

    // phones: null, so the existing className positioning is untouched
    const columnPlacement = isWide
        ? { left: panelLeft(), right: 'auto' as const, width: PANEL_WIDTH }
        : isMedium
            ? { left: centeredInset(560), right: centeredInset(560) }
            : null;
    const bannerPlacement = isWide
        ? { left: panelLeft(), right: 'auto' as const, width: PANEL_WIDTH, bottom: insets.bottom + LAYOUT_GUTTER }
        : isMedium
            ? { left: centeredInset(), right: centeredInset() }
            : null;
    // wide: the rail stays visible next to place details / route preview, phones hide the bottom bar
    const showNavigationTabs = isWide || (!showRoutePreview && !showPlaceDetail);

    const handleProfilePress = () => {
        router.push('/profile');
    };

    return (
        <>
            {showSearchContainer && showRecentSearches && (
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={onCloseSearch}
                    className="absolute inset-0 bg-black/20"
                    style={{ zIndex: 10 }}
                />
            )}

            {!showRoutePreview && (
                <View className="absolute left-4 right-4" style={[{ top: insets.top + 10, zIndex: 20 }, columnPlacement]}>
                    <View onLayout={isWide ? (e) => setSearchBarHeight(e.nativeEvent.layout.height) : undefined}>
                        <SearchBar
                            value={searchQuery}
                            onChangeText={onSearchChange}
                            onClear={onSearchClear}
                            onFocus={onSearchFocus}
                            onBlur={onSearchBlur}
                            placeholder={t('where-to-go')}
                            onProfilePress={handleProfilePress}
                            isLoading={isExploring}
                            hideProfile={isWide}
                        />
                    </View>

                    {!isWide && (
                        <QuickActions
                            onSelectCategory={onExploreCategory}
                            isLoading={isExploring}
                            selectedCategory={selectedExploreCategory}
                        />
                    )}

                    {!showSearchContainer && !isWide && (
                        <>
                            {isCompact && <FreeDriveButton userLocation={userLocation} />}
                            <SosButton userLocation={userLocation} />
                        </>
                    )}

                    <SearchResults
                        results={searchResults}
                        recentSearches={recentSearches}
                        savedPlaces={savedPlaces}
                        onSelectPlace={onSelectPlace}
                        onPrepareSelect={onPrepareSearchSelect}
                        onRemoveRecent={onRemoveRecentSearch}
                        onClearRecent={onClearRecentSearches}
                        isLoading={isSearching}
                        showContainer={showSearchContainer}
                        showRecentSearches={showRecentSearches}
                        onClose={onCloseSearch}
                    />

                </View>
            )}

            {/* wide: free drive + SOS move to the top-right corner instead of hanging off the panel */}
            {/* wide: category chips run along the top of the map, beside the search panel */}
            {!showRoutePreview && isWide && (
                <QuickActions
                    onSelectCategory={onExploreCategory}
                    isLoading={isExploring}
                    selectedCategory={selectedExploreCategory}
                    onLayout={(e) => setChipRowHeight(e.nativeEvent.layout.height)}
                    contentContainerStyle={{ paddingBottom: 0 }}
                    style={{
                        position: 'absolute',
                        top: insets.top + 10 + (searchBarHeight - chipRowHeight) / 2,
                        left: panelLeft() + PANEL_WIDTH + LAYOUT_GUTTER,
                        right: insets.right + 16 + 48 + LAYOUT_GUTTER,
                        marginTop: 0,
                        marginHorizontal: 0,
                        zIndex: 20,
                    }}
                />
            )}

            {!showRoutePreview && isWide && (
                <View className="absolute items-end" style={{ top: insets.top + 10, right: insets.right + 16, zIndex: 20 }}>
                    <ProfileButton onPress={handleProfilePress} size={48} />
                    {!showSearchContainer && <SosButton userLocation={userLocation} />}
                </View>
            )}

            {showRoutePreview && routeDestination && (
                <View className="absolute left-4 right-4" style={[{ top: insets.top + 10, zIndex: 20 }, columnPlacement]}>
                    <RoutePointsBar
                        origin={routeOrigin || null}
                        waypoints={routeWaypoints}
                        destination={routeDestination}
                        onOriginChange={onRouteOriginChange}
                        onWaypointsChange={onRouteWaypointsChange}
                        onClose={onClearRoute}
                        transportMode={routeTransportMode}
                    />
                </View>
            )}

            <FloatingActions
                onLocationPress={onLocationPress}
                onTaxiPress={onTaxiPress}
                isRoutePreviewActive={showRoutePreview}
                isPlaceDetailActive={showPlaceDetail || showExploreResults}
                middleActions={
                    !showRoutePreview && !showSearchContainer && (
                        <MapLayersButton
                            onPress={({ y, height }) => {
                                setLayersButtonBottom(windowHeight - (y + height));
                                setShowThemeSelector(true);
                            }}
                        />
                    )
                }
                bottomActions={
                    !isCompact && !showRoutePreview && !showSearchContainer && (
                        <FreeDriveButton userLocation={userLocation} />
                    )
                }
            />

            {isNavigationMinimized && navigationDestination && onRestoreNavigation && (
                <View className="absolute left-4 right-4" style={[{ bottom: Math.max(insets.bottom + 120, 148) }, bannerPlacement]}>
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

            {showNavigationTabs && (
                <BottomNavigation
                    onTabPress={(tabId) => {
                        void requireAuth(() => {
                            if (tabId === 'report') {
                                onReportPress();
                            } else if (tabId === 'explore') {
                                onExplorePress();
                            } else if (tabId === 'saved') {
                                router.push('/saved-places');
                            } else if (tabId === 'ai') {
                                router.push('/ai-assistant');
                            } else {
                                showToast(`${t('coming-soon')}: ${tabId}`);
                            }
                        });
                    }}
                    onAddPress={() => {
                        void requireAuth(onAddPlacePress);
                    }}
                />
            )}

            <MapThemeSelector
                visible={showThemeSelector}
                onClose={() => setShowThemeSelector(false)}
                bottomOffset={layersButtonBottom}
            />
        </>
    );
};
