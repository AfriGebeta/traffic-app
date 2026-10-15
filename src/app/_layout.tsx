import { Stack, router, usePathname } from "expo-router";
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
import { PointsPopupHost } from '../modules/campaigns/components/PointsPopupHost';
import { refreshCampaigns } from '../modules/campaigns/store/campaignStore';
import { showToast } from '../shared/utils/toast';
import { onSessionExpired } from '../shared/services/auth-session';
import { onUserRestricted, UserRestriction } from '../shared/utils/apiErrors';
import { resetHomeOnboarding } from '../modules/places/utils/homeOnboarding';
import i18n from '../shared/utils/localization/i18n';
import telemetryApiService from '../shared/services/telemetry-api.service';
import { dashboardEventsService } from '../shared/services/dashboard-events.service';
import { locationPermissionSettled } from '../shared/utils/permissionSequence';
import './globals.css';
import { applyGlobalFont } from '../shared/utils/globalFont';
import { installClientHeaders } from '../shared/utils/clientHeaders';
import { initializeCrashlytics, logBreadcrumb } from '../shared/utils/crashlytics';
import { useOrientationPolicy } from '../shared/layout/useOrientationPolicy';
import { createScreenLayout } from '../shared/layout/ResponsiveScreen';

import '../modules/navigation/services/nav-foreground-service';

// First thing on the JS thread, so early failures are still captured.
initializeCrashlytics();
applyGlobalFont();
installClientHeaders();

const BACKGROUND_IDLE_MS = 30 * 60 * 1000;
const RESTRICTED_TOAST_COOLDOWN_MS = 30 * 1000;

const restrictionMessage = ({ scope, expiresAt }: UserRestriction): string => {
  if (scope?.toLowerCase() === 'account') return i18n.t('account-suspended');
  const until = expiresAt ? new Date(expiresAt) : null;
  if (until && !Number.isNaN(until.getTime())) {
    return i18n.t('reporting-paused-until', {
      date: until.toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }),
    });
  }
  return i18n.t('reporting-paused');
};

const NAVIGATION_PATHS = [
  '/navigation/route-preview',
  '/taxi/navigation',
  '/taxi/route-preview',
  '/free-drive',
];
const isNavigationPath = (path: string) => NAVIGATION_PATHS.some((p) => path.startsWith(p));

const rootScreenLayout = createScreenLayout({
  fullBleed: [
    'index',
    'free-drive',
    'incident-map-picker',
    'navigation/route-preview',
    'neighborhoods/bounding-box',
    'share',
    'telegram-auth',
    'places',
    'rules',
    'taxi',
  ],
  forms: [
    'login',
    'register',
    'verify-email',
    'complete-profile',
    'telegram-login',
    'select-language',
    'edit-profile',
    'incident-report',
  ],
});

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
  useOrientationPolicy();
  const { updateRequired, updateAvailable, latestVersion, storeUrl } = useRemoteConfig();
  const pathname = usePathname();
  const showUpdateBanner = updateAvailable && !updateRequired && pathname === '/';
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    telemetryApiService.trackAppLaunch();

    // cold start
    dashboardEventsService.sessionStart();
    void refreshCampaigns();
    void dashboardEventsService.installOnce();
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      logBreadcrumb(`app state: ${nextState}`);
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAtRef.current = Date.now();
      } else if (nextState === 'active') {
        void refreshCampaigns();
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

  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const loginRedirectPendingRef = useRef(false);

  const redirectToLogin = () => {
    loginRedirectPendingRef.current = false;
    showToast(i18n.t('session-expired'));
    router.push('/login');
  };

  useEffect(() => {
    return onSessionExpired(() => {
      void resetHomeOnboarding();
      if (isNavigationPath(pathnameRef.current)) {
        logBreadcrumb('auth: session expired during navigation, deferring login redirect');
        loginRedirectPendingRef.current = true;
        return;
      }
      redirectToLogin();
    });
  }, []);

  // toast only, never a modal or redirect, so it's safe during navigation
  useEffect(() => {
    let lastShownAt = 0;
    return onUserRestricted((restriction) => {
      if (Date.now() - lastShownAt < RESTRICTED_TOAST_COOLDOWN_MS) return;
      lastShownAt = Date.now();
      logBreadcrumb(`api: user restricted (${restriction.scope ?? '-'})`);
      showToast(restrictionMessage(restriction));
    });
  }, []);

  useEffect(() => {
    if (loginRedirectPendingRef.current && !isNavigationPath(pathname)) {
      redirectToLogin();
    }
  }, [pathname]);

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
                    screenLayout={rootScreenLayout}
                  />
                  <ToastHost />
                  <PointsPopupHost />
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
