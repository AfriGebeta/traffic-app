import React, { useRef, useState, useEffect } from 'react';
import { View, LogBox, BackHandler, StatusBar } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import CustomGebetaMap from '../../../components/GebetaMap';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { NavigationBar } from './NavigationBar';
import { NavigationOverlay } from './NavigationOverlay';
import { IncidentAlert } from './IncidentAlert';
import { RuleAlert } from './RuleAlert';
import { MapOverlay } from './MapOverlay';
import { IncidentReportSheet } from './IncidentReportSheet';
import { PlaceDetailsSheet } from './PlaceDetailsSheet';
import { ExploreSheet } from '../../explore/components/ExploreSheet';
import { RoutePreview } from '../../navigation/components/RoutePreview';

import { NavigationOptionsModal } from '../../navigation/components/NavigationOptionsModal';
import { VoiceNavigationModal } from '../../navigation/components/VoiceNavigationModal';
import { useIncidents } from '../../incidents/hooks/useIncidents';
import { useUserLocation } from '../hooks/useUserLocation';
import { useSearch } from '../hooks/useSearch';
import { useNavigation } from '../../navigation/hooks/useNavigation';
import { useVoiceNavigation } from '../../navigation/hooks/useVoiceNavigation';
import { useNavigationTracking } from '../../navigation/hooks/useNavigationTracking';
import { useBackgroundSync } from '../../navigation/hooks/useBackgroundSync';
import { useIncidentAlerts } from '../hooks/useIncidentAlerts';
import { useRuleAlerts } from '../hooks/useRuleAlerts';
import { useMapMarkers } from '../hooks/useMapMarkers';
import { useMapTheme } from '../context/MapThemeContext';
import { useExplore } from '../hooks/useExplore';
import { useMapClick } from '../hooks/useMapClick';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from 'react-i18next';

import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import { useRulePreferences } from '../../rules/hooks/useRulePreferences';
import type { SharedLocation } from '../../../shared/utils/deepLinking';

interface TrafficMapProps {
    sharedLocation?: SharedLocation | null;
}

