import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, LogBox, BackHandler, StatusBar, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import CustomGebetaMap from '../../../components/GebetaMap';
import type { GebetaMapRef } from '@gebeta/tiles-react-native';
import { NavigationBar } from './NavigationBar';
import { NavigationOverlay } from './NavigationOverlay';
import { IncidentAlert } from './IncidentAlert';

import { MapOverlay } from './MapOverlay';
import { IncidentReportSheet } from './IncidentReportSheet';
import { ExploreSheet } from '../../explore/components/ExploreSheet';
import { RoutePreview } from '../../navigation/components/RoutePreview';
import { PlaceDetailPreview } from '../../navigation/components/PlaceDetailPreview';
import { ArrivalModal } from '../../navigation/components/ArrivalModal';
import { NavigationOptionsModal } from '../../navigation/components/NavigationOptionsModal';
import { VoiceNavigationModal } from '../../navigation/components/VoiceNavigationModal';
import { useIncidents } from '../../incidents/hooks/useIncidents';
import { useUserLocation } from '../hooks/useUserLocation';
import { useSearch } from '../hooks/useSearch';

import { colors } from '../../../shared/theme/colors';
import { getAppConfig } from '../../../shared/config/remoteConfigValues';
import { useNavigation } from '../../navigation/hooks/useNavigation';
import { useVoiceNavigation } from '../../navigation/hooks/useVoiceNavigation';
import { useNavigationTracking } from '../../navigation/hooks/useNavigationTracking';
import { useBackgroundSync } from '../../navigation/hooks/useBackgroundSync';
import { useIncidentAlerts } from '../hooks/useIncidentAlerts';
import { useRuleAlerts } from '../hooks/useRuleAlerts';
import { useMapMarkers } from '../hooks/useMapMarkers';
import { useMapTheme } from '../context/MapThemeContext';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useRemoteConfig } from '../../../shared/contexts/RemoteConfigContext';
import { useExplore } from '../hooks/useExplore';

import { useMapClick } from '../hooks/useMapClick';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from 'react-i18next';
import i18n from '../../../shared/utils/localization/i18n';

import type { GeocodingPlace } from '../../navigation/types/navigation.types';
import { useRulePreferences } from '../../rules/hooks/useRulePreferences';
import type { SharedLocation } from '../../../shared/utils/deepLinking';
import { decodePolyline } from '../../../shared/utils/polyline';
import { exploreService } from '../services/exploreService';
import type { TaxiNavigationResponse } from '../../taxi/types/taxi.types';
import { setNavigationPreviewData } from '../../navigation/services/navigationPreviewCache';
import { buildPreviewSteps } from '../../navigation/utils/navigationPreviewUtils';

interface TrafficMapProps {
    sharedLocation?: SharedLocation | null;
    taxiDestination?: { lat: number; lng: number; name: string };
    showTaxiMode?: boolean;
    voiceDestination?: { lat: number; lng: number; name: string };
}

