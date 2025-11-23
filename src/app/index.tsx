import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { TrafficMap } from '../modules/map';
import { useVehicleRegistration } from '../modules/register/hooks/useVehicleRegistration';

export default function Index() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const { getStoredVehicle } = useVehicleRegistration();

  useEffect(() => {
    checkRegistration();
  }, []);

  const checkRegistration = async () => {
    const vehicle = await getStoredVehicle();

    if (!vehicle) {
      router.replace('/register');
    } else {
      setIsChecking(false);
    }
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
