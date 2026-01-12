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
import { useIncidents } from '../../incidents/hooks/useIncidents';
import { useUserLocation } from '../hooks/useUserLocation';
import { useSearch } from '../hooks/useSearch';
import { useNavigation } from '../../navigation/hooks/useNavigation';
import { useVoiceNavigation } from '../../navigation/hooks/useVoiceNavigation';
import { useIncidentAlerts } from '../hooks/useIncidentAlerts';
import { useMapMarkers } from '../hooks/useMapMarkers';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from 'react-i18next';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';

export default function TrafficMap() {
    const mapRef = useRef<GebetaMapRef>(null);
    const searchMarkerRef = useRef<any>(null);
    const router = useRouter();

    const [initialCenter] = useState<[number, number]>([38.7463, 9.0223]);
    const [initialZoom] = useState(12);
    const [showReportOptions, setShowReportOptions] = useState(false);

    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { incidents, refetch } = useIncidents();
    const { userLocation, setUserLocation } = useUserLocation();

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
        currentHeading,
        simulateMovement,
        setSimulateMovement,
        snappedLocation,
        currentInstruction,
        remainingDistance,
        remainingTime,
        routeCoordinates,
        handleNavigate,
        handleStopNavigation,
        handleClearRoute,
    } = useNavigation(mapRef, userLocation, setUserLocation);

    const activeIncidentAlert = useIncidentAlerts(userLocation, incidents, navigationMode, routeCoordinates);
    const { addIncidentMarkers } = useMapMarkers(mapRef, incidents);

    const handleSelectPlace = (place: GeocodingPlace) => {
        if (searchMarkerRef.current) {
            mapRef.current?.clearMarkers();
            addIncidentMarkers();
        }

        mapRef.current?.flyTo({
            center: [place.longitude, place.latitude],
            zoom: 15,
            duration: 1000,
        });

        const marker = mapRef.current?.addImageMarker(
            [place.longitude, place.latitude],
            '',
            [40, 40],
            () => showToast.info(place.name, place.type),
            10,
            undefined,
            '#3B82F6',
            'location'
        );
        searchMarkerRef.current = marker;

        setSearchResults([]);
        setSelectedDestination(place);

        skipSearchRef.current = true;
        setSearchQuery(place.name);
    };

    const {
        isRecording,
        isProcessingVoice,
        navigationData: voiceNavigationData,
        handleVoicePress,
    } = useVoiceNavigation({
        mapRef,
        userLocation,
        language: 'amh',
        onDestinationFound: handleSelectPlace,
    });

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

    return (
        <View className="flex-1">
            <GebetaMap
                ref={mapRef}
                apiKey={process.env.EXPO_PUBLIC_GEBETA_API_KEY!}
                mapStyleUrl={`https://tiles.gebeta.app/styles/standard/style.json?apiKey=${process.env.EXPO_PUBLIC_GEBETA_API_KEY}`}
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
                    />
                    <NavigationOverlay
                        remainingTime={remainingTime}
                        remainingDistance={remainingDistance}
                        onReportPress={() => setShowReportOptions(true)}
                        onVoiceReportPress={() => showToast.info(t('coming-soon'), 'Voice Report')}
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
                    onVoicePress={handleVoicePress}
                    isRecording={isRecording}
                    isProcessingVoice={isProcessingVoice}
                    voiceNavigationData={voiceNavigationData}
                />
            )}

            <IncidentReportSheet
                isVisible={showReportOptions}
                onClose={() => setShowReportOptions(false)}
                userLocation={userLocation}
            />
        </View>
    );
}