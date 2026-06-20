import { Stack } from "expo-router";
import Toast from 'react-native-toast-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MapThemeProvider } from '../modules/map/context/MapThemeContext';
import { UserLocationProvider } from '../modules/map/context/UserLocationContext';
import { IncidentFiltersProvider } from '../modules/incidents/context/IncidentFiltersContext';
import { LocationProvider } from '../shared/contexts/LocationContext';
import { useEffect } from 'react';
import * as NavigationBar from 'expo-navigation-bar';
import { Platform } from 'react-native';
import { useTelegramDeepLink } from '../shared/hooks/useTelegramDeepLink';
import { useForceUpdate } from '../shared/hooks/useForceUpdate';
import { ForceUpdateModal } from '../components/ForceUpdateModal';
import telemetryApiService from '../shared/services/telemetry-api.service';
import './globals.css';
import '../shared/utils/localization/i18n';

export default function RootLayout() {
  useTelegramDeepLink();
  const updateRequired = useForceUpdate();

  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        NavigationBar.setBackgroundColorAsync('#ffffff');
        NavigationBar.setButtonStyleAsync('dark');
      } catch (error) {

      }
    }

    telemetryApiService.trackAppLaunch();
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <MapThemeProvider>
          <UserLocationProvider>
            <LocationProvider>
              <IncidentFiltersProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                  }}
                />
                <Toast />
                <ForceUpdateModal visible={updateRequired} />
              </IncidentFiltersProvider>
            </LocationProvider>
          </UserLocationProvider>
        </MapThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
