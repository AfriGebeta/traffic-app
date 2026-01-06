import React, { useRef, useState, useEffect } from 'react';
import { View, LogBox, Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import GebetaMap, { GebetaMapRef } from '../../../lib/gebeta-map/GebetaMap';
import { Input } from '../../../shared/components';
import { ReportBottomSheet } from './ReportBottomSheet';
import { SearchResults } from './SearchResults';
import { NavigationBar } from './NavigationBar';
import { DestinationCard } from './DestinationCard';
import { QuickActions } from './QuickActions';
import { IncidentAlert } from './IncidentAlert';
import { useIncidents } from '../../incidents/hooks/useIncidents';
import { useUserLocation } from '../hooks/useUserLocation';
import { useSearch } from '../hooks/useSearch';
import { useNavigation } from '../../navigation/hooks/useNavigation';
import { useIncidentAlerts } from '../hooks/useIncidentAlerts';
import { getIncidentIconUrl, getIncidentColor, getIncidentIconName } from '../../incidents/utils/incidentIcons';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from 'react-i18next';
import type { GeocodingPlace } from '../../navigation/types/navigation.types';

export default function TrafficMap() {
    const mapRef = useRef<GebetaMapRef>(null);
    const searchMarkerRef = useRef<any>(null);

    const [initialCenter] = useState<[number, number]>([38.7463, 9.0223]);
    const [initialZoom] = useState(12);

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

    //alerting incidents
    const activeIncidentAlert = useIncidentAlerts(userLocation, incidents, navigationMode, routeCoordinates);

    useEffect(() => {
        LogBox.ignoreLogs(['MapLibre error', 'Failed to load sprite']);
    }, []);

    useEffect(() => {
        if (params.refresh === 'true') {
            refetch();
        }
    }, [params.refresh, refetch]);

    //refetching after report
    useFocusEffect(
        React.useCallback(() => {
            refetch();
        }, [])
    );

    const handleSelectPlace = (place: GeocodingPlace) => {
        if (searchMarkerRef.current) {
            mapRef.current?.clearMarkers();
            addIncidentMarkers();
        }

        mapRef.current?.flyTo({
            center: [place.longitude, place.latitude],
            zoom: 15,
            duration: 1000
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

    const handleMapClick = () => {

    };

    const handleMapLoaded = () => {
        setTimeout(() => {
            addIncidentMarkers();
        }, 1000);
    };

    const addIncidentMarkers = () => {
        if (!mapRef.current || incidents.length === 0) {
            return;
        }

        try {
            incidents.forEach((incident) => {
                const iconUrl = getIncidentIconUrl(incident.type);
                const color = getIncidentColor(incident.type);
                const iconName = getIncidentIconName(incident.type);

                mapRef.current?.addImageMarker(
                    [incident.lng, incident.lat],
                    iconUrl,
                    [40, 40],
                    () => {
                        showToast.info(
                            incident.description,
                            `${incident.type.charAt(0).toUpperCase() + incident.type.slice(1)} Incident`
                        );
                    },
                    10,
                    undefined,
                    color,
                    iconName
                );
            });
        } catch (error) {
            console.log('error adding markers:', error);
        }
    };

    useEffect(() => {
        if (incidents.length > 0 && mapRef.current) {
            addIncidentMarkers();
        }
    }, [incidents]);

    //for console
    useEffect(() => {
        if (navigationMode) {
            console.log('navigation mode:', navigationMode);
            console.log('user location:', userLocation);
            console.log('snapped location:', snappedLocation);
            console.log('using location:', navigationMode && snappedLocation ? snappedLocation : userLocation);
        }
    }, [userLocation, snappedLocation, navigationMode]);

    return (
        <View className="flex-1">
            <GebetaMap
                ref={mapRef}
                apiKey={process.env.EXPO_PUBLIC_GEBETA_API_KEY!}
                mapStyleUrl={`https://tiles.gebeta.app/styles/standard/style.json?apiKey=${process.env.EXPO_PUBLIC_GEBETA_API_KEY}`}
                center={initialCenter}
                zoom={initialZoom}
                onMapClick={handleMapClick}
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

            {navigationMode && selectedDestination && (
                <NavigationBar
                    destination={selectedDestination}
                    onStop={handleStopNavigation}
                    simulateMovement={simulateMovement}
                    userLocation={userLocation}
                    currentInstruction={currentInstruction}
                    remainingDistance={remainingDistance}
                    remainingTime={remainingTime}
                />
            )}

            {!navigationMode && (
                <View className="absolute top-12 left-4 right-4">
                    <View className="bg-white rounded-2xl shadow-lg">
                        <Input
                            placeholder={t('where-to-go')}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            icon="search"
                            showClearButton={true}
                            onClear={clearSearch}
                        />
                    </View>

                    <SearchResults
                        results={searchResults}
                        onSelectPlace={handleSelectPlace}
                        onClose={() => {
                            setSearchResults([]);
                            setSearchQuery('');
                            setShowSearchContainer(false);
                        }}
                        isLoading={isSearching}
                        showContainer={showSearchContainer}
                    />

                    {selectedDestination && (
                        <>
                            {/* for testing */}
                            <View className="mt-2 bg-gray-100 rounded-2xl shadow-lg p-3">
                                <TouchableOpacity
                                    className="flex-row items-center justify-between"
                                    onPress={() => setSimulateMovement(!simulateMovement)}
                                >
                                    <View className="flex-row items-center gap-2">
                                        <Ionicons
                                            name={simulateMovement ? "checkmark-circle" : "ellipse-outline"}
                                            size={20}
                                            color={simulateMovement ? "#10B981" : "#6B7280"}
                                        />
                                        <Text className="text-sm font-medium text-gray-700">Simulate Movement (testing)</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>

                            <DestinationCard
                                destination={selectedDestination}
                                isNavigating={isNavigating}
                                onNavigate={() => handleNavigate(setUserLocation)}
                                onClear={handleClearRoute}
                            />
                        </>
                    )}

                    <QuickActions />
                </View>
            )}

            <ReportBottomSheet userLocation={userLocation} onIncidentReported={refetch} />
        </View>
    );
}