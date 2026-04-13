import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TrafficMap } from '../modules/map';
import { useUserRegistration } from '../modules/register/hooks/useUserRegistration';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SharedLocation } from '../shared/utils/deepLinking';

const GUEST_MODE_KEY = '@traffic_app_guest_mode';

export default function Index() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isChecking, setIsChecking] = useState(true);
  const [sharedLocation, setSharedLocation] = useState<SharedLocation | null>(null);
  const { getStoredUser } = useUserRegistration();

  useEffect(() => {
    checkRegistration();
  }, []);

  useEffect(() => {
    const lat = params.lat || params.sharedLat;
    const lng = params.lng || params.sharedLng;

    if (lat && lng) {
      const location: SharedLocation = {
        lat: parseFloat(lat as string),
        lng: parseFloat(lng as string),
        name: (params.name || params.sharedName) as string || undefined,
        city: (params.city || params.sharedCity) as string || undefined,
        country: (params.country || params.sharedCountry) as string || undefined,
        type: (params.type || params.sharedType) as string || undefined,
      };
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
      router.replace('/register');
      return;
    }

    setIsChecking(false);
  };

  if (isChecking) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#ffa500" />
      </View>
    );
  }

  return <TrafficMap sharedLocation={sharedLocation} />;
}
