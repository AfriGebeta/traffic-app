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
    const [simulateMovement, setSimulateMovement] = useState(false);

    const locationSubscription = useRef<Location.LocationSubscription | null>(null);
    const simulationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
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
                width: 7,
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

            // stop existing subs
            if (locationSubscription.current) {
                locationSubscription.current.remove();
            }

            console.log('starting location tracking for navigation...');

            locationSubscription.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 2000,     
                    distanceInterval: 3,   
                    mayShowUserSettingsDialog: true,
                },
                (location) => {
                    console.log('Navigation location update:', location.coords.latitude, location.coords.longitude);

                    const heading = location.coords.heading !== null && location.coords.heading !== undefined
                        ? location.coords.heading
                        : 0;

                    setCurrentHeading(heading);

                    // update camera when nav
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
            );

            console.log('Location tracking started successfully');
            showToast.success('location tracking started')
        } catch (error) {
            console.error('Error starting location tracking:', error);
            showToast.error('Location Error', 'Could not start location tracking');
        }
    };

    const stopLocationTracking = () => {
        if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
        }
    };

    const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        const toDeg = (rad: number) => (rad * 180) / Math.PI;

        const dLng = toRad(lng2 - lng1);
        const y = Math.sin(dLng) * Math.cos(toRad(lat2));
        const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);

        let bearing = toDeg(Math.atan2(y, x));
        return (bearing + 360) % 360;
    };

    const startSimulation = (setUserLocation: (location: { lat: number; lng: number }) => void) => {
        currentRouteIndex.current = 0;

        simulationInterval.current = setInterval(() => {
            if (currentRouteIndex.current >= routeCoordinates.current.length) {
                stopSimulation();
                showToast.success('Arrived', 'You have reached your destination!');
                handleStopNavigation();
                return;
            }

            const [lng, lat] = routeCoordinates.current[currentRouteIndex.current];

            let heading = 0;
            if (currentRouteIndex.current < routeCoordinates.current.length - 1) {
                const [nextLng, nextLat] = routeCoordinates.current[currentRouteIndex.current + 1];
                heading = calculateBearing(lat, lng, nextLat, nextLng);
            }

            setUserLocation({ lat, lng });
            setCurrentHeading(heading);

            mapRef.current?.flyTo({
                center: [lng, lat],
                zoom: 18,
                duration: 500,
                pitch: 60,
                heading: heading,
            });

            updateRemainingRoute();
            currentRouteIndex.current += 1;
        }, 1000);
    };

    const stopSimulation = () => {
        if (simulationInterval.current) {
            clearInterval(simulationInterval.current);
            simulationInterval.current = null;
        }
    };

    const handleNavigate = async (setUserLocation?: (location: { lat: number; lng: number }) => void) => {
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

                if (simulateMovement && setUserLocation) {
                    startSimulation(setUserLocation);
                } else {
                    startLocationTracking();
                }
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
        stopSimulation();
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
            stopSimulation();
        };
    }, []);

    return {
        selectedDestination,
        setSelectedDestination,
        isNavigating,
        navigationMode,
        currentHeading,
        simulateMovement,
        setSimulateMovement,
        handleNavigate,
        handleStopNavigation,
        handleClearRoute,
    };
};
