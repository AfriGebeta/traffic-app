import React, { useRef, useState, useEffect } from 'react';
import { View, LogBox } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import GebetaMap, { GebetaMapRef } from '../../../lib/gebeta-map/GebetaMap';
import { NavigationBar } from './NavigationBar';
import { NavigationOverlay } from './NavigationOverlay';
import { IncidentAlert } from './IncidentAlert';
import { MapOverlay } from './MapOverlay';
import { IncidentReportSheet } from './IncidentReportSheet';
import { VoiceRecordingOverlay } from './VoiceRecordingOverlay';
import { PlaceDetailsSheet } from './PlaceDetailsSheet';
import { ExploreSheet } from '../../explore/components/ExploreSheet';
import { RoutePreview } from '../../navigation/components/RoutePreview';
import { useIncidents } from '../../incidents/hooks/useIncidents';
import { useUserLocation } from '../hooks/useUserLocation';
import { useSearch } from '../hooks/useSearch';
import { useNavigation } from '../../navigation/hooks/useNavigation';
import { useVoiceNavigation } from '../../navigation/hooks/useVoiceNavigation';
import { useIncidentAlerts } from '../hooks/useIncidentAlerts';
import { useMapMarkers } from '../hooks/useMapMarkers';
import { useMapTheme } from '../context/MapThemeContext';
import { useExplore } from '../hooks/useExplore';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../shared/theme/colors';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';

