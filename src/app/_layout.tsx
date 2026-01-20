import { Stack } from "expo-router";
import Toast from 'react-native-toast-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MapThemeProvider } from '../modules/map/context/MapThemeContext';
import './globals.css';
import '../shared/utils/localization/i18n';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <MapThemeProvider>
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          />
          <Toast />
        </MapThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
