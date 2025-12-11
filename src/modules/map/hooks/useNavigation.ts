import { useState, useRef, useEffect } from 'react';
import * as Location from 'expo-location';
import { GebetaMapRef } from '../../../lib/gebeta-map/GebetaMap';
import { navigationService, GeocodingPlace } from '../../navigation/services/navigation.service';
import { showToast } from '../../../shared/utils/toast';

export const useNavigation = (
    mapRef: React.RefObject<GebetaMapRef | null>,
    userLocation: { lat: number; lng: number } | null
) => {
    const [selectedDestination, setSelectedDestination] = useState<GeocodingPlace | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [navigationMode, setNavigationMode] = useState(false);
    const [currentHeading, setCurrentHeading] = useState(0);

    const locationSubscription = useRef<Location.LocationSubscription | null>(null);
    const routeCoordinates = useRef<[number, number][]>([]);
    const currentRouteIndex = useRef(0);

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

    const startLocationTracking = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showToast.error('Permission Denied', 'Location permission is required for navigation');
                return;
            }

            locationSubscription.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 1000,
                    distanceInterval: 5,
                },
                (location) => {
                    const heading = location.coords.heading !== null && location.coords.heading !== undefined
                        ? location.coords.heading
                        : 0;

                    setCurrentHeading(heading);

                    if (navigationMode) {
                        mapRef.current?.flyTo({
                            center: [location.coords.longitude, location.coords.latitude],
                            zoom: 18,
                            duration: 500,
                            pitch: 60,
                            heading: heading,
                        });

                        currentRouteIndex.current = findClosestPointOnRoute(
                            location.coords.latitude,
                            location.coords.longitude
                        );

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

    const handleNavigate = async () => {
        if (!userLocation || !selectedDestination) {
            showToast.error('Navigation Error', 'User location or destination not available');
            return;
        }

        setIsNavigating(true);
        try {
            const navigationData = await navigationService.getNavigation({
                origin: [userLocation.lat, userLocation.lng],
                destination: [selectedDestination.latitude, selectedDestination.longitude]
            });

            if (navigationData && navigationData.direction) {
                const routeGeoJSON = {
                    type: 'Feature',
                    properties: {
                        distance: navigationData.totalDistance,
                        duration: navigationData.timetaken
                    },
                    geometry: {
                        type: 'LineString',
                        coordinates: navigationData.direction.map(coord => [coord[1], coord[0]])
                    }
                };

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

    const handleClearRoute = () => {
        mapRef.current?.clearRoute();
        setSelectedDestination(null);
    };

    useEffect(() => {
        return () => {
            stopLocationTracking();
        };
    }, []);

    return {
        selectedDestination,
        setSelectedDestination,
        isNavigating,
        navigationMode,
        currentHeading,
        handleNavigate,
        handleStopNavigation,
        handleClearRoute,
    };
};
