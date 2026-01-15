import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { TrafficMap } from '../modules/map';
import { useUserRegistration } from '../modules/register/hooks/useUserRegistration';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_MODE_KEY = '@traffic_app_guest_mode';

export default function Index() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const { getStoredUser } = useUserRegistration();

  useEffect(() => {
    checkRegistration();
  }, []);

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

  return <TrafficMap />;
}
