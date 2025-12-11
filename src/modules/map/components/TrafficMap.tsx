import React, { useRef, useState, useEffect } from 'react';
import { View, LogBox, TouchableOpacity, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import GebetaMap, { GebetaMapRef } from '../../../lib/gebeta-map/GebetaMap';
import { Input } from '../../../shared/components';
import { ReportBottomSheet } from './ReportBottomSheet';
import { SearchResults } from './SearchResults';
import { useIncidents } from '../../incidents/hooks/useIncidents';
import { getIncidentIconUrl, getIncidentColor, getIncidentIconName } from '../../incidents/utils/incidentIcons';
import { showToast } from '../../../shared/utils/toast';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { navigationService, GeocodingPlace } from '../../navigation/services/navigation.service';

export default function TrafficMap() {
    const mapRef = useRef<GebetaMapRef>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<GeocodingPlace[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchContainer, setShowSearchContainer] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [initialCenter] = useState<[number, number]>([38.7463, 9.0223]);
    const [initialZoom] = useState(12);
    const { incidents, refetch } = useIncidents();
    const params = useLocalSearchParams();
    const { t } = useTranslation();
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchMarkerRef = useRef<any>(null);
    const skipSearchRef = useRef(false);
    const [selectedDestination, setSelectedDestination] = useState<GeocodingPlace | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [navigationMode, setNavigationMode] = useState(false);
    const [currentHeading, setCurrentHeading] = useState(0);
    const locationSubscription = useRef<Location.LocationSubscription | null>(null);
    const routeCoordinates = useRef<[number, number][]>([]);
    const currentRouteIndex = useRef(0);

    useEffect(() => {
        // suppress MapLibre sprite loading warnings
        LogBox.ignoreLogs([
            'MapLibre error',
            'Failed to load sprite',
        ]);

        getUserLocation();
    }, []);

    // refresh when returning from incident report
    useEffect(() => {
        if (params.refresh === 'true') {
            refetch();
        }
    }, [params.refresh, refetch]);

    const getUserLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                });
                setUserLocation({
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                });
            }
        } catch (error) {
            console.log('Error getting location:', error);
        }
    };

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

    const findClosestPointOnRoute = (userLat: number, userLng: number): number => {
        let closestIndex = 0;
        let minDistance = Infinity;

        routeCoordinates.current.forEach((coord, index) => {
            const [lng, lat] = coord;
            const distance = Math.sqrt(
                Math.pow(lat - userLat, 2) + Math.pow(lng - userLng, 2)
            );
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = index;
            }
        });

        return closestIndex;
    };

    const startLocationTracking = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showToast.error('Permission Denied', 'Location permission is required for navigation');
                return;
            }

            //start watching location with heading
            locationSubscription.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 1000,
                    distanceInterval: 5,
                },
                (location) => {
                    const newLocation = {
                        lat: location.coords.latitude,
                        lng: location.coords.longitude,
                    };
                    setUserLocation(newLocation);

                    //update heading
                    if (location.coords.heading !== null && location.coords.heading !== undefined) {
                        setCurrentHeading(location.coords.heading);
                    }

                    //update camera
                    if (navigationMode) {
                        const heading = location.coords.heading !== null && location.coords.heading !== undefined
                            ? location.coords.heading
                            : 0;

                        mapRef.current?.flyTo({
                            center: [location.coords.longitude, location.coords.latitude],
                            zoom: 18,
                            duration: 500,
                            pitch: 60,
                            heading: heading,
                        });

                        //update route index
                        currentRouteIndex.current = findClosestPointOnRoute(
                            location.coords.latitude,
                            location.coords.longitude
                        );

                        //update route to show latest
                        updateRemainingRoute();
                    }
                }
            );
        } catch (error) {
            console.error('Error starting location tracking:', error);
        }
    };

    const stopLocationTracking = () => {
        if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
        }
    };



    const updateRemainingRoute = () => {
        if (currentRouteIndex.current >= routeCoordinates.current.length - 1) {
            return;
        }

        
        const remainingCoordinates = routeCoordinates.current.slice(currentRouteIndex.current);

        if (remainingCoordinates.length > 1) {
            const routeGeoJSON = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: remainingCoordinates
                }
            };

            mapRef.current?.displayRoute(routeGeoJSON, {
                color: '#3B82F6',
                width: 5,
                opacity: 0.8
            });
        }
    };



    const handleNavigate = async () => {
        if (!userLocation || !selectedDestination) {
            showToast.error('Navigation Error', 'User location or destination not available');
            return;
        }

        console.log('Starting navigation...');
        console.log('Origin:', [userLocation.lat, userLocation.lng]);
        console.log('Destination:', [selectedDestination.latitude, selectedDestination.longitude]);

        setIsNavigating(true);
        try {
            const navigationData = await navigationService.getNavigation({
                origin: [userLocation.lat, userLocation.lng],
                destination: [selectedDestination.latitude, selectedDestination.longitude]
            });

            console.log('Navigation data received:', navigationData);

            if (navigationData && navigationData.direction) {
                
                const routeGeoJSON = {
                    type: 'Feature',
                    properties: {
                        distance: navigationData.totalDistance,
                        duration: navigationData.timetaken
                    },
                    geometry: {
                        type: 'LineString',
                        coordinates: navigationData.direction.map(coord => [coord[1], coord[0]]) // lng lat
                    }
                };

                console.log('Route GeoJSON:', JSON.stringify(routeGeoJSON, null, 2));

                
                mapRef.current?.displayRoute(routeGeoJSON, {
                    color: '#3B82F6',
                    width: 5,
                    opacity: 0.8
                });

                
                const distanceKm = (navigationData.totalDistance / 1000).toFixed(2);
                const durationMin = (navigationData.timetaken / 60).toFixed(0);
                showToast.success('Route Found', `${distanceKm} km • ${durationMin} min`);

                
                routeCoordinates.current = navigationData.direction.map(coord => [coord[1], coord[0]]);

                
                setNavigationMode(true);

                //set camera
                if (userLocation) {
                    mapRef.current?.flyTo({
                        center: [userLocation.lng, userLocation.lat],
                        zoom: 18,
                        duration: 1500,
                        pitch: 60,
                        heading: currentHeading,
                    });
                }

               
                startLocationTracking();
            } else {
                console.log('No navigation data or direction');
                showToast.error('Navigation Error', 'No route data received');
            }
        } catch (error) {
            console.error('Navigation error:', error);
            showToast.error('Navigation Error', 'Could not calculate route');
        } finally {
            setIsNavigating(false);
        }
    };

    const handleStopNavigation = () => {
        setNavigationMode(false);
        stopLocationTracking();
        mapRef.current?.clearRoute();
        setSelectedDestination(null);

        //reset camera
        if (userLocation) {
            mapRef.current?.flyTo({
                center: [userLocation.lng, userLocation.lat],
                zoom: 15,
                duration: 1000,
                pitch: 0,
                heading: 0,
            });
        }
    };

    // cleanup
    useEffect(() => {
        return () => {
            stopLocationTracking();
        };
    }, []);

    const handleClearRoute = () => {
        mapRef.current?.clearRoute();
        setSelectedDestination(null);
    };

    const handleMapClick = (lngLat: [number, number]) => {
        // Add a default marker
        // const marker = mapRef.current?.addMarker();
        // const mapInstance = mapRef.current?.getMapInstance();
        // if (marker && mapInstance) {
        // marker.setLngLat(lngLat).addTo(mapInstance);

        // mapRef.current?.addImageMarker(
        //     lngLat,
        //     "https://cdn-icons-png.flaticon.com/512/3081/3081559.png",
        //     [40, 40],
        //     () => alert("Marker clicked!"),
        //     10,
        //     "<b>Custom Marker Popup</b>"
        // );

    }
    // };


    const handleMapLoaded = () => {
        // small delay
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

    //adding markers when loaded
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

            {navigationMode && (
                <View className="absolute top-12 left-4 right-4">
                    <View className="bg-blue-600 rounded-2xl shadow-lg p-4">
                        <View className="flex-row items-center justify-between">
                            <View className="flex-1">
                                <Text className="text-white text-lg font-bold">Navigating...</Text>
                                <Text className="text-blue-100 text-sm">{selectedDestination?.name}</Text>
                            </View>
                            <TouchableOpacity
                                className="bg-white rounded-full p-2"
                                onPress={handleStopNavigation}
                            >
                                <Ionicons name="close" size={20} color="#2563EB" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
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
                            onClear={() => {
                                setSearchQuery('');
                                setSearchResults([]);
                                setShowSearchContainer(false);
                            }}
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
                    {selectedDestination && !navigationMode && (
                        <View className="mt-2 bg-white rounded-2xl shadow-lg p-3 flex-row items-center justify-between">
                            <View className="flex-1">
                                <Text className="text-sm font-semibold text-gray-900">{selectedDestination.name}</Text>
                                <Text className="text-xs text-gray-500">{selectedDestination.type}</Text>
                            </View>
                            <View className="flex-row gap-2">
                                <TouchableOpacity
                                    className="bg-blue-500 rounded-full px-4 py-2 flex-row items-center gap-1.5"
                                    onPress={handleNavigate}
                                    disabled={isNavigating}
                                >
                                    <Ionicons name="navigate" size={16} color="#FFFFFF" />
                                    <Text className="text-xs font-medium text-white">
                                        {isNavigating ? 'Loading...' : 'Navigate'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className="bg-gray-200 rounded-full p-2"
                                    onPress={handleClearRoute}
                                >
                                    <Ionicons name="close" size={16} color="#6B7280" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}





                    <View className="flex-row gap-2 mt-2 justify-around">
                        <TouchableOpacity
                            className="bg-white rounded-full px-3 py-2 shadow-md flex-row items-center gap-1.5"
                            onPress={() => showToast.info(t('coming-soon'), t('gas-station'))}
                        >
                            <Ionicons name="water" size={16} color="#EF4444" />
                            <Text className="text-xs font-medium text-gray-700">{t('gas-station')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="bg-white rounded-full px-3 py-2 shadow-md flex-row items-center gap-1.5"
                            onPress={() => showToast.info(t('coming-soon'), t('taxi-station'))}
                        >
                            <Ionicons name="car" size={16} color="#3B82F6" />
                            <Text className="text-xs font-medium text-gray-700">{t('taxi-station')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="bg-white rounded-full px-3 py-2 shadow-md flex-row items-center gap-1.5"
                            onPress={() => showToast.info(t('coming-soon'), t('repair-shop'))}
                        >
                            <Ionicons name="construct" size={16} color="#F59E0B" />
                            <Text className="text-xs font-medium text-gray-700">{t('repair-shop')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="bg-white rounded-full px-3 py-2 shadow-md flex-row items-center gap-1.5"
                            onPress={() => showToast.info(t('coming-soon'), t('restaurants'))}
                        >
                            <Ionicons name="fast-food-outline" size={16} color="#EC4899" />
                            <Text className="text-xs font-medium text-gray-700">{t('restaurants')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <ReportBottomSheet userLocation={userLocation} onIncidentReported={refetch} />

            {/* for debug - if backend not responding*/}
            {/* <View className="absolute bottom-32 left-4 right-4 bg-white rounded-xl shadow-lg p-4 max-h-48">
                <Text className="font-bold text-lg mb-2">
                    Incidents ({incidents.length})
                </Text>
                <ScrollView>
                    {incidents.length === 0 ? (
                        <Text className="text-gray-500">No incidents found</Text>
                    ) : (
                        incidents.map((incident) => (
                            <View key={incident.id} className="mb-2 pb-2 border-b border-gray-200">
                                <Text className="font-semibold capitalize">{incident.type}</Text>
                                <Text className="text-sm text-gray-600">{incident.description}</Text>
                                <Text className="text-xs text-gray-400">
                                    {incident.lat.toFixed(4)}, {incident.lng.toFixed(4)}
                                </Text>
                            </View>
                        ))
                    )}
                </ScrollView>
            </View> */}
        </View>
    );
}