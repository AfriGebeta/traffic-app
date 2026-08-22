import { Stack, usePathname } from "expo-router";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MapThemeProvider } from '../modules/map/context/MapThemeContext';
import { UserLocationProvider } from '../modules/map/context/UserLocationContext';
import { IncidentFiltersProvider } from '../modules/incidents/context/IncidentFiltersContext';
import { LocationProvider } from '../shared/contexts/LocationContext';
import { ThemeProvider, useTheme } from '../shared/theme/ThemeContext';
import { useEffect, useRef } from 'react';
import * as NavigationBar from 'expo-navigation-bar';
import { AppState, AppStateStatus, Platform, PermissionsAndroid } from 'react-native';
import { useFonts } from 'expo-font';
import { useTelegramDeepLink } from '../shared/hooks/useTelegramDeepLink';
import { useRemoteConfig, RemoteConfigProvider } from '../shared/contexts/RemoteConfigContext';
import { initializeAppCheckSingleton } from '../shared/utils/appCheck';
import { ForceUpdateModal } from '../components/ForceUpdateModal';
import { UpdateBanner } from '../components/UpdateBanner';
import { ToastHost } from '../shared/components/ToastHost';
import telemetryApiService from '../shared/services/telemetry-api.service';
import { dashboardEventsService } from '../shared/services/dashboard-events.service';
import { locationPermissionSettled } from '../shared/utils/permissionSequence';
import './globals.css';
import '../shared/utils/localization/i18n';
import { applyGlobalFont } from '../shared/utils/globalFont';
import { installClientHeaders } from '../shared/utils/clientHeaders';
import { initializeCrashlytics, logBreadcrumb } from '../shared/utils/crashlytics';

import '../modules/navigation/services/nav-foreground-service';

// First thing on the JS thread, so early failures are still captured.
initializeCrashlytics();
applyGlobalFont();
installClientHeaders();

const BACKGROUND_IDLE_MS = 30 * 60 * 1000;

function ThemedNavigationBar() {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    try {
      NavigationBar.setBackgroundColorAsync(colors.background);
      NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
    } catch (error) {

    }
  }, [colors.background, isDark]);

  return null;
}

function AppShell() {
  useTelegramDeepLink();
  const { updateRequired, updateAvailable, latestVersion, storeUrl } = useRemoteConfig();
  const pathname = usePathname();
  const showUpdateBanner = updateAvailable && !updateRequired && pathname === '/';
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    telemetryApiService.trackAppLaunch();

    // cold start
    dashboardEventsService.sessionStart();
    void dashboardEventsService.installOnce();
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      logBreadcrumb(`app state: ${nextState}`);
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
          <ThemeProvider>
            <ThemedNavigationBar />
            <UserLocationProvider>
              <LocationProvider>
                <IncidentFiltersProvider>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                    }}
                  />
                  <ToastHost />
                  <UpdateBanner
                    visible={showUpdateBanner}
                    latestVersion={latestVersion}
                    storeUrl={storeUrl}
                  />
                  <ForceUpdateModal visible={updateRequired} storeUrl={storeUrl} />
                </IncidentFiltersProvider>
              </LocationProvider>
            </UserLocationProvider>
          </ThemeProvider>
        </MapThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'PlusJakartaSans-Regular': require('../../assets/fonts/plus-jakarta-sans/PlusJakartaSans-Regular.ttf'),
    'PlusJakartaSans-Medium': require('../../assets/fonts/plus-jakarta-sans/PlusJakartaSans-Medium.ttf'),
    'PlusJakartaSans-SemiBold': require('../../assets/fonts/plus-jakarta-sans/PlusJakartaSans-SemiBold.ttf'),
    'PlusJakartaSans-Bold': require('../../assets/fonts/plus-jakarta-sans/PlusJakartaSans-Bold.ttf'),
    'PlusJakartaSans-ExtraBold': require('../../assets/fonts/plus-jakarta-sans/PlusJakartaSans-ExtraBold.ttf'),
    'RammettoOne-Regular': require('../../assets/fonts/rammetto-one/RammettoOne-Regular.ttf'),
  });

  useEffect(() => {
    initializeAppCheckSingleton();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <RemoteConfigProvider>
      <AppShell />
    </RemoteConfigProvider>
  );
}