export default function TrafficMap({ sharedLocation, taxiDestination, showTaxiMode, voiceDestination }: TrafficMapProps) {
    const mapRef = useRef<GebetaMapRef>(null);
    const searchMarkerRef = useRef<any>(null);
    const processedSharedLocationRef = useRef<SharedLocation | null>(null);
    const processedVoiceDestRef = useRef<string | null>(null);
    const [voiceNavStarting, setVoiceNavStarting] = useState(false);
    const sharedFlyToTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const router = useRouter();

    const USER_LOCATION_ZOOM = getAppConfig().userLocationZoom;

    const initialMapCenterRef = useRef<[number, number] | null>(null);
    const [showReportOptions, setShowReportOptions] = useState(false);
    const [incidentReportLocation, setIncidentReportLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [showExploreSheet, setShowExploreSheet] = useState(false);
    const [selectedExploreCategory, setSelectedExploreCategory] = useState<string | null>(null);
    const [clickedLocation, setClickedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isNavigationMinimized, setIsNavigationMinimized] = useState(false);
    const [hasUserZoomedOut, setHasUserZoomedOut] = useState(false);
    const [isOnIncidentReportScreen, setIsOnIncidentReportScreen] = useState(false);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [taxiRouteData, setTaxiRouteData] = useState<any>(null);

    const [taxiStations, setTaxiStations] = useState<Array<{ id: number; name: string; lat: number; lng: number; type: 'start' | 'end' | 'intermediate' }> | null>(null);
    const [taxiWalkRoutes, setTaxiWalkRoutes] = useState<Array<{ type: 'origin' | 'transfer' | 'destination'; polyline: string }> | null>(null);
    const [taxiRouteSegments, setTaxiRouteSegments] = useState<Array<{ coordinates: Array<[number, number]>; cost: number; from: string; to: string }> | null>(null);
    const [isFromTaxiSearch, setIsFromTaxiSearch] = useState(false);
    const [showPlaceDetail, setShowPlaceDetail] = useState(false);

    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { incidents, refetch } = useIncidents();
    const { userLocation, setUserLocation, stopLocationTracking: stopBackgroundTracking, startLocationTracking: startBackgroundTracking } = useUserLocation();
    const { currentTheme } = useMapTheme();
    const { colors: appTheme } = useTheme();
    const { apiKey } = useRemoteConfig();
    const { isLoading: isExploring, results: exploreResults, searchNearby, clearResults: clearExploreResults } = useExplore();
    const { refetch: refetchRulePreferences } = useRulePreferences();

    const {
        searchQuery,
        setSearchQuery,

        searchResults,
        setSearchResults,
        recentSearches,
        savedPlaces,
        isSearching,
        showSearchContainer,
        setShowSearchContainer,
        showRecentSearches,
        skipSearchRef,
        clearSearch,
        handleSearchFocus,
        handleSearchBlur,
        prepareSearchSelection,

        dismissSearchPanel,
        recordRecentSearch,
        removeRecentSearch,
        clearRecentSearches,
    } = useSearch();

    const {
        selectedDestination,
        setSelectedDestination,
        waypoints,
        setWaypoints,
        isNavigating,
        navigationMode,

        showRoutePreview,
        setShowRoutePreview,
        currentHeading,
        simulateMovement,
        setSimulateMovement,
        currentInstruction,
        nextInstruction,

        maneuverType,
        maneuverDistance,
        nextManeuverType,

        remainingDistance,
        remainingTime,
        totalRouteDistance,
        isOffRoute,
        isRecalculating,
        routeCoordinates,
        showArrivalModal,
        setShowArrivalModal,
        arrivalStage,

        routeGeoJSON,
        routeOrigin,
        setRouteOrigin,
        routeManeuversList,
        routeLegs,
        allRouteOptions,
        selectedRouteIndex,
        alternativeRoutesGeoJSON,
        handleSelectRoute,
        handleNavigate,

        handleStartNavigation,
        handleStopNavigation,
        handleClearRoute,
        simulateOffRoute,
        recalculateRoute,
        currentCosting,
        setCurrentCosting,
        currentSpeed,
    } = useNavigation(mapRef, userLocation, setUserLocation, stopBackgroundTracking, startBackgroundTracking);

    const [nearbyRules, setNearbyRules] = useState<any[]>([]);

    const fetchRules = React.useCallback(async () => {
        try {
            // console.log('rules: fetchRules called');
            const { ruleService } = await import('../../rules/services/rule.service');
            const rules = await ruleService.getAllReports();
            // console.log('rules: fetched count:', rules.length);
            setNearbyRules(rules);
        } catch (error) {
            // console.log('rules: fetchRules error:', error);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        import('../../rules/services/preferences.service').then(({ rulePreferencesService }) => {
            rulePreferencesService.getPreferences().then((prefs) => {
                if (cancelled) return;
                // console.log('rules: storage read on mount - showonmap:', prefs.showOnMap, 'navigationMode:', navigationMode);
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

    const clearSearchMarker = () => {
        if (searchMarkerRef.current) {
            mapRef.current?.clearMarkers();
            addIncidentMarkers();
            searchMarkerRef.current = null;
        }
    };

    const handleClosePlaceDetail = () => {
        setShowPlaceDetail(false);
        setSelectedDestination(null);
        clearSearchMarker();
    };

    const handleCancelRoutePreview = useCallback(() => {
        setShowRoutePreview(false);
        setShowPlaceDetail(false);
        handleClearRoute();
        setClickedLocation(null);
        setTaxiRouteData(null);
        setIsFromTaxiSearch(false);

        router.setParams({
            taxiDestLat: undefined,
            taxiDestLng: undefined,
            taxiDestName: undefined,
            showTaxiMode: undefined,
        });
    }, [handleClearRoute, setShowRoutePreview]);

    const handleContributeFromPlaceDetail = (location: { lat: number; lng: number }) => {
        setShowPlaceDetail(false);
        setIncidentReportLocation(location);
        setShowReportOptions(true);
    };

    const handleDirectionsFromPlaceDetail = () => {
        setShowPlaceDetail(false);
        setIsFromTaxiSearch(false);
        setTaxiRouteData(null);
        setRouteOrigin(null);
        if (selectedDestination) {
            handleNavigate(setUserLocation, selectedDestination);
        }
    };

    const handleTaxiFromPlaceDetail = () => {
        setShowPlaceDetail(false);
        setTaxiRouteData(null);
        setIsFromTaxiSearch(true);
        if (selectedDestination) {
            handleNavigate(setUserLocation, selectedDestination);
        }
    };

    const handleOriginChange = (place: GeocodingPlace | null) => {
        setIsFromTaxiSearch(false);
        setTaxiRouteData(null);
        if (selectedDestination) {
            handleNavigate(
                setUserLocation,
                selectedDestination,
                currentCosting === 'pedestrian' ? 'pedestrian' : 'auto',
                waypoints,
                place
            );
        }
    };


    const handleOpenRoutePreview = () => {
        if (!selectedDestination || !routeGeoJSON || routeLegs.length === 0) {
            showToast(t('route-unavailable'));
            return;
        }

        const previewSteps = buildPreviewSteps(routeLegs);
        if (previewSteps.length === 0) {
            showToast(t('route-unavailable'));
            return;
        }

        setNavigationPreviewData({
            routeGeoJSON,
            previewSteps,
            destination: selectedDestination,
            origin: routeOrigin,
            distance: remainingDistance,
            duration: remainingTime,
            waypoints,
        });

        router.push('/navigation/route-preview');
    };

    const handleStartFromPlaceDetail = () => {
        setShowPlaceDetail(false);
        handleStartNavigation(setUserLocation);
    };

    const handleSelectPlace = (place: GeocodingPlace, autoNavigate: boolean = false, saveToRecents: boolean = false, skipPreview: boolean = false) => {
        const queryForRecent = searchQuery.trim() || undefined;

        import('../../navigation/services/searchLog.service').then(({ searchLogService }) => {
            const storedQuery = searchLogService.getAndClearSearchQuery();
            if (storedQuery) {
                searchLogService.trackSearch(storedQuery, {
                    name: place.name,
                    latitude: place.latitude,
                    longitude: place.longitude,
                });
            }
        });

        if (saveToRecents) {
            void recordRecentSearch(place, queryForRecent);
        }

        clearSearchMarker();

        const marker = mapRef.current?.addImageMarker(
            [place.longitude, place.latitude],
            '',
            [40, 40],
            () => { },
            10,
            undefined
        );
        searchMarkerRef.current = marker;

        // clear search result
        dismissSearchPanel();
        setSearchResults([]);

        // clearing old route
        if (showRoutePreview || routeGeoJSON) {
            handleClearRoute();
        }

        setSelectedDestination(place);
        setSearchQuery('');

        setClickedLocation(null);

        //reset taxi search
        setIsFromTaxiSearch(false);
        setRouteOrigin(null);

        if (autoNavigate) {
            setShowPlaceDetail(false);
            if (skipPreview) {
                // destination passed explicitly — no need to wait for state commit
                handleStartNavigation(setUserLocation, place);
            } else {
                setTimeout(() => {
                    handleNavigate(setUserLocation, place);
                }, 300);
            }
        } else {
            setShowPlaceDetail(true);
            setShowRoutePreview(false);
            mapRef.current?.flyTo({
                center: [place.longitude, place.latitude],
                zoom: 15,
                duration: 1000,
            });
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
            () => { },
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
        currentOption: voiceCurrentOption,
        showOptions: showVoiceOptions,
        disambiguationMessage: voiceDisambiguationMessage,
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
        onDestinationFound: (place) => handleSelectPlace(place, true, false, true),
    });

    const handleExploreCategory = async (categoryId: string) => {
        //taxi cateogry-separate
        if (categoryId === 'taxi') {
            router.push('/taxi/search');
            return;
        }

        if (!userLocation) {
            showToast(`${t('location-unavailable')}: ${t('please-wait-for-location')}`);
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
            setSelectedExploreCategory(null);
        }
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
            // console.log('rules: useFocusEffect fired');
            refetch();
            import('../../rules/services/preferences.service').then(({ rulePreferencesService }) => {
                rulePreferencesService.getPreferences().then((prefs) => {
                    // console.log('rules: useFocusEffect direct storage read - show on map:', prefs.showOnMap);
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

    useEffect(() => {
        if (isMapLoaded) return;
        const timer = setTimeout(() => setIsMapLoaded(true), 2500);
        return () => clearTimeout(timer);
    }, [isMapLoaded]);

    const handleLocationPress = () => {
        if (!userLocation) {
            return;
        }

        if (!mapRef.current) {
            return;
        }

        (mapRef.current as any).recenterOnce({
            center: [userLocation.lng, userLocation.lat],
            zoom: USER_LOCATION_ZOOM,
        });
    };

    const handleRecenter = () => {
        if (!mapRef.current) return;

        (mapRef.current as any).recenterNavigation?.();
        setHasUserZoomedOut(false);
    };

    useNavigationTracking({
        isNavigating: navigationMode,
        userLocation,
    });

    useBackgroundSync();

    useEffect(() => {
        if (sharedLocation && mapRef.current && isMapLoaded) {

            if (processedSharedLocationRef.current === sharedLocation) {
                return;
            }
            processedSharedLocationRef.current = sharedLocation;

            const fallbackName =
                sharedLocation.name ||
                `${sharedLocation.lat.toFixed(5)}, ${sharedLocation.lng.toFixed(5)}`;

            const place: GeocodingPlace = {
                id: `shared-${sharedLocation.lat}-${sharedLocation.lng}`,
                name: fallbackName,
                display_name: fallbackName,
                category: sharedLocation.type || 'location',
                location: {
                    lat: sharedLocation.lat,
                    lng: sharedLocation.lng,
                },
                address: {
                    city: sharedLocation.city,
                    country: sharedLocation.country || '',
                    country_code: '',
                },
                latitude: sharedLocation.lat,
                longitude: sharedLocation.lng,
                type: sharedLocation.type || 'location',
                City: sharedLocation.city || '',
                Country: sharedLocation.country || '',
            };


            handleSelectSharedPlace(place);
            setShowPlaceDetail(true);

            if (!sharedLocation.name) {
                const target = sharedLocation;
                const isStale = () => processedSharedLocationRef.current !== target;

                (async () => {
                    try {
                        const resolved = await Promise.race([
                            exploreService.reverseGeocode(target.lat, target.lng),
                            new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
                        ]);

                        if (resolved?.name) {
                            if (isStale()) return;
                            handleSelectSharedPlace({
                                ...resolved,
                                id: place.id,
                            });
                            return;
                        }
                    } catch (error) {
                        console.log('shared location reverse geocode failed:', error);
                    }

                    const lang = i18n.language === 'am' ? 'AM' : 'EN';
                    const address = await exploreService.requestAddress(target.lat, target.lng, lang);
                    if (!address || isStale()) return;
                    if (!address.district && !address.city) return;

                    handleSelectSharedPlace({
                        ...place,
                        name: address.district || address.city,
                        address: {
                            city: address.city || '',
                            country: address.country || '',
                            country_code: '',
                        },
                        type: 'coordinates',
                        City: address.city || '',
                        Country: address.country || '',
                        District: address.district || '',
                    });
                })();
            }

            if (sharedFlyToTimer.current) {
                clearTimeout(sharedFlyToTimer.current);
            }
            let attempts = 0;
            const flyToShared = () => {
                mapRef.current?.flyTo({
                    center: [place.longitude, place.latitude],
                    zoom: 15,
                    duration: attempts === 0 ? 1200 : 500,
                });
                attempts += 1;
                if (attempts < 5) {
                    sharedFlyToTimer.current = setTimeout(flyToShared, 600);
                }
            };
            sharedFlyToTimer.current = setTimeout(flyToShared, 100);
        }
    }, [sharedLocation, isMapLoaded]);

    useEffect(() => {

        if (taxiDestination && userLocation) {
            const place: GeocodingPlace = {
                id: `taxi-dest-${taxiDestination.lat}-${taxiDestination.lng}`,
                name: taxiDestination.name,
                display_name: taxiDestination.name,
                category: 'destination',
                location: {
                    lat: taxiDestination.lat,
                    lng: taxiDestination.lng,
                },
                address: {
                    city: '',
                    country: '',
                    country_code: '',
                },
                latitude: taxiDestination.lat,
                longitude: taxiDestination.lng,
                type: 'destination',
                City: '',
                Country: '',
            };

            setSelectedDestination(place);
            setIsFromTaxiSearch(true);


            const globalTaxiRoute = (globalThis as any).__taxiRouteData;

            if (globalTaxiRoute && globalTaxiRoute.timestamp) {
                setTaxiRouteData(globalTaxiRoute);
                setShowRoutePreview(true);
                delete (globalThis as any).__taxiRouteData;
            } else {
                setTimeout(() => {
                    handleNavigate(setUserLocation, place);
                }, 100);
            }
        }
    }, [taxiDestination, userLocation]);

    useEffect(() => {
        if (!voiceDestination || !userLocation) return;

        const key = `${voiceDestination.lat},${voiceDestination.lng}`;
        if (processedVoiceDestRef.current === key) return;
        processedVoiceDestRef.current = key;

        const place: GeocodingPlace = {
            id: `voice-dest-${voiceDestination.lat}-${voiceDestination.lng}`,
            name: voiceDestination.name,
            display_name: voiceDestination.name,
            category: 'destination',
            location: { lat: voiceDestination.lat, lng: voiceDestination.lng },
            address: { city: '', country: '', country_code: '' },
            latitude: voiceDestination.lat,
            longitude: voiceDestination.lng,
            type: 'destination',
            City: '',
            Country: '',
        };

        handleSelectPlace(place, true, false, true);
    }, [voiceDestination, userLocation]);

    useFocusEffect(
        React.useCallback(() => {
            if ((globalThis as any).__voiceRoutePrefetch) {
                setVoiceNavStarting(true);
            }
        }, [])
    );

    useEffect(() => {
        if (navigationMode) setVoiceNavStarting(false);
    }, [navigationMode]);

    useEffect(() => {
        if (!voiceNavStarting) return;
        const timer = setTimeout(() => setVoiceNavStarting(false), 15000);
        return () => clearTimeout(timer);
    }, [voiceNavStarting]);

    useEffect(() => {
        if (!taxiRouteData) {
            setTaxiStations(null);
            setTaxiWalkRoutes(null);
            setTaxiRouteSegments(null);
            return;
        }

        if (!taxiRouteData.startNode || !taxiRouteData.endNode || !taxiRouteData.origin || !taxiRouteData.destination) {
            setTaxiStations(null);
            setTaxiWalkRoutes(null);
            setTaxiRouteSegments(null);
            return;
        }

        const fetchIntermediateNodes = async () => {
            const stations: Array<{ id: number; name: string; lat: number; lng: number; type: 'start' | 'end' | 'intermediate' }> = [
                {
                    id: taxiRouteData.startNode.id,
                    name: taxiRouteData.startNode.name,
                    lat: taxiRouteData.startNode.lat,
                    lng: taxiRouteData.startNode.lng,
                    type: 'start'
                }
            ];

            if (taxiRouteData.path && taxiRouteData.path.length > 2) {
                const intermediateIds = taxiRouteData.path.slice(1, -1);

                try {
                    const { taxiService } = await import('../../taxi/services/taxi.service');
                    const allNodes = await taxiService.getAllNodes();

                    const intermediateNodes = allNodes.filter((node: any) =>
                        intermediateIds.includes(node.id)
                    );

                    intermediateIds.forEach((id: number) => {
                        const node = intermediateNodes.find((n: any) => n.id === id);
                        if (node) {
                            stations.push({
                                id: node.id,
                                name: node.name,
                                lat: node.lat,
                                lng: node.lng,
                                type: 'intermediate'
                            });
                        }
                    });
                } catch (error) {
                    console.error('taxi route: Error fetching intermediate nodes:', error);
                }
            }

            stations.push({
                id: taxiRouteData.endNode.id,
                name: taxiRouteData.endNode.name,
                lat: taxiRouteData.endNode.lat,
                lng: taxiRouteData.endNode.lng,
                type: 'end'
            });

            setTaxiStations(stations);
        };

        fetchIntermediateNodes();

        const fetchTransferWalks = async () => {
            const walkRoutes: Array<{ type: 'origin' | 'transfer' | 'destination'; polyline: string }> = [];

            if (taxiRouteData.segments && taxiRouteData.segments.length > 0) {
                taxiRouteData.segments.forEach((segment: any, index: number) => {
                    if ((segment.type === 'walk' || segment.mode === 'pedestrian') && segment.polyline) {
                        const type = index === 0 ? 'origin' :
                            index === taxiRouteData.segments.length - 1 ? 'destination' :
                                'transfer';
                        walkRoutes.push({ type, polyline: segment.polyline });
                    }
                });
            } else {
                const originShape = taxiRouteData.originWalkRoute?.trip.legs[0]?.shape;
                if (originShape) {
                    walkRoutes.push({ type: 'origin', polyline: originShape });
                }

                if (taxiRouteData.path && taxiRouteData.path.length > 2) {
                    try {
                        const { taxiService } = await import('../../taxi/services/taxi.service');
                        const allEdges = await taxiService.getAllEdges();

                        for (let i = 0; i < taxiRouteData.path.length - 1; i++) {
                            const startNodeId = taxiRouteData.path[i];
                            const endNodeId = taxiRouteData.path[i + 1];

                            const edge = allEdges.find(
                                (e: any) => e.start_node_id === startNodeId && e.end_node_id === endNodeId
                            );

                            if (edge && edge.connection === 'walk') {
                                const allNodes = await taxiService.getAllNodes();
                                const startNode = allNodes.find((n: any) => n.id === startNodeId);
                                const endNode = allNodes.find((n: any) => n.id === endNodeId);

                                if (startNode && endNode) {
                                    const { navigationService } = await import('../../navigation/services/navigation.service');
                                    const walkRoute = await navigationService.getNavigation({
                                        origin: [startNode.lat, startNode.lng],
                                        destination: [endNode.lat, endNode.lng]
                                    });

                                    if (walkRoute?.data?.trip?.legs?.[0]?.shape) {
                                        walkRoutes.push({
                                            type: 'transfer',
                                            polyline: walkRoute.data.trip.legs[0].shape
                                        });
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.error('taxi route: Error fetching transfer walks:', error);
                    }
                }

                const destShape = taxiRouteData.destinationWalkRoute?.trip.legs[0]?.shape;
                if (destShape) {
                    walkRoutes.push({ type: 'destination', polyline: destShape });
                }
            }

            setTaxiWalkRoutes(walkRoutes);
        };

        fetchTransferWalks();


        const fetchTaxiDrivingRoute = async () => {
            try {
                const { navigationService } = await import('../../navigation/services/navigation.service');
                const routeData = await navigationService.getNavigation({
                    origin: [taxiRouteData.startNode.lat, taxiRouteData.startNode.lng],
                    destination: [taxiRouteData.endNode.lat, taxiRouteData.endNode.lng]
                });

                if (routeData?.data?.trip?.legs?.[0]?.shape) {
                    const decodedCoords = decodePolyline(routeData.data.trip.legs[0].shape, 6);
                    const mapCoords: [number, number][] = decodedCoords.map(([lat, lng]) => [lng, lat] as [number, number]);
                    setTaxiRouteSegments([{
                        coordinates: mapCoords,
                        cost: taxiRouteData.summary.estimatedFare,
                        from: taxiRouteData.startNode.name,
                        to: taxiRouteData.endNode.name
                    }]);
                } else {
                    if (taxiRouteData.startNode && taxiRouteData.endNode && taxiRouteData.summary) {
                        setTaxiRouteSegments([{
                            coordinates: [
                                [taxiRouteData.startNode.lng, taxiRouteData.startNode.lat],
                                [taxiRouteData.endNode.lng, taxiRouteData.endNode.lat],
                            ],
                            cost: taxiRouteData.summary.estimatedFare,
                            from: taxiRouteData.startNode.name,
                            to: taxiRouteData.endNode.name
                        }]);
                    }
                }
            } catch (error) {
                // console.error('taxi route Error fetching driving route:', error);
                if (taxiRouteData.startNode && taxiRouteData.endNode && taxiRouteData.summary) {
                    setTaxiRouteSegments([{
                        coordinates: [
                            [taxiRouteData.startNode.lng, taxiRouteData.startNode.lat],
                            [taxiRouteData.endNode.lng, taxiRouteData.endNode.lat],
                        ],
                        cost: taxiRouteData.summary.estimatedFare,
                        from: taxiRouteData.startNode.name,
                        to: taxiRouteData.endNode.name
                    }]);
                }
            }
        };

        fetchTaxiDrivingRoute();

        if (mapRef.current && isMapLoaded) {
            const allCoords = [
                [taxiRouteData.origin.lng, taxiRouteData.origin.lat],
                [taxiRouteData.startNode.lng, taxiRouteData.startNode.lat],
                [taxiRouteData.endNode.lng, taxiRouteData.endNode.lat],
                [taxiRouteData.destination.lng, taxiRouteData.destination.lat],
            ];

            const lngs = allCoords.map(c => c[0]);
            const lats = allCoords.map(c => c[1]);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);

            const centerLng = (minLng + maxLng) / 2;
            const centerLat = (minLat + maxLat) / 2;

            setTimeout(() => {
                mapRef.current?.flyTo({
                    center: [centerLng, centerLat],
                    zoom: 13,
                    duration: 1000,
                });
            }, 100);
        }
    }, [taxiRouteData, isMapLoaded]);

    useEffect(() => {
        if (navigationMode) return;
        if (!showRoutePreview && !showPlaceDetail) return;

        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (showReportOptions || isOnIncidentReportScreen) {
                return false;
            }
            if (showRoutePreview) {
                handleCancelRoutePreview();
            } else {
                handleClosePlaceDetail();
            }
            return true;
        });

        return () => backHandler.remove();
    }, [navigationMode, showRoutePreview, showPlaceDetail, showReportOptions, isOnIncidentReportScreen, handleCancelRoutePreview]);

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

    if (userLocation) {
        if (!initialMapCenterRef.current || !isMapLoaded) {
            initialMapCenterRef.current = [userLocation.lng, userLocation.lat];
        }
    }

    const mapCenter: [number, number] | undefined = sharedLocation
        ? [sharedLocation.lng, sharedLocation.lat]
        : initialMapCenterRef.current ?? undefined;

    const showAlternativeRoutes = !isNavigationMinimized && !taxiRouteData && !navigationMode && allRouteOptions.length > 1;

    const routeTimeLabels = useMemo(() => {
        if (!showAlternativeRoutes) return undefined;

        const selected = allRouteOptions[selectedRouteIndex];
        if (!selected) return undefined;

        const formatMinutes = (seconds: number) => Math.max(1, Math.floor(seconds / 60));

        const midpointOf = (coords: [number, number][]): [number, number] | null => {
            if (!coords || coords.length === 0) return null;
            return coords[Math.floor(coords.length / 2)];
        };

        const labels: Array<{ coordinate: [number, number]; label: string; isPrimary: boolean }> = [];

        const selectedMidpoint = midpointOf(selected.coordinates);
        if (selectedMidpoint) {
            labels.push({
                coordinate: selectedMidpoint,
                label: `${formatMinutes(selected.duration)} min`,
                isPrimary: true,
            });
        }

        allRouteOptions.forEach((option, index) => {
            if (index === selectedRouteIndex) return;

            const midpoint = midpointOf(option.coordinates);
            if (!midpoint) return;

            const deltaSeconds = option.duration - selected.duration;
            const deltaMinutes = Math.round(Math.abs(deltaSeconds) / 60);

            const label = deltaMinutes === 0
                ? 'Same time'
                : `${deltaMinutes} min ${deltaSeconds > 0 ? 'slower' : 'faster'}`;

            labels.push({ coordinate: midpoint, label, isPrimary: false });
        });

        return labels;
    }, [showAlternativeRoutes, allRouteOptions, selectedRouteIndex]);

    return (
        <View className="flex-1">
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
            <CustomGebetaMap
                ref={mapRef}
                apiKey={apiKey!}
                mapStyleUrl={
                    !currentTheme.styleJson && currentTheme.styleUrl
                        ? `${currentTheme.styleUrl}?apiKey=${apiKey}`
                        : undefined
                }
                mapStyleJson={currentTheme.styleJson}
                center={mapCenter}
                zoom={USER_LOCATION_ZOOM}
                onMapClick={handleMapClick}
                onMapLoaded={handleMapLoaded}
                routeGeoJSON={isNavigationMinimized ? undefined : (taxiRouteData ? undefined : routeGeoJSON)}
                maneuvers={isNavigationMinimized || taxiRouteData ? undefined : routeManeuversList}
                alternativeRoutesGeoJSON={
                    !isNavigationMinimized && !taxiRouteData && alternativeRoutesGeoJSON.length > 0
                        ? alternativeRoutesGeoJSON
                        : undefined
                }
                routeTimeLabels={routeTimeLabels}
                routeStyle={{
                    color: navigationMode ? '#3B82F6' : colors.primary.main,
                    width: 5,
                    opacity: 0.8,
                    isDotted: currentCosting === 'pedestrian',
                }}
                isNavigating={navigationMode && !isNavigationMinimized}
                userLocation={userLocation}
                selectedDestination={selectedDestination}
                onUserInteraction={() => {
                    setHasUserZoomedOut(true);
                }}

                userHeading={currentHeading}
                showUserLocationMarker={!routeOrigin}
                onUserLocationUpdate={(loc) => {
                    if (
                        !userLocation ||
                        Math.abs(userLocation.lat - loc.lat) > 0.00005 ||
                        Math.abs(userLocation.lng - loc.lng) > 0.00005
                    ) {
                        setUserLocation(loc);
                    }
                }}
                routeOrigin={routeOrigin ? {
                    latitude: routeOrigin.latitude,
                    longitude: routeOrigin.longitude,
                    name: routeOrigin.name,
                } : null}
                incidents={incidents}
                rules={nearbyRules}
                clickedLocation={clickedLocation}
                explorePlaces={exploreResults}
                exploreCategory={selectedExploreCategory}
                onExplorePlacePress={(place) => handleSelectPlace(place)}
                taxiStations={taxiStations || undefined}
                taxiWalkRoutes={taxiWalkRoutes || undefined}
                taxiRouteSegments={taxiRouteSegments || undefined}
                waypointMarkers={waypoints.length > 0 ? waypoints.map(wp => ({ latitude: wp.latitude, longitude: wp.longitude, name: wp.name })) : undefined}
                externalCameraControl={!navigationMode}
                isHomeMap
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

            {navigationMode && selectedDestination && !isNavigationMinimized && (
                <>
                    <NavigationBar
                        destination={selectedDestination}
                        onStop={handleStopNavigation}
                        onMinimize={() => setIsNavigationMinimized(true)}
                        simulateMovement={simulateMovement}
                        userLocation={userLocation}
                        currentInstruction={currentInstruction}
                        nextInstruction={nextInstruction}
                        maneuverType={maneuverType}
                        maneuverDistance={maneuverDistance}
                        nextManeuverType={nextManeuverType}
                        remainingDistance={remainingDistance}
                        remainingTime={remainingTime}
                    />
                    <NavigationOverlay
                        remainingTime={remainingTime}
                        remainingDistance={remainingDistance}
                        totalRouteDistance={totalRouteDistance}
                        destination={selectedDestination.name}
                        destinationCoords={{ lat: selectedDestination.latitude, lng: selectedDestination.longitude }}
                        onReportPress={() => setShowReportOptions(true)}
                        onExitPress={handleStopNavigation}
                        isOffRoute={isOffRoute}
                        isRecalculating={isRecalculating}
                        onTestOffRoute={() => simulateOffRoute(setUserLocation)}
                        showRecenterButton={hasUserZoomedOut}
                        onRecenter={handleRecenter}
                        currentSpeed={currentSpeed}
                        activeRule={activeRuleAlert}
                        currentInstruction={currentInstruction}
                        maneuverType={maneuverType}
                    />
                </>
            )}

            {(!navigationMode || isNavigationMinimized) && (
                <MapOverlay
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onSearchClear={clearSearch}
                    onSearchFocus={handleSearchFocus}
                    onSearchBlur={handleSearchBlur}

                    searchResults={searchResults}
                    recentSearches={recentSearches}
                    savedPlaces={savedPlaces}
                    isSearching={isSearching}
                    showSearchContainer={showSearchContainer}
                    showRecentSearches={showRecentSearches}
                    onSelectPlace={(place) => handleSelectPlace(place, false, true)}
                    onPrepareSearchSelect={prepareSearchSelection}
                    onRemoveRecentSearch={removeRecentSearch}
                    onClearRecentSearches={clearRecentSearches}

                    onCloseSearch={() => {
                        dismissSearchPanel();
                        setSearchResults([]);
                        setSearchQuery('');
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
                    onTaxiPress={() => router.push('/taxi/search')}
                    onVoicePress={handleVoicePress}

                    onVoiceRelease={handleVoiceStop}
                    isRecording={isRecording}
                    isProcessingVoice={isProcessingVoice}
                    showRoutePreview={showRoutePreview}
                    showPlaceDetail={showPlaceDetail}
                    voiceNavigationData={voiceNavigationData}
                    onExploreCategory={handleExploreCategory}
                    isExploring={isExploring}
                    selectedExploreCategory={selectedExploreCategory}

                    isNavigationMinimized={isNavigationMinimized}
                    onRestoreNavigation={() => setIsNavigationMinimized(false)}
                    navigationDestination={navigationMode ? selectedDestination : null}
                    routeOrigin={routeOrigin}
                    routeWaypoints={waypoints}
                    routeDestination={selectedDestination}
                    onRouteOriginChange={handleOriginChange}
                    onRouteWaypointsChange={(updated) => {
                        setWaypoints(updated);
                        if (selectedDestination && userLocation) {
                            handleNavigate(setUserLocation, selectedDestination, currentCosting === 'pedestrian' ? 'pedestrian' : 'auto', updated);
                        }
                    }}
                    routeTransportMode={currentCosting === 'pedestrian' ? 'walking' : isFromTaxiSearch ? 'taxi' : 'driving'}
                />
            )}

            {showPlaceDetail && selectedDestination && !showRoutePreview && !navigationMode && (
                <PlaceDetailPreview
                    place={selectedDestination}
                    userLocation={userLocation}
                    onDirections={handleDirectionsFromPlaceDetail}
                    onStart={handleStartFromPlaceDetail}
                    onTaxi={handleTaxiFromPlaceDetail}
                    onContribute={handleContributeFromPlaceDetail}
                    onClose={handleClosePlaceDetail}
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
                    onStartTaxiNavigation={(taxiRoute) => {
                        router.push({
                            pathname: '/taxi/navigation',
                            params: {
                                routeData: JSON.stringify(taxiRoute),
                                simulateMovement: simulateMovement.toString(),
                            },
                        });
                    }}
                    onCancel={handleCancelRoutePreview}
                    destination={selectedDestination}
                    userLocation={userLocation}
                    onTaxiRouteChange={(taxiRoute) => setTaxiRouteData(taxiRoute)}
                    onModeChange={(mode) => {
                        if (mode === 'walking') {
                            setCurrentCosting('pedestrian');
                            if (selectedDestination && userLocation) {
                                handleNavigate(setUserLocation, selectedDestination, 'pedestrian', waypoints);
                            }
                        } else if (mode === 'driving') {
                            setCurrentCosting('auto');
                            if (selectedDestination && userLocation) {
                                handleNavigate(setUserLocation, selectedDestination, 'auto', waypoints);
                            }
                        }
                    }}
                    initialMode={isFromTaxiSearch ? 'taxi' : 'driving'}
                    waypoints={waypoints}
                    onWaypointsChange={(updated) => {
                        setWaypoints(updated);
                        if (selectedDestination && userLocation) {
                            handleNavigate(setUserLocation, selectedDestination, currentCosting === 'pedestrian' ? 'pedestrian' : 'auto', updated);
                        }
                    }}
                    origin={routeOrigin}
                    onOriginChange={handleOriginChange}
                    maneuvers={routeManeuversList}
                    onPreviewPress={handleOpenRoutePreview}
                    routeOptions={allRouteOptions.length > 1 ? allRouteOptions.map(r => ({ distance: r.distance, duration: r.duration })) : undefined}
                    selectedRouteIndex={selectedRouteIndex}
                    onSelectRoute={handleSelectRoute}
                    isFetchingRoute={isNavigating}
                />
            )}

            <IncidentReportSheet
                isVisible={showReportOptions}
                onClose={() => {
                    setShowReportOptions(false);
                    setIncidentReportLocation(null);
                }}
                userLocation={incidentReportLocation ?? userLocation}
                isNavigating={navigationMode}
                onNavigateToReport={() => setIsOnIncidentReportScreen(true)}
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
                disambiguationMessage={voiceDisambiguationMessage}
                isRecording={isRecording}
                onSelectOption={handleOptionSelect}
                onClose={clearVoiceNavigation}
                onPressIn={handleVoiceStart}
                onPressOut={handleVoiceStop}
            />

            <VoiceNavigationModal
                visible={showVoiceModal}
                isRecording={isRecording}
                isProcessing={isProcessingVoice}
                onClose={handleCloseVoiceModal}
                onPressIn={handleVoiceStart}
                onPressOut={handleVoiceStop}
            />

            <ArrivalModal
                visible={showArrivalModal}
                stage={arrivalStage}
                destinationName={selectedDestination?.name}
                onClose={() => setShowArrivalModal(false)}
            />

            {voiceNavStarting && (
                <View
                    className="absolute inset-0 items-center justify-center"
                    style={{ zIndex: 9999, elevation: 20, backgroundColor: appTheme.background }}
                >
                    <ActivityIndicator size="large" color={colors.primary.main} />
                    <Text className="text-base mt-4" style={{ color: appTheme.textSecondary }}>{t('starting-navigation')}</Text>
                </View>
            )}
        </View>
    );
}
