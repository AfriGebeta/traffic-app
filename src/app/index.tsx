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
    if (params.sharedLat && params.sharedLng) {
      const location: SharedLocation = {
        lat: parseFloat(params.sharedLat as string),
        lng: parseFloat(params.sharedLng as string),
        name: params.sharedName as string || undefined,
        city: params.sharedCity as string || undefined,
        country: params.sharedCountry as string || undefined,
        type: params.sharedType as string || undefined,
      };
      setSharedLocation(location);
    }
  }, [params]);

  const checkRegistration = async () => {
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
