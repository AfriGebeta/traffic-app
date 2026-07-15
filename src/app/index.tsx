import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TrafficMap } from '../modules/map';
import { useUserRegistration } from '../modules/register/hooks/useUserRegistration';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseLocationUrl, type SharedLocation } from '../shared/utils/deepLinking';
import { useTheme } from '../shared/theme/ThemeContext';

const GUEST_MODE_KEY = '@traffic_app_guest_mode';

type RouteParams = ReturnType<typeof useLocalSearchParams>;

function locationFromParams(params: RouteParams): SharedLocation | null {
  const lat = params.lat || params.sharedLat;
  const lng = params.lng || params.sharedLng;

  if (!lat || !lng) return null;

  return {
    lat: parseFloat(lat as string),
    lng: parseFloat(lng as string),
    name: (params.name || params.sharedName) as string || undefined,
    city: (params.city || params.sharedCity) as string || undefined,
    country: (params.country || params.sharedCountry) as string || undefined,
    type: (params.type || params.sharedType) as string || undefined,
  };
}

export default function Index() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors: theme } = useTheme();
  const [isChecking, setIsChecking] = useState(true);

  const [sharedLocation, setSharedLocation] = useState<SharedLocation | null>(() =>
    locationFromParams(params)
  );
  const { getStoredUser } = useUserRegistration();

  useEffect(() => {
    checkRegistration();
  }, []);

  useEffect(() => {
    const applyUrl = (url: string | null) => {
      if (!url) return;
      const location = parseLocationUrl(url);
      if (location) {
        setSharedLocation({ ...location });
      }
    };

    const subscription = Linking.addEventListener('url', ({ url }) => applyUrl(url));
    Linking.getInitialURL().then(applyUrl);

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const location = locationFromParams(params);
    if (location) {
      setSharedLocation(location);
    }
  }, [params.lat, params.lng, params.sharedLat, params.sharedLng, params.name, params.sharedName]);

  const checkRegistration = async () => {
    const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');

    if (!hasSeenOnboarding) {
      router.replace('/onboarding');
      return;
    }

    const user = await getStoredUser();
    const guestMode = await AsyncStorage.getItem(GUEST_MODE_KEY);

    if (!user && !guestMode) {
      router.replace('/telegram-login');
      return;
    }

    setIsChecking(false);
  };

  if (isChecking) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return <TrafficMap sharedLocation={sharedLocation} taxiDestination={params.taxiDestLat && params.taxiDestLng ? {
    lat: parseFloat(params.taxiDestLat as string),
    lng: parseFloat(params.taxiDestLng as string),
    name: params.taxiDestName as string || 'Destination',
  } : undefined} showTaxiMode={params.showTaxiMode === 'true'} />;
}