export default function TrafficMap({ sharedLocation }: TrafficMapProps) {
    const mapRef = useRef<GebetaMapRef>(null);
    const searchMarkerRef = useRef<any>(null);
    const hasZoomedToUserLocation = useRef(false);
    const hasProcessedSharedLocation = useRef(false);
    const router = useRouter();

    const [initialCenter] = useState<[number, number]>([38.7463, 9.0223]);
    const [initialZoom] = useState(12);
    const [showReportOptions, setShowReportOptions] = useState(false);
    const [showExploreSheet, setShowExploreSheet] = useState(false);
    const [selectedExploreCategory, setSelectedExploreCategory] = useState<string | null>(null);
    const [selectedExplorePlace, setSelectedExplorePlace] = useState<GeocodingPlace | null>(null);
    const [showUserLocationMarker, setShowUserLocationMarker] = useState(false);
    const [clickedLocation, setClickedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isNavigationMinimized, setIsNavigationMinimized] = useState(false);
    const [hasUserZoomedOut, setHasUserZoomedOut] = useState(false);
    const [isOnIncidentReportScreen, setIsOnIncidentReportScreen] = useState(false);
    const [isMapLoaded, setIsMapLoaded] = useState(false);

    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { incidents, refetch } = useIncidents();
    const { userLocation, setUserLocation, stopLocationTracking: stopBackgroundTracking, startLocationTracking: startBackgroundTracking } = useUserLocation();
    const { currentTheme } = useMapTheme();
    const { isLoading: isExploring, results: exploreResults, searchNearby, clearResults: clearExploreResults } = useExplore();
    const { refetch: refetchRulePreferences } = useRulePreferences();

    const {
        searchQuery,
        setSearchQuery,
        searchResults,
        setSearchResults,
        isSearching,
        showSearchContainer,
        setShowSearchContainer,
        skipSearchRef,
        clearSearch,
    } = useSearch();

    const {
        selectedDestination,
        setSelectedDestination,
        isNavigating,
        navigationMode,

        showRoutePreview,
        setShowRoutePreview,
        currentHeading,
        simulateMovement,
        setSimulateMovement,
        currentInstruction,
        remainingDistance,
        remainingTime,
        isOffRoute,
        isRecalculating,
        routeCoordinates,

        routeGeoJSON,
        handleNavigate,

        handleStartNavigation,
        handleStopNavigation,
        handleClearRoute,
        simulateOffRoute,
        recalculateRoute,
    } = useNavigation(mapRef, userLocation, setUserLocation, stopBackgroundTracking, startBackgroundTracking);

    const [nearbyRules, setNearbyRules] = useState<any[]>([]);

    const fetchRules = React.useCallback(async () => {
        try {
            console.log('[Rules] fetchRules called');
            const { ruleService } = await import('../../rules/services/rule.service');
            const rules = await ruleService.getAllReports();
            console.log('[Rules] fetched count:', rules.length);
            setNearbyRules(rules);
        } catch (error) {
            console.log('[Rules] fetchRules error:', error);
        }
    }, []);

    // Read directly from storage — never rely on hook's async initial state
    useEffect(() => {
        let cancelled = false;
        import('../../rules/services/preferences.service').then(({ rulePreferencesService }) => {
            rulePreferencesService.getPreferences().then((prefs) => {
                if (cancelled) return;
                console.log('[Rules] storage read on mount — showOnMap:', prefs.showOnMap, 'navigationMode:', navigationMode);
                if (prefs.showOnMap || navigationMode) {
                    fetchRules();
                } else {
                    setNearbyRules([]);
                }
            });
        });
        return () => { cancelled = true; };
    }, [navigationMode, fetchRules]);

    const { activeAlert: activeIncidentAlert, dismissAlert: dismissIncidentAlert } = useIncidentAlerts(userLocation, incidents, navigationMode, routeCoordinates);
    const activeRuleAlert = useRuleAlerts(userLocation, nearbyRules, navigationMode, routeCoordinates);
    const { addIncidentMarkers } = useMapMarkers(mapRef, incidents);

    const handleSelectPlace = (place: GeocodingPlace, autoNavigate: boolean = true) => {
        if (searchMarkerRef.current) {
            mapRef.current?.clearMarkers();
            addIncidentMarkers();
        }

        const marker = mapRef.current?.addImageMarker(
            [place.longitude, place.latitude],
            '',
            [40, 40],
            () => showToast.info(place.name, place.type),
            10,
            undefined
        );
        searchMarkerRef.current = marker;

        // clear search result
        setSearchResults([]);
        setShowSearchContainer(false);
        setSelectedDestination(place);
        setSearchQuery('');

        setClickedLocation(null);

        if (autoNavigate) {
            setTimeout(() => {
                handleNavigate(setUserLocation, place);
            }, 300);
        }
    };

    const handleSelectSharedPlace = (place: GeocodingPlace) => {
        if (searchMarkerRef.current) {
            mapRef.current?.clearMarkers();
            addIncidentMarkers();
        }

        const marker = mapRef.current?.addImageMarker(
            [place.longitude, place.latitude],
            '',
            [40, 40],
            () => showToast.info(place.name, place.type),
            10,
            undefined
        );
        searchMarkerRef.current = marker;

        setSelectedDestination(place);
        setClickedLocation(null);

    };
    const { handleMapClick } = useMapClick({
        navigationMode,
        onSelectPlace: handleSelectPlace,
        setSelectedDestination,
        setSearchQuery,
        skipSearchRef,
        setClickedLocation,
    });

    const {
        isRecording,
        isProcessingVoice,
        navigationData: voiceNavigationData,
        options: voiceOptions,
        showOptions: showVoiceOptions,
        showVoiceModal,

        transcription: voiceTranscription,
        handleVoicePress,
        handleVoiceStart,
        handleVoiceStop,
        handleCloseVoiceModal,
        handleOptionSelect,
        clearVoiceNavigation,
    } = useVoiceNavigation({
        mapRef,
        userLocation,
        language: 'amh',
        onDestinationFound: handleSelectPlace,
    });

    const handleExploreCategory = async (categoryId: string) => {
        if (!userLocation) {
            showToast.error(t('location-unavailable'), t('please-wait-for-location'));
            return;
        }

        if (selectedExploreCategory === categoryId) {
            setSelectedExploreCategory(null);
            clearExploreResults();
            setSearchResults([]);
            setShowSearchContainer(false);
            return;
        }

        setSelectedExploreCategory(categoryId);

        try {
            const places = await searchNearby(categoryId, userLocation);

            setSearchResults([]);
            setShowSearchContainer(false);

            if (places.length > 0) {
                const bounds = places.reduce((acc, place) => {
                    return {
                        minLng: Math.min(acc.minLng, place.longitude),
                        maxLng: Math.max(acc.maxLng, place.longitude),
                        minLat: Math.min(acc.minLat, place.latitude),
                        maxLat: Math.max(acc.maxLat, place.latitude),
                    };
                }, {
                    minLng: places[0].longitude,
                    maxLng: places[0].longitude,
                    minLat: places[0].latitude,
                    maxLat: places[0].latitude,
                });

                const centerLng = (bounds.minLng + bounds.maxLng) / 2;
                const centerLat = (bounds.minLat + bounds.maxLat) / 2;

                mapRef.current?.flyTo({
                    center: [centerLng, centerLat],
                    zoom: 13,
                    duration: 1000,
                });
            }
        } catch (error) {
            showToast.error(t('search-failed'), t('please-try-again'));
            setSelectedExploreCategory(null);
        }
    };

    const handleNavigateToExplorePlace = (place: GeocodingPlace) => {
        handleSelectPlace(place);
    };

    useEffect(() => {
        LogBox.ignoreLogs(['MapLibre error', 'Failed to load sprite']);
    }, []);


    useEffect(() => {
        if (params.refresh === 'true') {
            refetch();
        }
    }, [params.refresh, refetch]);

    useFocusEffect(
        React.useCallback(() => {
            console.log('[Rules] useFocusEffect fired');
            refetch();
            import('../../rules/services/preferences.service').then(({ rulePreferencesService }) => {
                rulePreferencesService.getPreferences().then((prefs) => {
                    console.log('[Rules] useFocusEffect direct storage read — showOnMap:', prefs.showOnMap);
                    if (prefs.showOnMap || navigationMode) {
                        fetchRules();
                    } else {
                        setNearbyRules([]);
                    }
                });
            });
            setIsOnIncidentReportScreen(false);
        }, [navigationMode, fetchRules])
    );

    const handleMapLoaded = () => {
        setIsMapLoaded(true);
        setTimeout(() => {
            addIncidentMarkers();
        }, 1000);
    };

    const handleLocationPress = () => {
        if (!userLocation) {
            showToast.error('Location not available', 'Please wait for location to load');
            return;
        }

        if (!mapRef.current) {
            showToast.error('Map not ready', 'Please try again');
            return;
        }

        setShowUserLocationMarker(true);

        mapRef.current.flyTo({
            center: [userLocation.lng, userLocation.lat],
            zoom: 15,
            duration: 1000,
        });
    };

    const handleRecenter = () => {
        if (!userLocation || !mapRef.current) return;

        const offsetDistance = 0.0007;
        const headingRad = ((currentHeading || 0) * Math.PI) / 180;
        const latOffset = offsetDistance * Math.cos(headingRad);
        const lngOffset = offsetDistance * Math.sin(headingRad);

        mapRef.current.flyTo({
            center: [userLocation.lng + lngOffset, userLocation.lat + latOffset],
            zoom: 18,
            duration: 500,
            pitch: 60,
        });

        //reset the flag
        setHasUserZoomedOut(false);
    };

    useNavigationTracking({
        isNavigating: navigationMode,
        userLocation,
    });

    useBackgroundSync();

    useEffect(() => {
        if (userLocation && mapRef.current && !navigationMode && !hasZoomedToUserLocation.current && !sharedLocation && !selectedDestination) {
            hasZoomedToUserLocation.current = true;
            setShowUserLocationMarker(true);
            mapRef.current.flyTo({
                center: [userLocation.lng, userLocation.lat],
                zoom: 15,
                duration: 1500,
            });
        }
    }, [userLocation?.lat, userLocation?.lng, navigationMode, sharedLocation, selectedDestination]);

    useEffect(() => {
        if (sharedLocation && mapRef.current && isMapLoaded && !hasProcessedSharedLocation.current) {
            hasProcessedSharedLocation.current = true;

            const place: GeocodingPlace = {
                name: sharedLocation.name || 'Shared Location',
                latitude: sharedLocation.lat,
                longitude: sharedLocation.lng,
                type: sharedLocation.type || 'location',
                City: sharedLocation.city || '',
                Country: sharedLocation.country || '',
            };

            setSearchResults([place]);
            setShowSearchContainer(true);
            setSelectedDestination(place);

            setTimeout(() => {
                mapRef.current?.flyTo({
                    center: [place.longitude, place.latitude],
                    zoom: 15,
                    duration: 1500,
                });
            }, 100);
        }
    }, [sharedLocation, isMapLoaded]);

    useEffect(() => {
        if (!navigationMode) return;

        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (showReportOptions || isOnIncidentReportScreen) {
                return false;
            }
            handleStopNavigation();
            return true;
        });

        return () => backHandler.remove();
    }, [navigationMode, handleStopNavigation, showReportOptions, isOnIncidentReportScreen]);

    return (
        <View className="flex-1">
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
            <CustomGebetaMap
                ref={mapRef}
                apiKey={process.env.EXPO_PUBLIC_GEBETA_API_KEY!}
                mapStyleUrl={currentTheme.styleUrl ? `${currentTheme.styleUrl}?apiKey=${process.env.EXPO_PUBLIC_GEBETA_API_KEY}` : undefined}

                mapStyleJson={currentTheme.styleJson}
                center={initialCenter}
                zoom={initialZoom}
                onMapClick={handleMapClick}
                onMapLoaded={handleMapLoaded}
                routeGeoJSON={isNavigationMinimized ? undefined : routeGeoJSON}
                routeStyle={{
                    color: '#3B82F6',
                    width: 5,
                    opacity: 0.8
                }}
                isNavigating={navigationMode && !isNavigationMinimized}
                userLocation={userLocation}
                selectedDestination={selectedDestination}
                onUserInteraction={() => setHasUserZoomedOut(true)}

                userHeading={currentHeading}
                showUserLocationMarker={showUserLocationMarker}
                incidents={incidents}
                rules={nearbyRules}
                clickedLocation={clickedLocation}
                explorePlaces={exploreResults}
                exploreCategory={selectedExploreCategory}
                onExplorePlacePress={(place) => setSelectedExplorePlace(place)}
            />

            {activeIncidentAlert && (
                <IncidentAlert
                    incidentId={activeIncidentAlert.incidentId}
                    incidentName={activeIncidentAlert.incidentName}
                    distance={activeIncidentAlert.distance}
                    distanceKm={activeIncidentAlert.distanceKm}
                    incidentType={activeIncidentAlert.incidentType}
                    onDismiss={dismissIncidentAlert}
                />
            )}

            {activeRuleAlert && (
                <RuleAlert
                    ruleId={activeRuleAlert.ruleId}
                    ruleName={activeRuleAlert.ruleName}
                    ruleImg={activeRuleAlert.ruleImg}
                    distance={activeRuleAlert.distance}
                    punishment={activeRuleAlert.punishment}
                    hasIncidentAlert={!!activeIncidentAlert}
                />
            )}

            {navigationMode && selectedDestination && !isNavigationMinimized && (
                <>
                    <NavigationBar
                        destination={selectedDestination}
                        onStop={handleStopNavigation}
                        onMinimize={() => setIsNavigationMinimized(true)}
                        simulateMovement={simulateMovement}
                        userLocation={userLocation}
                        currentInstruction={currentInstruction}
                        remainingDistance={remainingDistance}
                        remainingTime={remainingTime}
                        hasIncidentAlert={!!activeIncidentAlert}
                    />
                    <NavigationOverlay
                        remainingTime={remainingTime}
                        remainingDistance={remainingDistance}
                        onReportPress={() => setShowReportOptions(true)}
                        onVoiceReportPress={() => showToast.info(t('coming-soon'), 'Voice Report')}
                        isOffRoute={isOffRoute}
                        isRecalculating={isRecalculating}
                        onTestOffRoute={() => simulateOffRoute(setUserLocation)}
                        showRecenterButton={hasUserZoomedOut}
                        onRecenter={handleRecenter}
                    />
                </>
            )}

            {(!navigationMode || isNavigationMinimized) && (
                <MapOverlay
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onSearchClear={clearSearch}

                    searchResults={searchResults}
                    isSearching={isSearching}
                    showSearchContainer={showSearchContainer}
                    onSelectPlace={handleSelectPlace}

                    onCloseSearch={() => {
                        setSearchResults([]);
                        setSearchQuery('');
                        setShowSearchContainer(false);
                        setSelectedExploreCategory(null);
                        clearExploreResults();
                        setClickedLocation(null);
                    }}

                    selectedDestination={selectedDestination}
                    isNavigating={isNavigating}
                    simulateMovement={simulateMovement}
                    onSimulateToggle={() => setSimulateMovement(!simulateMovement)}
                    onNavigate={() => handleNavigate(setUserLocation)}

                    onClearRoute={() => {
                        handleClearRoute();
                        setClickedLocation(null);
                    }}

                    userLocation={userLocation}
                    mapRef={mapRef}
                    onReportPress={() => setShowReportOptions(true)}
                    onAddPlacePress={() => router.push('/contribution')}
                    onExplorePress={() => setShowExploreSheet(true)}
                    onLocationPress={handleLocationPress}
                    onVoicePress={handleVoicePress}

                    onVoiceRelease={handleVoiceStop}
                    isRecording={isRecording}
                    isProcessingVoice={isProcessingVoice}
                    voiceNavigationData={voiceNavigationData}
                    onExploreCategory={handleExploreCategory}
                    isExploring={isExploring}
                    selectedExploreCategory={selectedExploreCategory}
                    isNavigationMinimized={isNavigationMinimized}
                    onRestoreNavigation={() => setIsNavigationMinimized(false)}
                    navigationDestination={navigationMode ? selectedDestination : null}
                />
            )}

            {showRoutePreview && selectedDestination && (
                <RoutePreview
                    distance={remainingDistance}
                    duration={remainingTime}
                    destinationName={selectedDestination.name}
                    simulateMovement={simulateMovement}
                    onSimulateToggle={() => setSimulateMovement(!simulateMovement)}
                    onStartNavigation={() => handleStartNavigation(setUserLocation)}
                    onCancel={() => {
                        setShowRoutePreview(false);
                        handleClearRoute();
                        setClickedLocation(null);
                    }}
                    destination={selectedDestination}
                />
            )}

            <IncidentReportSheet
                isVisible={showReportOptions}
                onClose={() => setShowReportOptions(false)}
                userLocation={userLocation}
                isNavigating={navigationMode}
                onNavigateToReport={() => setIsOnIncidentReportScreen(true)}
            />

            <PlaceDetailsSheet
                place={selectedExplorePlace}
                onClose={() => setSelectedExplorePlace(null)}
                onNavigate={handleNavigateToExplorePlace}
            />

            <ExploreSheet
                visible={showExploreSheet}
                onClose={() => setShowExploreSheet(false)}
                userLocation={userLocation}
                onPlaceSelect={handleSelectPlace}
            />

            <NavigationOptionsModal
                visible={showVoiceOptions}
                options={voiceOptions}
                transcription={voiceTranscription}
                onSelectOption={handleOptionSelect}
                onClose={clearVoiceNavigation}
            />

            <VoiceNavigationModal
                visible={showVoiceModal}
                isRecording={isRecording}
                isProcessing={isProcessingVoice}
                onClose={handleCloseVoiceModal}
                onPressIn={handleVoiceStart}
                onPressOut={handleVoiceStop}
            />
        </View>
    );
}