export default function TrafficMap() {
    const mapRef = useRef<GebetaMapRef>(null);
    const searchMarkerRef = useRef<any>(null);
    const userLocationMarkerRef = useRef<any>(null);
    const exploreMarkersRef = useRef<any[]>([]);
    const router = useRouter();

    const [initialCenter] = useState<[number, number]>([38.7463, 9.0223]);
    const [initialZoom] = useState(12);
    const [showReportOptions, setShowReportOptions] = useState(false);
    const [showExploreSheet, setShowExploreSheet] = useState(false);
    const [selectedExploreCategory, setSelectedExploreCategory] = useState<string | null>(null);
    const [selectedExplorePlace, setSelectedExplorePlace] = useState<GeocodingPlace | null>(null);

    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { incidents, refetch } = useIncidents();
    const { userLocation, setUserLocation } = useUserLocation();
    const { currentTheme } = useMapTheme();
    const { isLoading: isExploring, results: exploreResults, searchNearby, clearResults: clearExploreResults } = useExplore();

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
        snappedLocation,
        currentInstruction,
        remainingDistance,
        remainingTime,
        isOffRoute,
        isRecalculating,
        routeCoordinates,
        handleNavigate,
        handleStartNavigation,
        handleStopNavigation,
        handleClearRoute,
        simulateOffRoute,
    } = useNavigation(mapRef, userLocation, setUserLocation);

    const activeIncidentAlert = useIncidentAlerts(userLocation, incidents, navigationMode, routeCoordinates);
    const { addIncidentMarkers } = useMapMarkers(mapRef, incidents);

    const handleSelectPlace = (place: GeocodingPlace) => {
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
            undefined,
            colors.primary.main,
            'location'
        );
        searchMarkerRef.current = marker;

        setSearchResults([]);
        setSelectedDestination(place);

        skipSearchRef.current = true;
        setSearchQuery(place.name);

        setTimeout(() => {
            handleNavigate(setUserLocation, place);
        }, 300);
    };

    const {
        isRecording,
        isProcessingVoice,
        navigationData: voiceNavigationData,
        handleVoiceStart,
        handleVoiceStop,
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

            exploreMarkersRef.current.forEach(() => {
                mapRef.current?.clearMarkers();
            });
            exploreMarkersRef.current = [];
            addIncidentMarkers();
            return;
        }

        setSelectedExploreCategory(categoryId);

        try {
            const places = await searchNearby(categoryId, userLocation);

            exploreMarkersRef.current.forEach(() => {
                mapRef.current?.clearMarkers();
            });
            exploreMarkersRef.current = [];

            mapRef.current?.clearMarkers();

            places.forEach((place) => {
                const marker = mapRef.current?.addImageMarker(
                    [place.longitude, place.latitude],
                    '',
                    [28, 28],
                    () => {
                        setSelectedExplorePlace(place);
                    },
                    10,
                    undefined,
                    colors.primary.main,
                    getIconForCategory(categoryId)
                );
                if (marker) {
                    exploreMarkersRef.current.push(marker);
                }
            });

            addIncidentMarkers();

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

    const getIconForCategory = (categoryId: string): string => {
        const iconMap: Record<string, string> = {
            restaurants: 'restaurant',
            gas: 'water',
            parking: 'car',
            hospital: 'medical',
            repair: 'construct',
        };
        return iconMap[categoryId] || 'location';
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
            refetch();
        }, [])
    );

    const handleMapLoaded = () => {
        setTimeout(() => {
            addIncidentMarkers();
        }, 1000);
    };

    const handleLocationPress = () => {
        console.log('Location button pressed, userLocation:', userLocation);
        console.log('mapRef.current:', mapRef.current);

        if (!userLocation) {
            showToast.error('Location not available', 'Please wait for location to load');
            return;
        }

        if (!mapRef.current) {
            showToast.error('Map not ready', 'Please try again');
            return;
        }

        if (userLocationMarkerRef.current) {
            mapRef.current.clearMarkers();
            addIncidentMarkers();
        }

        const marker = mapRef.current.addImageMarker(
            [userLocation.lng, userLocation.lat],
            '',
            [20, 20],
            () => showToast.info('Your Location', 'Current position'),
            10,
            undefined,
            '#ffa500',
            'radio-button-on'
        );
        userLocationMarkerRef.current = marker;

        mapRef.current.flyTo({
            center: [userLocation.lng, userLocation.lat],
            zoom: 15,
            duration: 1000,
        });
    };

    return (
        <View className="flex-1">
            <GebetaMap
                ref={mapRef}
                apiKey={process.env.EXPO_PUBLIC_GEBETA_API_KEY!}
                mapStyleUrl={currentTheme.styleUrl ? `${currentTheme.styleUrl}?apiKey=${process.env.EXPO_PUBLIC_GEBETA_API_KEY}` : undefined}
                mapStyleJson={currentTheme.styleJson}
                center={initialCenter}
                zoom={initialZoom}
                onMapClick={() => { }}
                onMapLoaded={handleMapLoaded}
                userLocation={navigationMode && snappedLocation ? snappedLocation : userLocation}
                showUserLocation={navigationMode}
                userHeading={currentHeading}
            />

            {activeIncidentAlert && (
                <IncidentAlert
                    incidentName={activeIncidentAlert.incidentName}
                    distance={activeIncidentAlert.distance}
                    incidentType={activeIncidentAlert.incidentType}
                />
            )}

            <VoiceRecordingOverlay
                isRecording={isRecording}
                isProcessing={isProcessingVoice}
            />

            {navigationMode && selectedDestination && (
                <>
                    <NavigationBar
                        destination={selectedDestination}
                        onStop={handleStopNavigation}
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
                    />
                </>
            )}

            {!navigationMode && (
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
                    }}
                    selectedDestination={selectedDestination}
                    isNavigating={isNavigating}
                    simulateMovement={simulateMovement}
                    onSimulateToggle={() => setSimulateMovement(!simulateMovement)}
                    onNavigate={() => handleNavigate(setUserLocation)}
                    onClearRoute={handleClearRoute}
                    userLocation={userLocation}
                    mapRef={mapRef}
                    onReportPress={() => setShowReportOptions(true)}
                    onAddPlacePress={() => router.push('/places/contribute')}
                    onExplorePress={() => setShowExploreSheet(true)}
                    onLocationPress={handleLocationPress}
                    onVoicePress={handleVoiceStart}
                    onVoiceRelease={handleVoiceStop}
                    isRecording={isRecording}
                    isProcessingVoice={isProcessingVoice}
                    voiceNavigationData={voiceNavigationData}
                    onExploreCategory={handleExploreCategory}
                    isExploring={isExploring}
                    selectedExploreCategory={selectedExploreCategory}
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
                    }}
                />
            )}

            <IncidentReportSheet
                isVisible={showReportOptions}
                onClose={() => setShowReportOptions(false)}
                userLocation={userLocation}
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
        </View>
    );
}