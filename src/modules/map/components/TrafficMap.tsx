import React, { useRef, useState, useEffect } from 'react';
import { View, LogBox } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import GebetaMap, { GebetaMapRef } from '../../../lib/gebeta-map/GebetaMap';
import { Input } from '../../../shared/components';
import { ReportBottomSheet } from './ReportBottomSheet';
import { SearchResults } from './SearchResults';
import { NavigationBar } from './NavigationBar';
import { DestinationCard } from './DestinationCard';
import { QuickActions } from './QuickActions';
import { useIncidents } from '../../incidents/hooks/useIncidents';
import { useUserLocation } from '../hooks/useUserLocation';
import { useSearch } from '../hooks/useSearch';
import { useNavigation } from '../hooks/useNavigation';
import { getIncidentIconUrl, getIncidentColor, getIncidentIconName } from '../../incidents/utils/incidentIcons';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from 'react-i18next';
import { GeocodingPlace } from '../../navigation/services/navigation.service';

export default function TrafficMap() {
    const mapRef = useRef<GebetaMapRef>(null);
    const searchMarkerRef = useRef<any>(null);

    const [initialCenter] = useState<[number, number]>([38.7463, 9.0223]);
    const [initialZoom] = useState(12);

    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { incidents, refetch } = useIncidents();
    const { userLocation } = useUserLocation();

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
        handleNavigate,
        handleStopNavigation,
        handleClearRoute,
    } = useNavigation(mapRef, userLocation);

    useEffect(() => {
        LogBox.ignoreLogs(['MapLibre error', 'Failed to load sprite']);
    }, []);

    useEffect(() => {
        if (params.refresh === 'true') {
            refetch();
        }
    }, [params.refresh, refetch]);

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
                userLocation={userLocation}
                showUserLocation={navigationMode}
                userHeading={currentHeading}
            />

            {navigationMode && selectedDestination && (
                <NavigationBar
                    destination={selectedDestination}
                    onStop={handleStopNavigation}
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
                        <DestinationCard
                            destination={selectedDestination}
                            isNavigating={isNavigating}
                            onNavigate={handleNavigate}
                            onClear={handleClearRoute}
                        />
                    )}

                    <QuickActions />
                </View>
            )}

            <ReportBottomSheet userLocation={userLocation} onIncidentReported={refetch} />
        </View>
    );
}