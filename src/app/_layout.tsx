import { Stack } from "expo-router";
import Toast from 'react-native-toast-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MapThemeProvider } from '../modules/map/context/MapThemeContext';
import { UserLocationProvider } from '../modules/map/context/UserLocationContext';
import { IncidentFiltersProvider } from '../modules/incidents/context/IncidentFiltersContext';
import { LocationProvider } from '../shared/contexts/LocationContext';
import { useEffect, useRef } from 'react';
import * as NavigationBar from 'expo-navigation-bar';
import { AppState, AppStateStatus, Platform, PermissionsAndroid } from 'react-native';
import { useTelegramDeepLink } from '../shared/hooks/useTelegramDeepLink';
import { useRemoteConfig, RemoteConfigProvider } from '../shared/contexts/RemoteConfigContext';
import { initializeAppCheckSingleton } from '../shared/utils/appCheck';
import { ForceUpdateModal } from '../components/ForceUpdateModal';
import telemetryApiService from '../shared/services/telemetry-api.service';
import { dashboardEventsService } from '../shared/services/dashboard-events.service';
import { locationPermissionSettled } from '../shared/utils/permissionSequence';
import './globals.css';
import '../shared/utils/localization/i18n';

import '../modules/navigation/services/nav-foreground-service';

const BACKGROUND_IDLE_MS = 30 * 60 * 1000;

function AppShell() {
  useTelegramDeepLink();
  const { updateRequired } = useRemoteConfig();
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        NavigationBar.setBackgroundColorAsync('#ffffff');
        NavigationBar.setButtonStyleAsync('dark');
      } catch (error) {

      }
    }

    telemetryApiService.trackAppLaunch();

    // cold start
    dashboardEventsService.sessionStart();
    void dashboardEventsService.installOnce();
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAtRef.current = Date.now();
      } else if (nextState === 'active') {
        const backgroundedAt = backgroundedAtRef.current;
        if (backgroundedAt !== null && Date.now() - backgroundedAt >= BACKGROUND_IDLE_MS) {
          dashboardEventsService.sessionStart();
        }
        backgroundedAtRef.current = null;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, 30000));
      Promise.race([locationPermissionSettled, timeout]).then(() => {
        PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        ).catch(() => undefined);
      });
    }
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

export default function RootLayout() {
  useEffect(() => {
    initializeAppCheckSingleton();
  }, []);

  return (
    <RemoteConfigProvider>
      <AppShell />
    </RemoteConfigProvider>
  );
}
